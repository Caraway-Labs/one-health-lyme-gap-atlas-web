import { describe, expect, it } from "vitest";

import {
  alignCompareCountyProfiles,
  compareCountyFailureSide,
  type CompareCountySide,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  buildCompareGlanceSide,
  buildCompareVisualRows,
  compareBarFraction,
  compareBarScale,
  compareGapEntries,
  compareNumberToken,
  compareRowRelation,
  compareRowsForSection,
  compareSectionCaption,
  compareSectionCoverage,
  compareSummaryCounts,
  filterCompareRows,
  type CompareSideValue,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";

import {
  COMPARE_LEFT_FIPS,
  COMPARE_RIGHT_FIPS,
  compareCountyDetail,
} from "./fixtures/compare-api-fixtures";

function ready(fips: string): CompareCountySide {
  return { detail: compareCountyDetail(fips), status: "ready" };
}

function pairedProfile(right: CompareCountySide = ready(COMPARE_RIGHT_FIPS)) {
  return alignCompareCountyProfiles({
    left: ready(COMPARE_LEFT_FIPS),
    leftFips: COMPARE_LEFT_FIPS,
    right,
    rightFips: COMPARE_RIGHT_FIPS,
  });
}

function rowById(rows: readonly CompareVisualRow[], id: string) {
  const row = rows.find((entry) => entry.id === id);
  if (!row) {
    throw new Error(`Missing visual row ${id}`);
  }
  return row;
}

function valueSide(
  text: string,
  options: { limited?: boolean; number?: number | null } = {}
): CompareSideValue {
  const evidence: EvidenceObjectModel = {
    availability: options.limited ? "limited" : "available",
    claimLabel: "Test",
    displayValue: text,
    provenance: {
      evidenceType: "Published",
      inspectSummary: "",
      limitations: [],
      observationPeriod: "2023",
      sourceFamily: "Test source",
    },
  };
  return {
    evidence,
    isZero: options.number === 0,
    kind: "value",
    limited: Boolean(options.limited),
    number: options.number ?? null,
    text,
  };
}

const missingSide: CompareSideValue = {
  kind: "missing",
  reason: "missing",
  text: "No published county record.",
};

describe(compareNumberToken, () => {
  it("reads the first number, including thousands separators and decimals", () => {
    expect(compareNumberToken("At least 1,234 cases")).toBe(1234);
    expect(compareNumberToken("At least 3.4 reported cases per 100,000")).toBe(
      3.4
    );
    expect(compareNumberToken("91st percentile")).toBe(91);
  });

  it("returns null when there is no number", () => {
    expect(compareNumberToken("Present")).toBeNull();
    expect(compareNumberToken("Unavailable")).toBeNull();
  });
});

describe(buildCompareVisualRows, () => {
  const rows = buildCompareVisualRows(pairedProfile());

  it("groups rows by the question being asked, not by data system", () => {
    expect(compareRowsForSection(rows, "human").map((row) => row.id)).toStrictEqual([
      "human_case_floor",
      "incidence_floor",
      "state_unallocated_2023",
    ]);
    expect(compareRowsForSection(rows, "vector").map((row) => row.id)).toStrictEqual([
      "scapularis_status",
      "pacificus_status",
      "burgdorferi_status",
      "tick_status",
    ]);
    expect(
      compareRowsForSection(rows, "community").map((row) => row.id)
    ).toStrictEqual([
      "population_2022",
      "svi_percentile_2022",
      "uninsured_percent_2022",
      "rucc_2023",
    ]);
  });

  it("picks the visual that fits the data type", () => {
    expect(rowById(rows, "human_case_floor").visual).toBe("bars");
    expect(rowById(rows, "population_2022").visual).toBe("bars");
    expect(rowById(rows, "svi_percentile_2022").visual).toBe("dots");
    expect(rowById(rows, "uninsured_percent_2022").visual).toBe("dots");
    expect(rowById(rows, "scapularis_status").visual).toBe("chips");
    expect(rowById(rows, "rucc_2023").visual).toBe("chips");
  });

  it("keeps lower-bound wording on published floors", () => {
    expect(rowById(rows, "human_case_floor").atLeast).toBeTruthy();
    expect(rowById(rows, "incidence_floor").atLeast).toBeTruthy();
    expect(rowById(rows, "population_2022").atLeast).toBeFalsy();
  });

  it("can hide the aggregate tick row when it repeats the species rows", () => {
    const hidden = buildCompareVisualRows(pairedProfile(), {
      hideRowIds: ["tick_status"],
    });
    expect(hidden.some((row) => row.id === "tick_status")).toBeFalsy();
  });

  it("never turns a county record that did not load into a value", () => {
    const failed = buildCompareVisualRows(
      pairedProfile(compareCountyFailureSide(new Error("network")))
    );
    const cases = rowById(failed, "human_case_floor");
    expect(cases.right.kind).toBe("missing");
    expect(cases.gap).toBeTruthy();
    expect(cases.relation).toBe("incomparable");
  });
});

describe(compareRowRelation, () => {
  it("is same or different from published text, with no calculated delta", () => {
    expect(compareRowRelation(valueSide("Present"), valueSide("present"))).toBe(
      "same"
    );
    expect(compareRowRelation(valueSide("12"), valueSide("40"))).toBe(
      "different"
    );
  });

  it("is incomparable when either side is missing", () => {
    expect(compareRowRelation(valueSide("12"), missingSide)).toBe(
      "incomparable"
    );
    expect(compareRowRelation(missingSide, missingSide)).toBe("incomparable");
  });
});

describe("bars", () => {
  function barRow(left: CompareSideValue, right: CompareSideValue) {
    return {
      atLeast: false,
      gap: false,
      id: "population_2022",
      label: "Population",
      left,
      note: null,
      relation: "different",
      right,
      scale: null,
      section: "community",
      unit: null,
      visual: "bars",
    } satisfies CompareVisualRow;
  }

  it("uses one shared scale for both counties", () => {
    const row = barRow(
      valueSide("100", { number: 100 }),
      valueSide("400", { number: 400 })
    );
    const scale = compareBarScale(row);
    expect(scale).toBe(400);
    expect(compareBarFraction(row.left, scale)).toBe(0.25);
    expect(compareBarFraction(row.right, scale)).toBe(1);
  });

  it("draws a published zero as zero length, never a missing value as zero", () => {
    const row = barRow(valueSide("0", { number: 0 }), missingSide);
    const scale = compareBarScale(row);
    expect(compareBarFraction(row.left, scale)).toBe(0);
    expect(compareBarFraction(row.right, scale)).toBeNull();
  });

  it("does not divide by zero when both values are zero", () => {
    const row = barRow(
      valueSide("0", { number: 0 }),
      valueSide("0", { number: 0 })
    );
    expect(compareBarFraction(row.left, compareBarScale(row))).toBe(0);
  });
});

describe("filters", () => {
  const rows = buildCompareVisualRows(
    pairedProfile(compareCountyFailureSide(new Error("network")))
  );

  it("returns every row with no filter on", () => {
    expect(
      filterCompareRows(rows, { onlyDifferences: false, onlyGaps: false })
    ).toHaveLength(rows.length);
  });

  it("show only evidence gaps keeps rows with a missing or limited side", () => {
    const gaps = filterCompareRows(rows, {
      onlyDifferences: false,
      onlyGaps: true,
    });
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((row) => row.gap)).toBeTruthy();
  });

  it("show only differences hides rows where both counties match", () => {
    const sameRows = buildCompareVisualRows(pairedProfile());
    const differing = filterCompareRows(sameRows, {
      onlyDifferences: true,
      onlyGaps: false,
    });
    expect(differing.every((row) => row.relation !== "same")).toBeTruthy();
  });
});

