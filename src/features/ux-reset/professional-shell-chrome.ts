/** Room the route pane needs before the inset scrolls the route with the chrome. */
export const USABLE_ROUTE_STRIP_PX = 160;

export function insetShouldScrollWithRoute(
  headerHeight: number,
  footerHeight: number,
  insetHeight: number
): boolean {
  if (
    !(
      insetHeight > 0 &&
      Number.isFinite(headerHeight) &&
      Number.isFinite(footerHeight) &&
      Number.isFinite(insetHeight)
    )
  ) {
    return false;
  }
  return insetHeight - headerHeight - footerHeight < USABLE_ROUTE_STRIP_PX;
}
