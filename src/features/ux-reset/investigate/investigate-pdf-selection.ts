import type { CountyEvidenceMeasureFailure } from "@/features/ux-reset/investigate/county-evidence";
import { ValueState, type Observation } from "@/generated/models";

const REPORT_DAY_LIMIT = 500;
const REPORT_MEASURE_LIMIT = 20;
const REPORT_OBSERVATION_LIMIT = 500;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export const investigatePdfOmissionReasons = {
  couldNotLoad: "This measure could not be loaded.",
  differentPeriod: "Different observation period.",
  measureLimit: "The report includes at most 20 measures.",
  mismatchedIdentity: "Does not match this county and release.",
  missingProvenance: "Missing provenance.",
  mixedPeriod: "Mixed observation period.",
  noPublishedPeriod: "No published data for this period.",
  noPublishedRelease: "No published data for this release.",
  observationLimit: "Too many observations to include in one report.",
  periodLimit: "The observation period is outside the report limit.",
  unsupportedState: "Unsupported evidence state.",
} as const;

export type InvestigatePdfMeasure = {
  label: string;
  measureId: string;
};

export type InvestigatePdfOmission = InvestigatePdfMeasure & {
  reason: string;
};

export type InvestigatePdfSelection = {
  included: InvestigatePdfMeasure[];
  observations: Observation[];
  omitted: InvestigatePdfOmission[];
  periodEnd: string | null;
  periodStart: string | null;
};

type PdfRecord = {
  measureId: string;
  measureLabel: string;
  observation: Observation;
};

function omitMeasure(
  omitted: Map<string, InvestigatePdfOmission>,
  measureId: string,
  label: string,
  reason: string
): void {
  if (!omitted.has(measureId)) {
    omitted.set(measureId, { label, measureId, reason });
  }
}

function publishedValueState(state: Observation["value_state"]): boolean {
  switch (state) {
    case ValueState.OBSERVED:
    case ValueState.ZERO:
    case ValueState.SUPPRESSED:
    case ValueState.MISSING:
    case ValueState.UNAVAILABLE:
    case ValueState.NO_COUNTY_LINKED_RECORD: {
      return true;
    }
    default: {
      const exhaustive: never = state;
      return Boolean(exhaustive) && false;
    }
  }
}

function hasExportProvenance(observation: Observation): boolean {
  return [
    observation.measure_id,
    observation.source_id,
    observation.source_label,
    observation.lineage_source_id,
    observation.dataset_id,
    observation.provenance_ref,
    observation.methodology_version,
    observation.semantic_version,
  ].every((value) => value?.trim());
}

function completePeriodDays(start: string, end: string): number | null {
  if (!(CALENDAR_DAY.test(start) && CALENDAR_DAY.test(end))) {
    return null;
  }
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!(Number.isFinite(startMs) && Number.isFinite(endMs))) {
    return null;
  }
  const days = (endMs - startMs) / MILLISECONDS_PER_DAY + 1;
  if (!Number.isFinite(days) || days < 1 || days > REPORT_DAY_LIMIT) {
    return null;
  }
  return days;
}

function rowProblem(
  observation: Observation,
  countyFips: string,
  releaseId: string
): string | null {
  if (
    observation.geography.geography_type !== "county" ||
    observation.geography.geography_id !== countyFips ||
    observation.release_id !== releaseId
  ) {
    return investigatePdfOmissionReasons.mismatchedIdentity;
  }
  if (!publishedValueState(observation.value_state)) {
    return investigatePdfOmissionReasons.unsupportedState;
  }
  if (!hasExportProvenance(observation)) {
    return investigatePdfOmissionReasons.missingProvenance;
  }
  if (
    completePeriodDays(observation.period_start, observation.period_end) ===
    null
  ) {
    return investigatePdfOmissionReasons.periodLimit;
  }
  return null;
}

function measureProblem(rows: readonly PdfRecord[]): string | null {
  const [first] = rows;
  if (!first) {
    return investigatePdfOmissionReasons.noPublishedRelease;
  }
  const period = `${first.observation.period_start}..${first.observation.period_end}`;
  for (const row of rows) {
    const current = `${row.observation.period_start}..${row.observation.period_end}`;
    if (current !== period) {
      return investigatePdfOmissionReasons.mixedPeriod;
    }
  }
  if (rows.length > REPORT_OBSERVATION_LIMIT) {
    return investigatePdfOmissionReasons.observationLimit;
  }
  return null;
}

