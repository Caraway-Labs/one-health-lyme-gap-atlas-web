/** Browse Suggested Follow-up card under the Explorer workspace. */
export const EXPLORER_MAP_FOLLOW_UP_ID = "explorer-map-follow-up";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Move to the existing Suggested Follow-up section on this page.
 * Smooth scrolling is skipped when the user prefers reduced motion.
 * Focus lands on the section so the destination has a name.
 */
export function scrollToSuggestedFollowUp(
  target: HTMLElement | null,
  reducedMotion = prefersReducedMotion()
): boolean {
  if (!target) {
    return false;
  }
  target.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });
  target.focus({ preventScroll: true });
  return true;
}
