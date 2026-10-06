import { describe, expect, it } from "vitest";

import { investigateContinueDestination } from "@/features/ux-reset/investigate/investigate-next-step";

describe("Investigate continue destination", () => {
  it("continues to Action when evidence is ready and compare has fewer than two counties", () => {
    expect(
      investigateContinueDestination({ compare: [], evidenceReady: true })
    ).toBe("action");
    expect(
      investigateContinueDestination({
        compare: ["08001"],
        evidenceReady: true,
      })
    ).toBe("action");
  });

  it("returns to Compare when the link already has two validated counties", () => {
    expect(
      investigateContinueDestination({
        compare: ["08001", "08013"],
        evidenceReady: true,
      })
    ).toBe("compare");
    expect(
      investigateContinueDestination({
        compare: ["08001", "08013"],
        evidenceReady: false,
      })
    ).toBe("compare");
    expect(
      investigateContinueDestination({
        compare: ["08001", "08001"],
        evidenceReady: true,
      })
    ).toBe("action");
  });

  it("offers no cross-page path without evidence or a compare pair", () => {
    expect(
      investigateContinueDestination({ compare: [], evidenceReady: false })
    ).toBeNull();
    expect(
      investigateContinueDestination({
        compare: ["not-a-fips", "08013"],
        evidenceReady: false,
      })
    ).toBeNull();
  });
});
