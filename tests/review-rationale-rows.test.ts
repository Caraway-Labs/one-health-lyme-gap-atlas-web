import { describe, expect, it } from "vitest";

import {
  RUCC_2023_COMPACT_CLASSIFICATIONS,
  RUCC_2023_LABELS,
} from "@/features/ux-reset/review/review-rationale";
import {
  formatReviewSviPercentile,
  reviewRationaleMeasures,
} from "@/features/ux-reset/review/review-rationale-rows";
import type { CountyDetail } from "@/generated/models";

function detail(overrides: Partial<CountyDetail> = {}): CountyDetail {
  return {
    burgdorferi_status: "No records",
    case_count_floor_2023: 1,
    color: "#ccc",
    county: "Example",
    evidence_completeness: 50,
    fips: "01001",
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: 2.14,
    pacificus_status: null,
    population: 1000,
    priority: "unavailable",
    release: {
      limitations: "",
      loaded_at: "2026-01-01",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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

describe("review rationale compact rows", () => {
  it("formats SVI percentiles from a 0–1 fraction without double scaling", () => {
    expect(formatReviewSviPercentile(0.1)).toBe("10th");
    expect(formatReviewSviPercentile(0.2873)).toBe("29th");
  });

  it("keeps species-specific tick rows and floor-qualified Lyme rows", () => {
    const measures = reviewRationaleMeasures(detail());
    expect({
      human: measures[0]?.rows.map((row) => [row.label, row.value]),
      labels: measures.map((measure) => measure.label),
      pathogen: measures[2]?.rows,
      tick: measures[1]?.rows.map((row) => [row.label, row.value]),
    }).toStrictEqual({
      human: [
        ["Minimum reported cases", "At least 1"],
        ["Minimum reported incidence", "At least 2.1 per 100,000"],
        ["Year", "2023"],
      ],
      labels: [
        "Reported Lyme disease",
        "Tick presence",
        "Borrelia burgdorferi detection",
        "Social vulnerability",
        "Uninsured population",
        "Rurality",
      ],
      pathogen: [
        {
          label: "County detection record",
          value: "No records",
          valueTone: "default",
        },
      ],
      tick: [
        ["Ixodes scapularis", "Established"],
        ["Ixodes pacificus", "Unavailable"],
      ],
    });
  });

  it("keeps an aggregate tick status when both species fields are unpublished", () => {
    for (const tickStatus of [
      "Established",
      "Unknown",
      "No records",
      "Out of scope",
    ]) {
      const measures = reviewRationaleMeasures(
        detail({
          pacificus_status: null,
          scapularis_status: null,
          tick_status: tickStatus,
        })
      );
      expect(
        measures[1]?.rows.map((row) => [row.label, row.value])
      ).toStrictEqual([
        ["Ixodes scapularis", "Unavailable"],
        ["Ixodes pacificus", "Unavailable"],
        ["County record", tickStatus],
      ]);
    }
  });

  it("does not replace differing species statuses with the aggregate", () => {
    const measures = reviewRationaleMeasures(
      detail({
        pacificus_status: "Reported",
        scapularis_status: "Established",
        tick_status: "Established",
      })
    );
    expect(
      measures[1]?.rows.map((row) => [row.label, row.value])
    ).toStrictEqual([
      ["Ixodes scapularis", "Established"],
      ["Ixodes pacificus", "Reported"],
    ]);
  });

  it("uses the 2023 RUCC threshold of 5,000 for codes 6 through 9", () => {
    expect(
      Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((code) => [
          code,
          {
            detail: RUCC_2023_COMPACT_CLASSIFICATIONS[code]?.detail,
            label: RUCC_2023_LABELS[code],
            title: RUCC_2023_COMPACT_CLASSIFICATIONS[code]?.title,
          },
        ])
      )
    ).toStrictEqual({
      1: {
        detail: "Metro population: 1 million or more",
        label: "metro area of 1 million or more",
        title: "Large metro",
      },
      2: {
        detail: "Metro population: 250,000 to 1 million",
        label: "metro area of 250,000 to 1 million",
        title: "Medium metro",
      },
      3: {
        detail: "Metro population: fewer than 250,000",
        label: "metro area of fewer than 250,000",
        title: "Small metro",
      },
      4: {
        detail: "Urban population of 20,000 or more, adjacent to a metro area",
        label: "urban population of 20,000 or more, adjacent to a metro area",
        title: "Urban, metro adjacent",
      },
      5: {
        detail:
          "Urban population of 20,000 or more, not adjacent to a metro area",
        label:
          "urban population of 20,000 or more, not adjacent to a metro area",
        title: "Urban, not metro adjacent",
      },
      6: {
        detail: "Urban population of 5,000 to 20,000, adjacent to a metro area",
        label: "urban population of 5,000 to 20,000, adjacent to a metro area",
        title: "Small urban, metro adjacent",
      },
      7: {
        detail:
          "Urban population of 5,000 to 20,000, not adjacent to a metro area",
        label:
          "urban population of 5,000 to 20,000, not adjacent to a metro area",
        title: "Small urban, not metro adjacent",
      },
      8: {
        detail:
          "Urban population of fewer than 5,000, adjacent to a metro area",
        label: "urban population of fewer than 5,000, adjacent to a metro area",
        title: "Rural, metro adjacent",
      },
      9: {
        detail:
          "Urban population of fewer than 5,000, not adjacent to a metro area",
        label:
          "urban population of fewer than 5,000, not adjacent to a metro area",
        title: "Rural, not metro adjacent",
      },
    });
    const rural = reviewRationaleMeasures(detail({ rucc_2023: 8 }));
    expect({
      note: rural[5]?.secondaryNote,
      rows: rural[5]?.rows.map((row) => [row.label, row.value]),
    }).toStrictEqual({
      note: "Urban population of fewer than 5,000, adjacent to a metro area",
      rows: [
        ["Classification", "Rural, metro adjacent"],
        ["RUCC", "8"],
        ["Year", "2023"],
      ],
    });
  });

  it("does not treat missing county records as absence", () => {
    const measures = reviewRationaleMeasures(
      detail({
        burgdorferi_status: "No records",
        case_count_floor_2023: null,
        human_status: "no_county_linked_record",
        incidence_floor_2023: null,
        rucc_2023: null,
        scapularis_status: null,
        svi_percentile: null,
        tick_status: "No records",
        uninsured_percent: null,
        uninsured_percentile: null,
      })
    );
    expect({
      human: measures[0]?.rows,
      insurance: measures[4]?.rows,
      rural: measures[5]?.rows,
      svi: measures[3]?.rows,
    }).toStrictEqual({
      human: [
        { label: "County record", value: "Unavailable", valueTone: "neutral" },
        { label: "Year", value: "2023" },
      ],
      insurance: [
        { label: "Uninsured", value: "Unavailable", valueTone: "neutral" },
      ],
      rural: [
        { label: "Classification", value: "Unavailable", valueTone: "neutral" },
        { label: "RUCC", value: "Unavailable", valueTone: "neutral" },
        { label: "Year", value: "2023" },
      ],
      svi: [
        { label: "Percentile", value: "Unavailable", valueTone: "neutral" },
        { label: "Year", value: "2022" },
      ],
    });
  });
});
