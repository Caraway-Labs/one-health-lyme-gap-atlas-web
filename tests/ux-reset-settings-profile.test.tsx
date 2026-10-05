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

import { reviewScopeMetadataFixture } from "./fixtures/review-scope-api-fixtures";

const { getProfile, saveProfile } = vi.hoisted(() => ({
  getProfile: vi.fn<() => Promise<never>>(),
  saveProfile: vi.fn<() => Promise<never>>(),
}));

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push: vi.fn<() => void>() }),
    }) as unknown as Partial<typeof import("next/navigation")>
);

vi.mock(import("@/generated/atlas"), () => ({
  confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
    vi.fn<() => Promise<never>>(),
  createPrivacyRequestV1MePrivacyRequestsPost: vi.fn<() => Promise<never>>(),
  downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
    vi.fn<() => Promise<never>>(),
  getProfileV1MeProfileGet: getProfile,
  metadataV1AtlasMetadataGet: vi.fn<() => Promise<never>>(),
  saveProfileV1MeProfilePut: saveProfile,
}));

import { resetSavedProfileCoordinationForTests } from "@/features/ux-reset/profile/saved-profile-client";
import { ResetSettingsExperience } from "@/features/ux-reset/settings/reset-settings-experience";
import { settingsMetadataQueryKey } from "@/features/ux-reset/settings/use-settings-state-options";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

function asResponse<T>(value: T): never {
  return value as never;
}

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(<ResetSettingsExperience />, { wrapper }) };
}

