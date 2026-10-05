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
  return render(<ResetSettingsExperience />, { wrapper });
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
      "saved default is unchanged. Reference: req-4."
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
});
