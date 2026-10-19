/**
 * Snapshot for the canonical geography identity route.
 *
 * On 18 October 2026 the production API returned an HTML error page for
 * `GET /v1/geographies/county/08001`. The client status was 504, the origin
 * status was 503, and `Retry-After` was absent. There was no Geography JSON
 * body. The badge records that check. It does not read the current origin.
 */
export const GEOGRAPHY_IDENTITY_PATH =
  "/v1/geographies/{geography_type}/{geography_id}";

export const GEOGRAPHY_IDENTITY_CHECK_DATE = "18 October 2026";

export const PENDING_DELIVERY_BADGE_LABEL =
  "Delivery pending at the last production check, 18 October 2026.";

export const PENDING_DELIVERY_NOTE =
  "Production API, 18 October 2026. This is not a live health indicator.";

export const DISPLAY_GEOMETRY_PATH = "/v1/atlas/geometry";

export function pendingDeliveryLabel(): string {
  return PENDING_DELIVERY_BADGE_LABEL;
}

export function showsPendingDeliveryBadge(
  method: string,
  route: string
): boolean {
  return method === "GET" && route === GEOGRAPHY_IDENTITY_PATH;
}
