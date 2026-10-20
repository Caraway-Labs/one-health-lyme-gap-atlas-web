import { describe, expect, it } from "vitest";

import {
  atlasSearchParams,
  toScoreSettings,
} from "../src/lib/atlas-search-params";

describe("Atlas search-parameter contract", () => {
  it("resets a legacy parameter and permits the next v1.1 slider state", () => {
    expect(
      toScoreSettings({ breakpoint: "10", smooth: 50, eco: 85, missing: 40 })
    ).toStrictEqual({
      smooth_k: 50,
      ecological_share: 65,
      missing_human_weakness: 75,
    });
    expect(
      toScoreSettings({ breakpoint: null, smooth: 100, eco: 85, missing: 40 })
    ).toStrictEqual({
      smooth_k: 100,
      ecological_share: 85,
      missing_human_weakness: 40,
    });
  });

  it("parses state, evidence, and county values", () => {
    expect(atlasSearchParams.state.parse("CO")).toBe("CO");
    expect(atlasSearchParams.evidence.parse("human")).toBe("human");
    expect(atlasSearchParams.evidence.parse("unknown")).toBeNull();
    expect(atlasSearchParams.county.parse("08001")).toBe("08001");
    expect(atlasSearchParams.county.parse("8001")).toBeNull();
  });

  it("serializes supported public values", () => {
    expect(atlasSearchParams.state.serialize("CO")).toBe("CO");
    expect(atlasSearchParams.county.serialize("08001")).toBe("08001");
  });

  it("parses comparison FIPS values safely", () => {
    expect(atlasSearchParams.compare.parse("06037")).toBe("06037");
    expect(atlasSearchParams.compare.parse("bad")).toBeNull();
  });

  it("accepts bounded score settings and rejects invalid values", () => {
    expect(atlasSearchParams.eco.parse("70")).toBe(70);
    expect(atlasSearchParams.eco.parse("71")).toBeNull();
    expect(atlasSearchParams.smooth.parse("25")).toBe(25);
    expect(atlasSearchParams.smooth.parse("26")).toBeNull();
    expect(atlasSearchParams.missing.parse("80")).toBe(80);
  });
});
