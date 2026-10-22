import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  alignCompareCountyProfiles,
  compareCountyFailureSide,
  compareCountySideStatuses,
  type CompareCountySide,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  buildCompareVisualRows,
  type CompareMissingReason,
  type CompareSideValue,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import { CompareUnknownPanel } from "@/features/ux-reset/compare/compare-visual-sections";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";

import {
  COMPARE_LEFT_FIPS,
  COMPARE_RIGHT_FIPS,
  compareCountyDetail,
} from "./fixtures/compare-api-fixtures";

const counties = [
  { fips: COMPARE_LEFT_FIPS, label: "Denver", letter: "A" },
  { fips: COMPARE_RIGHT_FIPS, label: "Boulder", letter: "B" },
] as const;

function ready(fips: string): CompareCountySide {
  return { detail: compareCountyDetail(fips), status: "ready" };
}

function renderUnknown(rows: readonly CompareVisualRow[]) {
  render(
    <CompareUnknownPanel
      counties={counties}
      countyLimitations={null}
      period={null}
      rows={rows}
      sharedLimitation={null}
    />
  );
}

function valueSide(text: string, caveat: string): CompareSideValue {
  const evidence: EvidenceObjectModel = {
    availability: "limited",
    claimLabel: "Population",
    displayValue: text,
    provenance: {
      evidenceType: "Published",
      inspectSummary: "",
      limitations: [caveat],
      materialCaveat: caveat,
      observationPeriod: "2022",
      sourceFamily: "Census",
    },
  };
  return {
    evidence,
    isZero: false,
    kind: "value",
    limited: true,
    number: null,
    text,
  };
}

function missingSide(
  reason: CompareMissingReason,
  text: string
): CompareSideValue {
  return { kind: "missing", reason, text };
}

function populationRow(
  left: CompareSideValue,
  right: CompareSideValue
): CompareVisualRow {
  return {
    atLeast: false,
    gap: true,
    id: "population_2022",
    label: "Population",
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

describe("compare unknown panel", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not describe a network failure or a rejected release as unpublished", () => {
    const failedRows = buildCompareVisualRows(
      alignCompareCountyProfiles({
        left: ready(COMPARE_LEFT_FIPS),
        leftFips: COMPARE_LEFT_FIPS,
        right: compareCountyFailureSide(new Error("network")),
        rightFips: COMPARE_RIGHT_FIPS,
      })
    );
    renderUnknown(failedRows);
    const failedText = screen.getByTestId("compare-unknown").textContent ?? "";
    const failedLoad =
      screen.getByTestId("compare-could-not-load").textContent ?? "";
    const failedIntro =
      screen.getByTestId("compare-unknown-introduction").textContent ?? "";
    cleanup();

    const mismatchRows = buildCompareVisualRows(
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
    renderUnknown(mismatchRows);
    const mismatchText =
      screen.getByTestId("compare-unknown").textContent ?? "";
    const mismatchRelease =
      screen.getByTestId("compare-not-usable").textContent ?? "";
    const mismatchIntro =
      screen.getByTestId("compare-unknown-introduction").textContent ?? "";
    expect({
      failedIntro: failedIntro.includes("Most values above are published"),
      failedLoad: failedLoad.includes("Could not load for Boulder"),
      failedPublished: failedText.includes("No value published for Boulder"),
      mismatchIntro: mismatchIntro.includes("Most values above are published"),
      mismatchPublished: mismatchText.includes(
        "No value published for Boulder"
      ),
      mismatchRelease: mismatchRelease.includes(
        "Not usable for this release for Boulder"
      ),
    }).toStrictEqual({
      failedIntro: false,
      failedLoad: true,
      failedPublished: false,
      mismatchIntro: false,
      mismatchPublished: false,
      mismatchRelease: true,
    });
  });

  it("attributes different and identical caveats to the right county", () => {
    renderUnknown([
      populationRow(
        valueSide("100", "Population denominator unavailable"),
        valueSide("200", "Provisional data")
      ),
    ]);
    const differing = screen.getByTestId("compare-cautions").textContent ?? "";
    cleanup();
    renderUnknown([
      populationRow(
        valueSide("100", "Provisional data"),
        valueSide("200", "Provisional data")
      ),
    ]);
    const identical = screen.getByTestId("compare-cautions").textContent ?? "";
    expect({
      differingDenver: differing.includes("Population (Denver only)"),
      differingLeft: differing.includes("Population denominator unavailable"),
      differingRight: differing.includes("Provisional data"),
      differingBoulder: differing.includes("Population (Boulder only)"),
      identicalBoth: identical.includes("Population."),
      identicalCaveat: identical.includes("Provisional data"),
      identicalOnly: identical.includes("only"),
    }).toStrictEqual({
      differingBoulder: true,
      differingDenver: true,
      differingLeft: true,
      differingRight: true,
      identicalBoth: true,
      identicalCaveat: true,
      identicalOnly: false,
    });
  });

  it("keeps a suppressed reason and a failed reason on their counties", () => {
    renderUnknown([
      populationRow(
        missingSide("suppressed", "Suppressed"),
        missingSide("failed", "Couldn’t load this evidence.")
      ),
    ]);
    const absence =
      screen.getByTestId("compare-not-published").textContent ?? "";
    const failed =
      screen.getByTestId("compare-could-not-load").textContent ?? "";
    const panel = screen.getByTestId("compare-unknown").textContent ?? "";
    expect({
      absenceCounty: absence.includes("Denver"),
      absenceReason: absence.includes("Suppressed"),
      failedCounty: failed.includes("Boulder"),
      failedReason: failed.includes("could not be loaded"),
      unpublishedFailure: panel.includes("No value published for Boulder"),
    }).toStrictEqual({
      absenceCounty: true,
      absenceReason: true,
      failedCounty: true,
      failedReason: true,
      unpublishedFailure: false,
    });
  });
});
