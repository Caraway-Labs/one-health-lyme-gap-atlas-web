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
  exploreObservationsEnvelope,
  exploreScoresFixture,
} from "./fixtures/explore-api-fixtures";

const observationControls = {
  delayMeasureId: null as string | null,
  failMeasureId: null as string | null,
};

let releaseDelayedObservations: (() => void) | null = null;
let delayedObservations: Promise<boolean> = Promise.resolve(true);

let geometryShouldFail = false;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/explore",
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
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

vi.mock(import("@/generated/atlas"), () => ({
  metadataV1AtlasMetadataGet: vi.fn<
    typeof import("@/generated/atlas").metadataV1AtlasMetadataGet
  >(
    async () =>
      ({
        data: exploreMetadataFixture,
        headers: new Headers(),
        status: 200,
      }) as never
  ),
  measuresV1MeasuresGet: vi.fn<
    typeof import("@/generated/atlas").measuresV1MeasuresGet
  >(
    async () =>
      ({
        data: exploreMeasuresEnvelope,
        headers: new Headers(),
        status: 200,
      }) as never
  ),
  observationsV1ObservationsGet: vi.fn<
    typeof import("@/generated/atlas").observationsV1ObservationsGet
  >(async (params) => {
    if (params.measure_id === observationControls.failMeasureId) {
      throw new Error("observations failed");
    }
    if (params.measure_id === observationControls.delayMeasureId) {
      await delayedObservations;
    }
    return {
      data: exploreObservationsEnvelope(params.measure_id),
      headers: new Headers(),
      status: 200,
    } as never;
  }),
  scoresV1AtlasScoresGet: vi.fn<
    typeof import("@/generated/atlas").scoresV1AtlasScoresGet
  >(
    async () =>
      ({
        data: exploreScoresFixture,
        headers: new Headers(),
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
  const adams = screen.getByRole("button", { name: "Adams" }).closest("tr");
  expect(legend.dataset.period).toBe(layer.dataset.period);
  expect(evidence.textContent).toContain(input.value);
  expect(evidence.textContent).toContain(layer.dataset.period);
  expect(adams?.dataset.unit).toBe(layer.dataset.unit);
  expect(adams?.dataset.period).toBe(layer.dataset.period);
}

function expectRowAndMapMeasure(measureId: string) {
  const adams = screen.getByRole("button", { name: "Adams" }).closest("tr");
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
    renderExplore("?scope=CO&county=08001");
    await waitFor(() =>
      expect(
        screen.getByTestId("explore-layer-identity").dataset.measureId
      ).toBe(EXPLORE_PRECIPITATION_MEASURE_ID)
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodIncludes: "2025",
      unit: "mm",
      value: "4.5 mm",
    });
    const names = screen
      .getAllByTestId("explore-county-row")
      .map((row) => row.querySelector("button")?.textContent);
    expect(names).toStrictEqual(["Adams", "Boulder"]);
    expect(screen.queryByText(/review priority/i)).toBeNull();
    expect(
      screen.getByTestId("explore-map-scope-select").textContent
    ).toContain("Colorado");
  });

  it("hands the selected county to Investigate without the Explore measure key", async () => {
    renderExplore("?scope=CO&county=08001");
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
    renderExplore("?scope=CO&county=08001");
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
      value: "4.5 mm",
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
    renderExplore("?scope=CO&county=08001");
    await waitFor(() =>
      expect(screen.getByTestId("explore-map-fallback")).toBeTruthy()
    );
    expectDisplayedMeasure({
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodIncludes: "2025",
      unit: "mm",
      value: "4.5 mm",
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
});
