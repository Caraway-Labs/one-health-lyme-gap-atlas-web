import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsClient } from "@/components/analytics-client";
import { PrivacyPreferences } from "@/components/privacy-preferences";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";
import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";
import { ABOUT_CARAWAY_LABS_PATH } from "@/features/ux-reset/routes";
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

let pathname = "/overview";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

function LegacyAtlasOrWorkspace() {
  if (getRouteShell(pathname) === "none") {
    return <ProfessionalTrustFooter />;
  }
  return (
    <>
      <AnalyticsClient />
      <FrontPorchTrustFooter />
    </>
  );
}

describe("professional trust footer", () => {
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

  it("links the brand, public privacy, responsible use, and settings", () => {
    pathname = "/app";
    render(<ProfessionalTrustFooter />);

    const footer = screen.getByRole("contentinfo");
    const brand = screen.getByRole("link", {
      name: "One Health Atlas by Caraway Labs (opens in a new tab)",
    });
    expect({
      href: brand.getAttribute("href"),
      inFooter: footer.contains(brand),
      inTrustNav: footer.querySelector("nav")?.contains(brand) ?? false,
      mark: brand.querySelector("img.atlas-brand-mark")?.getAttribute("src"),
      rel: brand.getAttribute("rel"),
      target: brand.getAttribute("target"),
      text: brand.textContent?.replaceAll(/\s+/g, " ").trim(),
    }).toStrictEqual({
      href: ABOUT_CARAWAY_LABS_PATH,
      inFooter: true,
      inTrustNav: false,
      mark: "/android-chrome-192x192.png",
      rel: "noopener noreferrer",
      target: "_blank",
      text: "One Health Atlas by Caraway Labs ↗ (opens in a new tab)",
    });

    const trust = within(screen.getByRole("navigation", { name: "Trust" }));
    expect(
      trust.getAllByRole("link").map((link) => ({
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
        text: link.textContent,
      }))
    ).toStrictEqual([
      { href: "/privacy", target: null, text: "Privacy" },
      {
        href: "/ai-ethics",
        target: null,
        text: "AI / Responsible Use",
      },
      { href: "/app/settings", target: null, text: "Privacy settings" },
    ]);
    expect(footer.querySelector("button")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps a legacy Atlas session until the shared privacy control withdraws it", async () => {
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
    expect(
      screen
        .getByRole("link", { name: "Privacy settings" })
        .getAttribute("href")
    ).toBe("/app/settings");
    expect(screen.queryByRole("dialog")).toBeNull();

    render(<PrivacyPreferences />);
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
