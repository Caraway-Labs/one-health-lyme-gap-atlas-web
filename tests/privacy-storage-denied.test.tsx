import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reviewScopeMetadataFixture } from "./fixtures/review-scope-api-fixtures";

const amplitude = vi.hoisted(() => ({
  init: vi.fn<(apiKey: string, options: Record<string, unknown>) => unknown>(),
  reset: vi.fn<() => unknown>(),
  setOptOut: vi.fn<(optOut: boolean) => unknown>(),
  track:
    vi.fn<
      (eventType: string, properties: Record<string, unknown>) => unknown
    >(),
}));

const { getProfile, saveProfile } = vi.hoisted(() => ({
  getProfile: vi.fn<() => Promise<never>>(),
  saveProfile: vi.fn<() => Promise<never>>(),
}));

vi.mock(import("@amplitude/analytics-browser"), () => amplitude as never);

vi.mock(
  import("next/navigation"),
  () =>
    ({
      usePathname: () => "/privacy",
      useRouter: () => ({ push: vi.fn<() => void>() }),
    }) as unknown as Partial<typeof import("next/navigation")>
);

vi.mock(import("@/generated/atlas"), () => ({
  confirmPrivacyRequest: vi.fn<() => Promise<never>>(),
  createPrivacyRequest: vi.fn<() => Promise<never>>(),
  downloadPrivacyExport: vi.fn<() => Promise<never>>(),
  getProfile,
  getAtlasMetadata: vi.fn<() => Promise<never>>(),
  updateProfile: saveProfile,
}));

import { AnalyticsClient } from "@/components/analytics-client";
import { PrivacyPreferences } from "@/components/privacy-preferences";
import { PublicLayout } from "@/components/public-layout";
import { ResetSettingsExperience } from "@/features/ux-reset/settings/reset-settings-experience";
import { getAtlasMetadata } from "@/generated/atlas";
import { atlasAnalytics } from "@/lib/atlas-analytics";

const STORAGE_UNAVAILABLE =
  "Atlas cannot save a preference in this browser, so optional analytics remain off.";

function asResponse<T>(value: T): never {
  return value as never;
}

async function withDeniedLocalStorage(run: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException(
        "Failed to read the 'localStorage' property from 'Window'",
        "SecurityError"
      );
    },
  });
  try {
    await run();
  } finally {
    if (descriptor) {
      Object.defineProperty(window, "localStorage", descriptor);
    } else {
      Reflect.deleteProperty(window, "localStorage");
    }
  }
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

describe("denied localStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfile.mockReset();
    saveProfile.mockReset();
    vi.mocked(getAtlasMetadata).mockResolvedValue(
      asResponse({ data: reviewScopeMetadataFixture, status: 200 })
    );
    getProfile.mockResolvedValue(
      asResponse({
        data: {
          profile: {
            job_title: "Epidemiologist",
            organization: "State health department",
            role: "state_level_epidemiologist",
            state_code: null,
          },
        },
        status: 200,
      })
    );
    vi.stubEnv(
      "NEXT_PUBLIC_AMPLITUDE_API_KEY",
      "00000000000000000000000000000000"
    );
  });

  afterEach(() => {
    cleanup();
    atlasAnalytics.stop();
    vi.unstubAllEnvs();
  });

  it("mounts the Settings section and dialog without throwing", async () => {
    await withDeniedLocalStorage(async () => {
      render(<PrivacyPreferences presentation="section" />);
      fireEvent.click(
        screen.getByRole("button", { name: "Allow optional analytics" })
      );
      expect({
        mounted: screen.getByTestId("settings-privacy-preferences").tagName,
        status: screen.getByRole("status").textContent,
      }).toStrictEqual({
        mounted: "SECTION",
        status: STORAGE_UNAVAILABLE,
      });

      cleanup();
      render(<PrivacyPreferences />);
      fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Turn off optional analytics" })
      );
      expect({
        dialog: screen
          .getByRole("dialog", { name: "Privacy settings" })
          .getAttribute("role"),
        status: screen.getByRole("status").textContent,
      }).toStrictEqual({
        dialog: "dialog",
        status: STORAGE_UNAVAILABLE,
      });
    });
  });

  it("keeps Settings profile and account controls usable", async () => {
    await withDeniedLocalStorage(async () => {
      renderSettings();
      const organization = (await screen.findByTestId(
        "settings-organization"
      )) as HTMLInputElement;
      fireEvent.click(
        screen.getByRole("button", { name: "Allow optional analytics" })
      );
      expect({
        account: screen.getByTestId("settings-account-controls").tagName,
        exportData: screen.getByRole("button", { name: "Export my data" })
          .tagName,
        jobTitle: (screen.getByTestId("settings-job-title") as HTMLInputElement)
          .value,
        organization: organization.value,
        profile: screen.getByTestId("settings-profile-form").tagName,
        profileWrites: saveProfile.mock.calls.length,
        signOut: screen.getByRole("button", { name: "Sign out" }).tagName,
        status: screen.getByRole("status").textContent,
      }).toStrictEqual({
        account: "SECTION",
        exportData: "BUTTON",
        jobTitle: "Epidemiologist",
        organization: "State health department",
        profile: "FORM",
        profileWrites: 0,
        signOut: "BUTTON",
        status: STORAGE_UNAVAILABLE,
      });
    });
  });

  it("keeps the public page and footer usable without starting analytics", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await withDeniedLocalStorage(async () => {
        render(
          <>
            <AnalyticsClient />
            <PublicLayout>
              <main>
                <h1>Public evidence</h1>
              </main>
            </PublicLayout>
          </>
        );

        fireEvent.click(
          screen.getByRole("button", { name: "Privacy settings" })
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Allow optional analytics" })
        );
        expect({
          dialog: screen
            .getByRole("dialog", { name: "Privacy settings" })
            .getAttribute("role"),
          status: screen.getByRole("status").textContent,
        }).toStrictEqual({
          dialog: "dialog",
          status: STORAGE_UNAVAILABLE,
        });
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect({
          about: screen
            .getByRole("link", {
              name: "One Health Atlas by Caraway Labs (opens in a new tab)",
            })
            .getAttribute("href"),
          heading: screen.getByRole("heading", { name: "Public evidence" })
            .textContent,
          initCalls: amplitude.init.mock.calls.length,
          networkEgress: fetchSpy.mock.calls.filter((call) =>
            String(call[0]).includes("amplitude")
          ).length,
          privacy: screen
            .getByRole("link", { name: "Privacy" })
            .getAttribute("href"),
          trackCalls: amplitude.track.mock.calls.length,
        }).toStrictEqual({
          about: "/about/caraway-labs",
          heading: "Public evidence",
          initCalls: 0,
          networkEgress: 0,
          privacy: "/privacy",
          trackCalls: 0,
        });
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