describe("coverage and gaps", () => {
  it("uses the Available, Limited, Unavailable vocabulary", () => {
    const profile = pairedProfile(
      compareCountyFailureSide(new Error("network"))
    );
    const rows = buildCompareVisualRows(profile);
    const human = compareRowsForSection(rows, "human");
    expect(compareSectionCoverage(human, "right")).toBe("unavailable");
    expect(compareSectionCoverage([], "left")).toBe("unavailable");
  });

  it("lists every gap for a county with its stated reason", () => {
    const profile = pairedProfile(
      compareCountyFailureSide(new Error("network"))
    );
    const entries = compareGapEntries(buildCompareVisualRows(profile), "right");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.state === "Unavailable")).toBeTruthy();
    expect(entries[0]?.reason).toMatch(/could not be loaded/);
  });

  it("marks limited values as Limited, not Unavailable", () => {
    const row: CompareVisualRow = {
      atLeast: false,
      gap: true,
      id: "rucc_2023",
      label: "Rural-urban classification",
      left: valueSide("2", { limited: true }),
      note: null,
      relation: "different",
      right: valueSide("3"),
      scale: null,
      section: "community",
      unit: null,
      visual: "chips",
    };
    expect(compareGapEntries([row], "left")[0]?.state).toBe("Limited");
    expect(compareGapEntries([row], "right")).toStrictEqual([]);
    expect(compareSectionCoverage([row], "left")).toBe("limited");
  });
});

describe("summary counts", () => {
  it("counts the whole comparison by relation", () => {
    expect(
      compareSummaryCounts(["same", "same", "different", "incomparable"])
    ).toStrictEqual({ different: 1, incomparable: 1, same: 2 });
  });
});

describe("section caption", () => {
  it("shows one caption only when every value shares a source and period", () => {
    const row = (left: CompareSideValue, right: CompareSideValue) =>
      ({
        atLeast: false,
        gap: false,
        id: "rucc_2023",
        label: "x",
        left,
        note: null,
        relation: "same",
        right,
        scale: null,
        section: "community",
        unit: null,
        visual: "chips",
      }) satisfies CompareVisualRow;
    expect(
      compareSectionCaption([row(valueSide("a"), valueSide("b"))])
    ).toContain("Source: Test source");
    expect(compareSectionCaption([row(valueSide("a"), missingSide)])).toContain(
      "Period: 2023"
    );
  });
});

describe(buildCompareGlanceSide, () => {
  it("keeps published score and components within 0 to 100 and never ranks", () => {
    const profile = pairedProfile();
    const rows = buildCompareVisualRows(profile);
    const left = buildCompareGlanceSide(profile, rows, "left");
    expect(left.score).not.toBeNull();
    expect(left.components).toHaveLength(3);
    for (const component of left.components) {
      expect(component.value).not.toBeNull();
    }
    expect(Object.keys(left.coverage).toSorted()).toStrictEqual([
      "community",
      "human",
      "vector",
    ]);
  });

  it("returns null scores, not zero, when a county record is missing", () => {
    const profile = pairedProfile(
      compareCountyFailureSide(new Error("network"))
    );
    const right = buildCompareGlanceSide(
      profile,
      buildCompareVisualRows(profile),
      "right"
    );
    expect(right.score).toBeNull();
    expect(
      right.components.every((component) => component.value === null)
    ).toBeTruthy();
  });
});
