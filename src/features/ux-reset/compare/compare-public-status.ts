import type {
  CompareMissingReason,
  CompareSideValue,
} from "@/features/ux-reset/compare/compare-visual-model";
import type { EvidenceReasonCode } from "@/features/ux-reset/evidence/types";
import { ValueState } from "@/generated/models";

/**
 * Public status words for Compare.
 * Each phrase follows an existing reason code or published status token.
 * A reason that is not recognized stays Unavailable or the published text.
 */

export type ComparePublicStatus = {
  detail: string | null;
  label: string;
};

const NO_RECORD_DETAIL = "No record does not mean absent.";
const SUPPRESSED_DETAIL =
  "Suppressed in the published data. A suppressed value is not zero.";
const NOT_PUBLISHED_DETAIL = "No published value. A missing value is not zero.";
const COVERAGE_DETAIL =
  "This source does not cover this county. That is not a zero.";
const FAILED_DETAIL =
  "This value could not be loaded. A request failure is not a published zero.";
const RELEASE_DETAIL =
  "This record is for a different release, so it is not used here.";

function categoricalLabel(text: string): string | null {
  const normalized = text.trim().toLowerCase().replaceAll(/\s+/g, " ");
  switch (normalized) {
    case "established":
    case "established status": {
      return "Established";
    }
    case "present":
    case "present status": {
      return "Recorded as present";
    }
    case "no record":
    case "no records": {
      return "No record";
    }
    case "reported": {
      return "Reported";
    }
    default: {
      return null;
    }
  }
}

function fromReasonCode(
  reason: EvidenceReasonCode
): ComparePublicStatus | null {
  switch (reason) {
    case ValueState.NO_RECORDS:
    case ValueState.NO_COUNTY_LINKED_RECORD: {
      return { detail: NO_RECORD_DETAIL, label: "No record" };
    }
    case ValueState.MISSING: {
      return { detail: NOT_PUBLISHED_DETAIL, label: "Not published" };
    }
    case ValueState.SUPPRESSED: {
      return { detail: SUPPRESSED_DETAIL, label: "Suppressed" };
    }
    case "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE":
    case "ENVIRONMENTAL_SOURCE_MISSING": {
      return { detail: COVERAGE_DETAIL, label: "Not covered by this source" };
    }
    case ValueState.UNAVAILABLE: {
      return { detail: null, label: "Unavailable" };
    }
    case ValueState.OBSERVED:
    case ValueState.ZERO:
    case "MATERIAL_LIMITATION": {
      return null;
    }
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

function fromMissingReason(reason: CompareMissingReason): ComparePublicStatus {
  switch (reason) {
    case "failed": {
      return { detail: FAILED_DETAIL, label: "Could not load" };
    }
    case "release_mismatch": {
      return { detail: RELEASE_DETAIL, label: "Not usable for this release" };
    }
    case "suppressed": {
      return { detail: SUPPRESSED_DETAIL, label: "Suppressed" };
    }
    case "missing": {
      return { detail: NOT_PUBLISHED_DETAIL, label: "Not published" };
    }
    case "unavailable": {
      return { detail: null, label: "Unavailable" };
    }
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

/** Words for one county cell. Numeric text is left unchanged, including zero. */
export function comparePublicStatus(
  side: CompareSideValue,
  categorical: boolean
): ComparePublicStatus {
  if (side.kind === "value") {
    if (side.isZero) {
      return {
        detail: "Published zero. This is not a missing value.",
        label: side.text,
      };
    }
    if (categorical) {
      const known = categoricalLabel(side.text);
      if (known === "No record") {
        return { detail: NO_RECORD_DETAIL, label: known };
      }
      if (known) {
        return { detail: null, label: known };
      }
    }
    const fromCode = side.evidence.reasonCode
      ? fromReasonCode(side.evidence.reasonCode)
      : null;
    if (fromCode && side.evidence.availability !== "available") {
      return fromCode;
    }
    return { detail: null, label: side.text };
  }
  if (side.evidence?.reasonCode) {
    const fromCode = fromReasonCode(side.evidence.reasonCode);
    if (fromCode) {
      return fromCode;
    }
  }
  const published = categoricalLabel(side.text);
  if (published) {
    return {
      detail: published === "No record" ? NO_RECORD_DETAIL : null,
      label: published,
    };
  }
  return fromMissingReason(side.reason);
}

/**
 * Uninsured chart domain.
 * The axis always starts at 0. The upper bound is the next multiple of 10
 * percentage points at or above the larger value, and at least 10.
 * A point is never placed past the labeled end of the axis.
 */
export function uninsuredAxisMax(values: readonly (number | null)[]): number {
  let peak = 0;
  for (const value of values) {
    if (value !== null && Number.isFinite(value) && value > peak) {
      peak = value;
    }
  }
  if (peak <= 0) {
    return 10;
  }
  const steps = Math.ceil(peak / 10) * 10;
  return Math.max(steps, 10);
}

export function communityPointPercent(
  value: number,
  min: number,
  max: number
): number | null {
  if (!Number.isFinite(value) || max <= min) {
    return null;
  }
  const fraction = (value - min) / (max - min);
  if (fraction < 0 || fraction > 1) {
    return null;
  }
  return fraction * 100;
}
