import { setTimeout as delay } from "node:timers/promises";

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

function PriorityListProbe({ fipsList }: { fipsList: readonly string[] }) {
  useExplorerCountyMlPriorities(fipsList, release);
  return null;
}

const APP_STALE_TIME_MS = 300_000;

function tier1QueryKey(fips: string) {
  return [
    "ux-reset-tier1-surveillance-priority",
    fips,
    tier1LowInsufficientFixture.release_id,
  ] as const;
}

function rowRank(fips: string): string {
  const row = document.querySelector<HTMLElement>(
    `[data-testid="review-candidate"][data-fips="${fips}"]`
  );
  return row?.querySelector(".ux-reset-ranked-number")?.textContent ?? "";
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
        '[data-testid="review-candidate"][data-fips="08001"] .ux-reset-ranked-score'
      );
      expect({
        adams: rowRank("08001"),
        boulder: rowRank("08013"),
        clearCreek: rowRank("08019"),
        denver: rowRank("08031"),
        score: adamsScore?.textContent ?? "",
      }).toStrictEqual({
        adams: "1",
        boulder: "2",
        clearCreek: "Not ranked",
        denver: "Not ranked",
        score: "Atlas gap score 75.0",
      });
    });
    expect(screen.queryByTestId("explorer-ml-priority-legend")).toBeNull();
    expect(
      document.querySelector("[data-testid='explorer-ml-priority']")
    ).toBeNull();
    expect(rowRank("08019")).toBe("Not ranked");

    fireEvent.click(screen.getByRole("tab", { name: /List/ }));
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
      expect(screen.getAllByTestId("review-published-county")).toHaveLength(25);
    });
    expect(tier1Get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("explorer-ml-priority-more")).toBeNull();
    for (const resolve of pending) {
      resolve({
        data: tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"),
        headers: new Headers(),
        status: 200 as const,
      });
    }
  });

  it("recovers a Could not load row after remount when the API returns HIGH", async () => {
    vi.useFakeTimers();
    tier1Get.mockImplementation(async (fips) => {
      throw new AtlasApiError(
        "Temporarily unavailable",
        `/v1/counties/${fips}/tier1-surveillance-priority`,
        503,
        null,
        0
      );
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { gcTime: 60_000, retry: false },
      },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <PriorityLabelProbe fips="08031" />
      </QueryClientProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByTestId("priority-label").textContent).toBe(
      EXPLORER_ML_PRIORITY_FAILED_LABEL
    );
    const exhaustedAttempts = tier1Get.mock.calls.length;
    tier1Get.mockImplementation(async (fips) => ({
      data: tier1PriorityForCounty(tier1HighSufficientFixture, fips),
      headers: new Headers(),
      status: 200 as const,
    }));
    view.unmount();
    render(
      <QueryClientProvider client={client}>
        <PriorityLabelProbe fips="08031" />
      </QueryClientProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
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
      label: screen.getByTestId("priority-label").textContent,
      recovered: tier1Get.mock.calls.length > exhaustedAttempts,
      tier: screen.getByTestId("priority-label").dataset.tier,
    }).toStrictEqual({
      label: "HIGH",
      recovered: true,
      tier: "HIGH",
    });
  });

  it("refetches a stale success and leaves a fresh success unrequested", async () => {
    const staleClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: APP_STALE_TIME_MS },
      },
    });
    staleClient.setQueryData(
      tier1QueryKey("08001"),
      tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"),
      { updatedAt: Date.now() - APP_STALE_TIME_MS - 1000 }
    );
    tier1Get.mockImplementation(async (fips) => ({
      data: tier1PriorityForCounty(tier1HighSufficientFixture, fips),
      headers: new Headers(),
      status: 200 as const,
    }));
    render(
      <QueryClientProvider client={staleClient}>
        <PriorityLabelProbe fips="08001" />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("priority-label").textContent).toBe("HIGH");
    });
    expect(tier1Get).toHaveBeenCalledOnce();

    cleanup();
    tier1Get.mockClear();
    const freshClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: APP_STALE_TIME_MS },
      },
    });
    freshClient.setQueryData(
      tier1QueryKey("08013"),
      tier1PriorityForCounty(tier1LowInsufficientFixture, "08013")
    );
    render(
      <QueryClientProvider client={freshClient}>
        <PriorityLabelProbe fips="08013" />
      </QueryClientProvider>
    );
    await act(async () => {
      await delay(20);
    });
    expect({
      calls: tier1Get.mock.calls.length,
      label: screen.getByTestId("priority-label").textContent,
    }).toStrictEqual({
      calls: 0,
      label: "LOW",
    });
    await freshClient.invalidateQueries({ queryKey: tier1QueryKey("08013") });
    await waitFor(() => {
      expect(screen.getByTestId("priority-label").textContent).toBe("HIGH");
    });
    expect(tier1Get).toHaveBeenCalledOnce();
  });

  it("refreshes stale rows four at a time", async () => {
    const fipsList = ["08001", "08003", "08005", "08007", "08009", "08011"];
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
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: APP_STALE_TIME_MS },
      },
    });
    for (const fips of fipsList) {
      client.setQueryData(
        tier1QueryKey(fips),
        tier1PriorityForCounty(tier1LowInsufficientFixture, fips),
        { updatedAt: Date.now() - APP_STALE_TIME_MS - 1000 }
      );
    }
    const view = render(
      <QueryClientProvider client={client}>
        <PriorityListProbe fipsList={fipsList} />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(tier1Get).toHaveBeenCalledTimes(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    });
    expect(tier1Get).toHaveBeenCalledTimes(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    view.unmount();
    for (const resolve of pending) {
      resolve({
        data: tier1PriorityForCounty(tier1HighSufficientFixture, "08001"),
        headers: new Headers(),
        status: 200 as const,
      });
    }
  });
});
