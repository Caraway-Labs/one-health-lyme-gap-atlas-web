import { contiguousUsGeometry } from "@/lib/atlas-geometry";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

import {
  lower48ReviewPostalCodes,
  postalCodeForStateFips,
  stateFipsPrefix,
  type ReviewStatePostal,
} from "./review-state-fips";

/**
 * National Review navigation is geographic selection, not a scored map.
 * Entries are the lower 48 and DC from the Review scope contract.
 * A state named by the release is supported. Every other contract state is unavailable.
 */
export const reviewStateNavigationCopy = {
  description:
    "Choose a state to open its review result. National scope does not assemble a nationwide county list.",
  heading: "State orientation",
  instructions:
    "Select a supported state on the map or in the list. The list works when the map is unavailable.",
  listLabel: "States",
  mapLabel: "United States state map",
  noContractSupport: "No supported states are listed for this release.",
  noFilterMatches: "No states match this search.",
  searchLabel: "Find a state",
} as const;

export const reviewNavigationMapPhaseValues = {
  boundaryEmpty: "boundary-empty",
  boundaryFailed: "boundary-failed",
  boundaryLoading: "boundary-loading",
  mapLoadFailed: "map-load-failed",
  mapLoading: "map-loading",
  ready: "ready",
  webglUnavailable: "webgl-unavailable",
} as const;

export type ReviewNavigationMapPhase =
  (typeof reviewNavigationMapPhaseValues)[keyof typeof reviewNavigationMapPhaseValues];

export const reviewStateAvailabilityValues = {
  supported: "supported",
  unavailable: "unavailable",
} as const;

export type ReviewStateAvailability =
  (typeof reviewStateAvailabilityValues)[keyof typeof reviewStateAvailabilityValues];

export type ReviewStateNavigationEntry = {
  availability: ReviewStateAvailability;
  code: string;
  name: string | null;
};

export type ReviewStateFeatureProperties = {
  availability: "supported" | "unavailable";
  code: string;
  name: string;
};

export type ReviewStateFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  ReviewStateFeatureProperties
>;

const STATE_FIPS_PREFIX_LENGTH = 2;

export function reviewStateNavigationEntries(
  releaseStates: readonly AtlasStateOption[]
): ReviewStateNavigationEntry[] {
  const byCode = new Map(releaseStates.map((state) => [state.code, state]));
  const entries: ReviewStateNavigationEntry[] = lower48ReviewPostalCodes().map(
    (code) => {
      const release = byCode.get(code);
      if (release) {
        return {
          availability: reviewStateAvailabilityValues.supported,
          code,
          name: release.name,
        };
      }
      return {
        availability: reviewStateAvailabilityValues.unavailable,
        code,
        name: null,
      };
    }
  );
  return entries.toSorted((left, right) => left.code.localeCompare(right.code));
}

export function reviewStateNavigationLabel(
  entry: ReviewStateNavigationEntry
): string {
  switch (entry.availability) {
    case reviewStateAvailabilityValues.supported: {
      return `${entry.code}, ${entry.name ?? entry.code}`;
    }
    case reviewStateAvailabilityValues.unavailable: {
      return `${entry.code}, not in this release`;
    }
    default: {
      const exhaustive: never = entry.availability;
      return exhaustive;
    }
  }
}

export function filterReviewStateNavigationEntries(
  entries: readonly ReviewStateNavigationEntry[],
  query: string
): ReviewStateNavigationEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...entries];
  }
  return entries.filter((entry) => {
    const name = entry.name?.toLowerCase() ?? "";
    return (
      entry.code.toLowerCase().includes(normalized) || name.includes(normalized)
    );
  });
}

export function reviewStateContractSummary(
  entries: readonly ReviewStateNavigationEntry[]
): string | null {
  if (
    entries.some(
      (entry) => entry.availability === reviewStateAvailabilityValues.supported
    )
  ) {
    return null;
  }
  return reviewStateNavigationCopy.noContractSupport;
}

