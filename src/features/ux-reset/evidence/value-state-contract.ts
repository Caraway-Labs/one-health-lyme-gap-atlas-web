import { ValueState } from "@/generated/models";

import {
  evidenceAvailabilityValues,
  type EvidenceAvailability as EvidenceAvailabilityType,
  type EvidenceReasonCode,
} from "./types";

const UNAVAILABLE_VALUE_STATES: ReadonlySet<ValueState> = new Set([
  ValueState.MISSING,
  ValueState.UNAVAILABLE,
  ValueState.NO_COUNTY_LINKED_RECORD,
]);

const LIMITED_VALUE_STATES: ReadonlySet<ValueState> = new Set([
  ValueState.SUPPRESSED,
]);

export type AvailabilityDerivationInput = {
  valueState: ValueState;
  /** When true and value state is otherwise available, surface Limited. */
  hasMaterialLimitations?: boolean;
};

export function availabilityFromGovernedValueState({
  hasMaterialLimitations = false,
  valueState,
}: AvailabilityDerivationInput): EvidenceAvailabilityType {
  if (UNAVAILABLE_VALUE_STATES.has(valueState)) {
    return evidenceAvailabilityValues.unavailable;
  }
  if (LIMITED_VALUE_STATES.has(valueState)) {
    return evidenceAvailabilityValues.limited;
  }
  if (hasMaterialLimitations) {
    return evidenceAvailabilityValues.limited;
  }
  return evidenceAvailabilityValues.available;
}

export function reasonCodeForEvidence({
  hasMaterialLimitations = false,
  valueState,
}: AvailabilityDerivationInput): EvidenceReasonCode {
  if (
    hasMaterialLimitations &&
    valueState !== ValueState.SUPPRESSED &&
    !UNAVAILABLE_VALUE_STATES.has(valueState)
  ) {
    return "MATERIAL_LIMITATION";
  }
  return valueState;
}

const REASON_LABELS: Record<EvidenceReasonCode, string> = {
  [ValueState.OBSERVED]: "Observed or published",
  [ValueState.ZERO]: "Published zero",
  [ValueState.MISSING]: "No county record",
  [ValueState.SUPPRESSED]: "Suppressed or privacy-protected",
  [ValueState.UNAVAILABLE]: "Unavailable for this release",
  [ValueState.NO_COUNTY_LINKED_RECORD]: "No county-linked record",
  MATERIAL_LIMITATION: "Coverage or methodology limits apply",
};

export function evidenceReasonLabel(reasonCode: EvidenceReasonCode): string {
  return REASON_LABELS[reasonCode];
}

export function evidenceAvailabilityLabel(
  availability: EvidenceAvailabilityType
): string {
  switch (availability) {
    case evidenceAvailabilityValues.available: {
      return "Available";
    }
    case evidenceAvailabilityValues.limited: {
      return "Limited";
    }
    case evidenceAvailabilityValues.unavailable: {
      return "Unavailable";
    }
    default: {
      const _exhaustive: never = availability;
      return _exhaustive;
    }
  }
}

export type FormatGovernedValueInput = {
  value: number | string | null;
  valueState: ValueState;
  unit?: string | null;
};

function appendUnit(
  formatted: string,
  unit: string | null | undefined
): string {
  const normalizedUnit = unit?.trim();
  if (!normalizedUnit) {
    return formatted;
  }
  return `${formatted} ${normalizedUnit}`;
}

function formatGovernedNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "Unavailable";
  }
  if (value === 0) {
    return "0";
  }
  const abs = Math.abs(value);
  if (abs >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }
  if (abs >= 0.01) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }
  return value.toLocaleString("en-US", { maximumSignificantDigits: 12 });
}

/**
 * Formats a governed observation value for display. Unavailable states never
 * render as numeric zero even when the payload carries `value: 0`.
 */
export function formatGovernedEvidenceValue({
  unit,
  value,
  valueState,
}: FormatGovernedValueInput): string {
  const availability = availabilityFromGovernedValueState({ valueState });
  if (availability === evidenceAvailabilityValues.unavailable) {
    return "Unavailable";
  }

  if (valueState === ValueState.SUPPRESSED) {
    return "Suppressed";
  }

  if (value === null || value === "") {
    if (valueState === ValueState.ZERO) {
      return appendUnit("0", unit);
    }
    return "Unavailable";
  }

  if (typeof value === "number") {
    return appendUnit(formatGovernedNumericValue(value), unit);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Unavailable";
  }
  if (unit?.trim() && !trimmed.includes(unit.trim())) {
    return appendUnit(trimmed, unit);
  }
  return trimmed;
}

export function normalizeGovernedLimitations(
  limitations: readonly string[] | null | undefined
): string[] {
  if (!limitations?.length) {
    return [];
  }
  return limitations
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function hasGovernedMaterialLimitations(
  limitations: readonly string[] | null | undefined
): boolean {
  return normalizeGovernedLimitations(limitations).length > 0;
}

/** Short strip caveat: first governed limitation only. */
export function materialCaveatShort(
  limitations: readonly string[] | null | undefined
): string | null {
  const normalized = normalizeGovernedLimitations(limitations);
  return normalized[0] ?? null;
}
