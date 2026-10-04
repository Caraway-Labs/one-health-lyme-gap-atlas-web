import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
import type { Measure, Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";

/**
 * Comparability for Reset V1 uses governed fields already on the observation
 * and its catalog measure. A numeric difference is withheld unless measure
 * identity, unit, period, release, method identity, methodology version,
 * denominator, strata, and geography type all match and both values are
 * published numbers.
 * API comparability metadata beyond these fields stays with issue 419.
 */
export const compareWithholdReasonValues = {
  denominatorMismatch: "denominator_mismatch",
  failed: "failed",
  geographyMismatch: "geography_mismatch",
  methodologyMismatch: "methodology_mismatch",
  missingSide: "missing_side",
  multipleObservations: "multiple_observations",
  nonNumeric: "non_numeric",
  periodMismatch: "period_mismatch",
  releaseMismatch: "release_mismatch",
  strataMismatch: "strata_mismatch",
  unitMismatch: "unit_mismatch",
  unsupportedPeriod: "unsupported_period",
} as const;

export type CompareWithholdReason =
  (typeof compareWithholdReasonValues)[keyof typeof compareWithholdReasonValues];

export type CompareRelation =
  | { kind: "similar" }
  | {
      absoluteDifference: string;
      kind: "different";
      signedDifference: number;
      unit: string;
    }
  | {
      explanation: string;
      kind: "withheld";
      reasons: readonly CompareWithholdReason[];
    };

export type CompareObservationRecord = {
  evidence: EvidenceObjectModel;
  fips: string;
  observation: Observation;
};

export type CompareCell =
  | {
      kind: "empty";
      message: string;
      reason: "failed" | "missing" | "unsupported_period";
    }
  | {
      kind: "observations";
      records: readonly CompareObservationRecord[];
    };

export type CompareAlignedRow = {
  definition: string | null;
  left: CompareCell;
  measureId: string;
  measureLabel: string;
  relation: CompareRelation;
  right: CompareCell;
};

export type CompareAlignment = {
  leftFips: string;
  rightFips: string;
  outcomes: readonly CompareMeasureOutcome[];
  /** Period used to load this alignment. Absent on alignments built only for row tests. */
  period?: string | null;
  releaseId?: string;
  rows: readonly CompareAlignedRow[];
};

export type CompareMeasureOutcome =
  | {
      measureId: string;
      observations: readonly Observation[];
      status: "ready";
    }
  | {
      measureId: string;
      message: string;
      /** Epoch ms from Retry-After. Null when the failure did not name a wait. */
      retryAtMs: number | null;
      status: "failed";
    }
  | {
      measureId: string;
      status: "unsupported_period";
    };

const MISSING_MESSAGE = "No observation. This absence is not zero.";
const FAILED_MESSAGE = "This measure response was not used.";
const UNSUPPORTED_PERIOD_MESSAGE =
  "This measure has no governed period for the selected release.";

function canonicalText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function methodIdentityLabel(value: string | null | undefined): string {
  const text = canonicalText(value);
  return text.length > 0 ? text : "none";
}

function canonicalStrata(strata: Observation["strata"]): string {
  if (!strata) {
    return "";
  }
  return Object.keys(strata)
    .sort()
    .map((key) => `${key}=${strata[key] ?? ""}`)
    .join("|");
}

function publishedNumber(observation: Observation): number | null {
  if (observation.value_state === ValueState.ZERO) {
    if (
      observation.value === null ||
      observation.value === "" ||
      observation.value === 0 ||
      observation.value === "0"
    ) {
      return 0;
    }
    return null;
  }
  if (observation.value_state !== ValueState.OBSERVED) {
    return null;
  }
  if (
    typeof observation.value === "number" &&
    Number.isFinite(observation.value)
  ) {
    return observation.value;
  }
  if (typeof observation.value === "string") {
    const trimmed = observation.value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function periodLabel(observation: Observation): string {
  return formatObservationPeriod(
    observation.period_start,
    observation.period_end,
    observation.temporal_grain
  );
}

function withheld(
  reasons: readonly CompareWithholdReason[],
  details: readonly string[]
): CompareRelation {
  return {
    explanation: `Comparison withheld: ${details.join(" ")}`,
    kind: "withheld",
    reasons,
  };
}

function recordsForFips(
  observations: readonly Observation[],
  fips: string,
  claimLabel: string,
  measureType: string | null
): CompareObservationRecord[] {
  const records: CompareObservationRecord[] = [];
  for (const observation of observations) {
    if (observation.geography.geography_id !== fips) {
      continue;
    }
    records.push({
      evidence: evidenceObjectFromObservation({
        claimLabel,
        measureType,
        observation,
      }),
      fips,
      observation,
    });
  }
  return records.toSorted((left, right) =>
    left.observation.observation_id.localeCompare(
      right.observation.observation_id
    )
  );
}

function emptyCell(
  reason: "failed" | "missing" | "unsupported_period",
  message: string
): CompareCell {
  return { kind: "empty", message, reason };
}

function relationForCells(input: {
  left: CompareCell;
  leftFips: string;
  right: CompareCell;
  rightFips: string;
}): CompareRelation {
  if (input.left.kind === "empty" && input.left.reason === "failed") {
    return withheld([compareWithholdReasonValues.failed], [input.left.message]);
  }
  if (
    input.left.kind === "empty" &&
    input.left.reason === "unsupported_period"
  ) {
    return withheld(
      [compareWithholdReasonValues.unsupportedPeriod],
      [input.left.message]
    );
  }
  const leftRecords =
    input.left.kind === "observations" ? input.left.records : [];
  const rightRecords =
    input.right.kind === "observations" ? input.right.records : [];
  if (leftRecords.length === 0 || rightRecords.length === 0) {
    const missingFips = [
      leftRecords.length === 0 ? input.leftFips : null,
      rightRecords.length === 0 ? input.rightFips : null,
    ].filter((fips): fips is string => Boolean(fips));
    return withheld(
      [compareWithholdReasonValues.missingSide],
      [
        `County ${missingFips.join(" and county ")} has no observation for this measure. The missing side is not zero.`,
      ]
    );
  }
  if (leftRecords.length !== 1 || rightRecords.length !== 1) {
    return withheld(
      [compareWithholdReasonValues.multipleObservations],
      [
        "More than one observation was returned for a county, so Atlas did not choose one by position.",
      ]
    );
  }
  const leftObservation = leftRecords[0]?.observation;
  const rightObservation = rightRecords[0]?.observation;
  if (!(leftObservation && rightObservation)) {
    return withheld(
      [compareWithholdReasonValues.missingSide],
      ["An observation was missing. The missing side is not zero."]
    );
  }
  return relationForPair(leftObservation, rightObservation);
}

function relationForPair(
  left: Observation,
  right: Observation
): CompareRelation {
  const reasons: CompareWithholdReason[] = [];
  const details: string[] = [];
  if (left.measure_id !== right.measure_id) {
    reasons.push(compareWithholdReasonValues.failed);
    details.push("The observations are not the same governed measure.");
  }
  if (canonicalText(left.release_id) !== canonicalText(right.release_id)) {
    reasons.push(compareWithholdReasonValues.releaseMismatch);
    details.push(
      `Release identifiers differ (${left.release_id} and ${right.release_id}).`
    );
  }
  if (
    canonicalText(left.period_start) !== canonicalText(right.period_start) ||
    canonicalText(left.period_end) !== canonicalText(right.period_end) ||
    canonicalText(left.temporal_grain) !== canonicalText(right.temporal_grain)
  ) {
    reasons.push(compareWithholdReasonValues.periodMismatch);
    details.push(
      `Observation periods differ (${periodLabel(left)} and ${periodLabel(right)}).`
    );
  }
  if (canonicalText(left.unit) !== canonicalText(right.unit)) {
    reasons.push(compareWithholdReasonValues.unitMismatch);
    details.push(`Units differ (${left.unit} and ${right.unit}).`);
  }
  if (
    canonicalText(left.methodology_id) !== canonicalText(right.methodology_id)
  ) {
    reasons.push(compareWithholdReasonValues.methodologyMismatch);
    details.push(
      `Governed method identities differ (${methodIdentityLabel(left.methodology_id)} and ${methodIdentityLabel(right.methodology_id)}).`
    );
  }
  if (
    canonicalText(left.methodology_version) !==
    canonicalText(right.methodology_version)
  ) {
    reasons.push(compareWithholdReasonValues.methodologyMismatch);
    details.push("Methodology versions differ.");
  }
  if (canonicalText(left.denominator) !== canonicalText(right.denominator)) {
    reasons.push(compareWithholdReasonValues.denominatorMismatch);
    details.push("Denominators differ.");
  }
  if (canonicalStrata(left.strata) !== canonicalStrata(right.strata)) {
    reasons.push(compareWithholdReasonValues.strataMismatch);
    details.push("Strata differ.");
  }
  if (
    left.geography.geography_type !== "county" ||
    right.geography.geography_type !== "county"
  ) {
    reasons.push(compareWithholdReasonValues.geographyMismatch);
    details.push("Geography types differ.");
  }
  const leftNumber = publishedNumber(left);
  const rightNumber = publishedNumber(right);
  if (leftNumber === null || rightNumber === null) {
    reasons.push(compareWithholdReasonValues.nonNumeric);
    details.push(
      "A value is suppressed, missing, or unavailable, so it is not a numeric difference."
    );
  }
  if (reasons.length > 0) {
    return withheld(reasons, details);
  }
  if (leftNumber === null || rightNumber === null) {
    return withheld(
      [compareWithholdReasonValues.nonNumeric],
      [
        "A value is suppressed, missing, or unavailable, so it is not a numeric difference.",
      ]
    );
  }
  const signedDifference = rightNumber - leftNumber;
  if (signedDifference === 0) {
    return { kind: "similar" };
  }
  const absolute = Math.abs(signedDifference);
  return {
    absoluteDifference: formatGovernedEvidenceValue({
      unit: left.unit,
      value: absolute,
      valueState: ValueState.OBSERVED,
    }),
    kind: "different",
    signedDifference,
    unit: left.unit,
  };
}

function cellForOutcome(input: {
  claimLabel: string;
  fips: string;
  measureType: string | null;
  observations: readonly Observation[];
  outcome: CompareMeasureOutcome | undefined;
}): CompareCell {
  const outcome = input.outcome;
  if (!outcome || outcome.status === "failed") {
    return emptyCell("failed", outcome?.message ?? FAILED_MESSAGE);
  }
  if (outcome.status === "unsupported_period") {
    return emptyCell("unsupported_period", UNSUPPORTED_PERIOD_MESSAGE);
  }
  const records = recordsForFips(
    input.observations,
    input.fips,
    input.claimLabel,
    input.measureType
  );
  if (records.length === 0) {
    return emptyCell("missing", MISSING_MESSAGE);
  }
  return { kind: "observations", records };
}

/**
 * One row per catalog measure id. Response order and display labels do not
 * place values. A county with no observation stays an empty cell.
 */
export function alignCompareEvidence(input: {
  leftFips: string;
  leftLabel: string;
  measures: readonly Measure[];
  outcomes: readonly CompareMeasureOutcome[];
  rightFips: string;
  rightLabel: string;
}): CompareAlignment {
  const outcomesByMeasure = new Map<string, CompareMeasureOutcome>();
  for (const outcome of input.outcomes) {
    if (!outcomesByMeasure.has(outcome.measureId)) {
      outcomesByMeasure.set(outcome.measureId, outcome);
    }
  }
  const measures = [...input.measures].toSorted(
    (left, right) =>
      left.measure_id.localeCompare(right.measure_id) ||
      left.label.localeCompare(right.label, "en")
  );
  const rows: CompareAlignedRow[] = [];
  for (const measure of measures) {
    const outcome = outcomesByMeasure.get(measure.measure_id);
    const observations =
      outcome?.status === "ready" ? outcome.observations : [];
    const foreign = observations.some(
      (observation) =>
        observation.measure_id !== measure.measure_id ||
        (observation.geography.geography_id !== input.leftFips &&
          observation.geography.geography_id !== input.rightFips)
    );
    const resolvedOutcome: CompareMeasureOutcome | undefined = foreign
      ? {
          measureId: measure.measure_id,
          message:
            "An observation did not match this measure and the two counties.",
          retryAtMs: null,
          status: "failed",
        }
      : outcome;
    const readyObservations =
      resolvedOutcome?.status === "ready" ? resolvedOutcome.observations : [];
    const left = cellForOutcome({
      claimLabel: input.leftLabel,
      fips: input.leftFips,
      measureType: measure.measure_type ?? null,
      observations: readyObservations,
      outcome: resolvedOutcome,
    });
    const right = cellForOutcome({
      claimLabel: input.rightLabel,
      fips: input.rightFips,
      measureType: measure.measure_type ?? null,
      observations: readyObservations,
      outcome: resolvedOutcome,
    });
    rows.push({
      definition: measure.definition,
      left,
      measureId: measure.measure_id,
      measureLabel: measure.label,
      relation: relationForCells({
        left,
        leftFips: input.leftFips,
        right,
        rightFips: input.rightFips,
      }),
      right,
    });
  }
  return {
    leftFips: input.leftFips,
    outcomes: input.outcomes,
    rightFips: input.rightFips,
    rows,
  };
}
