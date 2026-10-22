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
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { usePublishedExplorerMapFrame } from "@/features/ux-reset/review/use-explorer-map-loading";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

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

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: ({
    paintRevision,
    scores,
  }: {
    paintRevision?: string;
    scores: readonly { fips: string }[];
  }) => {
    recorded.paints.push({
      fips: scores.map((county) => county.fips),
      revision: paintRevision,
    });
    return <div data-testid="mock-atlas-map" />;
  },
}));

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

  it("explains an initially empty Available data result without a spinner", async () => {
    geometryRequest.resolve(geometry());
    render(picture({ kind: "ready", fips: new Set(["99999"]) }));
    await waitFor(() => {
      expect(screen.getByText(EXPLORER_AVAILABLE_DATA_EMPTY)).toBeTruthy();
    });
    const region = screen.getByTestId("review-national-map-region");
    expect(screen.queryByTestId("explorer-map-loading")).toBeNull();
    expect(region.getAttribute("aria-busy")).toBe("false");
  });

  it("hides the loader for an empty filter and restores the open counties", async () => {
    geometryRequest.resolve(geometry());
    const view = render(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
    });

    view.rerender(picture({ kind: "ready", fips: new Set(["99999"]) }));
    await waitFor(() => {
      expect(screen.getByText(EXPLORER_AVAILABLE_DATA_EMPTY)).toBeTruthy();
    });
    expect(screen.queryByTestId("explorer-map-loading")).toBeNull();

    view.rerender(picture({ kind: "open" }));
    await waitFor(() => {
      expect(latestPaint().fips).toStrictEqual(["08001", "36001"]);
    });
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
