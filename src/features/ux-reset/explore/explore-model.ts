import { parseCalendarIsoDate } from "@/features/ux-reset/context-params";
import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type {
  EvidenceAvailability,
  EvidenceObjectModel,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import type { Measure, Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";
import {
  observationsV1ObservationsGetQueryYearOneMax,
  observationsV1ObservationsGetQueryYearOneMin,
} from "@/generated/zod/atlas";
import { isCountyFips } from "@/lib/county-geography";

const CHOROPLETH_BIN_COUNT = 6;
const GOVERNED_YEAR_SEMANTICS = /^\d{4}$/;
const DAILY_TEMPORAL_SEMANTICS = "DAY";

/**
 * Published county discovery values. Measures are filtered by exact
 * `geography_semantics`. These tokens are not interchangeable, and neither is
 * the observations geography enum.
 */
export const EXPLORE_COUNTY_GEOGRAPHY_SEMANTICS = [
  "COUNTY_FIPS_5",
  "COUNTY",
] as const;

export type ExploreCountyGeographySemantic =
  (typeof EXPLORE_COUNTY_GEOGRAPHY_SEMANTICS)[number];

export class ExploreContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExploreContractError";
  }
}

export type ExploreTimeBound =
  | {
      handoffPeriod: string;
      kind: "year";
      year: number;
    }
  | {
      date: string;
      handoffPeriod: string;
      kind: "day";
    };

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
  geography_semantics?: Measure["geography_semantics"];
  label: string;
  measure_id: string;
  temporal_grains?: Measure["temporal_grains"];
  temporal_semantics?: Measure["temporal_semantics"];
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

export function isExploreCountyGeographySemantic(
  value: string | null | undefined
): value is ExploreCountyGeographySemantic {
  return value === "COUNTY_FIPS_5" || value === "COUNTY";
}

/** County measures whose published geography semantics match discovery exactly. */
export function countyExploreMeasures<T extends CatalogMeasure>(
  measures: readonly T[]
): T[] {
  const countyMeasures: T[] = [];
  for (const measure of measures) {
    if (isExploreCountyGeographySemantic(measure.geography_semantics)) {
      countyMeasures.push(measure);
    }
  }
  return countyMeasures.toSorted(
    (left, right) =>
      left.label.localeCompare(right.label, "en") ||
      left.measure_id.localeCompare(right.measure_id)
  );
}

/**
 * A governed year uses the observations `year` bound. A governed day uses one
 * `start_date`/`end_date` pair. The shared period is applied only when it is
 * that day; it is not a substitute for a missing year.
 */
export function resolveExploreTimeBound(
  measure: Pick<CatalogMeasure, "temporal_grains" | "temporal_semantics">,
  period: string | null
): ExploreTimeBound | null {
  const semantics = measure.temporal_semantics?.trim() ?? "";
  if (GOVERNED_YEAR_SEMANTICS.test(semantics)) {
    const year = Number(semantics);
    if (
      year < observationsV1ObservationsGetQueryYearOneMin ||
      year > observationsV1ObservationsGetQueryYearOneMax
    ) {
      return null;
    }
    return {
      handoffPeriod: `${semantics}-01-01`,
      kind: "year",
      year,
    };
  }
  const grains = measure.temporal_grains ?? [];
  const daily =
    semantics === DAILY_TEMPORAL_SEMANTICS ||
    grains.includes(DAILY_TEMPORAL_SEMANTICS);
  if (!daily || !period || parseCalendarIsoDate(period) !== period) {
    return null;
  }
  return {
    date: period,
    handoffPeriod: period,
    kind: "day",
  };
}

export function resolveRequestedMeasureId(
  measures: readonly CatalogMeasure[],
  metric: string | null,
  period: string | null
): string | null {
  if (metric && measures.some((measure) => measure.measure_id === metric)) {
    return metric;
  }
  for (const measure of measures) {
    if (resolveExploreTimeBound(measure, period)) {
      return measure.measure_id;
    }
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

function observationMatchesTimeBound(
  observation: Observation,
  timeBound: ExploreTimeBound
): boolean {
  const start = observation.period_start;
  const end = observation.period_end;
  switch (timeBound.kind) {
    case "year": {
      const firstDay = `${timeBound.year}-01-01`;
      const lastDay = `${timeBound.year}-12-31`;
      return start >= firstDay && end <= lastDay;
    }
    case "day": {
      return start === timeBound.date && end === timeBound.date;
    }
    default: {
      const exhaustive: never = timeBound;
      return exhaustive;
    }
  }
}

/**
 * Returned observation identities must match the requested release and time
 * bound. An empty page has no identity to contradict. Mixed or foreign
 * releases are rejected instead of stamped onto the layer.
 */
export function assertExploreObservations(input: {
  measureId: string;
  observations: readonly Observation[];
  releaseId: string;
  timeBound: ExploreTimeBound;
}): string {
  const seenFips = new Set<string>();
  const responseReleases = new Set<string>();
  for (const observation of input.observations) {
    if (observation.measure_id !== input.measureId) {
      throw new ExploreContractError(
        "Observation measure does not match the request."
      );
    }
    if (!observation.release_id) {
      throw new ExploreContractError("Observation release is missing.");
    }
    responseReleases.add(observation.release_id);
    if (!observationMatchesTimeBound(observation, input.timeBound)) {
      throw new ExploreContractError(
        "Observation period is outside the requested time bound."
      );
    }
    const fips = observation.geography.geography_id;
    if (
      observation.geography.geography_type !== "county" ||
      !isCountyFips(fips)
    ) {
      throw new ExploreContractError("Observation geography is not a county.");
    }
    if (seenFips.has(fips)) {
      throw new ExploreContractError("Observation response repeats a county.");
    }
    seenFips.add(fips);
  }
  if (responseReleases.size > 1) {
    throw new ExploreContractError(
      "Observation response mixes release identities."
    );
  }
  const responseRelease = [...responseReleases][0] ?? null;
  if (responseRelease && responseRelease !== input.releaseId) {
    throw new ExploreContractError(
      "Observation release does not match the requested release."
    );
  }
  return responseRelease ?? input.releaseId;
}

function indexObservationsByFips(
  observations: readonly Observation[]
): Map<string, Observation> {
  const byFips = new Map<string, Observation>();
  for (const observation of observations) {
    byFips.set(observation.geography.geography_id, observation);
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
  timeBound: ExploreTimeBound;
}): ExploreCommittedSelection {
  const releaseId = assertExploreObservations({
    measureId: input.measure.measure_id,
    observations: input.observations,
    releaseId: input.releaseId,
    timeBound: input.timeBound,
  });
  const indexed = indexObservationsByFips(input.observations);
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
    releaseId,
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
