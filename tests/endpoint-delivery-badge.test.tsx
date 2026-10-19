import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EndpointDeliveryBadge } from "@/features/docs/endpoint-delivery-badge";
import {
  PENDING_DELIVERY_BADGE_LABEL,
  PENDING_DELIVERY_NOTE,
} from "@/lib/endpoint-delivery";

describe(EndpointDeliveryBadge, () => {
  afterEach(() => cleanup());

  it("renders the dated production snapshot and not a live status", () => {
    render(<EndpointDeliveryBadge />);
    expect({
      label: screen.getByText(PENDING_DELIVERY_BADGE_LABEL).textContent,
      note: screen.getByText(PENDING_DELIVERY_NOTE).textContent,
    }).toStrictEqual({
      label: "Delivery pending at the last production check, 18 October 2026.",
      note: "Production API, 18 October 2026. This is not a live health indicator.",
    });
  });
});
