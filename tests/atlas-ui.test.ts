import { describe, expect, it } from "vitest";
import { matchesEvidence, numericParam, reasonsFor } from "../src/lib/atlas-ui";

const county = {
  fips: "08001", county: "Adams", state: "CO", state_name: "Colorado", in_contiguous_tick_scope: true,
  human_status: "no_county_linked_record", tick_status: "Established", burgdorferi_status: "Present", evidence_completeness: 6,
  score: { score: 61.9, human_weakness: 75, ecological: 100, community: 50, tick_signal: 100, pathogen_signal: 100, svi_signal: 50, access_signal: 50, rural_signal: 12.5 },
  priority: "Priority 2 — Review", color: "#efc64a",
};

describe("atlas UI rules", () => {
  it("validates shareable scoring parameters", () => {
    expect(numericParam("65", 0, 40, 85, 5)).toBe(65);
    expect(numericParam("66", 65, 40, 85, 5)).toBe(65);
    expect(numericParam("100", 65, 40, 85, 5)).toBe(65);
  });

  it("applies every evidence view consistently", () => {
    expect(matchesEvidence(county, "all")).toBe(true);
    expect(matchesEvidence(county, "ecological")).toBe(true);
    expect(matchesEvidence(county, "human")).toBe(false);
    expect(matchesEvidence(county, "complete")).toBe(true);
  });

  it("keeps missing human records distinct from zero cases", () => {
    const detail = { ...county, population: 1, case_count_floor_2023: null, incidence_floor_2023: null, state_unallocated_records_2023: null, scapularis_status: "Established", pacificus_status: null, svi_percentile: null, uninsured_percentile: null, uninsured_percent: null, rucc_2023: null, release: { release_id: "test", schema_version: "test", generated_at: "2026-01-01", loaded_at: "2026-01-01", scope: "test", bundle_sha256: "test", score_defaults: {}, methodology_version: "test", limitations: "test", sources: [], states: [] } };
    expect(reasonsFor(detail).join(" ")).toContain("not as zero cases");
  });
});
