import { describe, expect, it } from "vitest";

import {
  contiguousUsGeometry,
  isContiguousUsCounty,
} from "../src/lib/atlas-geometry";
import {
  followUpPlanFor,
  matchesEvidence,
  numericParam,
  reasonsFor,
} from "../src/lib/atlas-ui";
import { countyBelongsToDistrict } from "../src/lib/health-districts";

const county = {
  burgdorferi_status: "Present",
  color: "#efc64a",
  county: "Adams",
  evidence_completeness: 6,
  fips: "08001",
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  priority: "Priority 2 — Review",
  score: {
    access_signal: 50,
    community: 50,
    ecological: 100,
    human_weakness: 75,
    pathogen_signal: 100,
    rural_signal: 12.5,
    score: 61.9,
    svi_signal: 50,
    tick_signal: 100,
  },
  state: "CO",
  state_name: "Colorado",
  tick_status: "Established",
};

describe("atlas UI rules", () => {
  it("keeps Alaska and Hawaii out of the contiguous map geometry", () => {
    const geometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { fips: string }
    > = {
      features: [
        {
          type: "Feature",
          properties: { fips: "06037" },
          geometry: { type: "Point", coordinates: [-118, 34] },
        },
        {
          type: "Feature",
          properties: { fips: "02013" },
          geometry: { type: "Point", coordinates: [-150, 60] },
        },
        {
          type: "Feature",
          properties: { fips: "15001" },
          geometry: { type: "Point", coordinates: [-157, 21] },
        },
      ],
      type: "FeatureCollection",
    };

    expect(isContiguousUsCounty("06037")).toBeTruthy();
    expect(
      contiguousUsGeometry(geometry).features.map(
        (feature) => feature.properties.fips
      )
    ).toStrictEqual(["06037"]);
  });

  it("validates shareable scoring parameters", () => {
    expect(numericParam("65", 0, 40, 85, 5)).toBe(65);
    expect(numericParam("66", 65, 40, 85, 5)).toBe(65);
    expect(numericParam("100", 65, 40, 85, 5)).toBe(65);
  });

  it("applies every evidence view consistently", () => {
    expect(matchesEvidence(county, "all")).toBeTruthy();
    expect(matchesEvidence(county, "ecological")).toBeTruthy();
    expect(matchesEvidence(county, "human")).toBeFalsy();
    expect(matchesEvidence(county, "complete")).toBeTruthy();
  });

  it("keeps missing human records distinct from zero cases", () => {
    const detail = {
      ...county,
      case_count_floor_2023: null,
      incidence_floor_2023: null,
      pacificus_status: null,
      population: 1,
      release: {
        bundle_sha256: "test",
        generated_at: "2026-01-01",
        limitations: "test",
        loaded_at: "2026-01-01",
        methodology_version: "test",
        release_id: "test",
        schema_version: "test",
        scope: "test",
        score_defaults: {},
        sources: [],
        states: [],
      },
      rucc_2023: null,
      scapularis_status: "Established",
      state_unallocated_records_2023: null,
      svi_percentile: null,
      uninsured_percent: null,
      uninsured_percentile: null,
    };
    expect(reasonsFor(detail).join(" ")).toContain("not as zero cases");
  });

  it("maps all six chart colors to distinct follow-up levels", () => {
    const detail = {
      ...county,
      case_count_floor_2023: null,
      incidence_floor_2023: null,
      pacificus_status: null,
      population: 1,
      release: {
        bundle_sha256: "test",
        generated_at: "2026-01-01",
        limitations: "test",
        loaded_at: "2026-01-01",
        methodology_version: "test",
        release_id: "test",
        schema_version: "test",
        scope: "test",
        score_defaults: {},
        sources: [],
        states: [],
      },
      rucc_2023: null,
      scapularis_status: "Established",
      state_unallocated_records_2023: null,
      svi_percentile: null,
      uninsured_percent: null,
      uninsured_percentile: null,
    };
    const colors = [
      "#a9d2db",
      "#55a8a3",
      "#87b982",
      "#efc64a",
      "#f49a32",
      "#e9602b",
    ];
    const plans = colors.map((color) => followUpPlanFor({ ...detail, color }));
    expect(new Set(plans.map((plan) => plan.level)).size).toBe(6);
    expect(plans.at(-1)?.timeframe).toContain("2 weeks");
    expect(plans.every((plan) => plan.actions.length >= 3)).toBeTruthy();
  });

  it("keeps district highlights inside the selected state", () => {
    expect(countyBelongsToDistrict("ID", "Adams", "ID", "ID-3")).toBeTruthy();
    expect(countyBelongsToDistrict("WA", "Adams", "ID", "ID-3")).toBeFalsy();
    expect(
      countyBelongsToDistrict("ID", "Washington County", "ID", "ID-3")
    ).toBeTruthy();
  });
});
