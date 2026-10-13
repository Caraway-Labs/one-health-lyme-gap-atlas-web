import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerMlPriorityBadge } from "@/features/ux-reset/review/explorer-ml-priority";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  EXPLORER_ML_PRIORITY_FETCH_LIMIT,
  EXPLORER_ML_PRIORITY_PAGE_SIZE,
  useExplorerCountyMlPriorities,
} from "@/features/ux-reset/review/use-explorer-county-ml-priorities";
import {
  EXPLORER_ML_PRIORITY_FAILED,
  EXPLORER_ML_PRIORITY_FAILED_LABEL,
  EXPLORER_ML_PRIORITY_LOADING_LABEL,
  EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import {
  TIER1_FAILED_MESSAGE,
  type Tier1ActiveRelease,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
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

const { publishedCounties, tier1Get } = vi.hoisted(() => ({
  publishedCounties: vi.fn<
    () => {
      county: string;
      fips: string;
      state: string;
      stateName: string;
    }[]
  >(() => [
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
  ]),
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
      counties: publishedCounties(),
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

function PriorityLabelProbe({ fips }: { fips: string }) {
  const classifications = useExplorerCountyMlPriorities([fips], release);
  const classification = classifications.get(fips);
  return (
    <p data-testid="priority-label" data-tier={classification?.tier}>
      {classification?.label}
    </p>
  );
}

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
    publishedCounties.mockReset();
    publishedCounties.mockReturnValue([
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
    ]);
    vi.useRealTimers();
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

  it("explains a failed request without calling it Not available", () => {
    render(
      <ExplorerMlPriorityBadge classification={EXPLORER_ML_PRIORITY_FAILED} />
    );
    const badge = screen.getByTestId("explorer-ml-priority");
    expect({
      explanation: badge.textContent?.includes(TIER1_FAILED_MESSAGE),
      low: badge.textContent?.includes("LOW"),
      tier: badge.dataset.tier,
      unavailable: badge.textContent?.includes(
        EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL
      ),
    }).toStrictEqual({
      explanation: true,
      low: false,
      tier: "failed",
      unavailable: false,
    });
  });

  it("stays Loading through Retry-After and then shows the returned tier", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    tier1Get.mockImplementation(async (fips) => {
      attempts += 1;
      if (attempts === 1) {
        throw new AtlasApiError(
          "Too many requests",
          `/v1/counties/${fips}/tier1-surveillance-priority`,
          429,
          null,
          5
        );
      }
      return {
        data: tier1PriorityForCounty(tier1HighSufficientFixture, fips),
        headers: new Headers(),
        status: 200,
      };
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PriorityLabelProbe fips="08031" />
      </QueryClientProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("priority-label").textContent).toBe(
      EXPLORER_ML_PRIORITY_LOADING_LABEL
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect({
      attempts,
      label: screen.getByTestId("priority-label").textContent,
    }).toStrictEqual({
      attempts: 1,
      label: EXPLORER_ML_PRIORITY_LOADING_LABEL,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    for (let step = 0; step < 5; step += 1) {
      if (screen.getByTestId("priority-label").textContent === "HIGH") {
        break;
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    }
    expect({
      attempts,
      label: screen.getByTestId("priority-label").textContent,
      tier: screen.getByTestId("priority-label").dataset.tier,
    }).toStrictEqual({
      attempts: 2,
      label: "HIGH",
      tier: "HIGH",
    });
  });

  it("shows Could not load after a 503 and a network error exhaust retries", async () => {
    vi.useFakeTimers();
    tier1Get.mockImplementation(async (fips) => {
      if (fips === "08013") {
        throw new TypeError("Failed to fetch");
      }
      throw new AtlasApiError(
        "Temporarily unavailable",
        `/v1/counties/${fips}/tier1-surveillance-priority`,
        503,
        null,
        0
      );
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PriorityLabelProbe fips="08001" />
        <PriorityLabelProbe fips="08013" />
      </QueryClientProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const labels = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-testid='priority-label']"
      ),
    ].map((node) => ({
      label: node.textContent,
      tier: node.dataset.tier,
    }));
    expect(labels).toStrictEqual([
      { label: EXPLORER_ML_PRIORITY_FAILED_LABEL, tier: "failed" },
      { label: EXPLORER_ML_PRIORITY_FAILED_LABEL, tier: "failed" },
    ]);
  });

  it("requests only the open directory page, four counties at a time", async () => {
    const pending: ((value: {
      data: ReturnType<typeof tier1PriorityForCounty>;
      headers: Headers;
      status: 200;
    }) => void)[] = [];
    tier1Get.mockImplementation(() => {
      const deferred = Promise.withResolvers<{
        data: ReturnType<typeof tier1PriorityForCounty>;
        headers: Headers;
        status: 200;
      }>();
      pending.push(deferred.resolve);
      return deferred.promise;
    });
    publishedCounties.mockReturnValue(
      Array.from({ length: 25 }, (_, index) => ({
        county: `County ${index + 1}`,
        fips: String(8001 + index).padStart(5, "0"),
        state: "CO",
        stateName: "Colorado",
      }))
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={buildStateReview({
            candidates: [],
            resultState: "none_stand_out",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
          tierRelease={release}
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(tier1Get).toHaveBeenCalledTimes(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    });
    expect(screen.getAllByTestId("review-published-county")).toHaveLength(
      EXPLORER_ML_PRIORITY_PAGE_SIZE
    );
    expect(tier1Get).toHaveBeenCalledTimes(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    fireEvent.click(screen.getByTestId("explorer-ml-priority-more"));
    expect(screen.getAllByTestId("review-published-county")).toHaveLength(25);
    expect(tier1Get).toHaveBeenCalledTimes(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    for (const resolve of pending) {
      resolve({
        data: tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"),
        headers: new Headers(),
        status: 200 as const,
      });
    }
  });
});
