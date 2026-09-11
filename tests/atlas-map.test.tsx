import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AtlasMap } from "@/components/atlas-map";
import type { CountyScoreSummary } from "@/generated/models";
import { estimatedFitZoom } from "@/lib/atlas-map-camera";

const engine = vi.hoisted(() => {
  const instances: FakeMap[] = [];
  class FakeMap {
    handlers = new Map<string, ((event?: unknown) => void)[]>();
    sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
    layers = new Set<string>();
    center = { lat: 38.5, lng: -96.5 };
    zoom = 3.05;
    bearing = 0;
    pitch = 0;
    removed = false;
    west = -125;
    south = 24;
    east = -66;
    north = 50;
    jumpTo = vi.fn<() => void>();
    stop = vi.fn<() => void>();
    fitBounds = vi.fn<
      (
        bounds: [number, number, number, number],
        options: { duration: number; maxZoom: number; padding: number }
      ) => void
    >(
      (
        bounds: [number, number, number, number],
        options: { duration: number; maxZoom: number; padding: number }
      ) => {
        this.west = bounds[0];
        this.south = bounds[1];
        this.east = bounds[2];
        this.north = bounds[3];
        this.zoom = options.maxZoom;
      }
    );
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
    once(event: string, handler: (event?: unknown) => void) {
      this.on(event, handler);
    }
    addControl() {
      this.layers.add("navigation-control");
    }
    addSource(id: string) {
      this.sources.set(id, { setData: vi.fn<(...args: unknown[]) => void>() });
    }
    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }
    getSource(id: string) {
      return this.sources.get(id);
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
      return {
        getEast: () => this.east,
        getNorth: () => this.north,
        getSouth: () => this.south,
        getWest: () => this.west,
      };
    }
    getCanvas() {
      return { style: { cursor: this.removed ? "" : "" } };
    }
    remove() {
      this.removed = true;
    }
  }
  return { FakeMap, instances };
});

vi.mock(import("maplibre-gl"), () => ({
  default: {
    Map: engine.FakeMap,
    NavigationControl: function NavigationControl() {
      return {};
    },
  } as unknown as typeof import("maplibre-gl"),
}));

const adams: CountyScoreSummary = {
  burgdorferi_status: "Present",
  color: "#efc64a",
  county: "Adams",
  evidence_completeness: 6,
  fips: "08001",
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  priority: "Review",
  score: {
    access_signal: 50,
    community: 40,
    ecological: 30,
    human_weakness: 75,
    pathogen_signal: 100,
    rural_signal: 50,
    score: 60,
    svi_signal: 50,
    tick_signal: 0,
  },
  state: "CO",
  state_name: "Colorado",
  tick_status: "No records",
};

const losAngeles: CountyScoreSummary = {
  ...adams,
  county: "Los Angeles",
  fips: "06037",
  state: "CA",
  state_name: "California",
};

const geometry: GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips: string }> =
  {
    features: [
      {
        geometry: {
          coordinates: [
            [
              [-105, 39],
              [-104, 39],
              [-104, 40],
              [-105, 40],
              [-105, 39],
            ],
          ],
          type: "Polygon",
        },
        properties: { fips: "08001" },
        type: "Feature",
      },
      {
        geometry: {
          coordinates: [
            [
              [-118.7, 33.7],
              [-118.3, 33.7],
              [-118.3, 34],
              [-118.7, 34],
              [-118.7, 33.7],
            ],
          ],
          type: "Polygon",
        },
        properties: { fips: "06037" },
        type: "Feature",
      },
    ],
    type: "FeatureCollection",
  };

function stubPrefersReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener() {},
    addListener() {},
    dispatchEvent() {
      return false;
    },
    matches: query === "(prefers-reduced-motion: reduce)" && matches,
    media: query,
    onchange: null,
    removeEventListener() {},
    removeListener() {},
  }));
}

function renderMap(
  selectedFips: string,
  onSelect = vi.fn<(fips: string, surface: string) => void>()
) {
  return render(
    <AtlasMap
      geometry={geometry}
      scores={[adams, losAngeles]}
      selectedFips={selectedFips}
      onSelect={onSelect}
    />
  );
}

function loadMap() {
  const map = engine.instances.at(-1);
  act(() => {
    map?.emit("load");
    map?.emit("idle");
  });
  return map;
}

describe("AtlasMap county camera", () => {
  afterEach(() => {
    cleanup();
    engine.instances.length = 0;
    vi.unstubAllGlobals();
  });

  it("keeps the national overview on first load and fits later county selection", () => {
    stubPrefersReducedMotion(false);
    const view = renderMap("08001");
    const map = loadMap();
    expect(map?.fitBounds).not.toHaveBeenCalled();

    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );

    expect(map?.stop).toHaveBeenCalledOnce();
    expect(map?.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [-118.7, 33.7, -118.3, 34],
      { duration: 450, maxZoom: 8, padding: 48 }
    );
  });

  it("skips camera movement when the selected county is already substantially framed", () => {
    stubPrefersReducedMotion(false);
    const view = renderMap("06037");
    const map = loadMap();
    if (!map) {
      throw new Error("expected a map instance");
    }
    map.west = -105.2;
    map.south = 38.85;
    map.east = -103.8;
    map.north = 40.2;
    map.zoom = estimatedFitZoom([-105, 39, -104, 40]);

    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("uses duration 0 when the user prefers reduced motion", () => {
    stubPrefersReducedMotion(true);
    const view = renderMap("08001");
    const map = loadMap();
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    expect(map?.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [-118.7, 33.7, -118.3, 34],
      { duration: 0, maxZoom: 8, padding: 48 }
    );
  });

  it("stops an in-flight camera move before fitting the latest rapid selection", () => {
    stubPrefersReducedMotion(false);
    const view = renderMap("08001");
    const map = loadMap();
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    expect(map?.stop.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(map?.fitBounds).toHaveBeenLastCalledWith([-105, 39, -104, 40], {
      duration: 450,
      maxZoom: 8,
      padding: 48,
    });
  });

  it("does not treat camera movement as a county selection", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    renderMap("08001", onSelect);
    const map = loadMap();
    act(() => {
      map?.emit("move");
      map?.fitBounds([-118.7, 33.7, -118.3, 34], {
        duration: 450,
        maxZoom: 8,
        padding: 48,
      });
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
