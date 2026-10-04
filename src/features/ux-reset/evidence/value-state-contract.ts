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
      return unit ? `0 ${unit}` : "0";
    }
    return "Unavailable";
  }

  if (typeof value === "number") {
    const formatted = value.toLocaleString("en-US");
    return unit ? `${formatted} ${unit}` : formatted;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Unavailable";
}

export function materialLimitationFromList(
  limitations: readonly string[] | null | undefined
): string | null {
  if (!limitations?.length) {
    return null;
  }
  const first = limitations.find((entry) => entry.trim().length > 0);
  return first?.trim() ?? null;
}
