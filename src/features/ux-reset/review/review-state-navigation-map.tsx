"use client";

import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { CONTIGUOUS_US_INITIAL_VIEW } from "@/lib/atlas-geometry";
import { cn } from "@/lib/utils";

import { reviewNationalNavigationCamera } from "./review-national-camera";
import {
  reviewMapErrorFailure,
  reviewStateAvailabilityValues,
  type ReviewStateFeatureCollection,
} from "./review-state-navigation";

export const REVIEW_STATE_NAVIGATION_SOURCE_ID = "review-states";

const FILL_LAYER_ID = "review-states-fill";
const REVIEW_NAVIGATION_MAP_KEY = "reviewNavigationMap";
const LINE_LAYER_ID = "review-states-line";
const BACKGROUND_LAYER_ID = "review-nav-background";
const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

const NAVIGATION_COLOR_TOKENS = {
  canvas: "--background",
  fill: "--mint",
  focus: "--teal",
  hover: "--mint",
  outline: "--teal",
  outlineActive: "--navy",
  selected: "--navy",
  unavailable: "--pale",
  unavailableHover: "--input",
} as const;

export type ReviewNavigationColors = {
  [Key in keyof typeof NAVIGATION_COLOR_TOKENS]: string;
};

function paintExpression(
  expression: ExpressionSpecification
): ExpressionSpecification {
  return expression;
}

function isResolvedColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("rgb(") ||
    normalized.startsWith("rgba(") ||
    normalized.startsWith("hsl(") ||
    normalized.startsWith("hsla(") ||
    normalized.startsWith("lab(") ||
    normalized.startsWith("lch(") ||
    normalized.startsWith("oklch(") ||
    normalized.startsWith("color(")
  );
}

function readTokenColor(documentRef: Document, token: string): string | null {
  const probe = documentRef.createElement("span");
  probe.style.color = `var(${token}, transparent)`;
  documentRef.body.append(probe);
  const color = getComputedStyle(probe).color.trim();
  probe.remove();
  if (!isResolvedColor(color) || color === "rgba(0, 0, 0, 0)") {
    return null;
  }
  return color;
}

export function readReviewNavigationColors(
  documentRef: Document = document
): ReviewNavigationColors | null {
  const canvas = readTokenColor(documentRef, NAVIGATION_COLOR_TOKENS.canvas);
  const fill = readTokenColor(documentRef, NAVIGATION_COLOR_TOKENS.fill);
  const focus = readTokenColor(documentRef, NAVIGATION_COLOR_TOKENS.focus);
  const hover = readTokenColor(documentRef, NAVIGATION_COLOR_TOKENS.hover);
  const outline = readTokenColor(documentRef, NAVIGATION_COLOR_TOKENS.outline);
  const outlineActive = readTokenColor(
    documentRef,
    NAVIGATION_COLOR_TOKENS.outlineActive
  );
  const selected = readTokenColor(
    documentRef,
    NAVIGATION_COLOR_TOKENS.selected
  );
  const unavailable = readTokenColor(
    documentRef,
    NAVIGATION_COLOR_TOKENS.unavailable
  );
  const unavailableHover = readTokenColor(
    documentRef,
    NAVIGATION_COLOR_TOKENS.unavailableHover
  );
  if (
    !(
      canvas &&
      fill &&
      focus &&
      hover &&
      outline &&
      outlineActive &&
      selected &&
      unavailable &&
      unavailableHover
    )
  ) {
    return null;
  }
  return {
    canvas,
    fill,
    focus,
    hover,
    outline,
    outlineActive,
    selected,
    unavailable,
    unavailableHover,
  };
}

function availabilityEquals(
  availability: "supported" | "unavailable"
): ExpressionSpecification {
  return paintExpression(["==", ["get", "availability"], availability]);
}

function featureStateFlag(
  flag: "focus" | "hover" | "selected"
): ExpressionSpecification {
  return paintExpression(["boolean", ["feature-state", flag], false]);
}

function fillColorExpression(
  colors: ReviewNavigationColors
): ExpressionSpecification {
  const supported = availabilityEquals("supported");
  const unavailable = availabilityEquals("unavailable");
  const hovered = featureStateFlag("hover");
  return paintExpression([
    "case",
    ["all", supported, featureStateFlag("selected")],
    colors.selected,
    ["all", supported, featureStateFlag("focus")],
    colors.focus,
    ["all", supported, hovered],
    colors.hover,
    ["all", unavailable, hovered],
    colors.unavailableHover,
    unavailable,
    colors.unavailable,
    colors.fill,
  ]);
}

function lineColorExpression(
  colors: ReviewNavigationColors
): ExpressionSpecification {
  return paintExpression([
    "case",
    featureStateFlag("selected"),
    colors.outlineActive,
    featureStateFlag("focus"),
    colors.outlineActive,
    featureStateFlag("hover"),
    colors.outlineActive,
    colors.outline,
  ]);
}

