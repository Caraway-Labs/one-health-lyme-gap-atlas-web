import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AtlasDashboard } from "@/components/atlas-dashboard";
import { AtlasMap, type AtlasMapFillColor } from "@/components/atlas-map";
import { reviewNationalNavigationCamera } from "@/features/ux-reset/review/review-national-camera";
import type { CountyScoreSummary } from "@/generated/models";
import { estimatedFitZoom } from "@/lib/atlas-map-camera";
import { parseCountyDisplayGeometry } from "@/lib/county-geography";

const engine = vi.hoisted(() => {
  const instances: FakeMap[] = [];
  const webgl = { fail: false };
  class FakeMap {
    handlers = new Map<string, ((event?: unknown) => void)[]>();
    sources = new Map<
      string,
      {
        data?: unknown;
        promoteId?: string;
        setData: ReturnType<typeof vi.fn>;
      }
    >();
    layers = new Set<string>();
    paint = new Map<string, Record<string, unknown>>();
    filters = new Map<string, unknown>();
    center = { lat: 38.5, lng: -96.5 };
    zoom = 3.05;
    bearing = 0;
    pitch = 0;
    removed = false;
    west = -125;
    south = 24;
    east = -66;
    north = 50;
    jumpTo = vi.fn<(view: { center: [number, number]; zoom: number }) => void>(
      (view) => {
        this.center = { lat: view.center[1], lng: view.center[0] };
        this.zoom = view.zoom;
        this.emit("move");
      }
    );
    stop = vi.fn<() => void>();
    resize = vi.fn<() => void>();
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
        this.emit("move");
        this.emit("moveend");
      }
    );
    setFilter = vi.fn<(layer: string, filter: unknown) => void>(
      (layer, filter) => {
        this.filters.set(layer, filter);
      }
    );
    setPaintProperty = vi.fn<
      (layer: string, name: string, value: unknown) => void
    >((layer, name, value) => {
      const current = this.paint.get(layer) ?? {};
      this.paint.set(layer, { ...current, [name]: value });
    });
    options: Record<string, unknown>;
    constructor(options?: Record<string, unknown>) {
      this.options = options ?? {};
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
    off(event: string, handler: (event?: unknown) => void) {
      const callbacks = this.handlers.get(event);
      if (!callbacks) {
        return;
      }
      this.handlers.set(
        event,
        callbacks.filter((callback) => callback !== handler)
      );
    }
    addControl() {
      this.layers.add("navigation-control");
    }
    addSource(id: string, spec?: { data?: unknown; promoteId?: string }) {
      const record: {
        data?: unknown;
        promoteId?: string;
        setData: ReturnType<typeof vi.fn>;
      } = {
        data: spec?.data,
        promoteId: spec?.promoteId,
        setData: vi.fn<(data: unknown) => void>(),
      };
      record.setData.mockImplementation((data: unknown) => {
        record.data = data;
      });
      this.sources.set(id, record);
    }
    addLayer(layer: {
      filter?: unknown;
      id: string;
      paint?: Record<string, unknown>;
    }) {
      this.layers.add(layer.id);
      if (layer.paint) {
        this.paint.set(layer.id, { ...layer.paint });
      }
      if (layer.filter !== undefined) {
        this.filters.set(layer.id, layer.filter);
      }
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
      return {
        getContext: (kind: string) => {
          if (webgl.fail && kind === "webgl2") {
            return null;
          }
          return this.removed ? null : {};
        },
        style: { cursor: this.removed ? "" : "" },
      };
    }
    triggerRepaint() {}
    remove() {
      this.removed = true;
    }
    removeLayer(id: string) {
      this.layers.delete(id);
      this.paint.delete(id);
      this.filters.delete(id);
    }
    removeSource(id: string) {
      this.sources.delete(id);
    }
    setFeatureState =
      vi.fn<
        (
          target: { id: number | string; source: string },
          state: { hover?: boolean }
        ) => void
      >();
  }
  return { FakeMap, instances, webgl };
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

const adams: CountyScoreSummary = {
  burgdorferi_status: "Present",
  color: "#efc64a",
  county: "Adams",
  evidence_completeness: 6,
  fips: "08001",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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

function setMapBox(width: number, height: number) {
  const element = document.querySelector(".maplibre-atlas");
  if (!element) {
    throw new Error("expected a map container");
  }
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: height,
  });
}

type RecordedResizeObserver = {
  disconnect: () => void;
  observe: (target: Element) => void;
  onResize: () => void;
};

function recordedResizeObserver(instances: RecordedResizeObserver[]) {
  function ResizeObserver(onResize: () => void) {
    const record: RecordedResizeObserver = {
      disconnect() {},
      observe() {},
      onResize,
    };
    instances.push(record);
    return record;
  }
  return ResizeObserver;
}

