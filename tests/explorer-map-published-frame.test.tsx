import { setTimeout as delay } from "node:timers/promises";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPLORER_AVAILABLE_DATA_EMPTY,
  type ExplorerAvailableDataGate,
} from "@/features/ux-reset/review/explorer-county-reference";
import { EXPLORER_MAP_LOADING_DELAY_MS } from "@/features/ux-reset/review/explorer-map-loading";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import { usePublishedExplorerMapFrame } from "@/features/ux-reset/review/use-explorer-map-loading";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

import { buildStateReview } from "./fixtures/review-operating-picture-fixtures";

const recorded = vi.hoisted(() => ({
  paints: [] as { fips: string[]; revision: string | undefined }[],
}));

const geometryRequest = vi.hoisted(() => {
  let deferred =
    Promise.withResolvers<CountyDisplayGeometryFeatureCollection>();
  return {
    get promise() {
      return deferred.promise;
    },
    reset: () => {
      deferred = Promise.withResolvers();
    },
    resolve: (value: CountyDisplayGeometryFeatureCollection) => {
      deferred.resolve(value);
    },
  };
});

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), async () => {
  const { useEffect } = await import("react");
  return {
    AtlasMap: ({
      onIdle,
      paintRevision,
      scores,
    }: {
      onIdle?: () => void;
      paintRevision?: string;
      scores: readonly { fips: string }[];
    }) => {
      recorded.paints.push({
        fips: scores.map((county) => county.fips),
        revision: paintRevision,
      });
      useEffect(() => {
        onIdle?.();
      }, [onIdle]);
      return <div data-testid="mock-atlas-map" />;
    },
  };
});

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: () => geometryRequest.promise,
  };
});

const RELEASE_ID = "alpha-2026";

function score(
  fips: string,
  state: string,
  county: string
): CountyScoreSummary {
  return {
    burgdorferi_status: "observed",
    color: "#55a8a3",
    county,
    evidence_completeness: 50,
    fips,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 70,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state,
    state_name: state === "CO" ? "Colorado" : "New York",
    tick_status: "observed",
  };
}

const COUNTIES = [
  score("08001", "CO", "Adams"),
  score("36001", "NY", "Albany"),
];

function geometry(): CountyDisplayGeometryFeatureCollection {
  return {
    features: COUNTIES.map((county) => ({
      geometry: { coordinates: [-105.1, 39.7], type: "Point" as const },
      properties: { fips: county.fips },
      type: "Feature" as const,
    })),
    type: "FeatureCollection",
  };
}

function picture(gate: ExplorerAvailableDataGate) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties: COUNTIES,
      methodology_version: "1",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  return (
    <QueryClientProvider client={client}>
      <ReviewNationalPicture
        availableDataGate={gate}
        counties={[]}
        countiesError={false}
        countiesLoading={false}
        county={null}
        countyQuery=""
        mapLayer="gap_score"
        period={null}
        releaseId={RELEASE_ID}
        tierRelease={{ status: "unknown" }}
        onCountyChange={() => {}}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

function latestPaint(): { fips: string[]; revision: string | undefined } {
  const paint = recorded.paints.at(-1);
  if (!paint) {
    throw new Error("AtlasMap has not received a frame.");
  }
  return paint;
}

describe("published explorer map frame", () => {
  beforeEach(() => {
    recorded.paints.length = 0;
    geometryRequest.reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("publishes the frame for a new revision and holds it while a later render reuses that revision", () => {
    const { result, rerender } = renderHook(
      ({ frame, revision }: { frame: readonly string[]; revision: string }) =>
        usePublishedExplorerMapFrame(revision, frame),
      {
        initialProps: {
          frame: [] as readonly string[],
          revision: "gap:empty",
        },
      }
    );
    rerender({
      frame: ["08001", "36001"],
      revision: "gap:08001,36001",
    });
    rerender({
      frame: ["stale"],
      revision: "gap:08001,36001",
    });
    expect(result.current.frame).toStrictEqual(["08001", "36001"]);
    expect(result.current.revision).toBe("gap:08001,36001");
  });

  it("keeps the previous map while geometry is unresolved, then publishes the rendered counties", async () => {
    render(picture({ kind: "open" }));
    expect(screen.queryByTestId("mock-atlas-map")).toBeNull();

    geometryRequest.resolve(geometry());
    await waitFor(() => {
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy();
    });
    expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
  });

  it("publishes each Available data membership at the same layer and release", async () => {
    geometryRequest.resolve(geometry());
    const view = render(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
    });
    const openRevision = latestPaint().revision;

    view.rerender(picture({ kind: "ready", fips: new Set(["08001"]) }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001"]);
    });
    const subsetA = latestPaint().revision;

    view.rerender(picture({ kind: "ready", fips: new Set(["36001"]) }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["36001"]);
    });
    expect(latestPaint().revision).not.toBe(subsetA);
    expect(latestPaint().revision).not.toBe(openRevision);
  });

  it("restores the open county frame after a filtered publication", async () => {
    geometryRequest.resolve(geometry());
    const view = render(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
    });
    const openRevision = latestPaint().revision;

    view.rerender(picture({ kind: "ready", fips: new Set(["08001"]) }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001"]);
    });

    view.rerender(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint()).toMatchObject({
        fips: ["08001", "36001"],
        revision: openRevision,
      });
    });
  });
});

