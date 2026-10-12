import { describe, expect, it } from "vitest";

import {
  alignCompareCountyProfiles,
  compareCountyFailureSide,
  compareIncidenceFloorEvidence,
  compareProfilePeriodQualification,
  type CompareProfileCell,
  type CompareCountySide,
} from "@/features/ux-reset/compare/compare-county-profile";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { InvestigateContractError } from "@/features/ux-reset/investigate/county-evidence";

import {
  COMPARE_LEFT_FIPS,
  COMPARE_RIGHT_FIPS,
  compareCountyDetail,
} from "./fixtures/compare-api-fixtures";

function ready(fips: string): CompareCountySide {
  return { detail: compareCountyDetail(fips), status: "ready" };
}

const paired = alignCompareCountyProfiles({
  left: ready(COMPARE_LEFT_FIPS),
  leftFips: COMPARE_LEFT_FIPS,
  right: ready(COMPARE_RIGHT_FIPS),
  rightFips: COMPARE_RIGHT_FIPS,
});

function profileCell(fips: string, rowId: string): CompareProfileCell {
  const row = paired.rows.find((item) => item.id === rowId);
  if (!row) {
    throw new Error(`Missing profile row ${rowId}`);
  }
  return fips === paired.leftFips ? row.left : row.right;
}

function evidenceFor(fips: string, rowId: string): EvidenceObjectModel {
  const value = profileCell(fips, rowId);
  if (value.kind !== "evidence") {
    throw new Error(`${rowId} for ${fips} is ${value.kind}`);
  }
  return value.evidence;
}

function emptyFor(
  fips: string,
  rowId: string
): Extract<CompareProfileCell, { kind: "empty" }> {
  const value = profileCell(fips, rowId);
  if (value.kind !== "empty") {
    throw new Error(`${rowId} for ${fips} is ${value.kind}`);
  }
  return value;
}

function alignmentFor(detail: ReturnType<typeof compareCountyDetail>) {
  return alignCompareCountyProfiles({
    left: { detail, status: "ready" },
    leftFips: detail.fips,
    right: ready(COMPARE_RIGHT_FIPS),
    rightFips: COMPARE_RIGHT_FIPS,
  });
}

function leftCell(
  detail: ReturnType<typeof compareCountyDetail>,
  rowId: string
): CompareProfileCell {
  const row = alignmentFor(detail).rows.find((item) => item.id === rowId);
  if (!row) {
    throw new Error(`Missing profile row ${rowId}`);
  }
  return row.left;
}

function categoryDisplay(priority: string): string {
  const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
  detail.priority = priority;
  const cell = leftCell(detail, "review_category");
  if (cell.kind !== "evidence") {
    throw new Error(`Review category for ${priority} is ${cell.kind}`);
  }
  return cell.evidence.displayValue;
}

function reasonTexts(detail: ReturnType<typeof compareCountyDetail>): string {
  const cell = leftCell(detail, "review_reasons");
  if (cell.kind !== "reasons") {
    throw new Error(`Review reasons are ${cell.kind}`);
  }
  return cell.reasons.map((reason) => reason.text).join(" ");
}

