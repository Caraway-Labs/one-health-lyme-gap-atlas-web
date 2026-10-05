import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "@/lib/api-mutator";

import { reviewScopeMetadataFixture } from "./fixtures/review-scope-api-fixtures";

type Session = { user: { id: string } } | null;

const auth = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: Session) => void>();
  return {
    listeners,
    push: vi.fn<(href: string) => void>(),
    session: { user: { id: "user-a" } } as Session,
    signOut:
      vi.fn<
        (options?: {
          scope?: string;
        }) => Promise<{ error: { message: string } | null }>
      >(),
  };
});

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push: auth.push }),
    }) as unknown as Partial<typeof import("next/navigation")>
);

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: auth.session },
        error: null,
      }),
      onAuthStateChange: (
        // Supabase reports auth changes through a subscription callback.
        // eslint-disable-next-line promise/prefer-await-to-callbacks -- auth subscription has no async equivalent
        callback: (event: string, session: Session) => void
      ) => {
        auth.listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                auth.listeners.delete(callback);
              },
            },
          },
        };
      },
      signOut: (options?: { scope?: string }) => auth.signOut(options),
    },
  }),
}));

vi.mock(import("@/generated/atlas"), () => ({
  confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
    vi.fn<() => Promise<never>>(),
  createPrivacyRequestV1MePrivacyRequestsPost: vi.fn<() => Promise<never>>(),
  downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
    vi.fn<() => Promise<never>>(),
  getProfileV1MeProfileGet: vi.fn<() => Promise<never>>(),
  metadataV1AtlasMetadataGet: vi.fn<() => Promise<never>>(),
  saveProfileV1MeProfilePut: vi.fn<() => Promise<never>>(),
}));

import { resetSavedProfileCoordinationForTests } from "@/features/ux-reset/profile/saved-profile-client";
import { ResetSettingsExperience } from "@/features/ux-reset/settings/reset-settings-experience";
import {
  getProfileV1MeProfileGet,
  metadataV1AtlasMetadataGet,
  saveProfileV1MeProfilePut,
} from "@/generated/atlas";

function asResponse<T>(value: T): never {
  return value as never;
}

function profileFor(userId: string) {
  if (userId === "user-a") {
    return {
      job_title: "Epi",
      organization: "CDPHE",
      role: null,
      state_code: "CO",
    };
  }
  return {
    job_title: "Director",
    organization: "Other",
    role: null,
    state_code: "NY",
  };
}

function switchSession(userId: string | null) {
  auth.session = userId ? { user: { id: userId } } : null;
  for (const listener of auth.listeners) {
    listener(userId ? "SIGNED_IN" : "SIGNED_OUT", auth.session);
  }
}

function renderSettings(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = render(<ResetSettingsExperience />, { wrapper });
  return { client, ...view };
}

