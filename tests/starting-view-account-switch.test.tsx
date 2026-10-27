import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reviewScopeMetadataFixture } from "./fixtures/review-scope-api-fixtures";

type Session = { access_token: string; user: { id: string } } | null;
type AuthListener = (event: string, session: Session) => void;

const auth = vi.hoisted(() => {
  const listeners = new Set<AuthListener>();
  return {
    listeners,
    session: {
      access_token: "token-user-a",
      user: { id: "user-a" },
    } as Session,
  };
});

vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ replace: vi.fn<(path: string) => void>() }),
    }) as never
);

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => authClient,
}));

vi.mock(import("@/generated/atlas"), () => ({
  getProfile: vi.fn<() => Promise<never>>(),
  getAtlasMetadata: vi.fn<() => Promise<never>>(),
  updateProfile: vi.fn<() => Promise<never>>(),
}));

import StartingViewPage from "@/app/auth/starting-view/page";
import { resetProfileSessionGenerationForTests } from "@/features/ux-reset/profile/profile-session";
import { resetSavedProfileCoordinationForTests } from "@/features/ux-reset/profile/saved-profile-client";
import { getProfile, getAtlasMetadata, updateProfile } from "@/generated/atlas";

const authClient = {
  auth: {
    getSession: async () => ({
      data: { session: auth.session },
      error: null,
    }),
    onAuthStateChange: (
      // Supabase reports auth changes through a subscription callback.
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- auth subscription has no async equivalent
      callback: AuthListener
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
  },
};

const accountAProfile = {
  job_title: "Analyst",
  organization: "Account A lab",
  role: "state_level_epidemiologist",
  starting_view_version: null,
  state_code: null,
};

const accountBProfile = {
  job_title: "Nurse",
  organization: "Account B clinic",
  role: "general_public_citizen",
  starting_view_version: null,
  state_code: null,
};

function asResponse<T>(value: T): never {
  return value as never;
}

/**
 * auth-js 2.116.0 `_notifyAllSubscribers` starts every subscriber callback
 * before awaiting the group. Synchronous callbacks therefore run in
 * registration order before the next paint.
 */
async function notifySubscribers(event: string, session: Session) {
  const pending: Promise<unknown>[] = [];
  for (const listener of auth.listeners) {
    pending.push(Promise.resolve(listener(event, session)));
  }
  await Promise.all(pending);
}

function authorizationOf(init: unknown): string | undefined {
  if (!init || typeof init !== "object" || !("headers" in init)) {
    return undefined;
  }
  const headers = init.headers;
  if (
    !headers ||
    typeof headers !== "object" ||
    !("Authorization" in headers)
  ) {
    return undefined;
  }
  return typeof headers.Authorization === "string"
    ? headers.Authorization
    : undefined;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<StartingViewPage />, { wrapper });
}

describe("starting view account switch", () => {
  const releaseAccountBRead = Promise.withResolvers<boolean>();
  const releaseAccountAWrite = Promise.withResolvers<boolean>();

  beforeEach(() => {
    resetSavedProfileCoordinationForTests();
    resetProfileSessionGenerationForTests();
    auth.listeners.clear();
    auth.session = { access_token: "token-user-a", user: { id: "user-a" } };
    vi.mocked(getAtlasMetadata).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
    vi.mocked(getProfile).mockImplementation(
      asResponse(async (init: { headers?: { Authorization?: string } }) => {
        if (authorizationOf(init) === "Bearer token-user-b") {
          await releaseAccountBRead.promise;
          return { data: { profile: accountBProfile }, status: 200 };
        }
        return { data: { profile: accountAProfile }, status: 200 };
      })
    );
    vi.mocked(updateProfile).mockImplementation(
      asResponse(async () => {
        await releaseAccountAWrite.promise;
        return {
          data: {
            profile: { ...accountAProfile, starting_view_version: 1 },
          },
          status: 200,
        };
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("does not send account A fields with account B credentials", async () => {
    renderPage();
    await act(async () => {
      await notifySubscribers("INITIAL_SESSION", auth.session);
    });
    fireEvent.click(
      await screen.findByRole("radio", { name: "United States" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Atlas Explorer" })
    );
    await vi.waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          job_title: "Analyst",
          organization: "Account A lab",
        }),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-user-a" },
        })
      )
    );

    auth.session = { access_token: "token-user-b", user: { id: "user-b" } };
    await act(async () => {
      await notifySubscribers("SIGNED_IN", auth.session);
    });
    expect({
      checking: screen.getByRole("status").textContent,
      choice: screen.queryByRole("radio", { name: "United States" }),
    }).toStrictEqual({
      checking: "Checking your starting view…",
      choice: null,
    });

    releaseAccountAWrite.resolve(true);
    releaseAccountBRead.resolve(true);
    const unitedStates = await screen.findByRole("radio", {
      name: "United States",
    });
    const calls = vi.mocked(updateProfile).mock.calls;
    const sentAccountAFieldsAsAccountB = calls.some(([body, init]) => {
      const profile = body as { job_title?: string; organization?: string };
      return (
        authorizationOf(init) === "Bearer token-user-b" &&
        (profile.organization === "Account A lab" ||
          profile.job_title === "Analyst")
      );
    });
    expect({
      calls: calls.length,
      keptAccountAChoice: (unitedStates as HTMLInputElement).checked,
      sentAccountAFieldsAsAccountB,
    }).toStrictEqual({
      calls: 1,
      keptAccountAChoice: false,
      sentAccountAFieldsAsAccountB: false,
    });
  });
});
