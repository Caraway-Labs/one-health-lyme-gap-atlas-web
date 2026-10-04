import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetExploreExperience } from "@/features/ux-reset/explore/reset-explore-experience";

import {
  EXPLORE_CASES_MEASURE_ID,
  EXPLORE_PRECIPITATION_MEASURE_ID,
  EXPLORE_TICK_MEASURE_ID,
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsForMeasure,
  exploreScoresFixture,
} from "./fixtures/explore-api-fixtures";

const observationControls = {
  delayMeasureId: null as string | null,
  failMeasureId: null as string | null,
  releaseId: "alpha-2026",
};

const metadataControls = {
  releaseId: "alpha-2026",
};

let releaseDelayedObservations: (() => void) | null = null;
let delayedObservations: Promise<boolean> = Promise.resolve(true);

let geometryShouldFail = false;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/explore",
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: ({
    cameraFrameState,
    resetNationalView,
    scores,
  }: {
    cameraFrameState?: string | null;
    resetNationalView?: boolean;
    scores: readonly { color?: string; fips: string }[];
  }) => (
    <div
      data-camera={cameraFrameState ?? ""}
      data-reset-national={resetNationalView ? "true" : "false"}
      data-score-colors={scores
        .map((score) => `${score.fips}=${score.color ?? ""}`)
        .join(",")}
      data-testid="mock-atlas-map"
    />
  ),
}));

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<typeof actual.fetchCountyDisplayGeometry>(
      async () => {
        if (geometryShouldFail) {
          throw new Error("display geometry failed");
        }
        return exploreGeometryFixture as never;
      }
    ),
  };
});

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    metadataV1AtlasMetadataGet: vi.fn<
      typeof import("@/generated/atlas").metadataV1AtlasMetadataGet
    >(
      async () =>
        ({
          data: {
            ...exploreMetadataFixture,
            release_id: metadataControls.releaseId,
          },
          headers: new Headers(),
          status: 200,
        }) as never
    ),
    measuresV1MeasuresGet: vi.fn<
      typeof import("@/generated/atlas").measuresV1MeasuresGet
    >(async (params) => {
      if (params?.page_token === null || params?.geography_type === "county") {
        return {
          data: { detail: "invalid catalog request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      const data = exploreMeasuresEnvelope.data.filter(
        (measure) => measure.geography_semantics === params?.geography_type
      );
      return {
        data: { ...exploreMeasuresEnvelope, data },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      const hasYear = typeof params.year === "number";
      const hasRange = Boolean(params.start_date && params.end_date);
      if (
        params.page_token === null ||
        params.geography_type !== "county" ||
        hasYear === hasRange
      ) {
        return {
          data: { detail: "invalid observation request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      if (params.measure_id === observationControls.failMeasureId) {
        throw new Error("observations failed");
      }
      if (params.measure_id === observationControls.delayMeasureId) {
        await delayedObservations;
      }
      const matchesBound =
        (params.measure_id === EXPLORE_PRECIPITATION_MEASURE_ID &&
          params.start_date === "2025-01-01" &&
          params.end_date === "2025-01-01") ||
        (params.measure_id !== EXPLORE_PRECIPITATION_MEASURE_ID &&
          params.year === 2023);
      return {
        data: {
          data: matchesBound
            ? exploreObservationsForMeasure(
                params.measure_id,
                observationControls.releaseId
              )
            : [],
          links: { self: "/v1/observations" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    scoresV1AtlasScoresGet: vi.fn<
      typeof import("@/generated/atlas").scoresV1AtlasScoresGet
    >(
      async () =>
        ({
          data: {
            ...exploreScoresFixture,
            release_id: metadataControls.releaseId,
          },
          headers: new Headers(),
          status: 200,
        }) as never
    ),
  };
});

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

function renderExplore(search = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        hasMemory
        searchParams={new URL(`http://localhost/app/explore${search}`).search}
      >
        <ResetExploreExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function expectLayerAgreement(input: {
  measureId: string;
  periodIncludes: string;
  unit: string;
}) {
  const layer = screen.getByTestId("explore-layer-identity");
  const legend = screen.getByTestId("explore-map-legend");
  expect(layer.dataset.measureId).toBe(input.measureId);
  expect(layer.dataset.unit).toBe(input.unit);
  expect(layer.dataset.period).toContain(input.periodIncludes);
  expect(legend.dataset.measureId).toBe(input.measureId);
  expect(legend.dataset.unit).toBe(input.unit);
}

function expectLegendAndEvidence(input: { value: string }) {
  const layer = screen.getByTestId("explore-layer-identity");
  const legend = screen.getByTestId("explore-map-legend");
  const evidence = screen.getByTestId("explore-selected-evidence");
  const adams = screen
    .getByRole("button", { name: "Adams, Colorado 08001" })
    .closest("tr");
  expect(legend.dataset.period).toBe(layer.dataset.period);
  expect(evidence.textContent).toContain(input.value);
  expect(evidence.textContent).toContain(layer.dataset.period);
  expect(adams?.dataset.unit).toBe(layer.dataset.unit);
  expect(adams?.dataset.period).toBe(layer.dataset.period);
}

function expectRowAndMapMeasure(measureId: string) {
  const adams = screen
    .getByRole("button", { name: "Adams, Colorado 08001" })
    .closest("tr");
  expect(adams?.dataset.measureId).toBe(measureId);
  expect(screen.getByTestId("explore-map-region").dataset.measureId).toBe(
    measureId
  );
}

async function chooseMeasure(name: string) {
  fireEvent.click(screen.getByTestId("explore-measure-select"));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

function expectDisplayedMeasure(input: {
  measureId: string;
  periodIncludes: string;
  unit: string;
  value: string;
}) {
  expectLayerAgreement(input);
  expectLegendAndEvidence({ value: input.value });
  expectRowAndMapMeasure(input.measureId);
}

describe("Explore workspace", () => {
  beforeEach(() => {
    geometryShouldFail = false;
    observationControls.delayMeasureId = null;
    observationControls.failMeasureId = null;
    observationControls.releaseId = "alpha-2026";
    metadataControls.releaseId = "alpha-2026";
    const delayed = Promise.withResolvers<boolean>();
    releaseDelayedObservations = () => {
      delayed.resolve(true);
    };
    delayedObservations = delayed.promise;
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("agrees on the catalog measure across legend, evidence, and the county table", async () => {
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_PRECIPITATION_MEASURE_ID)
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodIncludes: "2025",
      unit: "mm",
      value: "18 mm",
    });
    const names = screen
      .getAllByTestId("explore-county-row")
      .map((row) => row.querySelector("button")?.textContent);
    expect(names).toStrictEqual([
      "Adams, Colorado 08001",
      "Boulder, Colorado 08013",
    ]);
    expect(screen.queryByText(/review priority/i)).toBeNull();
    expect(
      screen.getByTestId("explore-map-scope-select").textContent
    ).toContain("Colorado");
  });

  it("hands the selected county to Investigate without the Explore measure key", async () => {
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_PRECIPITATION_MEASURE_ID)
    );
    const investigate = screen.getByTestId("explore-investigate");
    expect(investigate.getAttribute("href")).toContain("/app/investigate");
    expect(investigate.getAttribute("href")).toContain("county=08001");
    expect(investigate.getAttribute("href")).not.toContain("metric=");
    expect(
      screen.getByTestId("explore-compare").getAttribute("href")
    ).toContain("/app/compare");
  });

  it("keeps the previous measure labeled until the next measure loads, then switches together", async () => {
    observationControls.delayMeasureId = EXPLORE_CASES_MEASURE_ID;
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_PRECIPITATION_MEASURE_ID)
    );

    await chooseMeasure("Reported Lyme cases");

    await waitFor(() =>
      expect(
        screen.getByTestId("explore-request-status").textContent
      ).toContain("Reported Lyme cases")
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodIncludes: "2025",
      unit: "mm",
      value: "18 mm",
    });

    releaseDelayedObservations?.();
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_CASES_MEASURE_ID)
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_CASES_MEASURE_ID,
      periodIncludes: "2023",
      unit: "cases",
      value: "2 cases",
    });
  });

  it("does not relabel the layer when the next measure request fails", async () => {
    renderExplore("?scope=CO&county=08001&metric=reported-cases");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_CASES_MEASURE_ID)
    );
    observationControls.failMeasureId = EXPLORE_TICK_MEASURE_ID;
    await chooseMeasure("Tick abundance");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-request-status").textContent
      ).toContain("could not be loaded")
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_CASES_MEASURE_ID,
      periodIncludes: "2023",
      unit: "cases",
      value: "2 cases",
    });
  });

  it("keeps evidence and navigation available when display geometry fails", async () => {
    geometryShouldFail = true;
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    await waitFor(() =>
      expect(screen.getByTestId("explore-map-fallback")).toBeTruthy()
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodIncludes: "2025",
      unit: "mm",
      value: "18 mm",
    });
    expect(screen.getByTestId("explore-county-table")).toBeTruthy();
    expect(screen.queryByTestId("mock-atlas-map")).toBeNull();
    const investigate = screen.getByTestId("explore-investigate");
    const compare = screen.getByTestId("explore-compare");
    investigate.focus();
    expect(document.activeElement).toBe(investigate);
    compare.focus();
    expect(document.activeElement).toBe(compare);
  });

  it("disambiguates duplicate county names on the national list", async () => {
    renderExplore("?map_scope=ALL&county=08001&period=2025-01-01");
    await expect(
      screen.findByRole("button", { name: "Adams, Colorado 08001" })
    ).resolves.toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Adams, New York 36001" })
    ).toBeTruthy();
  });

  it("paints AtlasMap from the active measure and resets the national camera", async () => {
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    const map = await screen.findByTestId("mock-atlas-map");
    const precipColors = map.dataset.scoreColors ?? "";
    expect(map.dataset.resetNational).toBe("false");
    expect(precipColors).toContain("08001=var(--map-ramp-6)");

    fireEvent.click(screen.getByTestId("explore-map-scope-select"));
    const national = await screen.findByRole("option", {
      name: "United States",
    });
    fireEvent.pointerDown(national, { pointerType: "mouse" });
    fireEvent.click(national);

    await waitFor(() =>
      expect(screen.getByTestId("mock-atlas-map").dataset.resetNational).toBe(
        "true"
      )
    );
    await chooseMeasure("Reported Lyme cases");
    await waitFor(() =>
      expect(
        screen.getByTestId("mock-atlas-map").dataset.scoreColors
      ).toContain("08001=var(--map-ramp-1)")
    );
    expect(screen.getByTestId("mock-atlas-map").dataset.scoreColors).not.toBe(
      precipColors
    );
  });

  it("keeps the previous layer when observations return another release", async () => {
    renderExplore("?scope=CO&county=08001&period=2025-01-01");
    await screen.findByTestId("explore-layer-identity");
    observationControls.releaseId = "beta-2026";
    await chooseMeasure("Reported Lyme cases");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-request-status").textContent
      ).toContain("could not be loaded")
    );
    expect(screen.getByTestId("explore-layer-identity").dataset.measureId).toBe(
      EXPLORE_PRECIPITATION_MEASURE_ID
    );
  });

  it("does not commit a pinned release when observations are from another release", async () => {
    metadataControls.releaseId = "pinned-old";
    renderExplore(
      "?scope=CO&county=08001&period=2025-01-01&dataset=pinned-old"
    );
    await expect(
      screen.findByText("The selected measure could not be loaded.")
    ).resolves.toBeTruthy();
    expect(screen.queryByTestId("explore-layer-identity")).toBeNull();
  });

  it("edits one compare pair and hands off that pair", async () => {
    renderExplore(
      "?map_scope=ALL&county=08001&period=2025-01-01&compare=08013,36001&selected=08001"
    );
    const selection = await screen.findByTestId("explore-compare-selection");
    expect(selection.dataset.fips).toBe("08001");
    const initialCompare = screen.getByTestId("explore-compare");
    expect(initialCompare.getAttribute("href")).toContain("compare=08001");
    expect(initialCompare.getAttribute("href")).not.toContain("08013");

    fireEvent.click(
      screen.getByRole("button", { name: "Boulder, Colorado 08013" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to compare" }));
    await waitFor(() =>
      expect(screen.getByTestId("explore-compare-selection").dataset.fips).toBe(
        "08001,08013"
      )
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Adams, New York 36001" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace in compare" }));
    await waitFor(() =>
      expect(screen.getByTestId("explore-compare-selection").dataset.fips).toBe(
        "08001,36001"
      )
    );
    expect(
      screen.getByTestId("explore-compare").getAttribute("href")
    ).toContain("compare=08001%2C36001");

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Adams, Colorado 08001" })
    );
    await waitFor(() =>
      expect(screen.getByTestId("explore-compare-selection").dataset.fips).toBe(
        "36001"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear compare" }));
    await waitFor(() =>
      expect(screen.getByTestId("explore-compare-selection").dataset.fips).toBe(
        ""
      )
    );
  });
});
