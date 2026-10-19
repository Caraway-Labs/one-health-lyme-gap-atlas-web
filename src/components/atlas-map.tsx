"use client";

import type {
  ExpressionSpecification,
  FillLayerSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { Map as MapLibre, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

import { explorerStateGeometryBounds } from "@/features/ux-reset/review/explorer-map-focus";
import { reviewNationalNavigationCamera } from "@/features/ux-reset/review/review-national-camera";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";
import {
  CONTIGUOUS_US_INITIAL_VIEW,
  contiguousUsGeometry,
} from "@/lib/atlas-geometry";
import {
  countyFeatureBounds,
  countyIsSubstantiallyVisible,
  fitCountyBounds,
  mapCameraDuration,
  type CountyBounds,
} from "@/lib/atlas-map-camera";
import { countyBelongsToDistrict } from "@/lib/health-districts";
import { cn } from "@/lib/utils";

/**
 * Missing completeness stays missing. A published 0 remains 0.
 * Callers that omit the field are not treated as zero percent.
 */
export function mapFeatureCompleteness(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { fips: string }
>;

export type AtlasMapFillColor = NonNullable<
  NonNullable<FillLayerSpecification["paint"]>["fill-color"]
>;

export type AtlasMapCamera = {
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
};

export type AtlasMapHandle = {
  getMap: () => MapLibreMap | null;
};

/** County paint record for map rendering. Review scores satisfy this shape. */
export type AtlasMapCounty = {
  color?: string;
  county?: string;
  evidence_completeness?: number | null;
  fips: string;
  state: string;
};

function mapWithExternalJumpTo(
  map: MapLibreMap,
  applyingExternalMove: { current: boolean }
): MapLibreMap {
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === "jumpTo") {
        return (
          options: Parameters<MapLibreMap["jumpTo"]>[0],
          eventData?: Parameters<MapLibreMap["jumpTo"]>[1]
        ) => {
          applyingExternalMove.current = true;
          try {
            if (eventData === undefined) {
              return target.jumpTo(options);
            }
            return target.jumpTo(options, eventData);
          } finally {
            applyingExternalMove.current = false;
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

const DEFAULT_ARIA_LABEL =
  "County map colored by County Review Priority. Use the county list or results table for keyboard selection.";

const ACCENT_STATE_OUTLINE = "#0b7285";
const GEOGRAPHIC_STATE_OUTLINE = "#000000";

export type AtlasMapCountyPointer = {
  clickDetail: number;
  fips: string;
};

function stateOutlinePaint(geographic: boolean): {
  "line-color": string;
  "line-width": number | ExpressionSpecification;
} {
  if (!geographic) {
    return { "line-color": ACCENT_STATE_OUTLINE, "line-width": 2.5 };
  }
  return {
    "line-color": GEOGRAPHIC_STATE_OUTLINE,
    "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1, 5, 1.35, 8, 2],
  };
}

const DEFAULT_FILL_COLOR: AtlasMapFillColor = [
  "coalesce",
  ["get", "color"],
  "#e4e9ea",
];

function atlasMapContainerRole(role: "img" | "none"): "img" | undefined {
  switch (role) {
    case "img": {
      return "img";
    }
    case "none": {
      return undefined;
    }
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

function viewportBoundsFromMap(map: MapLibreMap): CountyBounds {
  const viewport = map.getBounds();
  return [
    viewport.getWest(),
    viewport.getSouth(),
    viewport.getEast(),
    viewport.getNorth(),
  ];
}

export function AtlasMap({
  geometry,
  scores,
  selectedFips,
  selectedState = "ALL",
  cameraFrameState,
  fitSignal = 0,
  resetNationalView = false,
  fitSelectedCounty = false,
  geographicStateOutline = false,
  doubleClickZoom = true,
  selectedDistrict = "ALL",
  onCountyPointer,
  onSelect,
  className,
  ariaLabel = DEFAULT_ARIA_LABEL,
  showOverlays = true,
  includeUnscoredCounties = true,
  fillColor = DEFAULT_FILL_COLOR,
  onMove,
  onIdle,
  onError,
  containerRole = "img",
  ref,
}: {
  geometry: FeatureCollection;
  scores: readonly AtlasMapCounty[];
  selectedFips: string;
  selectedState?: string;
  /** When set, fits the map camera to this state scope (Review). Independent of highlight `selectedState`. */
  cameraFrameState?: string | null;
  /** Increment to fit the camera to the current jurisdiction again. */
  fitSignal?: number;
  /**
   * Opt-in. When the frame returns to the national view, jump back to the
   * contiguous United States camera. Callers that omit this keep the previous
   * camera when `cameraFrameState` is cleared.
   */
  resetNationalView?: boolean;
  /**
   * National Explorer county stage. When a state frame and a selected county
   * arrive together, fit that county. State-scoped maps omit this and keep
   * fitting the whole state.
   */
  fitSelectedCounty?: boolean;
  /**
   * National Explorer state focus. County lines for the focused state are
   * black. Other maps keep the accent state outline.
   */
  geographicStateOutline?: boolean;
  /** National Explorer drill disables double-click zoom so one gesture cannot take both steps. */
  doubleClickZoom?: boolean;
  selectedDistrict?: string;
  /**
   * When set, a county click is reported here instead of `onSelect`.
   * The caller decides state focus versus county selection.
   */
  onCountyPointer?: (click: AtlasMapCountyPointer) => void;
  onSelect: (fips: string, surface: GeographySelectionSurface) => void;
  className?: string;
  ariaLabel?: string;
  showOverlays?: boolean;
  includeUnscoredCounties?: boolean;
  fillColor?: AtlasMapFillColor;
  onMove?: (camera: AtlasMapCamera) => void;
  onIdle?: () => void;
  onError?: () => void;
  containerRole?: "img" | "none";
  ref?: Ref<AtlasMapHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const applyingExternalMove = useRef(false);
  const previousSelectedFips = useRef<string | null>(null);
  const previousFramedState = useRef<string | null>(null);
  const previousFitSignal = useRef(fitSignal);
  const cameraFitGeneration = useRef(0);
  const resetNationalViewRef = useRef(resetNationalView);
  const cameraFrameStateRef = useRef(cameraFrameState);
  const doubleClickZoomRef = useRef(doubleClickZoom);
  const geographicStateOutlineRef = useRef(geographicStateOutline);
  const userAdjustedNationalRef = useRef(false);
  const initialNationalFitRef = useRef(false);
  const fitNationalViewRef = useRef<(instance: MapLibreMap) => boolean>(
    () => false
  );
  const [mapReady, setMapReady] = useState(false);
  const selectRef = useRef(onSelect);
  const countyPointerRef = useRef(onCountyPointer);
  const onMoveRef = useRef(onMove);
  const onIdleRef = useRef(onIdle);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    selectRef.current = onSelect;
    countyPointerRef.current = onCountyPointer;
    onMoveRef.current = onMove;
    onIdleRef.current = onIdle;
    onErrorRef.current = onError;
    resetNationalViewRef.current = resetNationalView;
    cameraFrameStateRef.current = cameraFrameState;
    doubleClickZoomRef.current = doubleClickZoom;
    geographicStateOutlineRef.current = geographicStateOutline;
  });
  fitNationalViewRef.current = (instance) => {
    const element = container.current;
    if (!element) {
      return false;
    }
    const camera = reviewNationalNavigationCamera(
      element.clientWidth,
      element.clientHeight
    );
    if (!camera) {
      return false;
    }
    applyingExternalMove.current = true;
    instance.stop();
    instance.jumpTo({ center: camera.center, zoom: camera.zoom });
    applyingExternalMove.current = false;
    const center = instance.getCenter();
    element.dataset.mapCameraLat = String(center.lat);
    element.dataset.mapCameraLng = String(center.lng);
    element.dataset.mapCameraZoom = String(instance.getZoom());
    return true;
  };

  useImperativeHandle(ref, () => ({
    getMap: () => {
      const current = map.current;
      return current
        ? mapWithExternalJumpTo(current, applyingExternalMove)
        : null;
    },
  }));

  const enriched = (): GeoJSON.FeatureCollection => {
    const byFips = new Map(scores.map((county) => [county.fips, county]));
    const contiguousGeometry = contiguousUsGeometry(geometry);
    return {
      ...contiguousGeometry,
      features: contiguousGeometry.features.flatMap((feature) => {
        const county = byFips.get(feature.properties.fips);
        if (!includeUnscoredCounties && !county) {
          return [];
        }
        return [
          {
            ...feature,
            properties: {
              ...feature.properties,
              color: county?.color ?? "#e4e9ea",
              completeness: mapFeatureCompleteness(
                county?.evidence_completeness
              ),
              selected: feature.properties.fips === selectedFips,
              selectedDistrict: Boolean(
                county?.county &&
                countyBelongsToDistrict(
                  county.state,
                  county.county,
                  selectedState,
                  selectedDistrict
                )
              ),
              selectedState:
                selectedState !== "ALL" && county?.state === selectedState,
            },
          },
        ];
      }),
    };
  };

  useEffect(() => {
    if (!container.current || map.current) {
      return;
    }
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    let instance: MapLibreMap;
    try {
      instance = new MapLibre({
        container: container.current,
        style: { layers: [], sources: {}, version: 8 },
        ...CONTIGUOUS_US_INITIAL_VIEW,
        attributionControl: false,
        doubleClickZoom: doubleClickZoomRef.current,
        maxZoom: 8,
        minZoom: resetNationalView ? 0 : 2,
      });
    } catch {
      onErrorRef.current?.();
      return;
    }
    const canvas = instance.getCanvas();
    if (
      typeof canvas.getContext === "function" &&
      !canvas.getContext("webgl2")
    ) {
      onErrorRef.current?.();
      try {
        instance.remove();
      } catch {
        // WebGL setup can fail before MapLibre creates a painter.
      }
      return;
    }
    instance.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right"
    );
    instance.on("error", () => {
      onErrorRef.current?.();
    });
    instance.on("move", (event) => {
      const center = instance.getCenter();
      const element = container.current;
      if (element) {
        element.dataset.mapCameraLat = String(center.lat);
        element.dataset.mapCameraLng = String(center.lng);
        element.dataset.mapCameraZoom = String(instance.getZoom());
      }
      if (applyingExternalMove.current) {
        return;
      }
      const frame = cameraFrameStateRef.current;
      const nationallyFramed =
        resetNationalViewRef.current && (!frame || frame === "ALL");
      if (event?.originalEvent && nationallyFramed) {
        userAdjustedNationalRef.current = true;
      }
      onMoveRef.current?.({
        center: { lng: center.lng, lat: center.lat },
        zoom: instance.getZoom(),
        bearing: instance.getBearing(),
        pitch: instance.getPitch(),
      });
    });
    instance.on("load", () => {
      instance.addSource("counties", { data: enriched(), type: "geojson" });
      instance.addLayer({
        id: "counties-fill",
        paint: {
          "fill-color": fillColor,
          "fill-opacity": 0.92,
          "fill-outline-color": "rgba(255,255,255,.9)",
        },
        source: "counties",
        type: "fill",
      });
      if (showOverlays) {
        instance.addLayer({
          filter: ["==", ["get", "selectedDistrict"], true],
          id: "selected-district-fill",
          paint: { "fill-color": "#f08c46", "fill-opacity": 0.2 },
          source: "counties",
          type: "fill",
        });
        instance.addLayer({
          filter: ["==", ["get", "selectedDistrict"], true],
          id: "selected-district-outline",
          paint: { "line-color": "#d9480f", "line-width": 5 },
          source: "counties",
          type: "line",
        });
        instance.addLayer({
          filter: ["==", ["get", "selectedState"], true],
          id: "selected-state-outline",
          paint: stateOutlinePaint(geographicStateOutlineRef.current),
          source: "counties",
          type: "line",
        });
      }
      instance.addLayer({
        filter: ["==", ["get", "selected"], true],
        id: "selected-outline",
        paint: { "line-color": "#061f3d", "line-width": 3 },
        source: "counties",
        type: "line",
      });
      instance.on("click", "counties-fill", (event) => {
        const fips = event.features?.[0]?.properties?.fips;
        if (typeof fips !== "string") {
          return;
        }
        const pointer = countyPointerRef.current;
        if (pointer) {
          const detail = event.originalEvent?.detail;
          const clickDetail =
            typeof detail === "number" && detail > 0 ? detail : 1;
          pointer({ clickDetail, fips });
          return;
        }
        selectRef.current(fips, "map");
      });
      instance.on("mouseenter", "counties-fill", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "counties-fill", () => {
        instance.getCanvas().style.cursor = "";
      });
      instance.once("idle", () => {
        onIdleRef.current?.();
      });
      setMapReady(true);
    });
    map.current = instance;
    const observed = container.current;
    const resizeObserver =
      observed && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            instance.resize();
            const frame = cameraFrameStateRef.current;
            const nationallyFramed =
              resetNationalViewRef.current && (!frame || frame === "ALL");
            if (!nationallyFramed || userAdjustedNationalRef.current) {
              return;
            }
            fitNationalViewRef.current(instance);
          })
        : null;
    resizeObserver?.observe(observed as HTMLElement);
    return () => {
      resizeObserver?.disconnect();
      instance.remove();
      map.current = null;
    };
    // The source is initialized once and refreshed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = map.current?.getSource("counties") as
      | GeoJSONSource
      | undefined;
    if (!source || !map.current?.getLayer("selected-outline")) {
      return;
    }
    source.setData(enriched());
    map.current.setPaintProperty("counties-fill", "fill-color", fillColor);
    if (map.current.getLayer("selected-state-outline")) {
      const outline = stateOutlinePaint(geographicStateOutline);
      map.current.setFilter("selected-state-outline", [
        "==",
        ["get", "selectedState"],
        true,
      ]);
      map.current.setPaintProperty(
        "selected-state-outline",
        "line-color",
        outline["line-color"]
      );
      map.current.setPaintProperty(
        "selected-state-outline",
        "line-width",
        outline["line-width"]
      );
    }
    if (map.current.getLayer("selected-district-outline")) {
      map.current.setFilter("selected-district-outline", [
        "==",
        ["get", "selectedDistrict"],
        true,
      ]);
    }
    map.current.setFilter("selected-outline", [
      "==",
      ["get", "selected"],
      true,
    ]);
  });

  useEffect(() => {
    const instance = map.current;
    if (!mapReady || !instance?.getLayer("selected-outline")) {
      return;
    }
    const fitRequested = previousFitSignal.current !== fitSignal;
    if (fitRequested) {
      previousFitSignal.current = fitSignal;
    }
    const frameState =
      cameraFrameState && cameraFrameState !== "ALL" ? cameraFrameState : null;
    if (fitRequested && resetNationalView && !frameState) {
      userAdjustedNationalRef.current = false;
      fitNationalViewRef.current(instance);
      previousFramedState.current = null;
      previousSelectedFips.current = selectedFips;
      return;
    }
    if (fitRequested) {
      previousFramedState.current = null;
    }
    if (!frameState) {
      const shouldResetNational =
        resetNationalView && previousFramedState.current !== null;
      previousFramedState.current = null;
      if (shouldResetNational) {
        userAdjustedNationalRef.current = false;
        fitNationalViewRef.current(instance);
        previousSelectedFips.current = selectedFips;
        return;
      }
      if (
        resetNationalView &&
        !userAdjustedNationalRef.current &&
        !initialNationalFitRef.current &&
        fitNationalViewRef.current(instance)
      ) {
        initialNationalFitRef.current = true;
        previousSelectedFips.current = selectedFips;
        return;
      }
    } else if (previousFramedState.current !== frameState) {
      previousFramedState.current = frameState;
      const selectedFeature = geometry.features.find(
        (item) => item.properties.fips === selectedFips
      );
      const countyBounds = fitSelectedCounty
        ? countyFeatureBounds(selectedFeature ?? null)
        : null;
      const frameBounds =
        countyBounds ?? explorerStateGeometryBounds(geometry, frameState);
      if (frameBounds) {
        applyingExternalMove.current = true;
        const generation = cameraFitGeneration.current + 1;
        cameraFitGeneration.current = generation;
        instance.stop();
        instance.once("moveend", () => {
          if (cameraFitGeneration.current === generation) {
            applyingExternalMove.current = false;
          }
        });
        fitCountyBounds(instance, frameBounds, {
          duration: mapCameraDuration(),
          stop: false,
        });
        previousSelectedFips.current = selectedFips;
        return;
      }
    }
    if (previousSelectedFips.current === null) {
      previousSelectedFips.current = selectedFips;
      return;
    }
    if (previousSelectedFips.current === selectedFips) {
      return;
    }
    const countyCleared =
      previousSelectedFips.current !== "" && selectedFips === "" && frameState;
    previousSelectedFips.current = selectedFips;
    if (countyCleared && frameState) {
      const stateBounds = explorerStateGeometryBounds(geometry, frameState);
      if (stateBounds) {
        applyingExternalMove.current = true;
        const generation = cameraFitGeneration.current + 1;
        cameraFitGeneration.current = generation;
        instance.stop();
        instance.once("moveend", () => {
          if (cameraFitGeneration.current === generation) {
            applyingExternalMove.current = false;
          }
        });
        fitCountyBounds(instance, stateBounds, {
          duration: mapCameraDuration(),
          stop: false,
        });
        return;
      }
    }

    const feature = geometry.features.find(
      (item) => item.properties.fips === selectedFips
    );
    const bounds = countyFeatureBounds(feature ?? null);
    if (!bounds) {
      return;
    }
    if (
      countyIsSubstantiallyVisible({
        county: bounds,
        currentZoom: instance.getZoom(),
        viewport: viewportBoundsFromMap(instance),
      })
    ) {
      return;
    }

    applyingExternalMove.current = true;
    const generation = cameraFitGeneration.current + 1;
    cameraFitGeneration.current = generation;
    instance.stop();
    instance.once("moveend", () => {
      if (cameraFitGeneration.current === generation) {
        applyingExternalMove.current = false;
      }
    });
    fitCountyBounds(instance, bounds, {
      duration: mapCameraDuration(),
      stop: false,
    });
  }, [
    cameraFrameState,
    fitSelectedCounty,
    fitSignal,
    geometry,
    mapReady,
    resetNationalView,
    selectedFips,
  ]);

  return (
    <div
      ref={container}
      className={cn("maplibre-atlas", className)}
      role={atlasMapContainerRole(containerRole)}
      aria-label={
        atlasMapContainerRole(containerRole) === "img" ? ariaLabel : undefined
      }
      data-camera-frame={
        cameraFrameState && cameraFrameState !== "ALL"
          ? cameraFrameState
          : undefined
      }
      data-double-click-zoom={doubleClickZoom ? "true" : "false"}
      data-state-outline={geographicStateOutline ? "black" : "accent"}
    />
  );
}
