import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EndpointDeliveryBadge } from "@/features/docs/endpoint-delivery-badge";
import {
  GEOGRAPHY_IDENTITY_CHECK_DATE,
  PENDING_DELIVERY_BADGE_LABEL,
  PENDING_DELIVERY_NOTE,
} from "@/lib/endpoint-delivery";

describe(EndpointDeliveryBadge, () => {
  afterEach(() => cleanup());

  it("renders the dated production snapshot and not a live status", () => {
    render(<EndpointDeliveryBadge />);
    expect({
      date: GEOGRAPHY_IDENTITY_CHECK_DATE,
      label: screen.getByText(PENDING_DELIVERY_BADGE_LABEL).textContent,
      note: screen.getByText(PENDING_DELIVERY_NOTE).textContent,
    }).toStrictEqual({
      date: "25 October 2026",
      label:
        "Typed HTTP 200, canonical identity unpublished, at the last production check, 25 October 2026.",
      note: "Production API, 25 October 2026. This records a dated check. This is not a live health indicator.",
    });
  });
});
