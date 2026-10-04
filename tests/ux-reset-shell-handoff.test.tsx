import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetReviewPage from "@/app/app/review/page";
import { uxResetDestinationHref } from "@/features/ux-reset";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";

let pathname = UX_RESET_ROUTE_PATHS.review;
let searchParams = new URLSearchParams(
  "scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
);

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

function stubDesktopMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

describe("UX Reset shell rendered handoff", () => {
  beforeEach(() => {
    pathname = UX_RESET_ROUTE_PATHS.review;
    searchParams = new URLSearchParams(
      "scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
    );
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("applies the bounded handoff contract on sidebar navigation links", () => {
    render(
      <ResetProfessionalShell>
        <ResetReviewPage />
      </ResetProfessionalShell>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const investigate = navigation.querySelector(
      'a[href="/app/investigate?scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01"]'
    );
    expect(investigate).toBeTruthy();
    expect(
      navigation.querySelector('a[href="/app/feed?"]') ??
        navigation.querySelector('a[href^="/app/feed?"]')
    ).toBeNull();
    expect(navigation.querySelector('a[href="/app/feed"]')).toBeTruthy();

    expect(uxResetDestinationHref("investigate", pathname, searchParams)).toBe(
      "/app/investigate?scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01"
    );
  });

  it("drops invalid shared context from malformed direct links on outbound handoff", () => {
    searchParams = new URLSearchParams(
      "scope=state&county=bad&period=2024&dataset=alpha"
    );
    render(
      <ResetProfessionalShell>
        <ResetReviewPage />
      </ResetProfessionalShell>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const investigate = navigation.querySelector('a[href^="/app/investigate"]');
    expect(investigate).toBeTruthy();
    const href = investigate?.getAttribute("href");
    expect(href).toBe(
      uxResetDestinationHref("investigate", pathname, searchParams)
    );
    expect(href).not.toContain("county=");
    expect(href).not.toContain("scope=");
    expect(href).not.toContain("period=");
  });
});
