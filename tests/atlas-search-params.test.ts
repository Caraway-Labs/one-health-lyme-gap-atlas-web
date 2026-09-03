import { describe, expect, it } from "vitest";

import { atlasSearchParams } from "../src/lib/atlas-search-params";

describe("Atlas search-parameter contract", () => {
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
    expect(atlasSearchParams.breakpoint.parse("25")).toBe(25);
    expect(atlasSearchParams.breakpoint.parse("26")).toBeNull();
    expect(atlasSearchParams.missing.parse("80")).toBe(80);
  });
});
