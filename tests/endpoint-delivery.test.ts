import { describe, expect, it } from "vitest";

import { displayGeometryUrl } from "@/features/docs/display-geometry-example";
import {
  DISPLAY_GEOMETRY_PATH,
  GEOGRAPHY_IDENTITY_PATH,
  pendingDeliveryLabel,
  PENDING_DELIVERY_BADGE_LABEL,
  showsPendingDeliveryBadge,
} from "@/lib/endpoint-delivery";
import { getPublishedApiOrigin } from "@/lib/public-origins";

describe("pending delivery badge", () => {
  it("labels the geography identity route from the production snapshot", () => {
    expect({
      geometry: showsPendingDeliveryBadge("GET", DISPLAY_GEOMETRY_PATH),
      identity: showsPendingDeliveryBadge("GET", GEOGRAPHY_IDENTITY_PATH),
      label: pendingDeliveryLabel(),
    }).toStrictEqual({
      geometry: false,
      identity: true,
      label: PENDING_DELIVERY_BADGE_LABEL,
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
