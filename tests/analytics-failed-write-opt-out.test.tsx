import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalyticsClient,
  notifyAnalyticsPreferenceChanged,
} from "@/components/analytics-client";
import { PrivacyPreferences } from "@/components/privacy-preferences";
import {
  ANALYTICS_PREFERENCE_KEY,
  readBrowserAnalyticsPreference,
  writeBrowserAnalyticsPreference,
} from "@/lib/analytics-consent";
import {
  analyticsControlAttributes,
  atlasAnalytics,
  trackRouteView,
} from "@/lib/atlas-analytics";
import { getRouteShell } from "@/lib/navigation";

const amplitude = vi.hoisted(() => ({
  init: vi.fn<(apiKey: string, options: Record<string, unknown>) => unknown>(),
  reset: vi.fn<() => unknown>(),
  setOptOut: vi.fn<(optOut: boolean) => unknown>(),
  track:
    vi.fn<
      (eventType: string, properties: Record<string, unknown>) => unknown
    >(),
}));

vi.mock(import("@amplitude/analytics-browser"), () => amplitude as never);

let pathname = "/overview";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

const CANNOT_SAVE =
  "Atlas cannot save a preference in this browser, so optional analytics remain off.";

function SessionHarness() {
  return (
    <>
      {getRouteShell(pathname) === "none" ? null : <AnalyticsClient />}
      <PrivacyPreferences presentation="section" />
      <button
        type="button"
        {...analyticsControlAttributes("hero_explore_counties")}
      >
        Explore counties
      </button>
    </>
  );
}

function sdkSnapshot() {
  return {
    initCalls: amplitude.init.mock.calls.length,
    optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
    resetCalls: amplitude.reset.mock.calls.length,
    trackCalls: amplitude.track.mock.calls.length,
  };
}

function storedPreference(): string | null {
  return localStorage.getItem(ANALYTICS_PREFERENCE_KEY);
}

describe("failed analytics preference writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    pathname = "/overview";
    vi.stubEnv(
      "NEXT_PUBLIC_AMPLITUDE_API_KEY",
      "00000000000000000000000000000000"
    );
  });

  afterEach(() => {
    cleanup();
    const written = writeBrowserAnalyticsPreference("granted");
    notifyAnalyticsPreferenceChanged({ attempted: "granted", written });
    atlasAnalytics.stop();
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("stops the SDK for the session when an opt-out cannot be persisted", async () => {
    const view = render(<SessionHarness />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("default-on visit did not start analytics");
      }
    });
    const tracksBeforeOptOut = amplitude.track.mock.calls.length;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Turn off optional analytics" })
      );
      fireEvent.click(view.getByRole("button", { name: "Explore counties" }));
      trackRouteView("/overview");
      const afterOptOut = sdkSnapshot();

      pathname = "/app";
      view.rerender(<SessionHarness />);
      trackRouteView("/app");
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: null,
            newValue: null,
            storageArea: localStorage,
          })
        );
      });
      const whileUnmounted = sdkSnapshot();
      const statusAfterClear = screen.getByRole("status").textContent;

      pathname = "/overview";
      view.rerender(<SessionHarness />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.click(view.getByRole("button", { name: "Explore counties" }));
      trackRouteView("/overview");
      fireEvent.click(
        screen.getByRole("button", { name: "Allow optional analytics" })
      );

      expect({
        afterFailedAllow: sdkSnapshot(),
        afterOptOut,
        preference: storedPreference(),
        rawConsent: readBrowserAnalyticsPreference(),
        status: screen.getByRole("status").textContent,
        statusAfterClear,
        whileUnmounted,
      }).toStrictEqual({
        afterFailedAllow: afterOptOut,
        afterOptOut: {
          initCalls: 1,
          optOut: true,
          resetCalls: 1,
          trackCalls: tracksBeforeOptOut,
        },
        preference: null,
        rawConsent: "not-decided",
        status: CANNOT_SAVE,
        statusAfterClear: CANNOT_SAVE,
        whileUnmounted: afterOptOut,
      });
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("stops the SDK when a denial cannot replace a stored grant", async () => {
    writeBrowserAnalyticsPreference("granted");
    const view = render(<SessionHarness />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("stored grant did not start analytics");
      }
    });
    const granted = storedPreference();
    const tracksBeforeOptOut = amplitude.track.mock.calls.length;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Turn off optional analytics" })
      );
      pathname = "/privacy";
      view.rerender(<SessionHarness />);
      trackRouteView("/privacy");
      fireEvent.click(view.getByRole("button", { name: "Explore counties" }));

      expect({
        preference: storedPreference(),
        rawConsent: readBrowserAnalyticsPreference(),
        sdk: sdkSnapshot(),
        status: screen.getByRole("status").textContent,
      }).toStrictEqual({
        preference: granted,
        rawConsent: "granted",
        sdk: {
          initCalls: 1,
          optOut: true,
          resetCalls: 1,
          trackCalls: tracksBeforeOptOut,
        },
        status: CANNOT_SAVE,
      });
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("follows a persisted cross-tab grant after an opt-out that could not be saved", async () => {
    render(<SessionHarness />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("default-on visit did not start analytics");
      }
    });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Turn off optional analytics" })
      );
    } finally {
      Storage.prototype.setItem = setItem;
    }
    expect(sdkSnapshot()).toMatchObject({ initCalls: 1, optOut: true });

    expect(writeBrowserAnalyticsPreference("granted")).toBe("granted");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_PREFERENCE_KEY,
          newValue: storedPreference(),
          storageArea: localStorage,
        })
      );
    });
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 2) {
        throw new Error("persisted cross-tab grant did not restart analytics");
      }
    });
    expect({
      optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      optOut: false,
      status:
        "Optional analytics are allowed for this browser until this preference expires or you change it.",
    });
  });
});
