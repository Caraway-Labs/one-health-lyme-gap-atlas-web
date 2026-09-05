import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExplorerMaps from "@/features/geographic-explorer/maps";
import type { CountyScoreSummary } from "@/generated/models";

const engine = vi.hoisted(() => {
  const instances: FakeMap[] = [];
  class FakeMap {
    handlers = new Map<string, ((event?: unknown) => void)[]>();
    sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
    layers = new Set<string>();
    center = { lng: -98, lat: 38 };
    zoom = 2.5;
    bearing = 0;
    pitch = 0;
    removed = false;
    jumpTo = vi.fn<
      (camera: {
        center: { lng: number; lat: number };
        zoom: number;
        bearing: number;
        pitch: number;
      }) => void
    >(
      (camera: {
        center: { lng: number; lat: number };
        zoom: number;
        bearing: number;
        pitch: number;
      }) => {
        this.center = camera.center;
        this.zoom = camera.zoom;
        this.bearing = camera.bearing;
        this.pitch = camera.pitch;
        this.emit("move");
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
      for (const handler of this.handlers.get(event) ?? []) handler(payload);
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
    remove() {
      this.removed = true;
    }
  }
  return { instances, FakeMap };
});
vi.mock(import("maplibre-gl"), () => ({
  default: {
    Map: engine.FakeMap,
    NavigationControl: function NavigationControl() {
      return {};
    },
  } as unknown as typeof import("maplibre-gl"),
}));
describe("geographic map behavior", () => {
  afterEach(() => {
    cleanup();
    engine.instances.length = 0;
  });

  const county: CountyScoreSummary = {
    fips: "08001",
    county: "Adams",
    state: "CO",
    state_name: "Colorado",
    in_contiguous_tick_scope: true,
    human_status: "no_county_linked_record",
    tick_status: "No records",
    burgdorferi_status: "Present",
    evidence_completeness: 0,
    color: "#efc64a",
    priority: "Review",
    score: {
      score: 60,
      human_weakness: 75,
      ecological: 30,
      community: 40,
      tick_signal: 0,
      pathogen_signal: 100,
      svi_signal: 50,
      access_signal: 50,
      rural_signal: 50,
    },
  };
  const geometry: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { fips: "08001" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-105, 39],
              [-104, 39],
              [-104, 40],
              [-105, 39],
            ],
          ],
        },
      },
    ],
  };

  it("synchronizes camera changes in either direction without a feedback loop", () => {
    render(
      <ExplorerMaps
        geometry={geometry}
        counties={[county]}
        selectedFips="08001"
        maximum={6}
        dual
        onSelect={vi.fn<(...args: unknown[]) => void>()}
      />
    );
    const [left, right] = engine.instances;
    act(() => {
      left.emit("load");
      right.emit("load");
    });
    left.center = { lng: -105, lat: 40 };
    left.zoom = 6;
    left.bearing = 10;
    left.pitch = 20;
    act(() => left.emit("move"));
    expect(right.jumpTo).toHaveBeenCalledExactlyOnceWith({
      center: left.center,
      zoom: 6,
      bearing: 10,
      pitch: 20,
    });
    expect(left.jumpTo).not.toHaveBeenCalled();
    right.zoom = 4;
    act(() => right.emit("move"));
    expect(left.jumpTo).toHaveBeenCalledExactlyOnceWith({
      center: right.center,
      zoom: 4,
      bearing: 10,
      pitch: 20,
    });
  });

  it("refreshes matching geometry and selection without rebuilding maps and cleans up on unmount", () => {
    const select = vi.fn<(...args: unknown[]) => void>();
    const view = render(
      <ExplorerMaps
        geometry={geometry}
        counties={[county]}
        selectedFips="08001"
        maximum={6}
        dual
        onSelect={select}
      />
    );
    const [left, right] = engine.instances;
    act(() => {
      left.emit("load");
      right.emit("load");
      left.emit("click:county-fill", {
        features: [{ properties: { fips: "08001" } }],
      });
    });
    expect(select).toHaveBeenCalledWith("08001");
    view.rerender(
      <ExplorerMaps
        geometry={geometry}
        counties={[]}
        selectedFips="08003"
        maximum={6}
        dual
        onSelect={select}
      />
    );
    expect(engine.instances).toHaveLength(2);
    expect(left.getSource("counties")?.setData).toHaveBeenLastCalledWith({
      type: "FeatureCollection",
      features: [],
    });
    expect(right.setFilter).toHaveBeenLastCalledWith("county-selection", [
      "==",
      ["get", "fips"],
      "08003",
    ]);
    view.unmount();
    expect(left.removed && right.removed).toBeTruthy();
  });
});
