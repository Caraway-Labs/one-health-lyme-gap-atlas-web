import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadonlyURLSearchParams } from "next/navigation";

import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";

let mockedSearch = "";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: () =>
    new URLSearchParams(mockedSearch) as ReadonlyURLSearchParams,
}));

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "./fixtures/review-scope-api-fixtures";

vi.mock(import("@/lib/county-geography"), async (importOriginal) => ({
  ...(await importOriginal()),
  countyDisplayGeometryQueryKey: (...args: unknown[]) => args,
  fetchCountyDisplayGeometry: vi.fn(async () => ({
    features: [],
    type: "FeatureCollection",
  })),
}));

vi.mock("@/components/atlas-map", () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

vi.mock("@/generated/atlas", () => ({
  getProfileV1MeProfileGet: vi.fn(async () => ({
    data: { profile: null },
    status: 200,
  })),
  metadataV1AtlasMetadataGet: vi.fn(async () => ({
    data: reviewScopeMetadataFixture,
    status: 200,
  })),
  scoresV1AtlasScoresGet: vi.fn(async () => ({
    data: reviewScopeScoresFixture,
    status: 200,
  })),
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

function renderReview(search = "") {
  mockedSearch = search.startsWith("?") ? search.slice(1) : search;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        searchParams={new URL(`http://localhost/app/review${search}`).search}
      >
        <ResetReviewExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

describe("Reset Review scope UI", () => {
  beforeEach(() => {
    mockedSearch = "";
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders national orientation for United States scope", async () => {
    renderReview();
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    expect(screen.getByTestId("review-scope-status").getAttribute("data-request-scope")).toBe(
      "ALL"
    );
  });

  it("honors explicit URL scope over profile default", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValueOnce({
      data: { profile: { state_code: "CO" } },
      status: 200,
    } as never);
    renderReview("?scope=NY");
    await waitFor(() =>
      expect(screen.getByTestId("review-scope-results").getAttribute("data-rendered-scope")).toBe(
        "NY"
      )
    );
    expect(screen.getByTestId("review-scope-status").textContent).toContain(
      "New York"
    );
  });
});
