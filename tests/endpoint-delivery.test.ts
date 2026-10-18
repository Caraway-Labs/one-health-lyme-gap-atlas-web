import { describe, expect, it } from "vitest";

import { displayGeometryUrl } from "@/features/docs/display-geometry-example";
import {
  DISPLAY_GEOMETRY_PATH,
  GEOGRAPHY_IDENTITY_CLIENT_STATUS,
  GEOGRAPHY_IDENTITY_ORIGIN_STATUS,
  GEOGRAPHY_IDENTITY_PATH,
  pendingDeliveryLabel,
  showsPendingDeliveryBadge,
} from "@/lib/endpoint-delivery";
import { getPublishedApiOrigin } from "@/lib/public-origins";

describe("pending delivery badge", () => {
  it("badges the geography identity route only while the origin status is 503", () => {
    expect({
      clientStatus: showsPendingDeliveryBadge(
        "GET",
        GEOGRAPHY_IDENTITY_PATH,
        GEOGRAPHY_IDENTITY_CLIENT_STATUS
      ),
      geometry: showsPendingDeliveryBadge(
        "GET",
        DISPLAY_GEOMETRY_PATH,
        GEOGRAPHY_IDENTITY_ORIGIN_STATUS
      ),
      label: pendingDeliveryLabel(GEOGRAPHY_IDENTITY_ORIGIN_STATUS),
      otherLabel: pendingDeliveryLabel(200),
      published: showsPendingDeliveryBadge("GET", GEOGRAPHY_IDENTITY_PATH, 200),
      unavailable: showsPendingDeliveryBadge(
        "GET",
        GEOGRAPHY_IDENTITY_PATH,
        503
      ),
    }).toStrictEqual({
      clientStatus: false,
      geometry: false,
      label: "Delivery pending",
      otherLabel: null,
      published: false,
      unavailable: true,
    });
  });

  it("builds the display geometry URL from the published API origin", () => {
    expect(displayGeometryUrl()).toBe(
      `${getPublishedApiOrigin({})}${DISPLAY_GEOMETRY_PATH}`
    );
    expect(
      displayGeometryUrl({
        NEXT_PUBLIC_API_BASE_URL: "https://preview.example",
      })
    ).toBe(`https://preview.example${DISPLAY_GEOMETRY_PATH}`);
  });
});
