import {
  isUxResetDatasetId,
  parseCalendarIsoDate,
} from "@/features/ux-reset/context-params";
import { parseAtlasDateTime } from "@/lib/atlas-evidence-metadata";

export const REVIEW_FIELD_UNAVAILABLE = "Unavailable";

const REVIEW_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
const REVIEW_RECORD_REF = /^[A-Za-z0-9][A-Za-z0-9._~:/+-]{0,255}$/;
const REVIEW_COUNTY_FIPS = /^\d{5}$/;

export function reviewText(value: string): string {
  return value.trim() || REVIEW_FIELD_UNAVAILABLE;
}

/** Method, version, family, status, and rule tokens. Prose is not an identifier. */
export function reviewIdentifier(value: string): string | null {
  const trimmed = value.trim();
  return REVIEW_IDENTIFIER.test(trimmed) ? trimmed : null;
}

export function reviewIdentifierText(value: string): string {
  return reviewIdentifier(value) ?? REVIEW_FIELD_UNAVAILABLE;
}

export function reviewDatasetId(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed && isUxResetDatasetId(trimmed) ? trimmed : null;
}

export function reviewDatasetText(value: string): string {
  return reviewDatasetId(value) ?? REVIEW_FIELD_UNAVAILABLE;
}

export function reviewFips(value: string): string | null {
  const trimmed = value.trim();
  return REVIEW_COUNTY_FIPS.test(trimmed) ? trimmed : null;
}

export function reviewFipsText(value: string): string {
  return reviewFips(value) ?? REVIEW_FIELD_UNAVAILABLE;
}

export function reviewRecordRef(value: string): string | null {
  const trimmed = value.trim();
  return REVIEW_RECORD_REF.test(trimmed) ? trimmed : null;
}

export function reviewRecordRefText(value: string): string {
  return reviewRecordRef(value) ?? REVIEW_FIELD_UNAVAILABLE;
}

/** Calendar date or offset date-time. Other text is not an as-of date. */
export function reviewSourceAsOf(value: string): string {
  const trimmed = value.trim();
  if (parseCalendarIsoDate(trimmed) || parseAtlasDateTime(trimmed)) {
    return trimmed;
  }
  return REVIEW_FIELD_UNAVAILABLE;
}

export function reviewRetrievedAt(value: string): string {
  return parseAtlasDateTime(value) ?? REVIEW_FIELD_UNAVAILABLE;
}
