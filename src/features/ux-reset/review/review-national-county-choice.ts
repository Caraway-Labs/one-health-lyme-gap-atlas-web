import { parseUxResetSharedContext } from "@/features/ux-reset/context-shared";

import {
  normalizeReviewCounty,
  reviewCountyFipsForScope,
} from "./review-operating-state";

const EXPLICIT_NATIONAL_COUNTY_KEY = "uxResetNationalCountyChoice";

function historyRecord(): Record<string, unknown> | null {
  if (typeof history === "undefined") {
    return null;
  }
  const state: unknown = history.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  return state as Record<string, unknown>;
}

/**
 * Remember which published county the user chose on this national history
 * entry. Back and Forward read that entry instead of the latest click.
 * `null` is an explicit clear. A missing key is an untouched entry.
 */
export function stampExplicitNationalCounty(fips: string | null): void {
  if (typeof history === "undefined") {
    return;
  }
  const current = historyRecord() ?? {};
  history.replaceState(
    { ...current, [EXPLICIT_NATIONAL_COUNTY_KEY]: fips },
    ""
  );
}

/** True when the live national URL county is the one this write intended. */
export function nationalHistoryCountyMatches(county: string | null): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const shared = parseUxResetSharedContext(
    new URLSearchParams(window.location.search)
  );
  if (shared.scope !== "ALL") {
    return false;
  }
  return normalizeReviewCounty(shared.scope, shared.county) === county;
}

/**
 * Published county to restore for the current history entry.
 * The marker must be a lower-48 or DC FIPS and equal the restored URL county.
 * Untouched bookmarks, invalid values, and Alaska or Hawaii stay withheld.
 */
export function explicitNationalCountyFromHistory(): string | null {
  const marked = historyRecord()?.[EXPLICIT_NATIONAL_COUNTY_KEY];
  if (typeof marked !== "string" || !nationalHistoryCountyMatches(marked)) {
    return null;
  }
  return reviewCountyFipsForScope(marked, "ALL");
}
