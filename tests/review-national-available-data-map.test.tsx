import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  countyReferenceFromScoreSummaries,
  explorerAvailableDataGate,
} from "@/features/ux-reset/review/explorer-county-reference";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";

import { reviewScopeScoresFixture } from "./fixtures/review-scope-api-fixtures";

const engine = vi.hoisted(() => {
  const instances: FakeMap[] = [];
  class FakeMap {
    handlers = new Map<string, ((event?: unknown) => void)[]>();
    geojson: GeoJSON.FeatureCollection | null = null;
    center = { lat: 38.5, lng: -96.5 };
    zoom = 3.05;
    bearing = 0;
    pitch = 0;
    removed = false;
    layers = new Set<string>();
    jumpTo = vi.fn<(view: { center: [number, number]; zoom: number }) => void>(
      (view) => {
        this.center = { lat: view.center[1], lng: view.center[0] };
        this.zoom = view.zoom;
        this.emit("move");
      }
    );
    stop = vi.fn<() => void>();
    resize = vi.fn<() => void>();
    setFilter = vi.fn<(...args: unknown[]) => void>();
    setPaintProperty = vi.fn<(...args: unknown[]) => void>();
    constructor() {
      instances.push(this);
    }
    on(
      event: string,
      layerOrHandler: string | ((event?: unknown) => void),
      handler?: (event?: unknown) => void
    ) {
      const key = handler ? `${event}:${layerOrHandler}` : event;
      const callback = handler ?? (layerOrHandler as (event?: unknown) => void);
      this.handlers.set(key, [...(this.handlers.get(key) ?? []), callback]);
    }
    emit(event: string, payload?: unknown) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(payload);
      }
    }
    clickCounty(fips: string) {
      for (const handler of this.handlers.get("click:counties-fill") ?? []) {
        handler({ features: [{ properties: { fips } }] });
      }
    }
    once(event: string, handler: (event?: unknown) => void) {
      this.on(event, handler);
    }
    off(event: string, handler: (event?: unknown) => void) {
      for (const [key, callbacks] of this.handlers) {
        if (key !== event) {
          continue;
        }
        const remaining: ((event?: unknown) => void)[] = [];
        for (const listener of callbacks) {
          if (listener !== handler) {
            remaining.push(listener);
          }
        }
        this.handlers.set(key, remaining);
      }
    }
    addControl() {
      this.layers.add("navigation-control");
    }
    addSource(id: string, spec?: { data?: GeoJSON.FeatureCollection }) {
      if (id === "counties") {
        this.geojson = spec?.data ?? null;
      }
    }
    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }
    getSource(id: string) {
      if (id !== "counties") {
        return;
      }
      return {
        setData: (data: GeoJSON.FeatureCollection) => {
          this.geojson = data;
        },
      };
    }
    getLayer(id: string) {
      return this.layers.has(id);
    }
    getCenter() {
      return this.center;
    }
    getZoom() {
      return this.zoom;
    }
    getBearing() {
      return this.bearing;
    }
    getPitch() {
      return this.pitch;
    }
    getBounds() {
      const west = this.center.lng - 20;
      const south = this.center.lat - 10;
      return {
        getEast: () => west + 40,
        getNorth: () => south + 20,
        getSouth: () => south,
        getWest: () => west,
      };
    }
    fitBounds = vi.fn<() => void>();
    getCanvas() {
      return { style: { cursor: this.removed ? "" : "" } };
    }
    triggerRepaint = () => this.removed;
    remove() {
      this.removed = true;
    }
  }
  return { FakeMap, instances };
});

vi.mock(
  import("maplibre-gl"),
  () =>
    ({
      Map: engine.FakeMap,
      NavigationControl: function NavigationControl() {
        return {};
      },
      setWorkerUrl: vi.fn<(url: string) => void>(),
    }) as unknown as Partial<typeof import("maplibre-gl")>
);

const publishedDenver = {
  ...reviewScopeScoresFixture.counties[0],
  human_status: "published_count_floor",
};
const unpublishedAlbany = {
  ...reviewScopeScoresFixture.counties[2],
  human_status: "missing",
};
const scoreCounties = [publishedDenver, unpublishedAlbany];

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  useSearchParams: () => new URLSearchParams() as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    scoresV1AtlasScoresGet: vi.fn<typeof actual.scoresV1AtlasScoresGet>(
      async () => ({
        data: {
          ...reviewScopeScoresFixture,
          counties: scoreCounties,
        },
        headers: new Headers(),
        status: 200,
      })
    ),
  };
});