export function reviewNavigationMapPhase(input: {
  featureCount: number;
  geometry: "error" | "loading" | "ready";
  mapFailure: "load" | "webgl" | null;
  mapReady: boolean;
}): ReviewNavigationMapPhase {
  switch (input.geometry) {
    case "loading": {
      return reviewNavigationMapPhaseValues.boundaryLoading;
    }
    case "error": {
      return reviewNavigationMapPhaseValues.boundaryFailed;
    }
    case "ready": {
      if (input.featureCount === 0) {
        return reviewNavigationMapPhaseValues.boundaryEmpty;
      }
      switch (input.mapFailure) {
        case "webgl": {
          return reviewNavigationMapPhaseValues.webglUnavailable;
        }
        case "load": {
          return reviewNavigationMapPhaseValues.mapLoadFailed;
        }
        case null: {
          return input.mapReady
            ? reviewNavigationMapPhaseValues.ready
            : reviewNavigationMapPhaseValues.mapLoading;
        }
        default: {
          const exhaustive: never = input.mapFailure;
          return exhaustive;
        }
      }
    }
    default: {
      const exhaustive: never = input.geometry;
      return exhaustive;
    }
  }
}

export function reviewNavigationMapStatus(
  phase: ReviewNavigationMapPhase
): string {
  switch (phase) {
    case reviewNavigationMapPhaseValues.boundaryLoading: {
      return "Loading state boundaries…";
    }
    case reviewNavigationMapPhaseValues.boundaryFailed: {
      return "State boundaries are unavailable. Choose a state from the list.";
    }
    case reviewNavigationMapPhaseValues.boundaryEmpty: {
      return "No state boundaries are available for this release. Choose a state from the list.";
    }
    case reviewNavigationMapPhaseValues.mapLoading: {
      return "Loading map…";
    }
    case reviewNavigationMapPhaseValues.webglUnavailable: {
      return "The map could not start. Choose a state from the list.";
    }
    case reviewNavigationMapPhaseValues.mapLoadFailed: {
      return "The map could not load. Choose a state from the list.";
    }
    case reviewNavigationMapPhaseValues.ready: {
      return "The map is ready.";
    }
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}

export function reviewNavigationMapRetryable(
  phase: ReviewNavigationMapPhase
): boolean {
  switch (phase) {
    case reviewNavigationMapPhaseValues.boundaryFailed:
    case reviewNavigationMapPhaseValues.boundaryEmpty:
    case reviewNavigationMapPhaseValues.webglUnavailable:
    case reviewNavigationMapPhaseValues.mapLoadFailed: {
      return true;
    }
    case reviewNavigationMapPhaseValues.boundaryLoading:
    case reviewNavigationMapPhaseValues.mapLoading:
    case reviewNavigationMapPhaseValues.ready: {
      return false;
    }
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}

export function reviewNavigationStateText(
  entry: ReviewStateNavigationEntry | null
): string {
  if (!entry) {
    return "none";
  }
  switch (entry.availability) {
    case reviewStateAvailabilityValues.supported: {
      return entry.name ? `${entry.name} (${entry.code})` : entry.code;
    }
    case reviewStateAvailabilityValues.unavailable: {
      return reviewStateNavigationLabel(entry);
    }
    default: {
      const exhaustive: never = entry.availability;
      return exhaustive;
    }
  }
}

export function reviewNavigationStatusText(input: {
  contractSummary: string | null;
  focus: ReviewStateNavigationEntry | null;
  hover: ReviewStateNavigationEntry | null;
  phase: ReviewNavigationMapPhase;
  selected: ReviewStateNavigationEntry | null;
  totalCount: number;
  visibleCount: number;
}): string {
  const parts = [
    `Map status: ${reviewNavigationMapStatus(input.phase)}`,
    `Highlighted state: ${reviewNavigationStateText(input.hover)}.`,
    `Focused state: ${reviewNavigationStateText(input.focus)}.`,
    `Selected state: ${reviewNavigationStateText(input.selected)}.`,
    `Showing ${input.visibleCount} of ${input.totalCount} states.`,
  ];
  if (input.visibleCount === 0) {
    parts.push(reviewStateNavigationCopy.noFilterMatches);
  }
  if (input.contractSummary) {
    parts.push(input.contractSummary);
  }
  return parts.join(" ");
}

export function reviewMapErrorFailure(
  message: string,
  sourceReady: boolean
): "ignore" | "load" | "webgl" {
  const normalized = message.toLowerCase();
  if (normalized.includes("webgl")) {
    return "webgl";
  }
  const sourceOrStyle =
    normalized.includes("style") ||
    normalized.includes("source") ||
    normalized.includes("layer");
  if (!sourceOrStyle) {
    return "ignore";
  }
  if (sourceReady && !normalized.includes("failed")) {
    return "ignore";
  }
  return "load";
}

function polygonsFromGeometry(
  geometry: GeoJSON.Geometry
): GeoJSON.Position[][][] {
  switch (geometry.type) {
    case "Polygon": {
      return [geometry.coordinates];
    }
    case "MultiPolygon": {
      return geometry.coordinates;
    }
    case "GeometryCollection":
    case "LineString":
    case "MultiLineString":
    case "MultiPoint":
    case "Point": {
      return [];
    }
    default: {
      const exhaustive: never = geometry;
      void exhaustive;
      return [];
    }
  }
}

function availabilityForPostal(
  code: ReviewStatePostal,
  entries: readonly ReviewStateNavigationEntry[]
): ReviewStateFeatureProperties["availability"] {
  const entry = entries.find((item) => item.code === code);
  if (entry?.availability === reviewStateAvailabilityValues.supported) {
    return reviewStateAvailabilityValues.supported;
  }
  return reviewStateAvailabilityValues.unavailable;
}

export function reviewStateNavigationFeatures(
  geometry: CountyDisplayGeometryFeatureCollection,
  entries: readonly ReviewStateNavigationEntry[]
): ReviewStateFeatureCollection {
  const grouped = new Map<
    string,
    { name: string; polygons: GeoJSON.Position[][][] }
  >();
  for (const feature of contiguousUsGeometry(geometry).features) {
    const fips = feature.properties.fips;
    if (fips.length < STATE_FIPS_PREFIX_LENGTH || !feature.geometry) {
      continue;
    }
    const postal = postalCodeForStateFips(
      fips.slice(0, STATE_FIPS_PREFIX_LENGTH)
    );
    if (!postal || stateFipsPrefix(postal) === null) {
      continue;
    }
    if (!isContractState(postal, entries)) {
      continue;
    }
    const polygons = polygonsFromGeometry(feature.geometry);
    if (polygons.length === 0) {
      continue;
    }
    const existing = grouped.get(postal);
    const entry = entries.find((item) => item.code === postal);
    const name = entry?.name ?? "";
    if (existing) {
      for (const polygon of polygons) {
        existing.polygons.push(polygon);
      }
      continue;
    }
    grouped.set(postal, { name, polygons });
  }
  const features: ReviewStateFeatureCollection["features"] = [];
  for (const [code, group] of grouped) {
    const postal = code as ReviewStatePostal;
    features.push({
      geometry: {
        coordinates: group.polygons,
        type: "MultiPolygon",
      },
      id: code,
      properties: {
        availability: availabilityForPostal(postal, entries),
        code,
        name: group.name,
      },
      type: "Feature",
    });
  }
  features.sort((left, right) =>
    left.properties.code.localeCompare(right.properties.code)
  );
  return { features, type: "FeatureCollection" };
}

function isContractState(
  code: ReviewStatePostal,
  entries: readonly ReviewStateNavigationEntry[]
): boolean {
  return entries.some((entry) => entry.code === code);
}

export function reviewNavigationEntryByCode(
  entries: readonly ReviewStateNavigationEntry[],
  code: string | null
): ReviewStateNavigationEntry | null {
  if (!code) {
    return null;
  }
  return entries.find((entry) => entry.code === code) ?? null;
}