describe("saved profile account isolation", () => {
  beforeEach(() => {
    resetSavedProfileCoordinationForTests();
    auth.session = { user: { id: "user-a" } };
    auth.listeners.clear();
    auth.push.mockReset();
    auth.signOut.mockReset();
    vi.mocked(getProfileV1MeProfileGet).mockReset();
    vi.mocked(saveProfileV1MeProfilePut).mockReset();
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
    vi.mocked(getProfileV1MeProfileGet).mockImplementation(
      asResponse(async () => ({
        data: {
          profile: profileFor(auth.session?.user.id ?? "user-b"),
        },
        status: 200,
      }))
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("loads account B after a cached remount instead of account A", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = renderSettings(client);
    expect(
      ((await screen.findByTestId("settings-organization")) as HTMLInputElement)
        .value
    ).toBe("CDPHE");
    first.unmount();
    switchSession("user-b");
    renderSettings(client);
    expect(
      ((await screen.findByDisplayValue("Other")) as HTMLInputElement).value
    ).toBe("Other");
    expect(screen.queryByDisplayValue("CDPHE")).toBeNull();
    expect(screen.queryByDisplayValue("Epi")).toBeNull();
  });

  it("drops a late account A read after switching to account B", async () => {
    const gate = Promise.withResolvers<boolean>();
    vi.mocked(getProfileV1MeProfileGet).mockImplementation(
      asResponse(async () => {
        const userId = auth.session?.user.id;
        if (userId === "user-a") {
          await gate.promise;
          return {
            data: { profile: profileFor("user-a") },
            status: 200,
          };
        }
        return {
          data: { profile: profileFor("user-b") },
          status: 200,
        };
      })
    );
    renderSettings();
    await vi.waitFor(() =>
      expect(getProfileV1MeProfileGet).toHaveBeenCalledWith(
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    switchSession("user-b");
    gate.resolve(true);
    expect(
      ((await screen.findByDisplayValue("Other")) as HTMLInputElement).value
    ).toBe("Other");
    expect(screen.queryByDisplayValue("CDPHE")).toBeNull();
  });

  it("does not send account A fields when account B saves", async () => {
    renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "SECRET" } });
    switchSession("user-b");
    expect(
      ((await screen.findByDisplayValue("Other")) as HTMLInputElement).value
    ).toBe("Other");
    expect(screen.queryByDisplayValue("SECRET")).toBeNull();
    vi.mocked(saveProfileV1MeProfilePut).mockResolvedValue(
      asResponse({
        data: { profile: profileFor("user-b") },
        status: 200,
      })
    );
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await waitFor(() =>
      expect(saveProfileV1MeProfilePut).toHaveBeenCalledWith(
        expect.objectContaining({
          job_title: "Director",
          organization: "Other",
          state_code: "NY",
        })
      )
    );
  });

  it("discards an in-flight save from account A after switching to B", async () => {
    const gate = Promise.withResolvers<boolean>();
    vi.mocked(saveProfileV1MeProfilePut).mockImplementation(
      asResponse(async () => {
        await gate.promise;
        return { data: { profile: profileFor("user-a") }, status: 200 };
      })
    );
    renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "SECRET" } });
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await vi.waitFor(() =>
      expect(saveProfileV1MeProfilePut).toHaveBeenCalledOnce()
    );
    switchSession("user-b");
    gate.resolve(true);
    expect(
      ((await screen.findByDisplayValue("Other")) as HTMLInputElement).value
    ).toBe("Other");
    expect(screen.queryByDisplayValue("SECRET")).toBeNull();
    expect(screen.queryByDisplayValue("CDPHE")).toBeNull();
  });

  it("applies the newer save when an older one is still in flight across remount", async () => {
    const gate = Promise.withResolvers<boolean>();
    vi.mocked(saveProfileV1MeProfilePut).mockImplementation(
      asResponse(
        async (body: {
          organization?: string | null;
          state_code?: string | null;
        }) => {
          if (body.organization === "Older") {
            await gate.promise;
          }
          return {
            data: {
              profile: {
                ...profileFor("user-a"),
                organization: body.organization ?? null,
                state_code: body.state_code ?? null,
              },
            },
            status: 200,
          };
        }
      )
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = renderSettings(client);
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "Older" } });
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await vi.waitFor(() =>
      expect(saveProfileV1MeProfilePut).toHaveBeenCalledOnce()
    );
    first.unmount();
    renderSettings(client);
    const nextOrganization = await screen.findByTestId("settings-organization");
    fireEvent.change(nextOrganization, { target: { value: "Newer" } });
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await Promise.resolve();
    expect(saveProfileV1MeProfilePut).toHaveBeenCalledOnce();
    gate.resolve(true);
    await waitFor(() =>
      expect(saveProfileV1MeProfilePut).toHaveBeenCalledTimes(2)
    );
    expect(saveProfileV1MeProfilePut).toHaveBeenLastCalledWith(
      expect.objectContaining({ organization: "Newer", state_code: "CO" })
    );
    expect(
      (await screen.findByDisplayValue("Newer")) as HTMLInputElement
    ).toBeTruthy();
  });

  it("clears the editor when an expired session returns 401", async () => {
    const { client } = renderSettings();
    await screen.findByDisplayValue("CDPHE");
    vi.mocked(getProfileV1MeProfileGet).mockRejectedValue(
      new AtlasApiError("expired", "/v1/me/profile", 401, null)
    );
    await client.refetchQueries();
    await expect(
      screen.findByTestId("settings-session-expired")
    ).resolves.toBeTruthy();
    expect(screen.queryByTestId("settings-organization")).toBeNull();
  });

  it("keeps the page when sign-out returns an error and the session remains", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    renderSettings();
    await screen.findByRole("button", { name: "Sign out" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("settings-sign-out-notice")).textContent
    ).toContain("still active");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.push).not.toHaveBeenCalled();
  });

  it("leaves after a sign-out error once the local session is gone", async () => {
    auth.signOut.mockImplementation(async () => {
      switchSession(null);
      return { error: { message: "remote failed" } };
    });
    renderSettings();
    await screen.findByRole("button", { name: "Sign out" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.push).toHaveBeenCalledWith("/"));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
