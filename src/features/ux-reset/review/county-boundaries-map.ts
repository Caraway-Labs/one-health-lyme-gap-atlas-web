import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

import { stateBoundaryCollections } from "@/features/ux-reset/review/county-boundaries-lines";
import {
  COUNTY_BOUNDARIES_BACKGROUND,
  COUNTY_BOUNDARIES_COUNTY_STROKE,
  COUNTY_BOUNDARIES_HOVER_CASING,
  COUNTY_BOUNDARIES_HOVER_STROKE,
  COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING,
  COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING_WIDTH,
  COUNTY_BOUNDARIES_SELECTED_STATE_LINE_WIDTH,
  COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
  COUNTY_BOUNDARIES_STATE_STROKE,
  COUNTY_BOUNDARY_COUNTY_LINE_WIDTH,
  COUNTY_BOUNDARY_HOVER_CASING_LINE_WIDTH,
  COUNTY_BOUNDARY_HOVER_LINE_WIDTH,
  COUNTY_BOUNDARY_HOVER_OPACITY,
  COUNTY_BOUNDARY_STATE_LINE_WIDTH,
} from "@/features/ux-reset/review/county-boundaries-palette";

const BACKGROUND_LAYER = "county-geography-background";
const COUNTY_LINE_LAYER = "county-boundary-lines";
const STATE_SOURCE = "state-boundary-lines";
const STATE_LINE_LAYER = "state-boundary-lines";
const SELECTED_STATE_SOURCE = "selected-state-perimeter";
const SELECTED_STATE_LAYER = "selected-state-perimeter";
const HOVER_CASING_LAYER = "county-hover-casing";
const HOVER_LINE_LAYER = "county-hover-line";
const SELECTED_COUNTY_CASING_LAYER = "selected-county-casing";

const DEFAULT_FILL_OUTLINE = "rgba(255,255,255,.9)";

const appliedChrome = new WeakSet<object>();

let cachedFeatureKey = "";
let cachedStateFips: string | null = null;
let cachedLines: ReturnType<typeof stateBoundaryCollections> | null = null;

function featureKey(features: readonly GeoJSON.Feature[]): string {
  let key = "";
  for (const feature of features) {
    const fips = feature.properties?.fips;
    key += typeof fips === "string" ? fips : "";
    key += ",";
  }
  return key;
}

function boundaryLines(
  features: readonly GeoJSON.Feature[],
  selectedStateFips: string | null
): ReturnType<typeof stateBoundaryCollections> {
  const key = featureKey(features);
  if (
    cachedLines &&
    cachedFeatureKey === key &&
    cachedStateFips === selectedStateFips
  ) {
    return cachedLines;
  }
  cachedFeatureKey = key;
  cachedStateFips = selectedStateFips;
  cachedLines = stateBoundaryCollections(features, selectedStateFips);
  return cachedLines;
}

type LineSource = {
  setData: (data: GeoJSON.FeatureCollection) => void;
};

function addLayer(
  map: MapLibreMap,
  layer: Parameters<MapLibreMap["addLayer"]>[0],
  beforeId: string
): void {
  if (map.getLayer(beforeId)) {
    map.addLayer(layer, beforeId);
    return;
  }
  map.addLayer(layer);
}

function removeLayer(map: MapLibreMap, id: string): void {
  if (map.getLayer(id)) {
    map.removeLayer(id);
  }
}

function removeSource(map: MapLibreMap, id: string): void {
  if (map.getSource(id)) {
    map.removeSource(id);
  }
}

function ensureLineSource(
  map: MapLibreMap,
  id: string,
  data: GeoJSON.FeatureCollection
): void {
  const source = map.getSource(id) as LineSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(id, { data, type: "geojson" });
}

/**
 * Neutral geography chrome for the county-boundaries layer.
 * Other layers keep the shared fill outline and selected-state strokes.
 */
