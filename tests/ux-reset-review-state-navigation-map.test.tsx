import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewStateFeatureCollection } from "@/features/ux-reset/review/review-state-navigation";
import {
  ReviewStateNavigationMap,
  type ReviewNavigationColors,
} from "@/features/ux-reset/review/review-state-navigation-map";

type LayerSpec = {
  id: string;
  paint?: Record<string, unknown>;
  source?: string;
  type: string;
};

type SourceSpec = {
  data: ReviewStateFeatureCollection;
  promoteId?: string;
  type: string;
};

const engine = vi.hoisted(() => {
  const instances: FakeMap[] = [];
  let throwOnConstruct = false;
  let webglContext: "missing" | "present" | "unavailable" = "missing";

  class FakeMap {
    handlers = new Map<string, ((event?: unknown) => void)[]>();
    layers: LayerSpec[] = [];
    options: Record<string, unknown> = {};
    removed = false;
    sources = new Map<
      string,
      { setData: ReturnType<typeof vi.fn>; spec: SourceSpec }
    >();
    setFeatureState = vi.fn<(target: unknown, state: unknown) => void>();
    resize = vi.fn<() => void>();
    canvas: {
      getContext?: (kind: string) => object | null;
      style: { cursor: string };
      tabIndex: number;
    } = { style: { cursor: "" }, tabIndex: 0 };

    constructor(options: Record<string, unknown>) {
      if (throwOnConstruct) {
        throw new Error("WebGL unavailable");
      }
      this.options = options;
      if (webglContext === "unavailable") {
        this.canvas.getContext = () => null;
      }
      if (webglContext === "present") {
        this.canvas.getContext = () => ({});
      }
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

    addSource(id: string, spec: SourceSpec) {
      this.sources.set(id, {
        setData: vi.fn<(data: ReviewStateFeatureCollection) => void>(),
        spec,
      });
    }

    addLayer(layer: LayerSpec) {
      this.layers.push(layer);
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    getCanvas() {
      return this.canvas;
    }

    remove() {
      this.removed = true;
    }
  }

  return {
    FakeMap,
    instances,
    reset() {
      instances.length = 0;
      throwOnConstruct = false;
      webglContext = "missing";
    },
    setThrowOnConstruct(value: boolean) {
      throwOnConstruct = value;
    },
    setWebglContext(value: "missing" | "present" | "unavailable") {
      webglContext = value;
    },
  };
});

const setWorkerUrl = vi.hoisted(() => vi.fn<(url: string) => void>());

vi.mock(
  import("maplibre-gl"),
  () =>
    ({
      Map: engine.FakeMap,
      setWorkerUrl,
    }) as unknown as Partial<typeof import("maplibre-gl")>
);

const colors: ReviewNavigationColors = {
  canvas: "rgb(1, 1, 1)",
  fill: "rgb(2, 2, 2)",
  focus: "rgb(3, 3, 3)",
  hover: "rgb(4, 4, 4)",
  outline: "rgb(5, 5, 5)",
  outlineActive: "rgb(6, 6, 6)",
  selected: "rgb(7, 7, 7)",
  unavailable: "rgb(8, 8, 8)",
  unavailableHover: "rgb(9, 9, 9)",
};

function features(): ReviewStateFeatureCollection {
  return {
    features: [
      {
        geometry: { coordinates: [], type: "MultiPolygon" },
        id: "CO",
        properties: { availability: "supported", code: "CO", name: "Colorado" },
        type: "Feature",
      },
      {
        geometry: { coordinates: [], type: "MultiPolygon" },
        id: "WY",
        properties: { availability: "unavailable", code: "WY", name: "" },
        type: "Feature",
      },
    ],
    type: "FeatureCollection",
  };
}

function renderNavigationMap(
  props: Partial<Parameters<typeof ReviewStateNavigationMap>[0]> = {}
) {
  const onActivate = vi.fn<(code: string) => void>();
  const onHover = vi.fn<(code: string | null) => void>();
  const onLoadFailed = vi.fn<() => void>();
  const onReady = vi.fn<() => void>();
  const onWebglUnavailable = vi.fn<() => void>();
  const view = render(
    <ReviewStateNavigationMap
      colors={colors}
      features={features()}
      focusCode={null}
      hoverCode={null}
      selectedCode={null}
      onActivate={onActivate}
      onHover={onHover}
      onLoadFailed={onLoadFailed}
      onReady={onReady}
      onWebglUnavailable={onWebglUnavailable}
      {...props}
    />
  );
  return {
    ...view,
    handleActivate: onActivate,
    handleHover: onHover,
    handleLoadFailed: onLoadFailed,
    handleReady: onReady,
    handleWebglUnavailable: onWebglUnavailable,
  };
}

describe("Review state navigation map lifecycle", () => {
  afterEach(() => {
    cleanup();
    engine.reset();
    setWorkerUrl.mockClear();
  });

  it("constructs one static map and registers its source and layers once", () => {
    const view = renderNavigationMap();
    const map = engine.instances[0];
    if (!map) {
      throw new Error("expected a map instance");
    }
    expect({
      instances: engine.instances.length,
      layersBeforeLoad: map.layers.length,
      options: {
        attributionControl: map.options.attributionControl,
        dragPan: map.options.dragPan,
        keyboard: map.options.keyboard,
        scrollZoom: map.options.scrollZoom,
        touchZoomRotate: map.options.touchZoomRotate,
      },
      workerUrl: setWorkerUrl.mock.calls,
    }).toStrictEqual({
      instances: 1,
      layersBeforeLoad: 0,
      options: {
        attributionControl: false,
        dragPan: false,
        keyboard: false,
        scrollZoom: false,
        touchZoomRotate: false,
      },
      workerUrl: [["/maplibre/maplibre-gl-worker.mjs"]],
    });
    map.emit("load");
    map.emit("load");
    const source = map.sources.get("review-states");
    const fill = map.layers.find((layer) => layer.id === "review-states-fill");
    const fillPaint = JSON.stringify(fill?.paint);
    expect({
      fillColor: fillPaint.includes("rgb(2, 2, 2)"),
      hasScoreLanguage: /priority|score|map-ramp|risk/i.test(
        `${JSON.stringify(source?.spec.data)} ${fillPaint}`
      ),
      layerIds: map.layers.map((layer) => layer.id),
      promoteId: source?.spec.promoteId,
      readyCalls: view.handleReady.mock.calls.length,
      sources: map.sources.size,
    }).toStrictEqual({
      fillColor: true,
      hasScoreLanguage: false,
      layerIds: [
        "review-nav-background",
        "review-states-fill",
        "review-states-line",
      ],
      promoteId: "code",
      readyCalls: 1,
      sources: 1,
    });
  });

  it("replaces source data, applies feature state, and removes the map on unmount", () => {
    const view = renderNavigationMap();
    const map = engine.instances[0];
    if (!map) {
      throw new Error("expected a map instance");
    }
    map.emit("load");
    const source = map.sources.get("review-states");
    const next = features();
    view.rerender(
      <ReviewStateNavigationMap
        colors={colors}
        features={next}
        focusCode="CO"
        hoverCode="WY"
        selectedCode={null}
        onActivate={view.handleActivate}
        onHover={view.handleHover}
        onLoadFailed={view.handleLoadFailed}
        onReady={view.handleReady}
        onWebglUnavailable={view.handleWebglUnavailable}
      />
    );
    expect({
      dataUpdates: source?.setData.mock.calls.length,
      featureState: map.setFeatureState.mock.calls,
      sources: map.sources.size,
    }).toStrictEqual({
      dataUpdates: 1,
      featureState: [
        [{ id: "WY", source: "review-states" }, { hover: true }],
        [{ id: "CO", source: "review-states" }, { focus: true }],
      ],
      sources: 1,
    });
    view.unmount();
    expect(map.removed).toBeTruthy();
  });

  it("activates a supported state from a click and ignores an unavailable state", () => {
    const view = renderNavigationMap();
    const map = engine.instances[0];
    map?.emit("load");
    map?.emit("click:review-states-fill", {
      features: [{ properties: { availability: "unavailable", code: "WY" } }],
    });
    map?.emit("click:review-states-fill", {
      features: [{ properties: { availability: "supported", code: "CO" } }],
    });
    map?.emit("mousemove:review-states-fill", {
      features: [{ properties: { availability: "supported", code: "CO" } }],
    });
    map?.emit("mouseleave:review-states-fill");
    expect({
      activated: view.handleActivate.mock.calls,
      cursor: map?.canvas.style.cursor,
      hover: view.handleHover.mock.calls,
    }).toStrictEqual({
      activated: [["CO"]],
      cursor: "",
      hover: [["CO"], [null]],
    });
  });

  it.each([
    ["constructor", "webgl", null],
    ["context", "webgl", true],
    ["style", "load", false],
  ] as const)("reports %s failure as %s", (kind, failure, removed) => {
    if (kind === "constructor") {
      engine.setThrowOnConstruct(true);
    }
    if (kind === "context") {
      engine.setWebglContext("unavailable");
    }
    const view = renderNavigationMap();
    if (kind === "style") {
      engine.instances[0]?.emit("error", {
        error: new Error("Failed to load style"),
      });
    }
    expect({
      loadFailed: view.handleLoadFailed.mock.calls.length,
      ready: view.handleReady.mock.calls.length,
      removed: engine.instances[0]?.removed ?? null,
      webgl: view.handleWebglUnavailable.mock.calls.length,
    }).toStrictEqual({
      loadFailed: failure === "load" ? 1 : 0,
      ready: 0,
      removed,
      webgl: failure === "webgl" ? 1 : 0,
    });
  });

  it("ignores a tile error after the source is ready and drops a late load after unmount", () => {
    const view = renderNavigationMap();
    const map = engine.instances[0];
    if (!map) {
      throw new Error("expected a map instance");
    }
    map.emit("load");
    map.emit("error", { error: new Error("tile not found") });
    view.unmount();
    map.emit("load");
    expect({
      loadFailed: view.handleLoadFailed.mock.calls.length,
      ready: view.handleReady.mock.calls.length,
      removed: map.removed,
      sources: map.sources.size,
    }).toStrictEqual({
      loadFailed: 0,
      ready: 1,
      removed: true,
      sources: 1,
    });
  });

  it("does not construct a map when navigation colors are unresolved", () => {
    const view = renderNavigationMap({ colors: null });
    expect({
      instances: engine.instances.length,
      loadFailed: view.handleLoadFailed.mock.calls.length,
    }).toStrictEqual({
      instances: 0,
      loadFailed: 1,
    });
  });
});
