import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteChrome } from "@/components/route-chrome";
import {
  ANALYTICS_PREFERENCE_KEY,
  writeBrowserAnalyticsPreference,
} from "@/lib/analytics-consent";
import {
  ANALYTICS_SCHEMA_VERSION,
  analyticsControlAttributes,
  atlasAnalytics,
  routeIdForPathname,
} from "@/lib/atlas-analytics";
import { routeMountsAnalyticsClient } from "@/lib/navigation";

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

vi.mock(import("@/components/app-shell"), () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock(import("@/components/chat-launcher"), () => ({
  ChatLauncher: () => <div />,
}));

vi.mock(import("@/components/feedback-dialog"), () => ({
  FeedbackProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock(import("@/components/public-layout"), () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

let pathname = "/explore";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

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

function interactionCount(): number {
  return amplitude.track.mock.calls.filter(
    (call) => call[0] === "atlas_ui_interaction"
  ).length;
}

describe("professional shell analytics client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    pathname = "/explore";
    atlasAnalytics.stop();
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

  it("mounts one client on a professional route and keeps it across the shell", async () => {
    expect({
      askAtlas: routeMountsAnalyticsClient("/askatlas"),
      callback: routeMountsAnalyticsClient("/auth/callback"),
      compare: routeMountsAnalyticsClient("/compare"),
      designSystem: routeMountsAnalyticsClient("/design-system"),
      docs: routeMountsAnalyticsClient("/docs/evidence-and-uncertainty"),
      explore: routeMountsAnalyticsClient("/explore"),
      feed: routeMountsAnalyticsClient("/app/feed"),
      frontPorch: routeMountsAnalyticsClient("/"),
      privacy: routeMountsAnalyticsClient("/privacy"),
      provenance: routeMountsAnalyticsClient("/data-provenance"),
      resources: routeMountsAnalyticsClient("/resources"),
      searchApi: routeMountsAnalyticsClient("/api/search"),
      settings: routeMountsAnalyticsClient("/app/settings"),
    }).toStrictEqual({
      askAtlas: true,
      callback: false,
      compare: true,
      designSystem: false,
      docs: false,
      explore: true,
      feed: true,
      frontPorch: false,
      privacy: false,
      provenance: true,
      resources: true,
      searchApi: false,
      settings: true,
    });

    writeBrowserAnalyticsPreference("granted");
    pathname = "/overview";
    const view = render(
      <RouteChrome>
        <button
          type="button"
          {...analyticsControlAttributes("hero_explore_counties")}
        >
          Explore counties
        </button>
      </RouteChrome>
    );
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("legacy Atlas did not start analytics");
      }
    });
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");

    pathname = "/explore";
    view.rerender(
      <RouteChrome>
        <button
          type="button"
          {...analyticsControlAttributes("hero_explore_counties")}
        >
          Explore counties
        </button>
      </RouteChrome>
    );
    await waitFor(() => {
      const routeViews = amplitude.track.mock.calls.filter(
        (call) => call[0] === "atlas_route_viewed"
      );
      if (routeViews.length < 2) {
        throw new Error("professional route did not record a route view");
      }
    });

    fireEvent.click(view.getByRole("button", { name: "Explore counties" }));

    expect({
      initCalls: amplitude.init.mock.calls.length,
      interactions: interactionCount(),
      optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
      resetCalls: amplitude.reset.mock.calls.length,
      session: sessionStorage.getItem("AMP_session"),
      unsent: localStorage.getItem("amplitude_unsent"),
    }).toStrictEqual({
      initCalls: 1,
      interactions: 1,
      optOut: false,
      resetCalls: 0,
      session: "vendor-session",
      unsent: "vendor-local",
    });
    expect(
      amplitude.track.mock.calls.some(
        (call) =>
          call[0] === "atlas_route_viewed" &&
          call[1]?.route_id === routeIdForPathname("/explore") &&
          call[1]?.schema_version === ANALYTICS_SCHEMA_VERSION
      )
    ).toBeTruthy();

    writeBrowserAnalyticsPreference("denied");
    dispatchPreferenceStorage(ANALYTICS_PREFERENCE_KEY);
    const interactionsAfterOptOut = interactionCount();
    fireEvent.click(view.getByRole("button", { name: "Explore counties" }));

    expect({
      initCalls: amplitude.init.mock.calls.length,
      interactions: interactionCount(),
      optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
      session: sessionStorage.getItem("AMP_session"),
      unsent: localStorage.getItem("amplitude_unsent"),
    }).toStrictEqual({
      initCalls: 1,
      interactions: interactionsAfterOptOut,
      optOut: true,
      session: null,
      unsent: null,
    });
  });

  it("keeps a stored grant and vendor storage on a fresh professional route", async () => {
    writeBrowserAnalyticsPreference("granted");
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");
    pathname = "/explore";
    render(
      <RouteChrome>
        <p>Atlas Explorer</p>
      </RouteChrome>
    );
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("professional route did not start analytics");
      }
    });
    expect({
      optOut: amplitude.setOptOut.mock.lastCall?.[0] ?? null,
      resetCalls: amplitude.reset.mock.calls.length,
      session: sessionStorage.getItem("AMP_session"),
      unsent: localStorage.getItem("amplitude_unsent"),
    }).toStrictEqual({
      optOut: false,
      resetCalls: 0,
      session: "vendor-session",
      unsent: "vendor-local",
    });
  });

  it("does not start analytics on an excluded route", () => {
    writeBrowserAnalyticsPreference("granted");
    pathname = "/docs/evidence-and-uncertainty";
    render(
      <RouteChrome>
        <p>Docs</p>
      </RouteChrome>
    );
    expect(amplitude.init).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();
  });
});