describe("compare county profile", () => {
  it("keeps human floors from being read as exact totals", () => {
    const cases = evidenceFor(COMPARE_LEFT_FIPS, "human_case_floor");
    const incidence = evidenceFor(COMPARE_LEFT_FIPS, "incidence_floor");
    expect(cases.displayValue).toContain("12");
    expect(cases.displayValue).toContain("floor");
    expect(incidence.displayValue).toContain("4.2");
    expect(incidence.valueNote).toContain("not an exact rate");
  });

  it("keeps percentiles, percents, and scores in their own meaning", () => {
    const vulnerability = evidenceFor(COMPARE_LEFT_FIPS, "svi_percentile_2022");
    const uninsured = evidenceFor(COMPARE_LEFT_FIPS, "uninsured_percent_2022");
    const rurality = evidenceFor(COMPARE_LEFT_FIPS, "rucc_2023");
    const score = evidenceFor(COMPARE_LEFT_FIPS, "published_review_score");
    expect(vulnerability.displayValue).toBe("91st percentile");
    expect(uninsured.displayValue).toBe("11.2%");
    expect(rurality.valueNote).toContain("Not a percentage");
    expect(score.displayValue).toBe("64");
    expect(score.valueNote).toContain("Not a rank");
  });

  it("shows suppressed human floors as suppressed", () => {
    const floor = evidenceFor(COMPARE_RIGHT_FIPS, "human_case_floor");
    const incidence = evidenceFor(COMPARE_RIGHT_FIPS, "incidence_floor");
    expect(floor.displayValue).toBe("Suppressed");
    expect(incidence.displayValue).toBe("Suppressed");
    expect(floor.displayValue).not.toContain("0");
    expect(incidence.displayValue).not.toContain("0");
  });

  it("leaves a missing population blank", () => {
    const population = emptyFor(COMPARE_RIGHT_FIPS, "population_2022");
    expect(population.reason).toBe("missing");
    expect(population.message).toContain("not zero");
    expect(population.message).not.toMatch(/\d/);
  });

  it("does not turn a no-records tick status into zero", () => {
    const tick = evidenceFor(COMPARE_RIGHT_FIPS, "tick_status");
    expect(tick.displayValue).toBe("Unavailable");
    expect(tick.valueNote).toContain("No records");
    expect(tick.displayValue).not.toBe("0");
  });

  it("withholds a mismatched release instead of showing its values", () => {
    const alignment = alignCompareCountyProfiles({
      left: ready(COMPARE_LEFT_FIPS),
      leftFips: COMPARE_LEFT_FIPS,
      right: compareCountyFailureSide(
        new InvestigateContractError("release", "release_mismatch")
      ),
      rightFips: COMPARE_RIGHT_FIPS,
    });
    const right = alignment.rows[0]?.right;
    if (right?.kind !== "empty") {
      throw new Error("Mismatched release did not stay empty.");
    }
    expect(alignment.releaseMismatch).toBeTruthy();
    expect(alignment.recordsReady).toBeFalsy();
    expect(right.reason).toBe("release_mismatch");
    expect(right.message).not.toContain("12");
    expect(JSON.stringify(alignment.rows)).not.toContain("signedDifference");
  });

  it("qualifies a selected period that is not the 2023 snapshot", () => {
    expect(compareProfilePeriodQualification(null)).not.toContain(
      "not applied"
    );
    expect(compareProfilePeriodQualification("2023-01-01")).not.toContain(
      "not applied"
    );
    expect(compareProfilePeriodQualification("1999-01-01")).toContain(
      "1999-01-01"
    );
    expect(compareProfilePeriodQualification("1999-01-01")).toContain(
      "not applied"
    );
  });

  it("does not treat a negative floor as an exact or zero value", () => {
    const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
    detail.incidence_floor_2023 = -4;
    const evidence = compareIncidenceFloorEvidence(detail);
    const reasons = reasonTexts(detail);
    expect(evidence.displayValue).toBe("Unavailable");
    expect(evidence.displayValue).not.toContain("-4");
    expect(reasons).not.toContain("-4");
    expect(reasons).not.toContain("0.0");
    expect(reasons).toContain("not as zero cases");
  });

  it("keeps a small incidence floor from rounding to zero in the reasons", () => {
    const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
    detail.incidence_floor_2023 = 0.04;
    const evidence = leftCell(detail, "incidence_floor");
    if (evidence.kind !== "evidence") {
      throw new Error(`Incidence floor is ${evidence.kind}`);
    }
    const reasons = reasonTexts(detail);
    expect(evidence.evidence.displayValue).toBe(
      "0.04 cases per 100,000 (published incidence floor)"
    );
    expect(reasons).toContain(evidence.evidence.displayValue);
    expect(reasons).not.toContain("0.0 cases");
  });

  it("preserves unavailable priorities instead of a lower category", () => {
    expect({
      missing: categoryDisplay("missing"),
      suppressed: categoryDisplay("suppressed"),
      unavailable: categoryDisplay("Unavailable"),
      unfamiliar: categoryDisplay("Priority 3 — Review"),
      unknown: categoryDisplay("unknown"),
    }).toStrictEqual({
      missing: "Unavailable",
      suppressed: "Suppressed",
      unavailable: "Unavailable",
      unfamiliar: "Priority 3 — Review",
      unknown: "Unavailable",
    });
  });

  it("keeps recognized review categories in their published meaning", () => {
    expect({
      lower: categoryDisplay("Lower"),
      priority1: categoryDisplay("Priority 1 — Investigate"),
      priority2: categoryDisplay("Priority 2 — Review"),
      watch: categoryDisplay("Watch"),
    }).toStrictEqual({
      lower: "Lower review priority",
      priority1: "Highest review priority",
      priority2: "Moderate review priority",
      watch: "Monitor for changes",
    });
  });
});
