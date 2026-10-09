import { isUxResetDatasetId } from "@/features/ux-reset/context-params";
import { parseAtlasDateTime } from "@/lib/atlas-evidence-metadata";

export const REVIEW_FIELD_UNAVAILABLE = "Unavailable";

const REVIEW_COUNTY_FIPS = /^\d{5}$/;

/** Source-native and free-text fields. Blank is Unavailable; no invented pattern. */
export function reviewText(value: string): string {
  return value.trim() || REVIEW_FIELD_UNAVAILABLE;
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

export function reviewRetrievedAt(value: string): string {
  return parseAtlasDateTime(value) ?? REVIEW_FIELD_UNAVAILABLE;
}
