import { describe, expect, it } from "vitest";

import {
  FRONT_PORCH_FIRST_FINDING_LINE,
  frontPorchRevealIndex,
} from "@/features/front-porch/front-porch-scrolly";

const viewportHeight = 900;

describe("front porch reveal index", () => {
  it("keeps the opening illustration empty until panel 01's paragraph reaches the reading line", () => {
    expect(
      frontPorchRevealIndex({
        nearest: 0,
        firstParagraphBottom:
          viewportHeight * FRONT_PORCH_FIRST_FINDING_LINE + 1,
        viewportHeight,
        reducedMotion: false,
      })
    ).toBe(-1);
    expect(
      frontPorchRevealIndex({
        nearest: 0,
        firstParagraphBottom: viewportHeight * FRONT_PORCH_FIRST_FINDING_LINE,
        viewportHeight,
        reducedMotion: false,
      })
    ).toBe(0);
  });

  it("keeps later beats on the existing nearest-beat threshold", () => {
    expect(
      frontPorchRevealIndex({
        nearest: 1,
        firstParagraphBottom: viewportHeight,
        viewportHeight,
        reducedMotion: false,
      })
    ).toBe(1);
    expect(
      frontPorchRevealIndex({
        nearest: 2,
        firstParagraphBottom: viewportHeight,
        viewportHeight,
        reducedMotion: false,
      })
    ).toBe(2);
  });

  it("shows every finding when motion is reduced", () => {
    expect(
      frontPorchRevealIndex({
        nearest: 0,
        firstParagraphBottom: viewportHeight,
        viewportHeight,
        reducedMotion: true,
      })
    ).toBe(2);
  });
});
