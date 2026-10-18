import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  availabilityFromGovernedValueState,
  evidenceReasonLabel,
  hasGovernedMaterialLimitations,
  materialCaveatShort,
  reasonCodeForEvidence,
} from "@/features/ux-reset/evidence/value-state-contract";
import {
  EnvironmentalContextCoverageStatus,
  ValueState,
  type EnvironmentalContext,
  type Observation,
} from "@/generated/models";

/**
 * January 2025 daily NOAA nClimGrid contract from API #84.
 * 2025-01-17 is the documented representative day from the production handoff.
 * It is a supported day inside that month, not a claim that the day is latest.
 */
export const ENVIRONMENTAL_CONTEXT_WINDOW = {
  end: "2025-01-31",
  representativeDate: "2025-01-17",
  start: "2025-01-01",
} as const;

const CALENDAR_DAY = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

export const environmentalContextMeasureIds = [
  "nclimgrid_prcp_county_day",
  "nclimgrid_tmin_county_day",
  "nclimgrid_tmax_county_day",
  "nclimgrid_tavg_county_day",
] as const;

export type EnvironmentalContextMeasureId =
  (typeof environmentalContextMeasureIds)[number];

export const ENVIRONMENTAL_CONTEXT_MEASURES: readonly {
  claimLabel: string;
  measureId: EnvironmentalContextMeasureId;
}[] = [
  {
    claimLabel: "Precipitation",
    measureId: "nclimgrid_prcp_county_day",
  },
  {
    claimLabel: "Minimum temperature",
    measureId: "nclimgrid_tmin_county_day",
  },
  {
    claimLabel: "Maximum temperature",
    measureId: "nclimgrid_tmax_county_day",
  },
  {
    claimLabel: "NOAA average temperature",
    measureId: "nclimgrid_tavg_county_day",
  },
];

export type EnvironmentalDateSupport =
  | "invalid"
  | "outside_coverage"
  | "supported";

export function environmentalDateSupport(
  value: string
): EnvironmentalDateSupport {
  const trimmed = value.trim();
  const match = CALENDAR_DAY.exec(trimmed);
  if (!match?.groups) {
    return "invalid";
  }
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const realCalendarDay =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day;
  if (!realCalendarDay) {
    return "invalid";
  }
  if (
    trimmed >= ENVIRONMENTAL_CONTEXT_WINDOW.start &&
    trimmed <= ENVIRONMENTAL_CONTEXT_WINDOW.end
  ) {
    return "supported";
  }
  return "outside_coverage";
}

/** Cache identity is the county, measure, day, and governed release together. */
export function environmentalContextQueryKey(input: {
  date: string;
  fips: string;
  measureId: string;
  releaseId: string;
}): readonly [string, string, string, string, string] {
  return [
    "environmental-context",
    input.releaseId,
    input.fips,
    input.date,
    input.measureId,
  ];
}

const DEGREE_CELSIUS = "degree_Celsius";

export function environmentalDisplayUnit(unit: string): string {
  const trimmed = unit.trim();
  if (trimmed === DEGREE_CELSIUS) {
    return "°C";
  }
  return trimmed;
}

