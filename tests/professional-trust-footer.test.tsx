import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsClient } from "@/components/analytics-client";
import { SiteFooter } from "@/components/site-footer";
import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";
import { atlasAnalytics } from "@/lib/atlas-analytics";
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

let pathname = "/";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
}));

function LegacyAtlasOrWorkspace() {
  if (getRouteShell(pathname) === "none") {
    return <ProfessionalTrustFooter />;
  }
  return (
    <>
      <AnalyticsClient />
      <SiteFooter />
    </>
  );
}

describe("professional trust footer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    pathname = "/";
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

  it("opens the public Privacy link and privacy settings from the footer", () => {
    pathname = "/app";
    render(<ProfessionalTrustFooter />);

    const privacy = screen.getByRole("link", { name: "Privacy" });
    expect(privacy.getAttribute("href")).toBe("/privacy");
    expect(privacy.getAttribute("target")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    const dialog = screen.getByRole("dialog", { name: "Privacy settings" });
    expect(dialog.textContent).toContain(
      "Optional analytics are off until you make a choice."
    );
    expect(
      screen.getByRole("button", { name: "Keep optional analytics off" })
    ).toBeTruthy();
  });

  it("stops a legacy Atlas session when the professional footer withdraws consent", async () => {
    const view = render(<LegacyAtlasOrWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Allow optional analytics" })
    );
    await waitFor(() => {
      if (amplitude.init.mock.calls.length !== 1) {
        throw new Error("legacy Atlas did not start analytics");
      }
    });
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");

    pathname = "/app";
    view.rerender(<LegacyAtlasOrWorkspace />);
    if (amplitude.setOptOut.mock.lastCall?.[0] !== false) {
      throw new Error(
        "leaving legacy Atlas stopped analytics before withdrawal"
      );
    }
    if (
      sessionStorage.getItem("AMP_session") !== "vendor-session" ||
      localStorage.getItem("amplitude_unsent") !== "vendor-local"
    ) {
      throw new Error("vendor storage was cleared before withdrawal");
    }

    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Keep optional analytics off" })
    );

    expect(amplitude.setOptOut).toHaveBeenLastCalledWith(true);
    expect(amplitude.reset).toHaveBeenCalledOnce();
    expect({
      session: sessionStorage.getItem("AMP_session"),
      local: localStorage.getItem("amplitude_unsent"),
      decision: JSON.parse(
        localStorage.getItem("atlas.analytics-preference.v1") ?? "{}"
      ).decision,
      initCalls: amplitude.init.mock.calls.length,
    }).toStrictEqual({
      session: null,
      local: null,
      decision: "denied",
      initCalls: 1,
    });
  });
});
