import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type {
  EvidenceAvailability,
  EvidenceObjectModel,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import type { Measure, Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";
import { isCountyFips } from "@/lib/county-geography";

const CHOROPLETH_BIN_COUNT = 6;

const NON_NUMERIC_VALUE_STATES: ReadonlySet<ValueState> = new Set([
  ValueState.MISSING,
  ValueState.NO_COUNTY_LINKED_RECORD,
  ValueState.SUPPRESSED,
  ValueState.UNAVAILABLE,
]);

export type ExploreCountyIdentity = {
  county: string;
  fips: string;
  state: string;
  stateName: string;
};

export type ExploreChoroplethBin = number | "neutral";

export type ExploreCountyRow = {
  availability: EvidenceAvailability;
  choroplethBin: ExploreChoroplethBin;
  countyName: string;
  displayValue: string;
  evidence: EvidenceObjectModel | null;
  fips: string;
  observationPeriod: string;
  state: string;
  stateName: string;
  unit: string;
};

export type ExploreCommittedSelection = {
  mapScope: string;
  measureId: string;
  measureLabel: string;
  measureType: string | null;
  observationPeriod: string;
  releaseId: string;
  rows: ExploreCountyRow[];
  unit: string;
};

export type ExploreRequestStatus = "error" | "pending" | "success";

type ScoreDirectoryCounty = {
  county: string;
  fips: string;
  state: string;
  state_name: string;
};

type CatalogMeasure = {
  geography_types?: Measure["geography_types"];
  label: string;
  measure_id: string;
};

/**
 * County names and state membership come from the published county score list.
 * Score, priority, and color are discarded so Explore does not become Review.
 */
export function countyDirectoryFromScoreSummaries(
  counties: readonly ScoreDirectoryCounty[]
): ExploreCountyIdentity[] {
  const byFips = new Map<string, ExploreCountyIdentity>();
  for (const county of counties) {
    if (!isCountyFips(county.fips) || byFips.has(county.fips)) {
      continue;
    }
    byFips.set(county.fips, {
      county: county.county.trim() || `County ${county.fips}`,
      fips: county.fips,
      state: county.state.trim(),
      stateName: county.state_name.trim(),
    });
  }
  return [...byFips.values()];
}

export function filterDirectoryByMapScope(
  directory: readonly ExploreCountyIdentity[],
  mapScope: string
): ExploreCountyIdentity[] {
  if (mapScope === "ALL") {
    return [...directory];
  }
  return directory.filter((county) => county.state === mapScope);
}

/** County-capable measures from canonical catalog metadata, in label order. */
export function countyExploreMeasures<T extends CatalogMeasure>(
  measures: readonly T[]
): T[] {
  const countyMeasures: T[] = [];
  for (const measure of measures) {
    const geographyTypes = measure.geography_types;
    if (
      !geographyTypes ||
      geographyTypes.length === 0 ||
      geographyTypes.includes("county")
    ) {
      countyMeasures.push(measure);
    }
  }
  return countyMeasures.toSorted(
    (left, right) =>
      left.label.localeCompare(right.label, "en") ||
      left.measure_id.localeCompare(right.measure_id)
  );
}

export function resolveRequestedMeasureId(
  measures: readonly CatalogMeasure[],
  metric: string | null
): string | null {
  if (metric && measures.some((measure) => measure.measure_id === metric)) {
    return metric;
  }
  return measures[0]?.measure_id ?? null;
}

export function resolveExploreMapScope(input: {
  mapScopeParam: string | null;
  reviewScope: string;
  stateCodes: readonly string[];
}): string {
  if (input.mapScopeParam === "ALL") {
    return "ALL";
  }
  if (input.mapScopeParam && input.stateCodes.includes(input.mapScopeParam)) {
    return input.mapScopeParam;
  }
  if (
    input.reviewScope !== "ALL" &&
    input.stateCodes.includes(input.reviewScope)
  ) {
    return input.reviewScope;
  }
  return "ALL";
}

export function numericExploreValue(observation: Observation): number | null {
  if (NON_NUMERIC_VALUE_STATES.has(observation.value_state)) {
    return null;
  }
  if (
    typeof observation.value === "number" &&
    Number.isFinite(observation.value)
  ) {
    return observation.value;
  }
  if (typeof observation.value === "string" && observation.value.trim()) {
    const parsed = Number(observation.value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (observation.value_state === ValueState.ZERO) {
    return 0;
  }
  return null;
}

export function choroplethBin(
  value: number | null,
  minimum: number,
  maximum: number
): ExploreChoroplethBin {
  if (value === null || !Number.isFinite(value)) {
    return "neutral";
  }
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    maximum <= minimum
  ) {
    return 0;
  }
  const ratio = (value - minimum) / (maximum - minimum);
  return Math.min(
    CHOROPLETH_BIN_COUNT - 1,
    Math.floor(ratio * CHOROPLETH_BIN_COUNT)
  );
}

function preferLaterObservation(
  candidate: Observation,
  current: Observation
): boolean {
  const periodCompare = candidate.period_end.localeCompare(current.period_end);
  if (periodCompare !== 0) {
    return periodCompare > 0;
  }
  return candidate.observation_id.localeCompare(current.observation_id) > 0;
}

function indexObservationsByFips(
  observations: readonly Observation[],
  measureId: string
): Map<string, Observation> {
  const byFips = new Map<string, Observation>();
  for (const observation of observations) {
    if (observation.measure_id !== measureId) {
      continue;
    }
    if (observation.geography.geography_type !== "county") {
      continue;
    }
    const fips = observation.geography.geography_id;
    if (!isCountyFips(fips)) {
      continue;
    }
    const existing = byFips.get(fips);
    if (!existing || preferLaterObservation(observation, existing)) {
      byFips.set(fips, observation);
    }
  }
  return byFips;
}

function sharedLabel(values: readonly string[], multipleLabel: string): string {
  const unique = new Set(
    values.filter((value) => value.trim() && value !== "Unavailable")
  );
  if (unique.size === 1) {
    return [...unique][0] ?? "Unavailable";
  }
  if (unique.size === 0) {
    return "Unavailable";
  }
  return multipleLabel;
}

function sortDirectory(
  directory: readonly ExploreCountyIdentity[]
): ExploreCountyIdentity[] {
  return [...directory].toSorted(
    (left, right) =>
      left.county.localeCompare(right.county, "en") ||
      left.fips.localeCompare(right.fips)
  );
}

export function buildExploreSelection(input: {
  directory: readonly ExploreCountyIdentity[];
  mapScope: string;
  measure: Measure;
  observations: readonly Observation[];
  releaseId: string;
}): ExploreCommittedSelection {
  const indexed = indexObservationsByFips(
    input.observations,
    input.measure.measure_id
  );
  const ordered = sortDirectory(input.directory);
  const numericValues: number[] = [];
  for (const county of ordered) {
    const observation = indexed.get(county.fips);
    if (!observation) {
      continue;
    }
    const numeric = numericExploreValue(observation);
    if (numeric !== null) {
      numericValues.push(numeric);
    }
  }
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of numericValues) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  const catalogUnit = input.measure.unit?.trim() || "Unavailable";
  const rows: ExploreCountyRow[] = [];
  for (const county of ordered) {
    const observation = indexed.get(county.fips) ?? null;
    if (!observation) {
      rows.push({
        availability: evidenceAvailabilityValues.unavailable,
        choroplethBin: "neutral",
        countyName: county.county,
        displayValue: "Unavailable",
        evidence: null,
        fips: county.fips,
        observationPeriod: "Unavailable",
        state: county.state,
        stateName: county.stateName,
        unit: catalogUnit,
      });
      continue;
    }
    const evidence = evidenceObjectFromObservation({
      claimLabel: input.measure.label,
      measureType: input.measure.measure_type,
      observation,
    });
    const numeric = numericExploreValue(observation);
    rows.push({
      availability: evidence.availability,
      choroplethBin: choroplethBin(numeric, minimum, maximum),
      countyName: county.county,
      displayValue: evidence.displayValue,
      evidence,
      fips: county.fips,
      observationPeriod: evidence.provenance.observationPeriod,
      state: county.state,
      stateName: county.stateName,
      unit: observation.unit.trim() || catalogUnit,
    });
  }

  return {
    mapScope: input.mapScope,
    measureId: input.measure.measure_id,
    measureLabel: input.measure.label,
    measureType: input.measure.measure_type ?? null,
    observationPeriod: sharedLabel(
      rows.map((row) => row.observationPeriod),
      "Multiple observation periods"
    ),
    releaseId: input.releaseId,
    rows,
    unit: sharedLabel(
      rows.map((row) => row.unit),
      catalogUnit
    ),
  };
}

/**
 * The displayed layer changes only after a successful response for the
 * requested measure, map area, and release. Pending and failed requests keep
 * the previous selection so the map is not relabeled early.
 */
export function commitExploreSelection(input: {
  current: ExploreCommittedSelection | null;
  incoming: ExploreCommittedSelection | null;
  requestStatus: ExploreRequestStatus;
  requestedMapScope: string;
  requestedMeasureId: string | null;
  requestedReleaseId: string | null;
}): ExploreCommittedSelection | null {
  if (input.requestStatus !== "success") {
    return input.current;
  }
  if (
    !input.incoming ||
    !input.requestedMeasureId ||
    !input.requestedReleaseId
  ) {
    return input.current;
  }
  const matchesRequest =
    input.incoming.measureId === input.requestedMeasureId &&
    input.incoming.mapScope === input.requestedMapScope &&
    input.incoming.releaseId === input.requestedReleaseId;
  if (!matchesRequest) {
    return input.current;
  }
  return input.incoming;
}

export function exploreRequestStatusCopy(input: {
  committedMapScopeLabel: string | null;
  committedMeasureLabel: string | null;
  failed: boolean;
  matchesCommitted: boolean;
  requestedMapScopeLabel: string;
  requestedMeasureLabel: string;
}): { message: string; tone: "error" | "loading" } | null {
  if (input.matchesCommitted || !input.committedMeasureLabel) {
    return null;
  }
  const stillShows = `The map still shows ${input.committedMeasureLabel} in ${input.committedMapScopeLabel}.`;
  if (input.failed) {
    return {
      message: `${input.requestedMeasureLabel} in ${input.requestedMapScopeLabel} could not be loaded. ${stillShows}`,
      tone: "error",
    };
  }
  return {
    message: `Loading ${input.requestedMeasureLabel} in ${input.requestedMapScopeLabel}. ${stillShows}`,
    tone: "loading",
  };
}