describe("Settings profile form", () => {
  beforeEach(() => {
    resetSavedProfileCoordinationForTests();
    getProfile.mockReset();
    saveProfile.mockReset();
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("does not turn a failed profile load into a blank authoritative form", async () => {
    getProfile.mockResolvedValue(asResponse({ data: null, status: 503 }));
    renderSettings();
    await waitFor(() =>
      expect(
        screen.getByTestId("settings-default-jurisdiction").textContent
      ).toContain("Unable to load your default jurisdiction")
    );
    expect(screen.queryByTestId("settings-profile-form")).toBeNull();
    expect(screen.queryByTestId("settings-organization")).toBeNull();
    expect(
      screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-default-jurisdiction='error']")
    ).toBeTruthy();
    expect(
      screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-jurisdiction-completion='unavailable']")
    ).toBeTruthy();
  });

  it("keeps optional fields empty and blocks a save until a jurisdiction is chosen", async () => {
    getProfile.mockResolvedValue(
      asResponse({ data: { profile: null }, status: 200 })
    );
    renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    expect((organization as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByTestId("settings-job-title") as HTMLInputElement).value
    ).toBe("");
    expect(
      screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-default-jurisdiction='unselected']")
    ).toBeTruthy();
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    expect(saveProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Nothing was saved"
    );
  });

  it("retains edits when a save fails and confirms them on retry", async () => {
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: null,
            role: null,
            state_code: null,
          },
        },
        status: 200,
      })
    );
    saveProfile.mockRejectedValueOnce(
      new AtlasApiError("unavailable", "/v1/me/profile", 503, "req-4")
    );
    renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "CDPHE" } });
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "could not confirm that save. Your edits are still here. The last confirmed default stays in place until Atlas can check it. Reference: req-4."
    );
    expect((organization as HTMLInputElement).value).toBe("CDPHE");
    expect(
      screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-default-jurisdiction='ALL']")
    ).toBeTruthy();

    saveProfile.mockResolvedValueOnce(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: "CDPHE",
            role: null,
            state_code: null,
          },
        },
        status: 200,
      })
    );
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await waitFor(() => {
      const saved = screen.getByTestId("settings-save-notice");
      const confirmed = screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-default-jurisdiction='ALL']");
      expect({
        confirmed: Boolean(confirmed),
        role: saved.getAttribute("role"),
        text: saved.textContent,
      }).toStrictEqual({
        confirmed: true,
        role: "status",
        text: expect.stringContaining(
          "New Review sessions will start with the United States."
        ),
      });
    });
    expect(
      (screen.getByTestId("settings-organization") as HTMLInputElement).value
    ).toBe("CDPHE");
  });

  it("keeps an unresolved save when a later retry sends a different body", async () => {
    let stored: {
      job_title: string | null;
      organization: string | null;
      role: null;
      state_code: string | null;
    } = {
      job_title: null,
      organization: null,
      role: null,
      state_code: null,
    };
    getProfile.mockImplementation(
      asResponse(async () => ({ data: { profile: stored }, status: 200 }))
    );
    saveProfile.mockImplementation(
      asResponse(async (body: { organization?: string | null }) => {
        if (body.organization === "First") {
          throw new AtlasApiError("dropped", "/v1/me/profile", 503, "req-lost");
        }
        return {
          data: {
            profile: {
              job_title: null,
              organization: body.organization ?? null,
              role: null,
              state_code: null,
            },
          },
          status: 200,
        };
      })
    );
    const { client } = renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "First" } });
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "could not confirm that save"
    );
    fireEvent.change(screen.getByTestId("settings-organization"), {
      target: { value: "Second" },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "could not confirm that save"
    );
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await waitFor(() =>
      expect({
        calls: saveProfile.mock.calls.length,
        notice: screen.getByTestId("settings-save-notice").textContent,
        organization: (
          screen.getByTestId("settings-organization") as HTMLInputElement
        ).value,
      }).toStrictEqual({
        calls: 2,
        notice: expect.stringContaining("could not confirm that save"),
        organization: "Second",
      })
    );
    stored = { ...stored, organization: "First" };
    await client.refetchQueries();
    await waitFor(() =>
      expect({
        notice: screen.getByTestId("settings-save-notice").textContent,
        organization: (
          screen.getByTestId("settings-organization") as HTMLInputElement
        ).value,
      }).toStrictEqual({
        notice: expect.stringContaining("could not confirm that save"),
        organization: "Second",
      })
    );
  });

  it("shows an unsupported saved state as incomplete for Review too", async () => {
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: "Dept",
            role: null,
            state_code: "MA",
          },
        },
        status: 200,
      })
    );
    renderSettings();
    const readout = await screen.findByTestId("settings-default-jurisdiction");
    await waitFor(() => {
      const node = readout.querySelector<HTMLElement>(
        "[data-default-jurisdiction]"
      );
      expect({
        attribute: node?.dataset.defaultJurisdiction,
        completion: node?.dataset.jurisdictionCompletion,
        source: node?.dataset.reviewStartSource,
        start: node?.dataset.reviewStartScope,
      }).toStrictEqual({
        attribute: "unrecognized",
        completion: "incomplete",
        source: "national-fallback",
        start: "ALL",
      });
    });
  });

  it("does not confirm a saved state while the state list is unavailable", async () => {
    vi.mocked(metadataV1AtlasMetadataGet).mockRejectedValue(
      new AtlasApiError("down", "/v1/atlas/metadata", 503, null)
    );
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: null,
            role: null,
            state_code: "CO",
          },
        },
        status: 200,
      })
    );
    renderSettings();
    const readout = await screen.findByTestId("settings-default-jurisdiction");
    await waitFor(() => {
      const node = readout.querySelector<HTMLElement>(
        "[data-default-jurisdiction]"
      );
      expect(node?.dataset.defaultJurisdiction).toBe("unverified");
    });
    const settled = readout.querySelector<HTMLElement>(
      "[data-default-jurisdiction]"
    );
    expect(settled?.dataset.jurisdictionCompletion).toBe("unavailable");
    expect(settled?.dataset.reviewStartSource).toBe("national-fallback");
  });

  it("resyncs a pristine state draft after the state list recovers", async () => {
    vi.mocked(metadataV1AtlasMetadataGet).mockRejectedValueOnce(
      new AtlasApiError("down", "/v1/atlas/metadata", 503, null)
    );
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: "CDPHE",
            role: null,
            state_code: "CO",
          },
        },
        status: 200,
      })
    );
    const { client } = renderSettings();
    expect(
      ((await screen.findByTestId("settings-organization")) as HTMLInputElement)
        .value
    ).toBe("CDPHE");
    expect(
      screen.getByTestId("settings-jurisdiction-select").textContent
    ).toContain("Choose United States or a state");
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
    await client.refetchQueries({ queryKey: settingsMetadataQueryKey });
    await waitFor(() =>
      expect({
        jurisdiction: screen.getByTestId("settings-jurisdiction-select")
          .textContent,
        readout: screen
          .getByTestId("settings-default-jurisdiction")
          .querySelector("[data-default-jurisdiction='CO']"),
      }).toStrictEqual({
        jurisdiction: expect.stringContaining("Colorado (CO)"),
        readout: expect.any(Element),
      })
    );
    fireEvent.change(screen.getByTestId("settings-organization"), {
      target: { value: "Edited" },
    });
    saveProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: "Edited",
            role: null,
            state_code: "CO",
          },
        },
        status: 200,
      })
    );
    fireEvent.submit(screen.getByTestId("settings-profile-form"));
    await waitFor(() =>
      expect({
        alert: screen.queryByRole("alert"),
        called: (
          saveProfile.mock.calls.at(-1) as [Record<string, unknown>] | undefined
        )?.[0],
      }).toStrictEqual({
        alert: null,
        called: expect.objectContaining({
          organization: "Edited",
          state_code: "CO",
        }),
      })
    );
  });

  it("keeps a dirty organization edit when the state list recovers", async () => {
    vi.mocked(metadataV1AtlasMetadataGet).mockRejectedValueOnce(
      new AtlasApiError("down", "/v1/atlas/metadata", 503, null)
    );
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: null,
            organization: "CDPHE",
            role: null,
            state_code: "CO",
          },
        },
        status: 200,
      })
    );
    const { client } = renderSettings();
    const organization = await screen.findByTestId("settings-organization");
    fireEvent.change(organization, { target: { value: "Edited" } });
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
    await client.refetchQueries({ queryKey: settingsMetadataQueryKey });
    await waitFor(() =>
      expect(
        screen
          .getByTestId("settings-default-jurisdiction")
          .querySelector("[data-default-jurisdiction='CO']")
      ).toBeTruthy()
    );
    expect(
      (screen.getByTestId("settings-organization") as HTMLInputElement).value
    ).toBe("Edited");
  });
});
