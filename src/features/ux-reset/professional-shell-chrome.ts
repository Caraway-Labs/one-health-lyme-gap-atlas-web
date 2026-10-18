/**
 * Room the route pane needs before the inset scrolls the route with the header.
 * The trust footer is route content, so it does not reduce this strip.
 */
export const USABLE_ROUTE_STRIP_PX = 160;

export function insetShouldScrollWithRoute(
  headerHeight: number,
  insetHeight: number
): boolean {
  if (
    !(
      insetHeight > 0 &&
      Number.isFinite(headerHeight) &&
      Number.isFinite(insetHeight)
    )
  ) {
    return false;
  }
  return insetHeight - headerHeight < USABLE_ROUTE_STRIP_PX;
}
