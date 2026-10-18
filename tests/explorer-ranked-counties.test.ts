import { describe, expect, it } from "vitest";

import {
  formatGapScore,
  rankExplorerCounties,
} from "@/features/ux-reset/review/explorer-ranked-counties";

const counties = [
  {
    color: "#efc64a",
    county: "Boulder County",
    fips: "08013",
    score: 70.8,
    state: "CO",
  },
  {
    color: "#e9602b",
    county: "Denver County",
    fips: "08031",
    score: 84.6,
    state: "CO",
  },
  {
    color: "#f49a32",
    county: "Adams County",
    fips: "08001",
    score: 84.6,
    state: "CO",
  },
  {
    color: null,
    county: "Clear Creek County",
    fips: "08019",
    score: null,
    state: "CO",
  },
  { county: "Missing", fips: "08005", score: Number.NaN, state: "CO" },
];

describe("Explorer ranked counties", () => {
  it("ranks a geographic scope by published gap score and keeps ties stable", () => {
    const rows = rankExplorerCounties(counties);
    expect(rows.map((row) => [row.rank, row.fips, row.score])).toStrictEqual([
      [1, "08001", 84.6],
      [2, "08031", 84.6],
      [3, "08013", 70.8],
      [null, "08019", null],
      [null, "08005", null],
    ]);
    expect(formatGapScore(84.6)).toBe("84.6");
  });

  it("keeps the scope rank when search or availability filters hide other counties", () => {
    const rows = rankExplorerCounties(counties, {
      query: "boulder",
      visibleFips: new Set(["08013", "08019"]),
    });
    expect(rows.map((row) => [row.rank, row.fips])).toStrictEqual([
      [3, "08013"],
    ]);
  });

  it("does not rank a county whose score was filtered out of the scope", () => {
    const stateOnly = rankExplorerCounties(
      counties.filter((county) => county.state === "CO").slice(0, 1)
    );
    expect(stateOnly[0]).toMatchObject({ fips: "08013", rank: 1 });
  });
});
