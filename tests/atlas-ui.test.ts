import { describe, expect, it } from "vitest";
import { contiguousUsGeometry, isContiguousUsCounty } from "../src/lib/atlas-geometry";
import { followUpPlanFor, matchesEvidence, numericParam, reasonsFor } from "../src/lib/atlas-ui";
import { countyBelongsToDistrict } from "../src/lib/health-districts";

const county = {
  fips: "08001", county: "Adams", state: "CO", state_name: "Colorado", in_contiguous_tick_scope: true,
  human_status: "no_county_linked_record", tick_status: "Established", burgdorferi_status: "Present", evidence_completeness: 6,
  score: { score: 61.9, human_weakness: 75, ecological: 100, community: 50, tick_signal: 100, pathogen_signal: 100, svi_signal: 50, access_signal: 50, rural_signal: 12.5 },
  priority: "Priority 2 — Review", color: "#efc64a",
};

describe("atlas UI rules", () => {
  it("keeps Alaska and Hawaii out of the contiguous map geometry", () => {
    const geometry: GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips: string }> = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { fips: "06037" }, geometry: { type: "Point", coordinates: [-118, 34] } },
        { type: "Feature", properties: { fips: "02013" }, geometry: { type: "Point", coordinates: [-150, 60] } },
        { type: "Feature", properties: { fips: "15001" }, geometry: { type: "Point", coordinates: [-157, 21] } },
      ],
    };

    expect(isContiguousUsCounty("06037")).toBe(true);
    expect(contiguousUsGeometry(geometry).features.map((feature) => feature.properties.fips)).toEqual(["06037"]);
  });

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

  it("maps all six chart colors to distinct follow-up levels", () => {
    const detail = { ...county, population: 1, case_count_floor_2023: null, incidence_floor_2023: null, state_unallocated_records_2023: null, scapularis_status: "Established", pacificus_status: null, svi_percentile: null, uninsured_percentile: null, uninsured_percent: null, rucc_2023: null, release: { release_id: "test", schema_version: "test", generated_at: "2026-01-01", loaded_at: "2026-01-01", scope: "test", bundle_sha256: "test", score_defaults: {}, methodology_version: "test", limitations: "test", sources: [], states: [] } };
    const colors = ["#a9d2db", "#55a8a3", "#87b982", "#efc64a", "#f49a32", "#e9602b"];
    const plans = colors.map((color) => followUpPlanFor({ ...detail, color }));
    expect(new Set(plans.map((plan) => plan.level)).size).toBe(6);
    expect(plans.at(-1)?.timeframe).toContain("2 weeks");
    expect(plans.every((plan) => plan.actions.length >= 3)).toBe(true);
  });

  it("keeps district highlights inside the selected state", () => {
    expect(countyBelongsToDistrict("ID", "Adams", "ID", "ID-3")).toBe(true);
    expect(countyBelongsToDistrict("WA", "Adams", "ID", "ID-3")).toBe(false);
    expect(countyBelongsToDistrict("ID", "Washington County", "ID", "ID-3")).toBe(true);
  });
});
