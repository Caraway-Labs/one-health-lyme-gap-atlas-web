import { describe, expect, it } from "vitest";

import {
  COMPARE_ALL_STATES,
  compareStateFilterOptions,
  filterCompareCountyOptions,
} from "@/features/ux-reset/compare/compare-county-search";
import type { CompareCountyOption } from "@/features/ux-reset/compare/use-compare-workspace";

function option(
  countyName: string,
  stateCode: string,
  stateLabel: string,
  fips: string
): CompareCountyOption {
  return {
    countyName,
    disabled: false,
    fips,
    label: `${countyName}, ${stateLabel} (${fips})`,
    stateCode,
    stateLabel,
  };
}

const OPTIONS: readonly CompareCountyOption[] = [
  option("Adair County", "OK", "Oklahoma", "40001"),
  option("Adair County", "IA", "Iowa", "19001"),
  option("Abbeville County", "SC", "South Carolina", "45001"),
  option("Washington County", "RI", "Rhode Island", "44009"),
  option("Washington County", "MN", "Minnesota", "27163"),
  option("Oklahoma County", "OK", "Oklahoma", "40109"),
];

function fipsOf(options: readonly CompareCountyOption[]): string[] {
  return options.map((entry) => entry.fips);
}

describe("compare county search", () => {
  it("lists every county when nothing is typed", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "",
      stateCode: COMPARE_ALL_STATES,
    });
    expect({ shown: result.matches.length, total: result.total }).toStrictEqual(
      { shown: 6, total: 6 }
    );
  });

  it("matches the county name from the first letters", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "abb",
      stateCode: COMPARE_ALL_STATES,
    });
    expect(fipsOf(result.matches)).toStrictEqual(["45001"]);
  });

  it("matches a state name and a state code", () => {
    const byName = filterCompareCountyOptions(OPTIONS, {
      query: "oklahoma",
      stateCode: COMPARE_ALL_STATES,
    });
    const byCode = filterCompareCountyOptions(OPTIONS, {
      query: "adair ia",
      stateCode: COMPARE_ALL_STATES,
    });
    expect({
      byCode: fipsOf(byCode.matches),
      byName: fipsOf(byName.matches).toSorted(),
    }).toStrictEqual({
      byCode: ["19001"],
      byName: ["40001", "40109"],
    });
  });

  it("matches a FIPS code", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "44009",
      stateCode: COMPARE_ALL_STATES,
    });
    expect(fipsOf(result.matches)).toStrictEqual(["44009"]);
  });

  it("puts names that start with the typed text first", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "ok",
      stateCode: COMPARE_ALL_STATES,
    });
    expect(result.matches[0]?.fips).toBe("40109");
  });

  it("narrows to one state and keeps same-name counties apart", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "washington",
      stateCode: "MN",
    });
    expect(fipsOf(result.matches)).toStrictEqual(["27163"]);
  });

  it("reports the full match count when the list is cut short", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      limit: 2,
      query: "",
      stateCode: COMPARE_ALL_STATES,
    });
    expect({ shown: result.matches.length, total: result.total }).toStrictEqual(
      { shown: 2, total: 6 }
    );
  });

  it("returns nothing, not a guess, when no county matches", () => {
    const result = filterCompareCountyOptions(OPTIONS, {
      query: "zzz",
      stateCode: COMPARE_ALL_STATES,
    });
    expect(result).toStrictEqual({ matches: [], total: 0 });
  });

  it("lists each state once, sorted by name", () => {
    expect(
      compareStateFilterOptions(OPTIONS).map((state) => state.code)
    ).toStrictEqual(["IA", "MN", "OK", "RI", "SC"]);
  });
});
