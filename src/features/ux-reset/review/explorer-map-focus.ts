import {
  countyFeatureBounds,
  unionCountyBounds,
  type CountyBounds,
} from "@/lib/atlas-map-camera";

import {
  isLower48CountyFips,
  isLower48ReviewScope,
  postalCodeForStateFips,
  stateFipsPrefix,
} from "./review-state-fips";

/** Page-local national map focus. This is not Review `scope`. */
export const EXPLORER_MAP_FOCUS_PARAM = "focus" as const;

/**
 * Lower-48 or DC postal code. Alaska, Hawaii, and any other token are absent.
 */
export function parseExplorerMapFocus(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return isLower48ReviewScope(normalized) ? normalized : null;
}

/**
 * The county is outside the focused state.
 * A missing focus or county is not a conflict.
 */
export function explorerFocusCountyMismatch(
  focus: string | null,
  countyFips: string | null
): boolean {
  if (!(focus && countyFips)) {
    return false;
  }
  return explorerStateFromCountyFips(countyFips) !== focus;
}

/** Containing state from the county FIPS prefix. Color is not an input. */
export function explorerStateFromCountyFips(fips: string): string | null {
  if (!isLower48CountyFips(fips)) {
    return null;
  }
  const postal = postalCodeForStateFips(fips.slice(0, 2));
  if (!postal || !isLower48ReviewScope(postal)) {
    return null;
  }
  return postal;
}

export type ExplorerFitGeographyTarget =
  | { fips: string; kind: "county" }
  | { kind: "national" }
  | { kind: "state"; state: string };

/**
 * Fit geography target at click time.
 * A selected county wins, then a focused state, then the national extent.
 * The viewport center is not a selection.
 */
export function explorerFitGeographyTarget(input: {
  fitSelectedCounty: boolean;
  focusedState: string | null;
  selectedCountyFips: string;
}): ExplorerFitGeographyTarget {
  const fips = input.selectedCountyFips.trim();
  if (input.fitSelectedCounty && fips.length > 0) {
    return { fips, kind: "county" };
  }
  const state = input.focusedState?.trim() ?? "";
  if (state.length > 0 && state !== "ALL") {
    return { kind: "state", state };
  }
  return { kind: "national" };
}

export type ExplorerMapDrillAction =
  | { type: "ignore" }
  | { type: "focus-state"; state: string }
  | { type: "select-county"; fips: string; state: string };

/**
 * National map pointer drill.
 * The first click on a state focuses that state. A later click inside it
 * selects the county. The second hit of a double-click does not advance.
 */
export function explorerMapDrillAction(input: {
  clickDetail: number;
  fips: string;
  focusedState: string | null;
}): ExplorerMapDrillAction {
  if (!(input.clickDetail > 0) || input.clickDetail > 1) {
    return { type: "ignore" };
  }
  const state = explorerStateFromCountyFips(input.fips);
  if (!state) {
    return { type: "ignore" };
  }
  if (input.focusedState !== state) {
    return { state, type: "focus-state" };
  }
  return { fips: input.fips, state, type: "select-county" };
}

/**
 * Axis-aligned bounds of every lower-48 or DC county polygon in a state.
 * Membership is the FIPS prefix on the geometry, not fill color or score state.
 */
export function explorerStateGeometryBounds(
  geometry: GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips?: string }>,
  stateCode: string
): CountyBounds | null {
  if (!isLower48ReviewScope(stateCode)) {
    return null;
  }
  const prefix = stateFipsPrefix(stateCode);
  if (!prefix) {
    return null;
  }
  const boundsList: CountyBounds[] = [];
  for (const feature of geometry.features) {
    const fips = feature.properties?.fips;
    if (typeof fips !== "string" || !fips.startsWith(prefix)) {
      continue;
    }
    const bounds = countyFeatureBounds(feature);
    if (bounds) {
      boundsList.push(bounds);
    }
  }
  return unionCountyBounds(boundsList);
}