function box(fips: string, west: number) {
  return {
    geometry: {
      coordinates: [
        [
          [west, 39],
          [west + 1, 39],
          [west + 1, 40],
          [west, 40],
          [west, 39],
        ],
      ],
      type: "Polygon" as const,
    },
    properties: { fips },
    type: "Feature" as const,
  };
}

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<typeof actual.fetchCountyDisplayGeometry>(
      async () => ({
        features: [box("08001", -105), box("36001", -74)],
        type: "FeatureCollection",
      })
    ),
  };
});

function sourceFips(): string[] {
  const features = engine.instances.at(-1)?.geojson?.features ?? [];
  return features
    .map((feature) => String(feature.properties?.fips ?? ""))
    .toSorted();
}

function nationalPicture(
  availableData: "all" | "human",
  client: QueryClient,
  options: {
    county?: string | null;
    onCountyChange?: (fips: string | null, history: "push" | "replace") => void;
  } = {}
) {
  const counties = countyReferenceFromScoreSummaries(scoreCounties);
  return (
    <QueryClientProvider client={client}>
      <ReviewNationalPicture
        availableDataGate={explorerAvailableDataGate({
          availableData,
          counties,
          isError: false,
          isSuccess: true,
          scope: "ALL",
        })}
        counties={counties}
        countiesError={false}
        countiesLoading={false}
        county={options.county ?? null}
        countyQuery=""
        mapLayer="gap_score"
        period={null}
        releaseId="alpha-2026"
        tierRelease={{ status: "unknown" }}
        onCountyChange={options.onCountyChange ?? (() => {})}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

describe("national available-data map source", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      addEventListener() {},
      addListener() {},
      dispatchEvent() {
        return false;
      },
      matches: false,
      media: "",
      onchange: null,
      removeEventListener() {},
      removeListener() {},
    }));
  });

  afterEach(async () => {
    cleanup();
    engine.instances.length = 0;
    vi.unstubAllGlobals();
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
      features: [box("08001", -105), box("36001", -74)],
      type: "FeatureCollection",
    });
  });

  it("starts the county card at Counties without a local state filter", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(nationalPicture("all", client));
    const card = document.querySelector(".ux-reset-explorer-list");
    const heading = screen.getByRole("heading", { name: "Counties" });
    expect({
      browseLabel: screen.queryByText("Browse a state"),
      browseState: screen.queryByTestId("national-browse-state"),
      chooseState: screen.queryByText("Choose a state"),
      eyebrow: card?.querySelector(".ux-reset-ranked-counties-eyebrow") ?? null,
      firstHeading: card?.querySelector("h1, h2, h3") ?? null,
      headingInCard: card?.contains(heading) ?? false,
    }).toStrictEqual({
      browseLabel: null,
      browseState: null,
      chooseState: null,
      eyebrow: null,
      firstHeading: heading,
      headingInCard: true,
    });
  });

  it("omits a county that fails the published Lyme case gate and restores it when the gate opens", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(nationalPicture("human", client));
    await waitFor(() => {
      expect(engine.instances.length).toBeGreaterThan(0);
    });
    act(() => {
      const map = engine.instances.at(-1);
      map?.emit("load");
      map?.emit("idle");
    });
    await waitFor(() => {
      expect(sourceFips()).toStrictEqual(["08001"]);
    });

    view.rerender(nationalPicture("all", client));
    await waitFor(() => {
      expect(sourceFips()).toStrictEqual(["08001", "36001"]);
    });
  });

  it("leaves a geometry-only county drawn and refuses a published preview", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
      features: [box("08001", -105), box("08005", -104)],
      type: "FeatureCollection",
    });
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(nationalPicture("all", client, { county: "08005", onCountyChange }));
    await waitFor(() => {
      expect(engine.instances.length).toBeGreaterThan(0);
    });
    act(() => {
      const map = engine.instances.at(-1);
      map?.emit("load");
      map?.emit("idle");
    });
    await waitFor(() => {
      expect(sourceFips()).toStrictEqual(["08001", "08005"]);
    });

    act(() => {
      engine.instances.at(-1)?.clickCounty("08001");
    });
    expect(onCountyChange).not.toHaveBeenCalled();

    act(() => {
      engine.instances.at(-1)?.clickCounty("08005");
    });
    expect({
      compare: screen.queryByTestId("review-compare"),
      evidence: screen.queryByText("Published county evidence is available"),
      investigate: screen.queryByTestId("review-investigate"),
      preview: screen.queryByTestId("review-published-county-preview"),
      selection: onCountyChange.mock.calls,
    }).toStrictEqual({
      compare: null,
      evidence: null,
      investigate: null,
      preview: null,
      selection: [],
    });
    expect(screen.getByTestId("explorer-preview-empty")).toBeTruthy();

    act(() => {
      engine.instances.at(-1)?.clickCounty("08001");
    });
    expect(onCountyChange).toHaveBeenCalledWith("08001", "push");
  });
});
