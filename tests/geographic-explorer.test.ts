import { describe, expect, it } from "vitest";

import {
  evidenceLabel,
  explorerParams,
  metricMaximum,
  matchesExplorerEvidence,
  pageOf,
  parseComparison,
  rankCounties,
  STATE_GRID,
} from "@/features/geographic-explorer/model";
import type { CountyScoreSummary } from "@/generated/models";

function county(
  fips: string,
  score: number,
  completeness: number
): CountyScoreSummary {
  return {
    fips,
    county: fips,
    state: "CO",
    state_name: "Colorado",
    in_contiguous_tick_scope: true,
    human_status: "no_county_linked_record",
    tick_status: "No records",
    burgdorferi_status: "No records",
    evidence_completeness: completeness,
    priority: "Review",
    color: "#efc64a",
    score: {
      score,
      human_weakness: 0,
      ecological: 0,
      community: 0,
      tick_signal: 0,
      pathogen_signal: 0,
      svi_signal: 0,
      access_signal: 0,
      rural_signal: 0,
    },
  };
}
describe("geographic explorer state and comparisons", () => {
  it("interprets completeness as the released percentage, not a count", () => {
    expect(
      matchesExplorerEvidence(county("08001", 60, 67), "complete")
    ).toBeFalsy();
    expect(
      matchesExplorerEvidence(county("08001", 60, 83), "complete")
    ).toBeTruthy();
    expect(
      matchesExplorerEvidence(county("08001", 60, 100), "complete")
    ).toBeTruthy();
  });

  it("keeps only unique five-digit comparison FIPS, bounded to five", () => {
    expect(
      parseComparison("08001,08001,bad,8001,08003,08005,08007,08009,08011")
    ).toStrictEqual(["08001", "08003", "08005", "08007", "08009"]);
    expect(explorerParams.view.parse("invalid")).toBeNull();
    expect(explorerParams.page.parse("2junk")).toBeNull();
    expect(explorerParams.page.parse("-1")).toBeNull();
  });

  it("ranks by the selected metric with stable FIPS tie-breaking", () => {
    const counties = [
      county("08005", 60, 2),
      county("08001", 60, 0),
      county("08003", 20, 6),
    ];
    expect(
      rankCounties(counties, "score").map((item) => item.fips)
    ).toStrictEqual(["08001", "08005", "08003"]);
    expect(
      rankCounties(counties, "completeness").map((item) => item.fips)
    ).toStrictEqual(["08003", "08005", "08001"]);
    expect(counties[0].fips).toBe("08005");
    expect(metricMaximum()).toBe(100);
    expect(metricMaximum()).toBe(100);
  });

  it("keeps every result reachable and clamps stale pagination after filtering", () => {
    const items = Array.from({ length: 43 }, (_, index) => index);
    expect(
      [1, 2, 3].flatMap((page) => pageOf(items, page).items)
    ).toStrictEqual(items);
    expect(pageOf(items.slice(0, 1), 3)).toStrictEqual({
      current: 1,
      pages: 1,
      items: [0],
    });
    expect(pageOf([], 9)).toStrictEqual({ current: 1, pages: 1, items: [] });
  });

  it("places each state and DC once without collisions and preserves missing evidence", () => {
    expect(new Set(STATE_GRID.map((item) => item.code)).size).toBe(51);
    expect(
      new Set(STATE_GRID.map((item) => `${item.row},${item.column}`)).size
    ).toBe(51);
    expect(evidenceLabel("no_county_linked_record")).toBe(
      "No county-linked record"
    );
    expect(evidenceLabel("No records")).toBe("No records");
  });
});