describe("AtlasMap county camera", () => {
  afterEach(() => {
    cleanup();
    engine.webgl.fail = false;
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

  it("does not report programmatic county framing as a user camera move", () => {
    stubPrefersReducedMotion(false);
    const onMove = vi.fn<(camera: { zoom: number }) => void>();
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        onSelect={onSelect}
        onMove={onMove}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        onSelect={onSelect}
        onMove={onMove}
      />
    );
    expect(map?.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [-118.7, 33.7, -118.3, 34],
      { duration: 450, maxZoom: 8, padding: 48 }
    );
    expect(onMove).not.toHaveBeenCalled();

    act(() => {
      map?.emit("move");
    });
    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      bearing: 0,
      center: { lat: 38.5, lng: -96.5 },
      pitch: 0,
      zoom: 8,
    });
  });

  it("does not frame the camera from highlight selectedState alone", () => {
    stubPrefersReducedMotion(false);
    const view = render(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        selectedState="CA"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    const map = loadMap();
    expect(map?.fitBounds).not.toHaveBeenCalled();
    view.unmount();
  });

  it("fits county bounds when cross-state selection changes highlight state", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = renderMap("08001", onSelect);
    const map = loadMap();
    expect(map?.fitBounds).not.toHaveBeenCalled();
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        selectedState="CA"
        onSelect={onSelect}
      />
    );
    expect(map?.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [-118.7, 33.7, -118.3, 34],
      { duration: 450, maxZoom: 8, padding: 48 }
    );
  });

  it("frames the map to cameraFrameState on Review state scope load", () => {
    stubPrefersReducedMotion(false);
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    const map = loadMap();
    expect(map?.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [-105, 39, -104, 40],
      { duration: 450, maxZoom: 8, padding: 48 }
    );
    view.unmount();
  });

  it("reframes the map when cameraFrameState changes across review scopes", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        cameraFrameState="CA"
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        selectedState="CA"
        onSelect={onSelect}
      />
    );
    expect(map?.fitBounds).toHaveBeenLastCalledWith(
      [-118.7, 33.7, -118.3, 34],
      { duration: 450, maxZoom: 8, padding: 48 }
    );
  });

  it("returns to the contiguous United States camera when Explore resets nationally", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    expect(map?.zoom).toBe(8);
    setMapBox(480, 220);
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const camera = reviewNationalNavigationCamera(480, 220);
    expect({
      center: map?.center,
      fitBounds: map?.fitBounds.mock.calls.length,
      jump: map?.jumpTo.mock.calls.at(-1)?.[0],
      zoom: map?.zoom,
    }).toStrictEqual({
      center: { lat: camera?.center[1], lng: camera?.center[0] },
      fitBounds: 1,
      jump: { center: camera?.center, zoom: camera?.zoom },
      zoom: camera?.zoom,
    });
  });

  it("fits the contiguous United States when the national fit control repeats", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState={null}
        fitSignal={0}
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    setMapBox(480, 220);
    const map = loadMap();
    act(() => {
      map?.emit("move", { originalEvent: new Event("wheel") });
      map?.jumpTo({ center: [-105, 39.7], zoom: 6 });
    });
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        fitSignal={1}
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const camera = reviewNationalNavigationCamera(480, 220);
    expect(map?.jumpTo).toHaveBeenLastCalledWith({
      center: camera?.center,
      zoom: camera?.zoom,
    });
    expect(map?.zoom).toBe(camera?.zoom);
  });

  it("fits the national camera to the pane and keeps a deliberate pan on resize", () => {
    stubPrefersReducedMotion(false);
    const observers: RecordedResizeObserver[] = [];
    vi.stubGlobal("ResizeObserver", recordedResizeObserver(observers));
    render(
      <AtlasMap
        cameraFrameState={null}
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips=""
        selectedState="ALL"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    setMapBox(420, 240);
    const map = loadMap();
    if (!map) {
      throw new Error("expected a map instance");
    }
    const narrow = reviewNationalNavigationCamera(420, 240);
    setMapBox(720, 240);
    act(() => {
      observers[0]?.onResize();
    });
    const wide = reviewNationalNavigationCamera(720, 240);
    act(() => {
      map.emit("move", { originalEvent: new Event("wheel") });
    });
    setMapBox(360, 240);
    act(() => {
      observers[0]?.onResize();
    });
    expect({
      jumps: map.jumpTo.mock.calls.map((call) => call[0]),
      resizes: map.resize.mock.calls.length,
    }).toStrictEqual({
      jumps: [
        { center: narrow?.center, zoom: narrow?.zoom },
        { center: wide?.center, zoom: wide?.zoom },
      ],
      resizes: 2,
    });
  });

  it("leaves the camera in place when a national frame is not opted in", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    expect(map?.jumpTo).not.toHaveBeenCalled();
    expect(map?.zoom).toBe(8);
  });

  it("updates county source colors when scores change", () => {
    stubPrefersReducedMotion(false);
    const view = render(
      <AtlasMap
        geometry={geometry}
        scores={[{ ...adams, color: "#112233" }]}
        selectedFips="08001"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        geometry={geometry}
        scores={[{ ...adams, color: "#445566" }]}
        selectedFips="08001"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    const source = map?.sources.get("counties");
    const latest = source?.setData.mock.calls.at(-1)?.[0] as {
      features: { properties: { color?: string; fips?: string } }[];
    };
    const adamsFeature = latest.features.find(
      (feature) => feature.properties.fips === "08001"
    );
    expect(adamsFeature?.properties.color).toBe("#445566");
    expect(map?.setPaintProperty).toHaveBeenCalledWith(
      "counties-fill",
      "fill-color",
      ["coalesce", ["get", "color"], "#e4e9ea"]
    );
  });

  it("AtlasDashboard keeps national overview when only highlight state is set", () => {
    stubPrefersReducedMotion(false);
    const view = render(
      <AtlasDashboard
        copied={false}
        counties={[adams, losAngeles]}
        datasetVersion="alpha-2026"
        geometry={geometry}
        highlightState="CA"
        onCopy={vi.fn<() => void>()}
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
        onToggleTable={vi.fn<() => void>()}
        scores={[adams, losAngeles]}
        selectedFips="06037"
        selectedState="CA"
        settings={{
          ecological_share: 65,
          smooth_k: 50,
          missing_human_weakness: 75,
        }}
        showTable={false}
      />
    );
    const map = loadMap();
    expect(map?.fitBounds).not.toHaveBeenCalled();
    view.unmount();
  });

  it("refits the focused state when the selected county is cleared", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    expect(map?.fitBounds).toHaveBeenCalledOnce();
    view.rerender(
      <AtlasMap
        cameraFrameState="CO"
        geometry={geometry}
        resetNationalView
        scores={[adams, losAngeles]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    expect(map?.fitBounds).toHaveBeenCalledTimes(2);
    expect(map?.fitBounds).toHaveBeenLastCalledWith([-105, 39, -104, 40], {
      duration: 450,
      maxZoom: 8,
      padding: 48,
    });
    expect(map?.jumpTo).not.toHaveBeenCalled();
  });

  it("fits the selected county when a county-stage frame returns", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const adaBounds: [number, number, number, number] = [
      -117, 42.6, -114.4, 44,
    ];
    const stateBounds: [number, number, number, number] = [
      -117.2, 42.6, -111, 48.9,
    ];
    const fitOptions = { duration: 450, maxZoom: 8, padding: 48 };
    const idahoGeometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        {
          geometry: {
            coordinates: [
              [
                [adaBounds[0], adaBounds[1]],
                [adaBounds[2], adaBounds[1]],
                [adaBounds[2], adaBounds[3]],
                [adaBounds[0], adaBounds[3]],
                [adaBounds[0], adaBounds[1]],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117.2, 44.2],
                [-111, 44.2],
                [-111, 48.9],
                [-117.2, 48.9],
                [-117.2, 44.2],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16085" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    };
    const view = render(
      <AtlasMap
        cameraFrameState={null}
        fitSelectedCounty={false}
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips=""
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty={false}
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips=""
        onSelect={onSelect}
      />
    );
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    setMapBox(480, 220);
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        fitSelectedCounty={false}
        fitSignal={1}
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    expect(map?.fitBounds.mock.calls.map((call) => call[0])).toStrictEqual([
      stateBounds,
      adaBounds,
      adaBounds,
    ]);
    expect(map?.fitBounds.mock.calls.at(-1)?.[1]).toStrictEqual(fitOptions);
    view.unmount();
  });

  it("fits the county on a direct county-stage load and the state for scope", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const adaBounds: [number, number, number, number] = [
      -117, 42.6, -114.4, 44,
    ];
    const stateBounds: [number, number, number, number] = [
      -117.2, 42.6, -111, 48.9,
    ];
    const idahoGeometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        {
          geometry: {
            coordinates: [
              [
                [adaBounds[0], adaBounds[1]],
                [adaBounds[2], adaBounds[1]],
                [adaBounds[2], adaBounds[3]],
                [adaBounds[0], adaBounds[3]],
                [adaBounds[0], adaBounds[1]],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117.2, 44.2],
                [-111, 44.2],
                [-111, 48.9],
                [-117.2, 48.9],
                [-117.2, 44.2],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16085" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    };
    const countyLoad = render(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    const countyMap = loadMap();
    expect(
      countyMap?.fitBounds.mock.calls.map((call) => call[0])
    ).toStrictEqual([adaBounds]);
    countyLoad.unmount();
    engine.instances.length = 0;
    const stateLoad = render(
      <AtlasMap
        cameraFrameState="ID"
        geometry={idahoGeometry}
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    const stateMap = loadMap();
    expect(stateMap?.fitBounds.mock.calls.map((call) => call[0])).toStrictEqual(
      [stateBounds]
    );
    stateLoad.unmount();
  });

  it("fits Idaho and then Ada again after a national reset", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const adaBounds: [number, number, number, number] = [
      -117, 42.6, -114.4, 44,
    ];
    const stateBounds: [number, number, number, number] = [
      -117.2, 42.6, -111, 48.9,
    ];
    const idahoGeometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        {
          geometry: {
            coordinates: [
              [
                [adaBounds[0], adaBounds[1]],
                [adaBounds[2], adaBounds[1]],
                [adaBounds[2], adaBounds[3]],
                [adaBounds[0], adaBounds[3]],
                [adaBounds[0], adaBounds[1]],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117.2, 44.2],
                [-111, 44.2],
                [-111, 48.9],
                [-117.2, 48.9],
                [-117.2, 44.2],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16085" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    };
    const view = render(
      <AtlasMap
        cameraFrameState={null}
        fitSelectedCounty={false}
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty={false}
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips=""
        onSelect={onSelect}
      />
    );
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fitSelectedCounty
        geometry={idahoGeometry}
        resetNationalView
        scores={[]}
        selectedFips="16001"
        onSelect={onSelect}
      />
    );
    expect(map?.fitBounds.mock.calls.map((call) => call[0])).toStrictEqual([
      stateBounds,
      adaBounds,
    ]);
    view.unmount();
  });

  it("paints a black state outline and reports staged clicks without double-click zoom", () => {
    stubPrefersReducedMotion(false);
    const onCountyPointer =
      vi.fn<(click: { clickDetail: number; fips: string }) => void>();
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    render(
      <AtlasMap
        doubleClickZoom={false}
        geographicStateOutline
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips=""
        selectedState="CO"
        onCountyPointer={onCountyPointer}
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    act(() => {
      map?.emit("click:counties-fill", {
        features: [{ properties: { fips: "08001" } }],
        originalEvent: { detail: 1 },
      });
      map?.emit("click:counties-fill", {
        features: [{ properties: { fips: "08001" } }],
        originalEvent: { detail: 2 },
      });
    });
    expect({
      doubleClickZoom: map?.options.doubleClickZoom,
      outline: map?.setPaintProperty.mock.calls.some(
        (call) =>
          call[0] === "selected-state-outline" &&
          call[1] === "line-color" &&
          call[2] === "#000000"
      ),
      pointer: onCountyPointer.mock.calls,
      select: onSelect.mock.calls,
    }).toStrictEqual({
      doubleClickZoom: false,
      outline: true,
      pointer: [
        [{ clickDetail: 1, fips: "08001" }],
        [{ clickDetail: 2, fips: "08001" }],
      ],
      select: [],
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

  it("paints the nationally framed selected state and its counties black without changing other outlines", () => {
    stubPrefersReducedMotion(false);
    const idaho = { ...adams, county: "Ada", fips: "16001", state: "ID" };
    const valley = { ...adams, county: "Valley", fips: "16085", state: "ID" };
    const nationalGeometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        geometry.features[0],
        geometry.features[1],
        {
          geometry: {
            coordinates: [
              [
                [-117, 42.6],
                [-114.4, 42.6],
                [-114.4, 44],
                [-117, 44],
                [-117, 42.6],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117.2, 44],
                [-111, 44],
                [-111, 48.9],
                [-117.2, 48.9],
                [-117.2, 44],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16085" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    };
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const fillColor: AtlasMapFillColor = [
      "coalesce",
      ["get", "color"],
      "#e4e9ea",
    ];
    const view = render(
      <AtlasMap
        cameraFrameState={null}
        fillColor={fillColor}
        geometry={nationalGeometry}
        resetNationalView
        scores={[adams, losAngeles, idaho, valley]}
        selectedFips="16001"
        selectedState="ID"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    const source = map?.sources.get("counties") as
      | { data?: GeoJSON.FeatureCollection }
      | undefined;
    const selectedFips = (source?.data?.features ?? [])
      .filter((feature) => feature.properties?.selectedState === true)
      .map((feature) => feature.properties?.fips)
      .toSorted();
    expect({
      attribute:
        document.querySelector<HTMLElement>(".maplibre-atlas")?.dataset
          .stateOutline,
      countyOutline: map?.paint.get("selected-outline"),
      fill: map?.paint.get("counties-fill")?.["fill-color"],
      filter: map?.filters.get("selected-state-outline"),
      outline: map?.paint.get("selected-state-outline"),
      selectedFips,
    }).toStrictEqual({
      attribute: "accent",
      countyOutline: { "line-color": "#061f3d", "line-width": 3 },
      fill: fillColor,
      filter: ["==", ["get", "selectedState"], true],
      outline: { "line-color": "#000000", "line-width": 2.5 },
      selectedFips: ["16001", "16085"],
    });

    const nextFill: AtlasMapFillColor = [
      "coalesce",
      ["get", "color"],
      "#f4f1ea",
    ];
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        fillColor={nextFill}
        geometry={nationalGeometry}
        resetNationalView
        scores={[adams, losAngeles, idaho, valley]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const colorado = (source?.data?.features ?? [])
      .filter((feature) => feature.properties?.selectedState === true)
      .map((feature) => feature.properties?.fips)
      .toSorted();
    expect({
      colorado,
      fill: map?.paint.get("counties-fill")?.["fill-color"],
      lineColor: map?.paint.get("selected-state-outline")?.["line-color"],
    }).toStrictEqual({
      colorado: ["08001"],
      fill: nextFill,
      lineColor: "#000000",
    });

    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        fillColor={nextFill}
        geometry={nationalGeometry}
        resetNationalView
        scores={[adams, losAngeles, idaho, valley]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const cleared = (source?.data?.features ?? [])
      .filter((feature) => feature.properties?.selectedState === true)
      .map((feature) => feature.properties?.fips);
    expect({
      cleared,
      outline: map?.paint.get("selected-state-outline"),
    }).toStrictEqual({
      cleared: [],
      outline: { "line-color": "#0b7285", "line-width": 2.5 },
    });
    view.unmount();
  });

  it("paints state-scoped boundaries black across state changes, layers, and camera updates", () => {
    stubPrefersReducedMotion(false);
    const arapahoe = {
      ...adams,
      county: "Arapahoe",
      fips: "08005",
      state: "CO",
    };
    const idaho = { ...adams, county: "Ada", fips: "16001", state: "ID" };
    const valley = { ...adams, county: "Valley", fips: "16085", state: "ID" };
    const scopedGeometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        geometry.features[0],
        {
          geometry: {
            coordinates: [
              [
                [-105.2, 39.2],
                [-104.2, 39.2],
                [-104.2, 39.8],
                [-105.2, 39.8],
                [-105.2, 39.2],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "08005" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117, 42.6],
                [-114.4, 42.6],
                [-114.4, 44],
                [-117, 44],
                [-117, 42.6],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-117.2, 44],
                [-111, 44],
                [-111, 48.9],
                [-117.2, 48.9],
                [-117.2, 44],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "16085" },
          type: "Feature",
        },
        geometry.features[1],
      ],
      type: "FeatureCollection",
    };
    const gapFill: AtlasMapFillColor = [
      "coalesce",
      ["get", "color"],
      "#e4e9ea",
    ];
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        cameraFrameState="CO"
        fillColor={gapFill}
        geometry={scopedGeometry}
        scores={[adams, arapahoe, idaho, valley, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    const selectedFips = () => {
      const source = map?.sources.get("counties") as
        | { data?: GeoJSON.FeatureCollection }
        | undefined;
      return (source?.data?.features ?? [])
        .filter((feature) => feature.properties?.selectedState === true)
        .map((feature) => feature.properties?.fips)
        .toSorted();
    };
    const initial = {
      attribute:
        document.querySelector<HTMLElement>(".maplibre-atlas")?.dataset
          .stateOutline,
      countyOutline: map?.paint.get("selected-outline"),
      fill: map?.paint.get("counties-fill")?.["fill-color"],
      filter: map?.filters.get("selected-state-outline"),
      outline: map?.paint.get("selected-state-outline"),
      selectedFips: selectedFips(),
    };
    const tickFill: AtlasMapFillColor = [
      "match",
      ["get", "tick"],
      "established",
      "#1d4e89",
      "#f4f1ea",
    ];
    view.rerender(
      <AtlasMap
        cameraFrameState="CO"
        fillColor={tickFill}
        geometry={scopedGeometry}
        scores={[adams, arapahoe, idaho, valley, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const layered = {
      fill: map?.paint.get("counties-fill")?.["fill-color"],
      outline: map?.paint.get("selected-state-outline"),
    };
    act(() => {
      map?.emit("move");
      map?.jumpTo({ center: [-104.8, 39.5], zoom: 6 });
    });
    const moved = map?.paint.get("selected-state-outline");
    view.rerender(
      <AtlasMap
        cameraFrameState="ID"
        fillColor={tickFill}
        geometry={scopedGeometry}
        scores={[adams, arapahoe, idaho, valley, losAngeles]}
        selectedFips=""
        selectedState="ID"
        onSelect={onSelect}
      />
    );
    const idahoFrame = {
      countyOutline: map?.paint.get("selected-outline"),
      outline: map?.paint.get("selected-state-outline"),
      selectedFips: selectedFips(),
    };
    view.rerender(
      <AtlasMap
        cameraFrameState="CO"
        fillColor={gapFill}
        geometry={scopedGeometry}
        scores={[adams, arapahoe, idaho, valley, losAngeles]}
        selectedFips="08005"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const coloradoAgain = {
      outline: map?.paint.get("selected-state-outline")?.["line-color"],
      selectedFips: selectedFips(),
    };
    view.rerender(
      <AtlasMap
        cameraFrameState={null}
        fillColor={gapFill}
        geometry={scopedGeometry}
        resetNationalView
        scores={[adams, arapahoe, idaho, valley, losAngeles]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const black = { "line-color": "#000000", "line-width": 2.5 };
    expect({
      cleared: {
        outline: map?.paint.get("selected-state-outline"),
        selectedFips: selectedFips(),
      },
      coloradoAgain,
      idahoFrame,
      initial,
      layered,
      moved,
      selections: onSelect.mock.calls,
    }).toStrictEqual({
      cleared: {
        outline: { "line-color": "#0b7285", "line-width": 2.5 },
        selectedFips: [],
      },
      coloradoAgain: {
        outline: "#000000",
        selectedFips: ["08001", "08005"],
      },
      idahoFrame: {
        countyOutline: { "line-color": "#061f3d", "line-width": 3 },
        outline: black,
        selectedFips: ["16001", "16085"],
      },
      initial: {
        attribute: "accent",
        countyOutline: { "line-color": "#061f3d", "line-width": 3 },
        fill: gapFill,
        filter: ["==", ["get", "selectedState"], true],
        outline: black,
        selectedFips: ["08001", "08005"],
      },
      layered: { fill: tickFill, outline: black },
      moved: black,
      selections: [],
    });
    view.unmount();
  });

  it("keeps the focused-state outline black and lighter than the national selection stroke", () => {
    stubPrefersReducedMotion(false);
    render(
      <AtlasMap
        cameraFrameState="ID"
        geographicStateOutline
        geometry={geometry}
        resetNationalView
        scores={[adams]}
        selectedFips=""
        selectedState="ID"
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
      />
    );
    const map = loadMap();
    expect(map?.paint.get("selected-state-outline")).toStrictEqual({
      "line-color": "#000000",
      "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1, 5, 1.35, 8, 2],
    });
    expect(
      document.querySelector<HTMLElement>(".maplibre-atlas")?.dataset
        .stateOutline
    ).toBe("black");
  });

  it("reports WebGL failure and empty geometry without throwing", () => {
    stubPrefersReducedMotion(false);
    engine.webgl.fail = true;
    const onError = vi.fn<() => void>();
    expect(() => {
      render(
        <AtlasMap
          geometry={{ features: [], type: "FeatureCollection" }}
          resetNationalView
          scores={[]}
          selectedFips=""
          selectedState="ID"
          onError={onError}
          onSelect={vi.fn<(fips: string, surface: string) => void>()}
        />
      );
    }).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    cleanup();
    engine.webgl.fail = false;
    engine.instances.length = 0;
    expect(() => {
      render(
        <AtlasMap
          geometry={{ features: [], type: "FeatureCollection" }}
          resetNationalView
          scores={[]}
          selectedFips=""
          selectedState="ID"
          onSelect={vi.fn<(fips: string, surface: string) => void>()}
        />
      );
      loadMap();
    }).not.toThrow();
  });

  it("draws neutral county boundaries without recoloring the shared county stroke", () => {
    stubPrefersReducedMotion(false);
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        geographicStateOutline
        geometry={geometry}
        neutralCountyBoundaries
        scores={[
          { ...adams, color: "#F3F4F6" },
          { ...losAngeles, color: "#F3F4F6" },
        ]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    const stateSource = map?.sources.get("state-boundary-lines") as
      | { data?: GeoJSON.FeatureCollection }
      | undefined;
    const selectedSource = map?.sources.get("selected-state-perimeter") as
      | { data?: GeoJSON.FeatureCollection }
      | undefined;
    expect({
      countyStroke: map?.paint.get("county-boundary-lines")?.["line-color"],
      layers: [
        map?.layers.has("county-boundary-lines"),
        map?.layers.has("selected-state-perimeter"),
        map?.layers.has("state-boundary-lines"),
      ],
      selectedCounty: map?.paint.get("selected-outline"),
      selectedPerimeter: map?.paint.get("selected-state-perimeter"),
      selectedStateOpacity: map?.paint.get("selected-state-outline")?.[
        "line-opacity"
      ],
      stateStroke: map?.paint.get("state-boundary-lines")?.["line-color"],
    }).toStrictEqual({
      countyStroke: "#4B5563",
      layers: [true, true, true],
      selectedCounty: { "line-color": "#061f3d", "line-width": 3 },
      selectedPerimeter: { "line-color": "#000000", "line-width": 2.5 },
      selectedStateOpacity: 0,
      stateStroke: "#1F2937",
    });
    expect({
      selectedLines: selectedSource?.data?.features.length,
      stateLines: stateSource?.data?.features.length,
    }).toStrictEqual({ selectedLines: 1, stateLines: 1 });

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={geometry}
        scores={[adams, losAngeles]}
        selectedFips="08001"
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    expect({
      countyLines: map?.layers.has("county-boundary-lines"),
      selectedCounty: map?.paint.get("selected-outline"),
      selectedStateOpacity: map?.paint.get("selected-state-outline")?.[
        "line-opacity"
      ],
    }).toStrictEqual({
      countyLines: false,
      selectedCounty: { "line-color": "#061f3d", "line-width": 3 },
      selectedStateOpacity: 1,
    });
  });

  it("hovers parsed counties by five-digit FIPS across pointer moves and filtering", () => {
    stubPrefersReducedMotion(false);
    const parsed = parseCountyDisplayGeometry({
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
          id: 8001,
          properties: { fips: "08001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-104, 39],
                [-103, 39],
                [-103, 40],
                [-104, 40],
                [-104, 39],
              ],
            ],
            type: "Polygon",
          },
          id: "08005",
          properties: { fips: "08005" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    const parsedIds = parsed.features.map((feature) => "id" in feature);
    const arapahoe = {
      ...adams,
      county: "Arapahoe",
      fips: "08005",
    };
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const view = render(
      <AtlasMap
        geometry={parsed}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    if (!map) {
      throw new Error("expected a map instance");
    }
    const adamsPointer = countyPointerFeature(map, "08001");
    const arapahoePointer = countyPointerFeature(map, "08005");
    expect({
      adamsId: adamsPointer.id,
      arapahoeId: arapahoePointer.id,
      parsedIds,
    }).toStrictEqual({
      adamsId: "08001",
      arapahoeId: "08005",
      parsedIds: [false, false],
    });
    act(() => {
      map.emit("mousemove:counties-fill", { features: [adamsPointer] });
      map.emit("mousemove:counties-fill", { features: [arapahoePointer] });
      map.emit("mouseleave:counties-fill");
      map.emit("mousemove:counties-fill", { features: [adamsPointer] });
    });
    expect(map.setFeatureState.mock.calls).toStrictEqual([
      [{ id: "08001", source: "counties" }, { hover: true }],
      [{ id: "08001", source: "counties" }, { hover: false }],
      [{ id: "08005", source: "counties" }, { hover: true }],
      [{ id: "08005", source: "counties" }, { hover: false }],
      [{ id: "08001", source: "counties" }, { hover: true }],
    ]);

    map.setFeatureState.mockClear();
    view.rerender(
      <AtlasMap
        geometry={parsed}
        includeUnscoredCounties={false}
        neutralCountyBoundaries
        scores={[arapahoe]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    expect({
      calls: map.setFeatureState.mock.calls,
      fill: fillFips(map),
      remainingId: resolvedCountyFeatureId(map, "08005"),
    }).toStrictEqual({
      calls: [[{ id: "08001", source: "counties" }, { hover: true }]],
      fill: ["08005"],
      remainingId: "08005",
    });

    act(() => {
      map.emit("mouseleave:counties-fill");
    });
    view.rerender(
      <AtlasMap
        geometry={parsed}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const restored = countyPointerFeature(map, "08001");
    act(() => {
      map.emit("mousemove:counties-fill", { features: [restored] });
    });
    expect({
      id: restored.id,
      lastCall: map.setFeatureState.mock.calls.at(-1),
    }).toStrictEqual({
      id: "08001",
      lastCall: [{ id: "08001", source: "counties" }, { hover: true }],
    });
  });

  it("keeps state perimeters on the unfiltered display geometry", () => {
    stubPrefersReducedMotion(false);
    const adjacent = parseCountyDisplayGeometry({
      features: [
        squareCounty("08001", -105, 39),
        squareCounty("08005", -104, 39),
      ],
      type: "FeatureCollection",
    });
    const shifted = parseCountyDisplayGeometry({
      features: [
        squareCounty("08001", -95, 39),
        squareCounty("08005", -94, 39),
      ],
      type: "FeatureCollection",
    });
    const arapahoe = { ...adams, county: "Arapahoe", fips: "08005" };
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    const sharedEdge = "-104,39|-104,40";
    const view = render(
      <AtlasMap
        geographicStateOutline
        geometry={adjacent}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const map = loadMap();
    if (!map) {
      throw new Error("expected a map instance");
    }
    const nationalPerimeter = boundarySegments(map, "state-boundary-lines");
    expect({
      eastEdge: nationalPerimeter.includes("-103,39|-103,40"),
      fill: fillFips(map),
      selected: boundarySegments(map, "selected-state-perimeter"),
      sharedEdge: nationalPerimeter.includes(sharedEdge),
      westEdge: nationalPerimeter.includes("-105,39|-105,40"),
    }).toStrictEqual({
      eastEdge: true,
      fill: ["08001", "08005"],
      selected: [],
      sharedEdge: false,
      westEdge: true,
    });

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={adjacent}
        includeUnscoredCounties={false}
        neutralCountyBoundaries
        scores={[adams]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    const filteredNational = boundarySegments(map, "state-boundary-lines");
    expect({
      fill: fillFips(map),
      sharedEdge: filteredNational.includes(sharedEdge),
      state: filteredNational,
    }).toStrictEqual({
      fill: ["08001"],
      sharedEdge: false,
      state: nationalPerimeter,
    });

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={adjacent}
        includeUnscoredCounties={false}
        neutralCountyBoundaries
        scores={[adams]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const filteredStatePerimeter = boundarySegments(
      map,
      "selected-state-perimeter"
    );
    expect({
      selected: filteredStatePerimeter,
      sharedEdge: filteredStatePerimeter.includes(sharedEdge),
      state: boundarySegments(map, "state-boundary-lines"),
    }).toStrictEqual({
      selected: nationalPerimeter,
      sharedEdge: false,
      state: nationalPerimeter,
    });

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={adjacent}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const clearedStatePerimeter = boundarySegments(
      map,
      "selected-state-perimeter"
    );
    const clearedFill = fillFips(map);

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={adjacent}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="ALL"
        onSelect={onSelect}
      />
    );
    expect({
      clearedFill,
      clearedStatePerimeter,
      nationalSelected: boundarySegments(map, "selected-state-perimeter"),
      nationalState: boundarySegments(map, "state-boundary-lines"),
    }).toStrictEqual({
      clearedFill: ["08001", "08005"],
      clearedStatePerimeter: filteredStatePerimeter,
      nationalSelected: [],
      nationalState: nationalPerimeter,
    });

    view.rerender(
      <AtlasMap
        geographicStateOutline
        geometry={shifted}
        neutralCountyBoundaries
        scores={[adams, arapahoe]}
        selectedFips=""
        selectedState="CO"
        onSelect={onSelect}
      />
    );
    const shiftedPerimeter = boundarySegments(map, "selected-state-perimeter");
    expect({
      changed: shiftedPerimeter.join(";") !== filteredStatePerimeter.join(";"),
      oldWestEdge: shiftedPerimeter.includes("-105,39|-105,40"),
      sharedEdge: shiftedPerimeter.includes("-94,39|-94,40"),
      westEdge: shiftedPerimeter.includes("-95,39|-95,40"),
    }).toStrictEqual({
      changed: true,
      oldWestEdge: false,
      sharedEdge: false,
      westEdge: true,
    });
  });
});

function squareCounty(fips: string, west: number, south: number) {
  return {
    geometry: {
      coordinates: [
        [
          [west, south],
          [west + 1, south],
          [west + 1, south + 1],
          [west, south + 1],
          [west, south],
        ],
      ],
      type: "Polygon" as const,
    },
    id: fips,
    properties: { extra: "stripped", fips },
    type: "Feature" as const,
  };
}

type LoadedMap = NonNullable<ReturnType<typeof loadMap>>;

function resolvedCountyFeatureId(
  map: LoadedMap,
  fips: string
): number | string | undefined {
  const source = map.sources.get("counties");
  const data = source?.data as GeoJSON.FeatureCollection | undefined;
  const feature = data?.features.find((item) => item.properties?.fips === fips);
  if (!feature) {
    return undefined;
  }
  if (source?.promoteId) {
    const promoted = feature.properties?.[source.promoteId];
    if (typeof promoted === "string" || typeof promoted === "number") {
      return promoted;
    }
    return undefined;
  }
  if (typeof feature.id === "string") {
    const parsed = Number.parseInt(feature.id, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof feature.id === "number") {
    return feature.id;
  }
  return undefined;
}

function countyPointerFeature(map: LoadedMap, fips: string) {
  const id = resolvedCountyFeatureId(map, fips);
  return {
    ...(typeof id === "string" || typeof id === "number" ? { id } : {}),
    properties: { fips },
  };
}

function fillFips(map: LoadedMap): string[] {
  const source = map.sources.get("counties");
  const data = source?.data as
    | GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips?: string }>
    | undefined;
  return (data?.features ?? []).flatMap((feature) => {
    const fips = feature.properties?.fips;
    return typeof fips === "string" ? [fips] : [];
  });
}

function boundarySegments(map: LoadedMap, sourceId: string): string[] {
  const source = map.sources.get(sourceId);
  const data = source?.data as GeoJSON.FeatureCollection | undefined;
  const segments: string[] = [];
  for (const feature of data?.features ?? []) {
    if (feature.geometry?.type !== "MultiLineString") {
      continue;
    }
    for (const line of feature.geometry.coordinates) {
      for (let index = 0; index < line.length - 1; index += 1) {
        const start = line[index];
        const end = line[index + 1];
        if (!(start && end)) {
          continue;
        }
        const left = `${start[0]},${start[1]}`;
        const right = `${end[0]},${end[1]}`;
        segments.push(left < right ? `${left}|${right}` : `${right}|${left}`);
      }
    }
  }
  return segments.sort();
}
