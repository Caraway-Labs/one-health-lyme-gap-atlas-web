import { describe, expect, it } from "vitest";

import { reviewRationaleFor } from "@/features/ux-reset/review/review-rationale";
import type { CountyDetail } from "@/generated/models";

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
    } as unknown as CountyDetail["release"],
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
    expect({
      human: items[0]?.text,
      insurance: items[4]?.text,
      labels: items.map((item) => item.label),
      numbers: items.map((item) => item.number),
      pathogen: items[2]?.text,
      rural: items[5]?.text,
      svi: items[3]?.text,
      tick: items[1]?.text,
    }).toStrictEqual({
      human: expect.stringContaining("2.1 cases per 100,000"),
      insurance: expect.stringContaining("No estimated value"),
      labels: [
        "Published Lyme case data",
        "Tick presence",
        "Borrelia burgdorferi detection",
        "Social vulnerability",
        "Health insurance coverage",
        "Rurality",
      ],
      numbers: [1, 2, 3, 4, 5, 6],
      pathogen: expect.stringContaining("does not establish pathogen absence"),
      rural: expect.stringContaining("No estimated category"),
      svi: expect.stringContaining("No estimated value"),
      tick: expect.stringContaining("does not establish tick absence"),
    });
  });

  it("uses published values without calling them a score explanation", () => {
    const items = reviewRationaleFor(detail());
    expect({
      human: items[0]?.text,
      insurance: items[4]?.text,
      rural: items[5]?.text,
      svi: items[3]?.text,
      tick: items[1]?.text,
    }).toStrictEqual({
      human: expect.stringContaining(
        "case-count floor is 1. The published 2023 minimum rate is 2.1 cases per 100,000. A published floor is a minimum, not an exact count or rate."
      ),
      insurance: expect.stringContaining("8.2%"),
      rural: expect.stringContaining("Code 3"),
      svi: expect.stringContaining("28.7"),
      tick: expect.stringContaining("Ixodes scapularis is established"),
    });
    expect(items[5]?.text).toContain("fewer than 250,000");
  });
});
