import { afterEach, describe, expect, it } from "vitest";

import {
  captureReviewReturnFocusMount,
  markReviewReturnFocus,
  resolveReviewReturnFocus,
  reviewReturnFocusMountAfterPark,
  reviewReturnFocusTokenForMount,
} from "@/features/ux-reset/review/review-return-focus";

const RETURN_FOCUS_KEY = "ux-reset-review-return-focus";

describe(resolveReviewReturnFocus, () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState(null, "");
  });

  it("restores focus after a blank directory selection for the same URL county", () => {
    const armed = resolveReviewReturnFocus({
      latchedFips: null,
      mountedToken: "08041",
      selectedFips: "08041",
      urlCounty: "08041",
    });
    expect(armed).toStrictEqual({ focus: true, latch: "08041" });

    const blank = resolveReviewReturnFocus({
      latchedFips: armed.latch,
      mountedToken: "08041",
      selectedFips: "",
      urlCounty: "08041",
    });
    expect(blank).toStrictEqual({ focus: false, latch: "08041" });

    const restored = resolveReviewReturnFocus({
      latchedFips: blank.latch,
      mountedToken: "08041",
      selectedFips: "08041",
      urlCounty: "08041",
    });
    expect(restored).toStrictEqual({ focus: true, latch: "08041" });
  });

  it("does not let an empty URL county erase a stored return", () => {
    sessionStorage.setItem(RETURN_FOCUS_KEY, "08041");
    const fallback = resolveReviewReturnFocus({
      latchedFips: null,
      mountedToken: "08041",
      selectedFips: "08001",
      urlCounty: "",
    });
    expect(fallback).toStrictEqual({ focus: false, latch: null });
    expect(sessionStorage.getItem(RETURN_FOCUS_KEY)).toBe("08041");
  });

  it("drops the latch when the URL county changes", () => {
    const armed = resolveReviewReturnFocus({
      latchedFips: null,
      mountedToken: "08041",
      selectedFips: "08041",
      urlCounty: "08041",
    });
    const changed = resolveReviewReturnFocus({
      latchedFips: armed.latch,
      mountedToken: "08041",
      selectedFips: "08013",
      urlCounty: "08013",
    });
    expect(changed).toStrictEqual({ focus: false, latch: null });
  });

  it("keeps a token written by leaving Review for the next mount", () => {
    const open = captureReviewReturnFocusMount();
    markReviewReturnFocus("08041");
    expect(reviewReturnFocusTokenForMount(open)).toBeNull();
    expect(sessionStorage.getItem(RETURN_FOCUS_KEY)).toBe("08041");

    const returned = captureReviewReturnFocusMount();
    expect(reviewReturnFocusTokenForMount(returned)).toBe("08041");
    const focus = resolveReviewReturnFocus({
      latchedFips: null,
      mountedToken: reviewReturnFocusTokenForMount(returned),
      selectedFips: "08041",
      urlCounty: "08041",
    });
    expect(focus).toStrictEqual({ focus: true, latch: "08041" });
  });

  it("adopts a departure token when parked Review becomes visible again", () => {
    const open = captureReviewReturnFocusMount();
    markReviewReturnFocus("08041");
    expect(reviewReturnFocusMountAfterPark(open, false)).toBe(open);
    expect(reviewReturnFocusTokenForMount(open)).toBeNull();

    const visible = reviewReturnFocusMountAfterPark(open, true);
    expect(reviewReturnFocusTokenForMount(visible)).toBe("08041");
    expect(reviewReturnFocusMountAfterPark(visible, true)).toBe(visible);
  });
});
