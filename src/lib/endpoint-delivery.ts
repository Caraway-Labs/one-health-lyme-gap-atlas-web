/**
 * Delivery status for the canonical geography identity route.
 *
 * Checked on 18 October 2026 at the published API origin.
 * `GET /v1/geographies/county/08001` returned an HTML error page. The client
 * status was 504, `x-do-orig-status` was 503, and `Retry-After` was absent.
 * There was no Geography JSON body. The badge follows the origin status.
 */
export const GEOGRAPHY_IDENTITY_PATH =
  "/v1/geographies/{geography_type}/{geography_id}";

export const GEOGRAPHY_IDENTITY_ORIGIN_STATUS = 503;

export const GEOGRAPHY_IDENTITY_CLIENT_STATUS = 504;

export const DISPLAY_GEOMETRY_PATH = "/v1/atlas/geometry";

export function pendingDeliveryLabel(originStatus: number): string | null {
  if (originStatus === 503) return "Delivery pending";
  return null;
}

export function showsPendingDeliveryBadge(
  method: string,
  route: string,
  originStatus: number
): boolean {
  return (
    method === "GET" &&
    route === GEOGRAPHY_IDENTITY_PATH &&
    pendingDeliveryLabel(originStatus) !== null
  );
}