export function applyCountyBoundaryChrome(
  map: MapLibreMap,
  input: {
    enabled: boolean;
    features: GeoJSON.Feature[];
    selectedStateFips: string | null;
  }
): void {
  if (!map.getLayer("counties-fill") || !map.getLayer("selected-outline")) {
    return;
  }
  if (!input.enabled) {
    if (!appliedChrome.has(map)) {
      return;
    }
    appliedChrome.delete(map);
    removeLayer(map, BACKGROUND_LAYER);
    removeLayer(map, COUNTY_LINE_LAYER);
    removeLayer(map, STATE_LINE_LAYER);
    removeLayer(map, SELECTED_STATE_LAYER);
    removeLayer(map, HOVER_CASING_LAYER);
    removeLayer(map, HOVER_LINE_LAYER);
    removeLayer(map, SELECTED_COUNTY_CASING_LAYER);
    removeSource(map, STATE_SOURCE);
    removeSource(map, SELECTED_STATE_SOURCE);
    map.setPaintProperty(
      "counties-fill",
      "fill-outline-color",
      DEFAULT_FILL_OUTLINE
    );
    map.setPaintProperty("counties-fill", "fill-opacity", 0.92);
    if (map.getLayer("selected-state-outline")) {
      map.setPaintProperty("selected-state-outline", "line-opacity", 1);
    }
    return;
  }

  appliedChrome.add(map);
  const lines = boundaryLines(input.features, input.selectedStateFips);
  if (!map.getLayer(BACKGROUND_LAYER)) {
    addLayer(
      map,
      {
        id: BACKGROUND_LAYER,
        paint: { "background-color": COUNTY_BOUNDARIES_BACKGROUND },
        type: "background",
      },
      "counties-fill"
    );
  }
  map.setPaintProperty("counties-fill", "fill-outline-color", "rgba(0,0,0,0)");
  map.setPaintProperty("counties-fill", "fill-opacity", 1);
  if (map.getLayer("selected-state-outline")) {
    map.setPaintProperty("selected-state-outline", "line-opacity", 0);
  }

  if (!map.getLayer(COUNTY_LINE_LAYER)) {
    addLayer(
      map,
      {
        id: COUNTY_LINE_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_COUNTY_STROKE,
          "line-width":
            COUNTY_BOUNDARY_COUNTY_LINE_WIDTH as unknown as ExpressionSpecification,
        },
        source: "counties",
        type: "line",
      },
      "selected-outline"
    );
  }
  ensureLineSource(map, STATE_SOURCE, lines.stateLines);
  if (!map.getLayer(STATE_LINE_LAYER)) {
    addLayer(
      map,
      {
        id: STATE_LINE_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_STATE_STROKE,
          "line-width":
            COUNTY_BOUNDARY_STATE_LINE_WIDTH as unknown as ExpressionSpecification,
        },
        source: STATE_SOURCE,
        type: "line",
      },
      "selected-outline"
    );
  }
  ensureLineSource(map, SELECTED_STATE_SOURCE, lines.selectedStateLines);
  if (!map.getLayer(SELECTED_STATE_LAYER)) {
    addLayer(
      map,
      {
        id: SELECTED_STATE_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
          "line-width": COUNTY_BOUNDARIES_SELECTED_STATE_LINE_WIDTH,
        },
        source: SELECTED_STATE_SOURCE,
        type: "line",
      },
      "selected-outline"
    );
  }
  const hoverOpacity =
    COUNTY_BOUNDARY_HOVER_OPACITY as unknown as ExpressionSpecification;
  if (!map.getLayer(HOVER_CASING_LAYER)) {
    addLayer(
      map,
      {
        id: HOVER_CASING_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_HOVER_CASING,
          "line-opacity": hoverOpacity,
          "line-width":
            COUNTY_BOUNDARY_HOVER_CASING_LINE_WIDTH as unknown as ExpressionSpecification,
        },
        source: "counties",
        type: "line",
      },
      "selected-outline"
    );
  }
  if (!map.getLayer(HOVER_LINE_LAYER)) {
    addLayer(
      map,
      {
        id: HOVER_LINE_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_HOVER_STROKE,
          "line-opacity": hoverOpacity,
          "line-width":
            COUNTY_BOUNDARY_HOVER_LINE_WIDTH as unknown as ExpressionSpecification,
        },
        source: "counties",
        type: "line",
      },
      "selected-outline"
    );
  }
  if (!map.getLayer(SELECTED_COUNTY_CASING_LAYER)) {
    addLayer(
      map,
      {
        filter: ["==", ["get", "selected"], true],
        id: SELECTED_COUNTY_CASING_LAYER,
        paint: {
          "line-color": COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING,
          "line-width": COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING_WIDTH,
        },
        source: "counties",
        type: "line",
      },
      "selected-outline"
    );
  }
}

export function clearCountyBoundaryHover(
  map: MapLibreMap,
  hoveredId: number | string | null
): void {
  if (hoveredId === null || typeof map.setFeatureState !== "function") {
    return;
  }
  map.setFeatureState({ id: hoveredId, source: "counties" }, { hover: false });
}

export function setCountyBoundaryHover(
  map: MapLibreMap,
  hoveredId: number | string
): void {
  if (typeof map.setFeatureState !== "function") {
    return;
  }
  map.setFeatureState({ id: hoveredId, source: "counties" }, { hover: true });
}
