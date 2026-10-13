import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetReviewPage from "@/app/explore/page";
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
  useRouter: () =>
    ({
      back: vi.fn<() => void>(),
      bfcacheId: "test",
      forward: vi.fn<() => void>(),
      prefetch: vi.fn<() => void>(),
      push: vi.fn<(href: string) => void>(),
      refresh: vi.fn<() => void>(),
      replace: vi.fn<(href: string) => void>(),
    }) as ReturnType<typeof import("next/navigation").useRouter>,
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), () => ({
  getProfileV1MeProfileGet: vi.fn<
    typeof import("@/generated/atlas").getProfileV1MeProfileGet
  >(
    async () =>
      ({
        data: { profile: null },
        status: 200,
      }) as never
  ),
  metadataV1AtlasMetadataGet: vi.fn<
    typeof import("@/generated/atlas").metadataV1AtlasMetadataGet
  >(
    async () =>
      ({
        data: {
          bundle_sha256: "abc",
          generated_at: "2026-01-01T00:00:00Z",
          limitations: "",
          loaded_at: "2026-01-01T00:00:00Z",
          methodology_version: "1",
          release_id: "alpha-2026-08-06",
          schema_version: "1",
          scope: "US",
          score_defaults: {},
          sources: [],
          states: [{ code: "CO", name: "Colorado" }],
        },
        status: 200,
      }) as never
  ),
  scoresV1AtlasScoresGet: vi.fn<
    typeof import("@/generated/atlas").scoresV1AtlasScoresGet
  >(
    async () =>
      ({
        data: { counties: [] },
        status: 200,
      }) as never
  ),
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

  function renderReviewShell() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams.toString()}>
          <ResetProfessionalShell>
            <ResetReviewPage />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  }

  it("applies the bounded handoff contract on sidebar navigation links", () => {
    renderReviewShell();

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect({
      action: navigation.querySelector('a[aria-label="Action"]'),
      ask: navigation
        .querySelector('a[aria-label="Ask Atlas"]')
        ?.getAttribute("href"),
      compare: navigation
        .querySelector(
          'a[href="/compare?scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01"]'
        )
        ?.getAttribute("aria-label"),
      explore: navigation.querySelector('a[aria-label="Explore"]'),
      feed: navigation
        .querySelector('a[href="/app/feed"]')
        ?.getAttribute("href"),
      feedQuery: navigation.querySelector('a[href^="/app/feed?"]'),
      investigate: navigation.querySelector('a[aria-label="Investigate"]'),
      serializer: uxResetDestinationHref("compare", pathname, searchParams),
    }).toStrictEqual({
      action: null,
      ask: "/askatlas?county=08001&dataset=alpha-2026-08-06",
      compare: "Compare",
      explore: null,
      feed: "/app/feed",
      feedQuery: null,
      investigate: null,
      serializer:
        "/compare?scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01",
    });
  });

  it("drops invalid shared context from malformed direct links on outbound handoff", () => {
    searchParams = new URLSearchParams(
      "scope=state&county=bad&period=2024&dataset=alpha"
    );
    renderReviewShell();

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const href =
      navigation
        .querySelector('a[aria-label="Compare"]')
        ?.getAttribute("href") ?? "";
    expect({
      county: href.includes("county="),
      href,
      period: href.includes("period="),
      scope: href.includes("scope=ALL"),
      serializer: uxResetDestinationHref("compare", pathname, searchParams),
    }).toStrictEqual({
      county: false,
      href: uxResetDestinationHref("compare", pathname, searchParams),
      period: false,
      scope: true,
      serializer: uxResetDestinationHref("compare", pathname, searchParams),
    });
  });
});