function lineWidthExpression(): ExpressionSpecification {
  return paintExpression([
    "case",
    featureStateFlag("selected"),
    2.5,
    featureStateFlag("focus"),
    2.5,
    featureStateFlag("hover"),
    2,
    1.25,
  ]);
}

function featureCode(
  feature:
    | { properties?: { availability?: unknown; code?: unknown } }
    | undefined
): { availability: string; code: string } | null {
  const code = feature?.properties?.code;
  const availability = feature?.properties?.availability;
  if (typeof code !== "string" || typeof availability !== "string") {
    return null;
  }
  return { availability, code };
}

function webglUnavailable(map: MapLibreMap): boolean {
  const canvas = map.getCanvas();
  if (typeof canvas.getContext !== "function") {
    return false;
  }
  return !canvas.getContext("webgl2");
}

function publishReviewMap(element: HTMLElement, map: MapLibreMap | null): void {
  if (map) {
    Reflect.set(element, REVIEW_NAVIGATION_MAP_KEY, map);
    return;
  }
  Reflect.deleteProperty(element, REVIEW_NAVIGATION_MAP_KEY);
}

function applyReviewNationalCamera(
  map: MapLibreMap,
  element: HTMLElement
): void {
  const camera = reviewNationalNavigationCamera(
    element.clientWidth,
    element.clientHeight
  );
  if (!camera) {
    return;
  }
  map.jumpTo({ center: camera.center, zoom: camera.zoom });
  element.dataset.reviewCameraLat = String(camera.center[1]);
  element.dataset.reviewCameraLng = String(camera.center[0]);
  element.dataset.reviewCameraZoom = String(camera.zoom);
}

function browserCanStartWebgl(): boolean {
  const probe = document.createElement("canvas");
  if (typeof probe.getContext !== "function") {
    return true;
  }
  try {
    const context = probe.getContext("webgl2");
    if (!context || !("getExtension" in context)) {
      return context !== null;
    }
    const lose = context.getExtension("WEBGL_lose_context");
    if (lose && "loseContext" in lose) {
      lose.loseContext();
    }
    return true;
  } catch {
    return true;
  }
}

type ReviewStateNavigationMapProps = {
  className?: string;
  colors?: ReviewNavigationColors | null;
  features: ReviewStateFeatureCollection;
  focusCode: string | null;
  hoverCode: string | null;
  onActivate: (code: string) => void;
  onHover: (code: string | null) => void;
  onLoadFailed: () => void;
  onReady: () => void;
  onWebglUnavailable: () => void;
  selectedCode: string | null;
};