type PeriodCandidate = {
  label: string;
  measureId: string;
  observations: Observation[];
  periodEnd: string;
  periodStart: string;
};

function choosePeriod(
  candidates: readonly PeriodCandidate[]
): PeriodCandidate[] {
  const groups = new Map<string, PeriodCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.periodStart}..${candidate.periodEnd}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  let bestKey = "";
  let best: PeriodCandidate[] = [];
  for (const [key, group] of groups) {
    const preferred =
      group.length > best.length ||
      (group.length === best.length && key < bestKey);
    if (preferred) {
      best = group;
      bestKey = key;
    }
  }
  return best;
}

export function selectInvestigatePdfMeasures(input: {
  countyFips: string;
  failures: readonly Pick<
    CountyEvidenceMeasureFailure,
    "measureId" | "measureLabel" | "message"
  >[];
  readyMeasureIds: readonly string[];
  records: readonly PdfRecord[];
  releaseId: string;
  unsupportedPeriodMeasureIds: readonly string[];
}): InvestigatePdfSelection {
  const omitted = new Map<string, InvestigatePdfOmission>();
  for (const failure of input.failures) {
    omitMeasure(
      omitted,
      failure.measureId,
      failure.measureLabel,
      failure.message || investigatePdfOmissionReasons.couldNotLoad
    );
  }
  for (const measureId of input.unsupportedPeriodMeasureIds) {
    omitMeasure(
      omitted,
      measureId,
      measureId,
      investigatePdfOmissionReasons.noPublishedPeriod
    );
  }

  const byMeasure = new Map<string, PdfRecord[]>();
  for (const record of input.records) {
    const rows = byMeasure.get(record.measureId) ?? [];
    rows.push(record);
    byMeasure.set(record.measureId, rows);
  }
  for (const measureId of input.readyMeasureIds) {
    if (!(byMeasure.has(measureId) || omitted.has(measureId))) {
      omitMeasure(
        omitted,
        measureId,
        measureId,
        investigatePdfOmissionReasons.noPublishedRelease
      );
    }
  }

  const candidates: PeriodCandidate[] = [];
  for (const [measureId, rows] of byMeasure) {
    if (omitted.has(measureId)) {
      continue;
    }
    const label = rows[0]?.measureLabel ?? measureId;
    const rowIssue = rows
      .map((row) =>
        rowProblem(row.observation, input.countyFips, input.releaseId)
      )
      .find((issue) => issue !== null);
    const issue = rowIssue ?? measureProblem(rows);
    if (issue) {
      omitMeasure(omitted, measureId, label, issue);
      continue;
    }
    const first = rows[0];
    if (!first) {
      continue;
    }
    candidates.push({
      label,
      measureId,
      observations: rows.map((row) => row.observation),
      periodEnd: first.observation.period_end,
      periodStart: first.observation.period_start,
    });
  }

  const chosen = choosePeriod(candidates);
  const chosenIds = new Set(chosen.map((candidate) => candidate.measureId));
  for (const candidate of candidates) {
    if (!chosenIds.has(candidate.measureId)) {
      omitMeasure(
        omitted,
        candidate.measureId,
        candidate.label,
        investigatePdfOmissionReasons.differentPeriod
      );
    }
  }

  const sorted = [...chosen].sort((left, right) =>
    left.measureId.localeCompare(right.measureId)
  );
  const kept = sorted.slice(0, REPORT_MEASURE_LIMIT);
  for (const extra of sorted.slice(REPORT_MEASURE_LIMIT)) {
    omitMeasure(
      omitted,
      extra.measureId,
      extra.label,
      investigatePdfOmissionReasons.measureLimit
    );
  }

  const included = kept.map((candidate) => ({
    label: candidate.label,
    measureId: candidate.measureId,
  }));
  return {
    included,
    observations: kept.flatMap((candidate) => candidate.observations),
    omitted: [...omitted.values()].sort((left, right) =>
      left.measureId.localeCompare(right.measureId)
    ),
    periodEnd: kept[0]?.periodEnd ?? null,
    periodStart: kept[0]?.periodStart ?? null,
  };
}
