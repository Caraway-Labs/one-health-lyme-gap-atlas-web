import { setTimeout as delay } from "node:timers/promises";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
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
import type { ExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import { EXPLORER_MAP_LOADING_DELAY_MS } from "@/features/ux-reset/review/explorer-map-loading";
import { explorerMapValuesQueryKey } from "@/features/ux-reset/review/load-explorer-map-values";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  useExplorerMapPaintSettlement,
  usePublishedExplorerMapFrame,
} from "@/features/ux-reset/review/use-explorer-map-loading";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

import { buildStateReview } from "./fixtures/review-operating-picture-fixtures";

const recorded = vi.hoisted(() => ({
  failMap: false,
  paints: [] as {
    colors: string[];
    fips: string[];
    revision: string | undefined;
  }[],
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
      onError,
      onIdle,
      paintRevision,
      scores,
    }: {
      onError?: () => void;
      onIdle?: () => void;
      paintRevision?: string;
      scores: readonly { color?: string; fips: string }[];
    }) => {
      useEffect(() => {
        if (recorded.failMap) {
          onError?.();
          return;
        }
        onIdle?.();
      }, [onError, onIdle]);
      if (recorded.failMap) {
        return <div data-testid="mock-atlas-map-failed" />;
      }
      recorded.paints.push({
        colors: scores.map((county) => county.color ?? ""),
        fips: scores.map((county) => county.fips),
        revision: paintRevision,
      });
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

function latestPaint(): {
  colors: string[];
  fips: string[];
  revision: string | undefined;
} {
  const paint = recorded.paints.at(-1);
  if (!paint) {
    throw new Error("AtlasMap has not received a frame.");
  }
  return paint;
}

describe("published explorer map frame", () => {
  beforeEach(() => {
    recorded.failMap = false;
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

  it("holds the previous frame only while the next revision is unresolved", () => {
    const { result, rerender } = renderHook(
      ({
        frame,
        revision,
      }: {
        frame: readonly { color: string; fips: string }[];
        revision: string | null;
      }) => usePublishedExplorerMapFrame(revision, frame),
      {
        initialProps: {
          frame: [{ color: "#FEEBE2", fips: "08001" }],
          revision: "svi:painted" as string | null,
        },
      }
    );
    rerender({
      frame: [{ color: "", fips: "08001" }],
      revision: null,
    });
    expect(result.current).toMatchObject({
      frame: [{ color: "#FEEBE2", fips: "08001" }],
      revision: "svi:painted",
    });
    rerender({
      frame: [
        { color: "", fips: "08001" },
        { color: "", fips: "36001" },
      ],
      revision: "gap:unavailable",
    });
    expect(result.current).toMatchObject({
      frame: [
        { color: "", fips: "08001" },
        { color: "", fips: "36001" },
      ],
      revision: "gap:unavailable",
    });
  });

  it("waits for a new paint when a settled revision is published again", () => {
    const { result, rerender } = renderHook(
      ({ revision }: { revision: string }) =>
        useExplorerMapPaintSettlement(revision),
      { initialProps: { revision: "A" } }
    );
    const firstPaint = result.current.onPaintSettled;
    act(() => {
      firstPaint("A");
    });
    rerender({ revision: "B" });
    rerender({ revision: "A" });
    act(() => {
      firstPaint("A");
    });
    expect(result.current.settledRevision).toBeNull();
    act(() => {
      result.current.onPaintSettled("A");
    });
    expect(result.current.settledRevision).toBe("A");
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
    recorded.failMap = false;
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

function seedEmptyScoreLayer(
  client: QueryClient,
  observationFips: readonly string[]
): void {
  client.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties: [],
      methodology_version: "1",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  client.setQueryData(explorerMapValuesQueryKey(RELEASE_ID), {
    counties: observationFips.map((fips, index) => ({
      fips,
      incidence_floor_2023: null,
      rucc_2023: null,
      svi_percentile: index === 0 ? 0 : 1,
      uninsured_percent: null,
    })),
    release_id: RELEASE_ID,
  });
}

function nationalLayerPicture(
  mapLayer: ExplorerMapLayerId,
  client: QueryClient
) {
  return (
    <QueryClientProvider client={client}>
      <ReviewNationalPicture
        availableDataGate={{ kind: "open" }}
        counties={[]}
        countiesError={false}
        countiesLoading={false}
        county={null}
        countyQuery=""
        mapLayer={mapLayer}
        period={null}
        releaseId={RELEASE_ID}
        tierRelease={{ status: "unknown" }}
        onCountyChange={() => {}}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

function stateLayerPicture(mapLayer: ExplorerMapLayerId, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <ReviewOperatingPicture
        availableDataGate={{ kind: "open" }}
        mapLayer={mapLayer}
        review={buildStateReview({ state: "CO" })}
        scopeCode="CO"
        stateName="Colorado"
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

async function expectNeutralBoundaryFrame(
  regionTestId: string,
  revisionMarker: string
): Promise<void> {
  await waitFor(() => {
    expect(latestPaint().revision ?? "").toContain(revisionMarker);
  });
  const neutral = latestPaint();
  const legend = screen.getByTestId("explorer-map-legend");
  expect({
    colors: neutral.colors.join(" "),
    kind: legend.dataset.legendKind,
    note: legend.textContent ?? "",
  }).toStrictEqual({
    colors: expect.not.stringMatching(/#FEEBE2|#A63603/),
    kind: "unavailable",
    note: expect.stringContaining("The map shows county boundaries only."),
  });
  await delay(EXPLORER_MAP_LOADING_DELAY_MS + 50);
  expect({
    busy: screen.getByTestId(regionTestId).getAttribute("aria-busy"),
    error: screen.queryByTestId("explorer-map-loading-error"),
    loading: screen.queryByTestId("explorer-map-loading"),
    revision: latestPaint().revision ?? "",
  }).toStrictEqual({
    busy: "false",
    error: null,
    loading: null,
    revision: expect.stringContaining(revisionMarker),
  });
}

describe("terminal unavailable score frames", () => {
  beforeEach(() => {
    recorded.failMap = false;
    recorded.paints.length = 0;
    geometryRequest.reset();
    geometryRequest.resolve(geometry());
  });

  afterEach(() => {
    cleanup();
  });

  it("replaces a painted observation layer when a score layer has no scores", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    seedEmptyScoreLayer(client, ["08001", "36001"]);
    const view = render(nationalLayerPicture("svi", client));
    await waitFor(() => {
      expect(latestPaint().colors).toStrictEqual(["#FEEBE2", "#A63603"]);
    });
    const observationRevision = latestPaint().revision;

    for (const layerId of [
      "gap_score",
      "tick_status",
      "pathogen_status",
    ] as const) {
      view.rerender(nationalLayerPicture(layerId, client));
      await expectNeutralBoundaryFrame(
        "review-national-map-region",
        `:${layerId}:unavailable:`
      );
    }
    expect(latestPaint()).toMatchObject({
      fips: ["08001", "36001"],
    });
    expect(latestPaint().revision).not.toBe(observationRevision);

    view.rerender(nationalLayerPicture("svi", client));
    await waitFor(() => {
      expect(latestPaint()).toMatchObject({
        colors: ["#FEEBE2", "#A63603"],
        revision: observationRevision,
      });
    });
    expect({
      busy: screen
        .getByTestId("review-national-map-region")
        .getAttribute("aria-busy"),
      loading: screen.queryByTestId("explorer-map-loading"),
    }).toStrictEqual({ busy: "false", loading: null });
  });

  it("replaces a painted state observation layer when a score layer has no scores", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    seedEmptyScoreLayer(client, ["08001"]);
    client.setQueryData(
      ["ux-reset-review-county-directory", RELEASE_ID],
      [
        {
          county: "Adams",
          fips: "08001",
          state: "CO",
          stateName: "Colorado",
        },
      ]
    );
    const view = render(stateLayerPicture("svi", client));
    await waitFor(() => {
      expect(latestPaint().colors).toStrictEqual(["#FEEBE2"]);
    });
    const observationRevision = latestPaint().revision;

    for (const layerId of [
      "gap_score",
      "tick_status",
      "pathogen_status",
    ] as const) {
      view.rerender(stateLayerPicture(layerId, client));
      await expectNeutralBoundaryFrame(
        "review-state-map-region",
        `:${layerId}:unavailable:`
      );
    }
    expect(latestPaint()).toMatchObject({ fips: ["08001"] });
    expect(latestPaint().revision).not.toBe(observationRevision);

    view.rerender(stateLayerPicture("svi", client));
    await waitFor(() => {
      expect(latestPaint()).toMatchObject({
        colors: ["#FEEBE2"],
        revision: observationRevision,
      });
    });
    expect({
      busy: screen
        .getByTestId("review-state-map-region")
        .getAttribute("aria-busy"),
      loading: screen.queryByTestId("explorer-map-loading"),
    }).toStrictEqual({ busy: "false", loading: null });
  });

  it("shows Retry when the state map fails and restores the map after retry", async () => {
    recorded.failMap = true;
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
      [
        {
          county: "Adams",
          fips: "08001",
          state: "CO",
          stateName: "Colorado",
        },
      ]
    );
    render(stateLayerPicture("gap_score", client));
    await waitFor(() => {
      expect(screen.getByTestId("explorer-map-loading-error")).toBeTruthy();
    });
    recorded.failMap = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy();
    });
    await delay(EXPLORER_MAP_LOADING_DELAY_MS + 50);
    expect({
      busy: screen
        .getByTestId("review-state-map-region")
        .getAttribute("aria-busy"),
      error: screen.queryByTestId("explorer-map-loading-error"),
      loading: screen.queryByTestId("explorer-map-loading"),
    }).toStrictEqual({ busy: "false", error: null, loading: null });
  });
});
