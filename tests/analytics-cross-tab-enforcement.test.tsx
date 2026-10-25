import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsClient } from "@/components/analytics-client";
import {
  ANALYTICS_PREFERENCE_KEY,
  writeBrowserAnalyticsPreference,
} from "@/lib/analytics-consent";
import {
  analyticsControlAttributes,
  atlasAnalytics,
  trackRouteView,
} from "@/lib/atlas-analytics";
import { getRouteShell, routeMountsAnalyticsClient } from "@/lib/navigation";

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

function ConsentedTab() {
  return (
    <>
      {routeMountsAnalyticsClient(pathname) ? <AnalyticsClient /> : null}
      {getRouteShell(pathname) === "none" ? (
        <p>Professional shell</p>
      ) : (
        <button
          type="button"
          {...analyticsControlAttributes("hero_explore_counties")}
        >
          Explore counties
        </button>
      )}
    </>
  );
}

function dispatchPreferenceStorage(key: string | null): void {
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: key ? localStorage.getItem(key) : null,
        storageArea: localStorage,
      })
    );
  });
}

function sdkSnapshot() {
  return {
    initCalls: amplitude.init.mock.calls.length,
    optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
    resetCalls: amplitude.reset.mock.calls.length,
    session: sessionStorage.getItem("AMP_session"),
    trackCalls: amplitude.track.mock.calls.length,
    unsent: localStorage.getItem("amplitude_unsent"),
  };
}

describe("cross-tab analytics enforcement", () => {
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
    atlasAnalytics.stop();
    vi.unstubAllEnvs();
  });

  it("shuts the SDK down when another tab withdraws, including after the professional shell", async () => {
    writeBrowserAnalyticsPreference("granted");
    const view = render(<ConsentedTab />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("consented tab did not start analytics");
      }
    });
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");
    localStorage.setItem("unrelated-preference", "kept");
    dispatchPreferenceStorage("unrelated-preference");
    const tracksAfterStart = amplitude.track.mock.calls.length;
    fireEvent.click(view.getByRole("button", { name: "Explore counties" }));
    const whileRunning = sdkSnapshot();

    writeBrowserAnalyticsPreference("denied");
    dispatchPreferenceStorage(ANALYTICS_PREFERENCE_KEY);
    fireEvent.click(view.getByRole("button", { name: "Explore counties" }));
    trackRouteView("/overview");
    const afterWithdrawal = sdkSnapshot();

    pathname = "/app";
    view.rerender(<ConsentedTab />);
    trackRouteView("/app");

    expect({
      afterShell: sdkSnapshot(),
      afterWithdrawal,
      whileRunning,
    }).toStrictEqual({
      afterShell: {
        initCalls: 1,
        optOut: true,
        resetCalls: whileRunning.resetCalls + 1,
        session: null,
        trackCalls: whileRunning.trackCalls,
        unsent: null,
      },
      afterWithdrawal: {
        initCalls: 1,
        optOut: true,
        resetCalls: whileRunning.resetCalls + 1,
        session: null,
        trackCalls: whileRunning.trackCalls,
        unsent: null,
      },
      whileRunning: {
        initCalls: 1,
        optOut: false,
        resetCalls: whileRunning.resetCalls,
        session: "vendor-session",
        trackCalls: tracksAfterStart + 1,
        unsent: "vendor-local",
      },
    });
  });

  it("keeps the SDK running when another tab clears the preference", async () => {
    writeBrowserAnalyticsPreference("granted");
    const view = render(<ConsentedTab />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("consented tab did not start analytics");
      }
    });
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");
    const tracksBeforeClear = amplitude.track.mock.calls.length;
    localStorage.removeItem(ANALYTICS_PREFERENCE_KEY);
    dispatchPreferenceStorage(null);
    trackRouteView("/overview");
    pathname = "/app";
    view.rerender(<ConsentedTab />);
    trackRouteView("/app");

    const afterClear = sdkSnapshot();
    expect(afterClear).toMatchObject({
      initCalls: 1,
      optOut: false,
      resetCalls: 0,
      session: "vendor-session",
      unsent: "vendor-local",
    });
    expect(afterClear.trackCalls).toBeGreaterThan(tracksBeforeClear);
    expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBeNull();
  });

  it("starts analytics when storage works and no preference is stored", async () => {
    render(<ConsentedTab />);
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("default-on visit did not start analytics");
      }
    });
    expect({
      optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
      preference: localStorage.getItem(ANALYTICS_PREFERENCE_KEY),
      tracked: amplitude.track.mock.calls.length > 0,
    }).toStrictEqual({
      optOut: false,
      preference: null,
      tracked: true,
    });
  });

  it("does not start analytics when Do Not Track is on", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "doNotTrack");
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });
    try {
      const view = render(<ConsentedTab />);
      fireEvent.click(view.getByRole("button", { name: "Explore counties" }));
      expect(sdkSnapshot()).toStrictEqual({
        initCalls: 0,
        optOut: null,
        resetCalls: 0,
        session: null,
        trackCalls: 0,
        unsent: null,
      });
    } finally {
      if (descriptor) {
        Object.defineProperty(navigator, "doNotTrack", descriptor);
      } else {
        Reflect.deleteProperty(navigator, "doNotTrack");
      }
    }
  });
});