function coverageReason(
  status: EnvironmentalContext["coverage_status"] | null
): EvidenceObjectModel["reasonCode"] | null {
  switch (status) {
    case EnvironmentalContextCoverageStatus.COMPLETE: {
      return null;
    }
    case EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE: {
      return null;
    }
    case EnvironmentalContextCoverageStatus.SOURCE_MISSING: {
      return "ENVIRONMENTAL_SOURCE_MISSING";
    }
    case EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE: {
      return "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE";
    }
    case null: {
      return null;
    }
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function environmentalCoverageLabel(
  status: EnvironmentalContext["coverage_status"] | null
): string {
  switch (status) {
    case EnvironmentalContextCoverageStatus.COMPLETE: {
      return "Complete";
    }
    case EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE: {
      return "Partial coverage";
    }
    case EnvironmentalContextCoverageStatus.SOURCE_MISSING: {
      return "Source missing";
    }
    case EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE: {
      return "Out of source coverage";
    }
    case null: {
      return "Coverage metadata was not returned";
    }
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function valueIsBlank(value: Observation["value"]): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return !Number.isFinite(value);
}

function quantityText(value: Observation["value"], unit: string): string {
  if (typeof value === "number") {
    const rendered = value === 0 ? "0.0" : String(value);
    return unit ? `${rendered} ${unit}` : rendered;
  }
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "Unavailable";
  }
  if (unit && !trimmed.includes(unit)) {
    return `${trimmed} ${unit}`;
  }
  return trimmed;
}

/**
 * Exact governed quantities. A null, blank, or non-finite value stays
 * Unavailable. Numeric precipitation zero keeps one decimal so it stays
 * distinct from that unavailable text.
 */
export function environmentalDisplayValue(observation: Observation): string {
  const coverage = observation.environmental_context?.coverage_status ?? null;
  const blocked =
    coverage === EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE ||
    coverage === EnvironmentalContextCoverageStatus.SOURCE_MISSING;
  if (blocked || valueIsBlank(observation.value)) {
    return "Unavailable";
  }
  if (
    observation.value_state === ValueState.MISSING ||
    observation.value_state === ValueState.UNAVAILABLE ||
    observation.value_state === ValueState.NO_COUNTY_LINKED_RECORD ||
    observation.value_state === ValueState.NO_RECORDS
  ) {
    return "Unavailable";
  }
  if (observation.value_state === ValueState.SUPPRESSED) {
    return "Suppressed";
  }
  return quantityText(
    observation.value,
    environmentalDisplayUnit(observation.unit)
  );
}

function valueNote(input: {
  claimLabel: string;
  observation: Observation;
}): string | null {
  const notes: string[] = [];
  if (valueIsBlank(input.observation.value)) {
    notes.push("No numeric value was returned. Null is not shown as zero.");
  } else if (input.observation.value_state === ValueState.ZERO) {
    notes.push(
      "Published zero. This is an observed zero, not missing data and not out of coverage."
    );
  }
  if (input.observation.measure_id === "nclimgrid_tavg_county_day") {
    notes.push(
      "NOAA-supplied average temperature. Atlas does not recompute it."
    );
  }
  if (input.observation.environmental_context == null) {
    notes.push(
      `${input.claimLabel} coverage was not returned with this observation.`
    );
  }
  if (notes.length === 0) {
    return null;
  }
  return notes.join(" ");
}

export type EnvironmentalMeasurePresentation = {
  claimLabel: string;
  coverageLabel: string;
  dayConvention: string;
  evidence: EvidenceObjectModel;
  measureId: string;
  methodVersion: string;
  productId: string;
  provenanceRef: string;
  sourceLabel: string;
  valueStateLabel: string;
};

export function presentEnvironmentalObservation(input: {
  claimLabel: string;
  observation: Observation;
}): EnvironmentalMeasurePresentation {
  const coverage =
    input.observation.environmental_context?.coverage_status ?? null;
  const derivedReason = coverageReason(coverage);
  const partial =
    coverage === EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE;
  const base = evidenceObjectFromObservation({
    claimLabel: input.claimLabel,
    observation: input.observation,
  });
  const limitations = partial
    ? ["Partial coverage.", ...base.provenance.limitations]
    : [...base.provenance.limitations];
  const hasLimitations = hasGovernedMaterialLimitations(limitations);
  const blocked = derivedReason != null;
  const blank = valueIsBlank(input.observation.value);
  const reasonCode = blocked
    ? derivedReason
    : reasonCodeForEvidence({
        hasMaterialLimitations: hasLimitations,
        valueState: blank
          ? ValueState.UNAVAILABLE
          : input.observation.value_state,
      });
  const availability = blocked
    ? availabilityFromGovernedValueState({
        valueState: ValueState.UNAVAILABLE,
      })
    : availabilityFromGovernedValueState({
        hasMaterialLimitations: hasLimitations,
        valueState: blank
          ? ValueState.UNAVAILABLE
          : input.observation.value_state,
      });
  const dayConvention =
    input.observation.environmental_context?.day_convention.trim() ||
    "The 24-hour convention was not returned.";
  const evidence: EvidenceObjectModel = {
    ...base,
    availability,
    displayValue: environmentalDisplayValue(input.observation),
    provenance: {
      ...base.provenance,
      limitations,
      materialCaveat: materialCaveatShort(limitations),
    },
    reasonCode,
    valueNote: valueNote(input),
  };
  return {
    claimLabel: input.claimLabel,
    coverageLabel: environmentalCoverageLabel(coverage),
    dayConvention,
    evidence,
    measureId: input.observation.measure_id,
    methodVersion:
      input.observation.methodology_version.trim() || "Unavailable",
    productId: input.observation.source_id.trim() || "Unavailable",
    provenanceRef: input.observation.provenance_ref.trim() || "Unavailable",
    sourceLabel:
      input.observation.source_label?.trim() ||
      input.observation.source_id.trim() ||
      "Unavailable",
    valueStateLabel: `Value state ${input.observation.value_state}. ${evidenceReasonLabel(reasonCode)}.`,
  };
}

export function observationMatchesEnvironmentalRequest(
  observation: Observation,
  request: {
    date: string;
    fips: string;
    measureId: string;
    releaseId: string;
  }
): boolean {
  return (
    observation.measure_id === request.measureId &&
    observation.release_id === request.releaseId &&
    observation.geography.geography_type === "county" &&
    observation.geography.geography_id === request.fips &&
    observation.period_start === request.date &&
    observation.period_end === request.date
  );
}
