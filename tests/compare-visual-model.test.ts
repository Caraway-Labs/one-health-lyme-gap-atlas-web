import { describe, expect, it } from "vitest";

import {
  alignCompareCountyProfiles,
  compareCountyFailureSide,
  compareCountySideStatuses,
  type CompareCountySide,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  buildCompareGlanceSide,
  buildCompareVisualRows,
  compareBarFraction,
  compareBarScale,
  compareCommunityDifference,
  compareCommunitySide,
  compareGapEntries,
  compareGapSummary,
  compareNumberToken,
  compareRowRelation,
  compareRowsForSection,
  compareRuralityRelation,
  compareSectionCaption,
  compareSectionCoverage,
  compareSummaryCounts,
  compareUnknownIntroduction,
  filterCompareRows,
  type CompareMissingReason,
  type CompareSideValue,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { RUCC_2023_COMPACT_CLASSIFICATIONS } from "@/features/ux-reset/review/review-rationale";

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
  options: {
    caveat?: string;
    limited?: boolean;
    number?: number | null;
    period?: string;
  } = {}
): CompareSideValue {
  const evidence: EvidenceObjectModel = {
    availability: options.limited ? "limited" : "available",
    claimLabel: "Test",
    displayValue: text,
    provenance: {
      evidenceType: "Published",
      inspectSummary: "",
      limitations: options.caveat ? [options.caveat] : [],
      materialCaveat: options.caveat ?? null,
      observationPeriod: options.period ?? "2023",
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

function missingFor(
  reason: CompareMissingReason,
  text: string
): CompareSideValue {
  return { kind: "missing", reason, text };
}

function gapRow(
  left: CompareSideValue,
  right: CompareSideValue,
  label = "Population"
): CompareVisualRow {
  return {
    atLeast: false,
    gap: true,
    id: "population_2022",
    label,
    left,
    note: null,
    relation: "incomparable",
    right,
    scale: null,
    section: "community",
    unit: null,
    visual: "bars",
  };
}

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
    expect(
      compareRowsForSection(rows, "human").map((row) => row.id)
    ).toStrictEqual([
      "human_case_floor",
      "incidence_floor",
      "state_unallocated_2023",
    ]);
    expect(
      compareRowsForSection(rows, "vector").map((row) => row.id)
    ).toStrictEqual([
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

  it("uses bars for counts and dots for rates on a shared scale", () => {
    expect(rowById(rows, "human_case_floor").visual).toBe("bars");
    expect(rowById(rows, "population_2022").visual).toBe("bars");
    expect(rowById(rows, "svi_percentile_2022").visual).toBe("dots");
    expect(rowById(rows, "uninsured_percent_2022").visual).toBe("dots");
  });

  it("uses status chips for categorical findings", () => {
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
    expect(
      entries.every((entry) => entry.state === "Unavailable")
    ).toBeTruthy();
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

describe(compareGapSummary, () => {
  it("keeps different limited caveats on the county that stated them", () => {
    const summary = compareGapSummary([
      gapRow(
        valueSide("100", {
          caveat: "Population denominator unavailable",
          limited: true,
        }),
        valueSide("200", { caveat: "Provisional data", limited: true })
      ),
    ]);
    expect(
      summary.cautions.map((group) => ({
        reason: group.reason,
        sides: group.items.map((item) => item.sides),
      }))
    ).toStrictEqual([
      { reason: "Population denominator unavailable", sides: ["left"] },
      { reason: "Provisional data", sides: ["right"] },
    ]);
  });

  it("coalesces an identical limited caveat for both counties", () => {
    const summary = compareGapSummary([
      gapRow(
        valueSide("100", { caveat: "Provisional data", limited: true }),
        valueSide("200", { caveat: "Provisional data", limited: true })
      ),
    ]);
    expect(summary.cautions).toStrictEqual([
      {
        items: [{ label: "Population", sides: "both" }],
        reason: "Provisional data",
      },
    ]);
  });

  it("keeps suppressed and failed reasons on their own counties", () => {
    const summary = compareGapSummary([
      gapRow(
        missingFor("suppressed", "Suppressed"),
        missingFor("failed", "Couldn’t load this evidence.")
      ),
    ]);
    expect({
      absence: summary.absence.map((item) => ({
        cause: item.cause,
        reason: item.reason,
        sides: item.sides,
      })),
      failed: summary.couldNotLoad.map((item) => ({
        cause: item.cause,
        reason: item.reason,
        sides: item.sides,
      })),
      notUsable: summary.notUsable,
    }).toStrictEqual({
      absence: [
        {
          cause: "suppressed",
          reason:
            "Suppressed in the published data. A suppressed value is not zero.",
          sides: "left",
        },
      ],
      failed: [
        {
          cause: "failed",
          reason: "This county record could not be loaded.",
          sides: "right",
        },
      ],
      notUsable: [],
    });
  });
});

describe(compareUnknownIntroduction, () => {
  it("does not describe a network failure or a release mismatch as unpublished", () => {
    const failed = buildCompareVisualRows(
      pairedProfile(compareCountyFailureSide(new Error("network")))
    );
    const mismatched = buildCompareVisualRows(
      alignCompareCountyProfiles({
        left: ready(COMPARE_LEFT_FIPS),
        leftFips: COMPARE_LEFT_FIPS,
        right: {
          message: "This county record is for a different release.",
          status: compareCountySideStatuses.releaseMismatch,
        },
        rightFips: COMPARE_RIGHT_FIPS,
      })
    );
    const failedText = compareUnknownIntroduction(failed);
    const mismatchText = compareUnknownIntroduction(mismatched);
    expect({
      failedClaimsUnpublished: failedText.includes("No value published"),
      failedSaysMostPublished: /Most values above are published/.test(
        failedText
      ),
      failedStatesLoadFailure: failedText.includes("could not be loaded"),
      mismatchClaimsUnpublished: mismatchText.includes("No value published"),
      mismatchSaysMostPublished: /Most values above are published/.test(
        mismatchText
      ),
      mismatchStatesRelease: mismatchText.includes(
        "not usable for this release"
      ),
    }).toStrictEqual({
      failedClaimsUnpublished: false,
      failedSaysMostPublished: false,
      failedStatesLoadFailure: true,
      mismatchClaimsUnpublished: false,
      mismatchSaysMostPublished: false,
      mismatchStatesRelease: true,
    });
  });
});

describe("community context figures", () => {
  const mediumMetro = RUCC_2023_COMPACT_CLASSIFICATIONS[2];

  it("reads an ordinal percentile and the year in the observation period", () => {
    const side = compareCommunitySide(
      "svi_percentile_2022",
      "percentile",
      valueSide("91st percentile", { period: "Released for 2021" })
    );
    expect({
      number: side.number,
      shown: side.shown,
      year: side.year,
    }).toStrictEqual({ number: 91, shown: "91st", year: "2021" });
  });

  it("falls back to the year in the row id when the period has none", () => {
    const side = compareCommunitySide(
      "uninsured_percent_2022",
      "percent",
      valueSide("11.2%", { period: "Unavailable" })
    );
    expect({
      number: side.number,
      shown: side.shown,
      year: side.year,
    }).toStrictEqual({ number: 11.2, shown: "11.2%", year: "2022" });
  });

  it("maps a RUCC code through the Explore classification list", () => {
    const side = compareCommunitySide(
      "rucc_2023",
      "rucc",
      valueSide("2", { period: "RUCC 2023" })
    );
    expect({
      classification: side.classification,
      code: side.code,
      detail: side.detail,
      shown: side.shown,
      year: side.year,
    }).toStrictEqual({
      classification: mediumMetro?.title,
      code: 2,
      detail: mediumMetro?.detail,
      shown: "2",
      year: "2023",
    });
  });

  it("does not invent a figure when the published text cannot be read", () => {
    const percentile = compareCommunitySide(
      "svi_percentile_2022",
      "percentile",
      valueSide("101st percentile")
    );
    const percent = compareCommunitySide(
      "uninsured_percent_2022",
      "percent",
      valueSide("120%")
    );
    const rucc = compareCommunitySide(
      "rucc_2023",
      "rucc",
      valueSide("Published value")
    );
    expect({
      percent: percent.number,
      percentile: percentile.shown,
      rucc: rucc.classification,
    }).toStrictEqual({ percent: null, percentile: null, rucc: null });
  });

  it("builds a difference only when both published figures parse", () => {
    const higher = compareCommunitySide(
      "svi_percentile_2022",
      "percentile",
      valueSide("82nd percentile")
    );
    const lower = compareCommunitySide(
      "svi_percentile_2022",
      "percentile",
      valueSide("91st percentile")
    );
    const same = compareCommunitySide(
      "uninsured_percent_2022",
      "percent",
      valueSide("4.0%")
    );
    const unread = compareCommunitySide(
      "svi_percentile_2022",
      "percentile",
      valueSide("Present")
    );
    expect({
      missing: compareCommunityDifference("percentile", higher, {
        ...higher,
        number: null,
        shown: null,
      }),
      percent: compareCommunityDifference("percent", same, {
        ...same,
        number: 13,
        shown: "13%",
      }),
      percentile: compareCommunityDifference("percentile", lower, higher),
      rucc: compareCommunityDifference("rucc", higher, lower),
      same: compareCommunityDifference("percent", same, same),
      unread: compareCommunityDifference("percentile", unread, higher),
    }).toStrictEqual({
      missing: null,
      percent: "B is 9 percentage points higher than A.",
      percentile: "B is 9 percentile points lower than A.",
      rucc: null,
      same: "A and B have the same published value.",
      unread: null,
    });
  });

  it("states whether rural classifications match without ranking them", () => {
    const metro = compareCommunitySide("rucc_2023", "rucc", valueSide("2"));
    const rural = compareCommunitySide("rucc_2023", "rucc", valueSide("8"));
    const blank = compareCommunitySide("rucc_2023", "rucc", missingSide);
    expect({
      different: compareRuralityRelation(metro, rural, "different"),
      missing: compareRuralityRelation(metro, blank, "incomparable"),
      ranked: compareRuralityRelation(metro, rural, "different"),
      same: compareRuralityRelation(metro, metro, "same"),
    }).toStrictEqual({
      different: "A and B have different classifications.",
      missing:
        "The classifications are not compared because a published value is missing.",
      ranked: "A and B have different classifications.",
      same: "A and B have the same classification.",
    });
  });
});