function statePicture(gate: ExplorerAvailableDataGate) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties: COUNTIES,
      methodology_version: "1",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  client.setQueryData(
    ["ux-reset-review-county-directory", RELEASE_ID],
    COUNTIES.map((county) => ({
      county: county.county,
      fips: county.fips,
      state: county.state,
      stateName: county.state_name,
    }))
  );
  return (
    <QueryClientProvider client={client}>
      <ReviewOperatingPicture
        availableDataGate={gate}
        review={buildStateReview({ state: "CO" })}
        scopeCode="CO"
        stateName="Colorado"
      />
    </QueryClientProvider>
  );
}

async function expectEmptyFrameSettled(regionTestId: string): Promise<void> {
  await waitFor(() => {
    const region = screen.getByTestId(regionTestId);
    expect(region.textContent ?? "").toContain(EXPLORER_AVAILABLE_DATA_EMPTY);
  });
  await delay(EXPLORER_MAP_LOADING_DELAY_MS + 50);
  expect(screen.queryByTestId("explorer-map-loading")).toBeNull();
  expect(screen.queryByTestId("explorer-map-loading-error")).toBeNull();
  expect(screen.queryByTestId("mock-atlas-map")).toBeNull();
  expect(screen.getByTestId(regionTestId).getAttribute("aria-busy")).toBe(
    "false"
  );
}

describe("confirmed empty explorer map frames", () => {
  beforeEach(() => {
    recorded.paints.length = 0;
    geometryRequest.reset();
    geometryRequest.resolve(geometry());
  });

  afterEach(() => {
    cleanup();
  });

  it("completes an initial empty national result without a loader", async () => {
    render(picture({ kind: "ready", fips: new Set() }));
    await expectEmptyFrameSettled("review-national-map-region");
    expect(
      screen.getByTestId("review-national-map-region").textContent ?? ""
    ).toContain(EXPLORER_AVAILABLE_DATA_EMPTY);
  });

  it("completes an initial empty state result without a loader", async () => {
    render(statePicture({ kind: "ready", fips: new Set() }));
    await expectEmptyFrameSettled("review-state-map-region");
    expect(
      screen.getByTestId("review-state-map-region").textContent ?? ""
    ).toContain(EXPLORER_AVAILABLE_DATA_EMPTY);
  });

  it("recovers a national map after an empty Available data result", async () => {
    const view = render(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
    });

    view.rerender(picture({ kind: "ready", fips: new Set() }));
    await expectEmptyFrameSettled("review-national-map-region");

    view.rerender(picture({ kind: "ready", fips: new Set(["08001"]) }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001"]);
    });
    expect(
      screen.getByTestId("review-national-map-region").textContent ?? ""
    ).not.toContain(EXPLORER_AVAILABLE_DATA_EMPTY);
    expect(screen.queryByTestId("explorer-map-loading")).toBeNull();
    expect(
      screen.getByTestId("review-national-map-region").getAttribute("aria-busy")
    ).toBe("false");
  });

  it("recovers a state map after an empty Available data result", async () => {
    const view = render(statePicture({ kind: "open" }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy();
    });

    view.rerender(statePicture({ kind: "ready", fips: new Set() }));
    await expectEmptyFrameSettled("review-state-map-region");

    view.rerender(statePicture({ kind: "ready", fips: new Set(["08001"]) }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001"]);
    });
    expect(
      screen.getByTestId("review-state-map-region").textContent ?? ""
    ).not.toContain(EXPLORER_AVAILABLE_DATA_EMPTY);
    expect(screen.queryByTestId("explorer-map-loading")).toBeNull();
    expect(
      screen.getByTestId("review-state-map-region").getAttribute("aria-busy")
    ).toBe("false");
  });
});
