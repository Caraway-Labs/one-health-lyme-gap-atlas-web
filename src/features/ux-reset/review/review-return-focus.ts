const REVIEW_RETURN_FOCUS_KEY = "ux-reset-review-return-focus";

type ReviewHistoryState = {
  uxResetReviewReturnFocus?: unknown;
};

/**
 * Bumps when the user leaves Review for Compare or Investigate.
 * A view that is already open must not treat that write as a return:
 * doing so focuses the row and deletes the token before navigation, so
 * Back arrives with nothing left to restore.
 */
let reviewReturnFocusGeneration = 0;

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

export type ReviewReturnFocusMount = {
  generation: number;
  token: string | null;
};

function reviewReturnFocusValue(value: unknown): string | null {
  return typeof value === "string" && /^\d{5}$/.test(value) ? value : null;
}

/**
 * Remember which Review county was open when the user explicitly leaves for
 * Investigate or Compare. The flag lives on the current Review history entry
 * so Back restores it without copying Review-only controls into the next URL.
 * sessionStorage covers a new history entry, such as the Compare return link.
 */
export function markReviewReturnFocus(fips: string): void {
  try {
    sessionStorage.setItem(REVIEW_RETURN_FOCUS_KEY, fips);
  } catch {
    // Private browsing can reject storage. The history entry is the other signal.
  }
  const current = historyRecord();
  history.replaceState({ ...current, uxResetReviewReturnFocus: fips }, "");
  reviewReturnFocusGeneration += 1;
}

/** Token already stored when this Review view mounts. Later marks do not count. */
export function readReviewReturnFocusToken(): string | null {
  const fromHistory = reviewReturnFocusValue(
    historyRecord()?.uxResetReviewReturnFocus
  );
  if (fromHistory) {
    return fromHistory;
  }
  try {
    return reviewReturnFocusValue(
      sessionStorage.getItem(REVIEW_RETURN_FOCUS_KEY)
    );
  } catch {
    return null;
  }
}

export function captureReviewReturnFocusMount(): ReviewReturnFocusMount {
  return {
    generation: reviewReturnFocusGeneration,
    token: readReviewReturnFocusToken(),
  };
}

/**
 * Token this mounted view may restore. A mark that happens after mount is the
 * user leaving, so this view must not focus the row or consume the token.
 */
export function reviewReturnFocusTokenForMount(
  mount: ReviewReturnFocusMount
): string | null {
  if (mount.generation !== reviewReturnFocusGeneration) {
    return null;
  }
  return mount.token;
}

/**
 * Decide whether this render should move focus back to the returned county.
 *
 * The URL county is the return target. A blank or fallback selection while
 * that URL county is unchanged must not cancel the return: the published
 * directory can drop for a render, replace the focused row, and come back
 * with the same county still selected.
 */
export function resolveReviewReturnFocus(input: {
  latchedFips: string | null;
  mountedToken: string | null;
  selectedFips: string;
  urlCounty: string;
}): { focus: boolean; latch: string | null } {
  const explicitCounty = /^\d{5}$/.test(input.urlCounty) ? input.urlCounty : "";
  const matches =
    explicitCounty !== "" && input.mountedToken === explicitCounty;
  let latch = input.latchedFips;
  if (matches && latch !== explicitCounty) {
    latch = explicitCounty;
  } else if (
    latch !== null &&
    explicitCounty !== "" &&
    explicitCounty !== latch
  ) {
    latch = null;
  }
  const focus = input.selectedFips !== "" && latch === input.selectedFips;
  return { focus, latch };
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