export function ReviewStateNavigationMap({
  className,
  colors,
  features,
  focusCode,
  hoverCode,
  onActivate,
  onHover,
  onLoadFailed,
  onReady,
  onWebglUnavailable,
  selectedCode,
}: ReviewStateNavigationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const featuresRef = useRef(features);
  const readyRef = useRef(false);
  const disposedRef = useRef(false);
  const hoverRef = useRef<string | null>(null);
  const focusRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const onActivateRef = useRef(onActivate);
  const onHoverRef = useRef(onHover);
  const onLoadFailedRef = useRef(onLoadFailed);
  const onReadyRef = useRef(onReady);
  const onWebglUnavailableRef = useRef(onWebglUnavailable);
  const hoverCodeRef = useRef(hoverCode);
  const focusCodeRef = useRef(focusCode);
  const selectedCodeRef = useRef(selectedCode);
  const applyInteractionRef = useRef<(map: MapLibreMap) => void>(() => {});

  useEffect(() => {
    featuresRef.current = features;
    onActivateRef.current = onActivate;
    onHoverRef.current = onHover;
    onLoadFailedRef.current = onLoadFailed;
    onReadyRef.current = onReady;
    onWebglUnavailableRef.current = onWebglUnavailable;
    hoverCodeRef.current = hoverCode;
    focusCodeRef.current = focusCode;
    selectedCodeRef.current = selectedCode;
  });

  useEffect(() => {
    const element = container.current;
    if (!element || mapRef.current) {
      return;
    }
    const paint = colors === undefined ? readReviewNavigationColors() : colors;
    if (!paint) {
      onLoadFailedRef.current();
      return;
    }
    if (!browserCanStartWebgl()) {
      onWebglUnavailableRef.current();
      return;
    }
    disposedRef.current = false;
    readyRef.current = false;
    setWorkerUrl(MAP_WORKER_URL);
    const initialCamera = reviewNationalNavigationCamera(
      element.clientWidth,
      element.clientHeight
    );
    let instance: MapLibreMap;
    try {
      instance = new MapLibre({
        attributionControl: false,
        boxZoom: false,
        center: initialCamera?.center ?? CONTIGUOUS_US_INITIAL_VIEW.center,
        container: element,
        doubleClickZoom: false,
        dragPan: false,
        dragRotate: false,
        keyboard: false,
        scrollZoom: false,
        style: { layers: [], sources: {}, version: 8 },
        touchPitch: false,
        touchZoomRotate: false,
        zoom: initialCamera?.zoom ?? CONTIGUOUS_US_INITIAL_VIEW.zoom,
      });
    } catch {
      onWebglUnavailableRef.current();
      return;
    }
    mapRef.current = instance;
    publishReviewMap(element, instance);
    let removed = false;
    const removeInstance = () => {
      if (removed) {
        return;
      }
      removed = true;
      publishReviewMap(element, null);
      try {
        instance.remove();
      } catch {
        // WebGL setup can fail before MapLibre creates a painter.
      }
      if (mapRef.current === instance) {
        mapRef.current = null;
      }
    };
    if (webglUnavailable(instance)) {
      onWebglUnavailableRef.current();
      removeInstance();
      return;
    }

    const failLoad = (message: string) => {
      if (disposedRef.current) {
        return;
      }
      const failure = reviewMapErrorFailure(message, readyRef.current);
      if (failure === "ignore") {
        return;
      }
      if (failure === "webgl") {
        onWebglUnavailableRef.current();
        return;
      }
      onLoadFailedRef.current();
    };

    instance.on("error", (event) => {
      const message = event.error instanceof Error ? event.error.message : "";
      failLoad(message);
    });
    instance.on("load", () => {
      if (
        disposedRef.current ||
        instance.getSource(REVIEW_STATE_NAVIGATION_SOURCE_ID)
      ) {
        return;
      }
      instance.addLayer({
        id: BACKGROUND_LAYER_ID,
        paint: { "background-color": paint.canvas },
        type: "background",
      });
      instance.addSource(REVIEW_STATE_NAVIGATION_SOURCE_ID, {
        data: featuresRef.current,
        promoteId: "code",
        type: "geojson",
      });
      instance.addLayer({
        id: FILL_LAYER_ID,
        paint: {
          "fill-color": fillColorExpression(paint),
          "fill-opacity": 1,
          "fill-outline-color": paint.outline,
        },
        source: REVIEW_STATE_NAVIGATION_SOURCE_ID,
        type: "fill",
      });
      instance.addLayer({
        id: LINE_LAYER_ID,
        paint: {
          "line-color": lineColorExpression(paint),
          "line-width": lineWidthExpression(),
        },
        source: REVIEW_STATE_NAVIGATION_SOURCE_ID,
        type: "line",
      });
      instance.on("click", FILL_LAYER_ID, (event) => {
        const feature = featureCode(event.features?.[0]);
        if (feature?.availability === reviewStateAvailabilityValues.supported) {
          onActivateRef.current(feature.code);
        }
      });
      instance.on("mousemove", FILL_LAYER_ID, (event) => {
        const feature = featureCode(event.features?.[0]);
        const canvas = instance.getCanvas();
        canvas.style.cursor =
          feature?.availability === reviewStateAvailabilityValues.supported
            ? "pointer"
            : "";
        onHoverRef.current(feature?.code ?? null);
      });
      instance.on("mouseleave", FILL_LAYER_ID, () => {
        instance.getCanvas().style.cursor = "";
        onHoverRef.current(null);
      });
      readyRef.current = true;
      instance.resize();
      applyReviewNationalCamera(instance, element);
      applyInteractionRef.current(instance);
      onReadyRef.current();
    });

    const fitToContainer = () => {
      if (disposedRef.current) {
        return;
      }
      instance.resize();
      applyReviewNationalCamera(instance, element);
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(fitToContainer);
    if (observer) {
      observer.observe(element);
    } else {
      window.addEventListener("resize", fitToContainer);
    }

    return () => {
      disposedRef.current = true;
      readyRef.current = false;
      observer?.disconnect();
      if (!observer) {
        window.removeEventListener("resize", fitToContainer);
      }
      removeInstance();
    };
    // The map is created once. Feature and interaction updates use the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    featuresRef.current = features;
    const source = mapRef.current?.getSource(
      REVIEW_STATE_NAVIGATION_SOURCE_ID
    ) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }
    source.setData(features);
  }, [features]);

  useEffect(() => {
    applyInteractionRef.current = (map) => {
      if (!map.getSource(REVIEW_STATE_NAVIGATION_SOURCE_ID)) {
        return;
      }
      const apply = (
        code: string | null,
        key: "focus" | "hover" | "selected",
        previous: { current: string | null }
      ) => {
        if (previous.current && previous.current !== code) {
          map.setFeatureState(
            { id: previous.current, source: REVIEW_STATE_NAVIGATION_SOURCE_ID },
            { [key]: false }
          );
        }
        if (code) {
          map.setFeatureState(
            { id: code, source: REVIEW_STATE_NAVIGATION_SOURCE_ID },
            { [key]: true }
          );
        }
        previous.current = code;
      };
      apply(hoverCodeRef.current, "hover", hoverRef);
      apply(focusCodeRef.current, "focus", focusRef);
      apply(selectedCodeRef.current, "selected", selectedRef);
    };
    const map = mapRef.current;
    if (map) {
      applyInteractionRef.current(map);
    }
  }, [focusCode, hoverCode, selectedCode, features]);

  return (
    <div
      ref={container}
      className={cn("maplibre-atlas", className)}
      data-testid="review-state-navigation-map-canvas"
    />
  );
}
