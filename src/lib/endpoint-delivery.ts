/**
 * Snapshot for the canonical geography identity route.
 *
 * On 25 October 2026 a read-only production check of
 * `GET /v1/geographies/county/08001` returned HTTP 200. The origin status
 * (`x-do-orig-status`) was 200. The body was `application/json` with
 * `availability` `UNAVAILABLE`, `reason` `CANONICAL_GEOGRAPHY_UNPUBLISHED`,
 * `data` null, the echoed county identity, and `limitations`.
 * `Cache-Control` was `no-store`. The badge records that dated check. It
 * does not read the current origin. This is not a live health indicator.
 */
export const GEOGRAPHY_IDENTITY_PATH =
  "/v1/geographies/{geography_type}/{geography_id}";

export const GEOGRAPHY_IDENTITY_CHECK_DATE = "25 October 2026";

export const PENDING_DELIVERY_BADGE_LABEL = `Typed HTTP 200, canonical identity unpublished, at the last production check, ${GEOGRAPHY_IDENTITY_CHECK_DATE}.`;

export const PENDING_DELIVERY_NOTE = `Production API, ${GEOGRAPHY_IDENTITY_CHECK_DATE}. This records a dated check. This is not a live health indicator.`;

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
