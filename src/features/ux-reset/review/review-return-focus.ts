const REVIEW_RETURN_FOCUS_KEY = "ux-reset-review-return-focus";

type ReviewHistoryState = {
  uxResetReviewReturnFocus?: unknown;
};

function historyRecord(): ReviewHistoryState | null {
  if (typeof history === "undefined") {
    return null;
  }
  const state: unknown = history.state;
  if (!state || typeof state !== "object") {
    return null;
  }
  return state;
}

/**
 * Remember which Review county was open when the user explicitly leaves for
 * Investigate. The flag lives on the current Review history entry so Back
 * restores it without copying Review-only controls into the Investigate URL.
 */
export function markReviewReturnFocus(fips: string): void {
  try {
    sessionStorage.setItem(REVIEW_RETURN_FOCUS_KEY, fips);
  } catch {
    // Private browsing can reject storage. The history entry is the other signal.
  }
  const current = historyRecord();
  history.replaceState({ ...current, uxResetReviewReturnFocus: fips }, "");
}

export function reviewReturnFocusMatches(selectedFips: string): boolean {
  const fromHistory =
    historyRecord()?.uxResetReviewReturnFocus === selectedFips;
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(REVIEW_RETURN_FOCUS_KEY);
    if (stored && stored !== selectedFips) {
      sessionStorage.removeItem(REVIEW_RETURN_FOCUS_KEY);
    }
  } catch {
    stored = null;
  }
  return fromHistory || stored === selectedFips;
}

/** Drop the session fallback once Review has restored focus for this return. */
export function consumeReviewReturnFocus(selectedFips: string): void {
  try {
    if (sessionStorage.getItem(REVIEW_RETURN_FOCUS_KEY) === selectedFips) {
      sessionStorage.removeItem(REVIEW_RETURN_FOCUS_KEY);
    }
  } catch {
    // Storage can be blocked. The history entry remains the return signal.
  }
}
