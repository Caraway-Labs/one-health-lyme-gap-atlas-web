import { describe, expect, it } from "vitest";

import {
  USABLE_ROUTE_STRIP_PX,
  insetShouldScrollWithRoute,
} from "@/features/ux-reset/professional-shell-chrome";

describe("professional shell chrome overflow", () => {
  it("scrolls the inset with the route only when the header leaves no usable strip", () => {
    const cases = [
      [48, 900],
      [80, 844],
      [56, 80],
      [70, 200],
      [100, 160],
      [0, 0],
      [Number.NaN, 80],
    ] as const;
    const decisions = cases.map(([header, inset]) =>
      insetShouldScrollWithRoute(header, inset)
    );
    expect(decisions).toStrictEqual([
      false,
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(USABLE_ROUTE_STRIP_PX).toBe(160);
  });
});
