import { describe, expect, it } from "vitest";

import {
  USABLE_ROUTE_STRIP_PX,
  insetShouldScrollWithRoute,
} from "@/features/ux-reset/professional-shell-chrome";

describe("professional shell chrome overflow", () => {
  it("scrolls the inset with the route only when the chrome leaves no usable strip", () => {
    const cases = [
      [48, 72, 900],
      [80, 120, 844],
      [56, 40, 80],
      [70, 90, 200],
      [100, 60, 160],
      [0, 0, 0],
      [Number.NaN, 40, 80],
    ] as const;
    const decisions = cases.map(([header, footer, inset]) =>
      insetShouldScrollWithRoute(header, footer, inset)
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
