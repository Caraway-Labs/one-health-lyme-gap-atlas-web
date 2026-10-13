import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  buildStateReview,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "./fixtures/review-scope-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const { tier1Get } = vi.hoisted(() => ({
  tier1Get:
    vi.fn<
      typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
    >(),
}));

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(
  import("@/features/ux-reset/review/use-published-review-counties"),
  () => ({
    usePublishedReviewCounties: () => ({
      counties: [
        { county: "Adams", fips: "08001", state: "CO", stateName: "Colorado" },
        {
          county: "Boulder",
          fips: "08013",
          state: "CO",
          stateName: "Colorado",
        },
        { county: "Denver", fips: "08031", state: "CO", stateName: "Colorado" },
        {
          county: "Clear Creek",
          fips: "08019",
          state: "CO",
          stateName: "Colorado",
        },
      ],
      isError: false,
      isLoading: false,
      isSuccess: true,
    }),
  })
);

vi.mock(import("@/features/ux-reset/investigate/load-county-evidence"), () => ({
  loadInvestigateCountyRecord: vi.fn<() => Promise<null>>(async () => null),
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<typeof actual.fetchCountyDisplayGeometry>(
      async () => ({
        features: [],
        type: "FeatureCollection",
      })
    ),
  };
});

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    countyTier1SurveillancePriorityGet: (
      ...args: Parameters<
        typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
      >
    ) => tier1Get(...args),
    scoresV1AtlasScoresGet: vi.fn<typeof actual.scoresV1AtlasScoresGet>(
      async () => ({
        data: reviewScopeScoresFixture,
        headers: new Headers(),
        status: 200,
      })
    ),
  };
});

const release: Tier1ActiveRelease = {
  releaseId: tier1LowInsufficientFixture.release_id,
  status: "ready",
};

function rowLabel(fips: string): string {
  const row = document.querySelector<HTMLElement>(
    `[data-testid="review-candidate"][data-fips="${fips}"]`
  );
  const badge = row?.querySelector("[data-testid='explorer-ml-priority']");
  return badge?.textContent ?? "";
}

describe("Explorer county rows show ML surveillance priority", () => {
  afterEach(() => {
    cleanup();
    tier1Get.mockReset();
  });

  it("labels returned tiers and keeps a missing result Not available", async () => {
    tier1Get.mockImplementation(async (fips) => {
      if (fips === "08001") {
        return {
          data: tier1PriorityForCounty(tier1LowInsufficientFixture, fips),
          headers: new Headers(),
          status: 200,
        };
      }
      if (fips === "08013") {
        return {
          data: tier1PriorityForCounty(tier1MediumSufficientFixture, fips),
          headers: new Headers(),
          status: 200,
        };
      }
      if (fips === "08031") {
        return {
          data: tier1PriorityForCounty(tier1HighSufficientFixture, fips),
          headers: new Headers(),
          status: 200,
        };
      }
      throw new AtlasApiError(
        "No current Tier 1 county result",
        `/v1/counties/${fips}/tier1-surveillance-priority`,
        404,
        null
      );
    });
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={buildStateReview({
            candidates: [
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Adams",
                fips: "08001",
                reasonText: "Adams was returned by the method.",
              }),
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Boulder",
                fips: "08013",
                reasonText: "Boulder was returned by the method.",
              }),
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Denver",
                fips: "08031",
                reasonText: "Denver was returned by the method.",
              }),
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Clear Creek",
                fips: "08019",
                reasonText: "Clear Creek was returned by the method.",
              }),
            ],
            resultState: "candidates_found",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
          tierRelease={release}
          onCountyChange={onCountyChange}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const adamsScore = document.querySelector(
        '[data-testid="review-candidate"][data-fips="08001"] .ux-reset-explorer-county-score'
      );
      expect({
        adams: rowLabel("08001"),
        boulder: rowLabel("08013"),
        clearCreek: rowLabel("08019"),
        denver: rowLabel("08031"),
        score: adamsScore?.textContent ?? "",
      }).toStrictEqual({
        adams: "LOW",
        boulder: "MEDIUM",
        clearCreek: "Not available",
        denver: "HIGH",
        score: "Published score 75",
      });
    });
    const adams = document.querySelector<HTMLElement>(
      '[data-testid="review-candidate"][data-fips="08001"]'
    );
    expect({
      adamsTier: adams?.dataset.mlTier,
      legend: screen.getByTestId("explorer-ml-priority-legend").textContent,
      publishedCategory: adams?.querySelector("small")?.textContent,
      publishedScore: adams?.querySelector(".ux-reset-explorer-county-score")
        ?.textContent,
    }).toStrictEqual({
      adamsTier: "LOW",
      legend: expect.stringContaining(
        "ML surveillance priority — counties flagged for review, not personal Lyme disease risk"
      ),
      publishedCategory: expect.stringContaining(
        "Published category: Priority 3 — Review."
      ),
      publishedScore: "Published score 75",
    });
    expect(rowLabel("08019")).not.toBe("LOW");

    fireEvent.click(screen.getByRole("button", { name: /Boulder, CO/ }));
    expect(onCountyChange).toHaveBeenCalledWith("08013", "push");
  });
});
