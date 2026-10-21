import { describe, expect, it } from "vitest";

import type { CountyDetail } from "@/generated/models";
import { reviewRationaleFor } from "@/features/ux-reset/review/review-rationale";

function detail(overrides: Partial<CountyDetail> = {}): CountyDetail {
  return {
    burgdorferi_status: "No records",
    case_count_floor_2023: 1,
    color: "#ccc",
    county: "Example",
    evidence_completeness: 50,
    fips: "01001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: 2.14,
    pacificus_status: null,
    population: 1000,
    priority: "unavailable",
    release: {
      limitations: "",
      loaded_at: "2026-01-01",
      methodology_version: "1",
      release_id: "test",
      sources: [],
    } as CountyDetail["release"],
    rucc_2023: 3,
    scapularis_status: "Established",
    score: {
      access_signal: 0,
      community: 0,
      ecological: 0,
      human_weakness: 0,
      pathogen_signal: 0,
      rural_signal: 0,
      score: 1,
      svi_signal: 0,
      tick_signal: 0,
    },
    state: "AL",
    state_name: "Alabama",
    state_unallocated_records_2023: null,
    svi_percentile: 0.2873,
    tick_status: "Established",
    uninsured_percent: 8.2,
    uninsured_percentile: 0.2,
    ...overrides,
  };
}

describe("review rationale", () => {
  it("keeps six numbered categories and does not treat missing records as absence", () => {
    const items = reviewRationaleFor(
      detail({
        burgdorferi_status: "No records",
        rucc_2023: null,
        svi_percentile: null,
        tick_status: "No records",
        scapularis_status: null,
        uninsured_percent: null,
        uninsured_percentile: null,
      })
    );
    expect(items.map((item) => item.label)).toEqual([
      "Published Lyme case data",
      "Tick presence",
      "Borrelia burgdorferi detection",
      "Social vulnerability",
      "Health insurance coverage",
      "Rurality",
    ]);
    expect(items.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(items[0]?.text).toContain("2.1 cases per 100,000");
    expect(items[1]?.text).toContain("does not establish tick absence");
    expect(items[2]?.text).toContain("does not establish pathogen absence");
    expect(items[3]?.text).toContain("No estimated value");
    expect(items[4]?.text).toContain("No estimated value");
    expect(items[5]?.text).toContain("No estimated category");
  });

  it("uses published values without calling them a score explanation", () => {
    const items = reviewRationaleFor(detail());
    expect(items[1]?.text).toContain("Ixodes scapularis is established");
    expect(items[3]?.text).toContain("28.7");
    expect(items[4]?.text).toContain("8.2%");
    expect(items[5]?.text).toContain("Code 3");
    expect(items[5]?.text).toContain("fewer than 250,000");
  });
});
