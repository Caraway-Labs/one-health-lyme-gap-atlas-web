import { describe, expect, it } from "vitest";

import {
  alignCompareEvidence,
  compareWithholdReasonValues,
  type CompareCell,
  type CompareMeasureOutcome,
  type CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import {
  classifyCompareEntry,
  compareRecoveryMessages,
  removeCompareMember,
  replaceCompareSlot,
  resolveVisibleCompareEntry,
} from "@/features/ux-reset/compare/compare-entry";
import { compareEvidenceQueryKey } from "@/features/ux-reset/compare/load-compare-evidence";
import { mergeCompareQueryValues } from "@/features/ux-reset/context-params";
import { searchParamsWithCommittedExploreContext } from "@/features/ux-reset/explore-committed-navigation";
import type { Measure, Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";

import {
  COMPARE_CANOPY_MEASURE_ID,
  COMPARE_CASES_MEASURE_ID,
  COMPARE_LEFT_FIPS,
  COMPARE_RELEASE_ID,
  COMPARE_RIGHT_FIPS,
  COMPARE_TICK_MEASURE_ID,
  compareMeasuresFixture,
  compareObservation,
  compareObservationsFor,
} from "./fixtures/compare-api-fixtures";

function ready(
  measureId: string,
  observations: readonly Observation[]
): CompareMeasureOutcome {
  return { measureId, observations, status: "ready" };
}

function requireRow(measureId: string) {
  const aligned = row(measureId);
  if (!aligned) {
    throw new Error(`Missing aligned row ${measureId}.`);
  }
  return aligned;
}

function observationRecord(cell: CompareCell) {
  if (cell.kind !== "observations") {
    throw new Error("Expected observation records.");
  }
  const record = cell.records[0];
  if (!record) {
    throw new Error("Expected an observation record.");
  }
  return record;
}

function withheldRelation(relation: CompareRelation) {
  if (relation.kind !== "withheld") {
    throw new Error("Expected a withheld comparison.");
  }
  return relation;
}

function row(measureId: string) {
  return alignCompareEvidence({
    leftFips: COMPARE_LEFT_FIPS,
    leftLabel: "Denver, Colorado (08001)",
    measures: compareMeasuresFixture,
    outcomes: compareMeasuresFixture.map((measure) =>
      ready(
        measure.measure_id,
        compareObservationsFor({
          fips: [COMPARE_RIGHT_FIPS, COMPARE_LEFT_FIPS],
          measureId: measure.measure_id,
        })
      )
    ),
    rightFips: COMPARE_RIGHT_FIPS,
    rightLabel: "Boulder, Colorado (08013)",
  }).rows.find((candidate) => candidate.measureId === measureId);
}

function recoveryText(raw: readonly string[]): {
  messages: string;
  pair: string[];
} {
  const entry = classifyCompareEntry(raw);
  return {
    messages: compareRecoveryMessages({ entry, unknownFips: [] }).join(" "),
    pair: entry.pair,
  };
}

describe("compare pair contract", () => {
  it("uses the shared parser for an empty link", () => {
    const entry = recoveryText([]);
    expect(entry.pair).toStrictEqual(mergeCompareQueryValues([]));
    expect(entry.pair).toStrictEqual([]);
    expect(entry.messages).toContain("will not select");
  });

  it("uses the shared parser for one county", () => {
    const entry = recoveryText(["08001"]);
    expect(entry.pair).toStrictEqual(mergeCompareQueryValues(["08001"]));
    expect(entry.pair).toStrictEqual(["08001"]);
    expect(entry.messages).toContain("second county");
  });

  it("uses the shared parser for two counties", () => {
    const entry = recoveryText(["08001,08013"]);
    expect(entry.pair).toStrictEqual(mergeCompareQueryValues(["08001,08013"]));
    expect(entry.pair).toStrictEqual(["08001", "08013"]);
    expect(entry.messages).toBe("");
  });

  it("uses the shared parser for a repeated county", () => {
    const entry = recoveryText(["08001,08001"]);
    expect(entry.pair).toStrictEqual(mergeCompareQueryValues(["08001,08001"]));
    expect(entry.pair).toStrictEqual(["08001"]);
    expect(entry.messages).toContain("more than once");
  });

  it("uses the shared parser for an invalid identifier", () => {
    const entry = recoveryText(["08001,nope"]);
    expect(entry.pair).toStrictEqual(mergeCompareQueryValues(["08001,nope"]));
    expect(entry.pair).toStrictEqual(["08001"]);
    expect(entry.messages).toContain("not a county FIPS");
  });

  it("uses the shared parser for more than two counties", () => {
    const entry = recoveryText(["08001,08013,36001"]);
    expect(entry.pair).toStrictEqual(
      mergeCompareQueryValues(["08001,08013,36001"])
    );
    expect(entry.pair).toStrictEqual(["08001", "08013"]);
    expect(entry.messages).toContain("two counties");
  });

  it("keeps a pending pair when the raw URL still names the previous pair", () => {
    const beforeNuqs = resolveVisibleCompareEntry({
      pendingPair: ["08001", "36001"],
      rawCompareValues: ["08001,08013"],
      statePair: ["08001", "08013"],
    });
    expect(beforeNuqs.pair).toStrictEqual(["08001", "36001"]);
    expect(beforeNuqs.staleUrlIgnored).toBeTruthy();
    const rawStillOld = resolveVisibleCompareEntry({
      pendingPair: ["08001", "36001"],
      rawCompareValues: ["08001,08013"],
      statePair: ["08001", "36001"],
    });
    expect(rawStillOld.pair).toStrictEqual(["08001", "36001"]);
    expect(rawStillOld.staleUrlIgnored).toBeTruthy();
    expect(rawStillOld.invalidTokens).toStrictEqual([]);
  });

  it("follows a URL pair once the edit is no longer pending", () => {
    const settled = resolveVisibleCompareEntry({
      pendingPair: null,
      rawCompareValues: ["08001,08013"],
      statePair: ["08001", "08013"],
    });
    expect(settled.pair).toStrictEqual(["08001", "08013"]);
    expect(settled.staleUrlIgnored).toBeFalsy();
    const cleared = resolveVisibleCompareEntry({
      pendingPair: [],
      rawCompareValues: ["08001,08013"],
      statePair: ["08001", "08013"],
    });
    expect(cleared.pair).toStrictEqual([]);
    expect(cleared.staleUrlIgnored).toBeTruthy();
  });

  it("edits are reversible list operations and reject a repeated county", () => {
    const replaced = replaceCompareSlot(["08001", "08013"], 1, "36001");
    expect(replaced).toStrictEqual(["08001", "36001"]);
    expect(replaceCompareSlot(["08001", "08013"], 1, "08001")).toBeNull();
    expect(removeCompareMember(["08001", "08013"], "08001")).toStrictEqual([
      "08013",
    ]);
    expect(removeCompareMember(["08001", "08013"], "08013")).toStrictEqual([
      "08001",
    ]);
    expect(removeCompareMember(["08001"], "08001")).toStrictEqual([]);
  });

  it("puts the visible pair on Compare shell links and leaves other routes alone", () => {
    const source = new URLSearchParams(
      "compare=08001,08013&county=08001&scope=CO&dataset=alpha-2026"
    );
    const compareHref = searchParamsWithCommittedExploreContext(
      "/app/compare",
      source,
      {
        county: null,
        compare: ["08001", "36001"],
        dataset: "alpha-2026",
        period: null,
      }
    );
    expect(compareHref.get("compare")).toBe("08001,36001");
    expect(compareHref.get("dataset")).toBe("alpha-2026");
    const reviewHref = searchParamsWithCommittedExploreContext(
      "/app/review",
      source,
      {
        county: "08001",
        dataset: "alpha-2026",
        period: null,
      }
    );
    expect(reviewHref.get("compare")).toBe("08001,08013");
  });
});

describe("aligned evidence", () => {
  it("keeps a real zero beside a published value", () => {
    const cases = requireRow(COMPARE_CASES_MEASURE_ID);
    expect(cases.relation).toMatchObject({
      kind: "different",
      signedDifference: -12,
    });
    expect(observationRecord(cases.left).observation.value).toBe(12);
    expect(observationRecord(cases.left).evidence.displayValue).toContain("12");
    expect(observationRecord(cases.right).observation).toMatchObject({
      value: 0,
      value_state: ValueState.ZERO,
    });
    expect(observationRecord(cases.right).evidence.displayValue).toContain("0");
  });

  it("keeps a missing side off the numeric comparison", () => {
    const tick = requireRow(COMPARE_TICK_MEASURE_ID);
    const relation = withheldRelation(tick.relation);
    expect(tick.right).toMatchObject({ kind: "empty", reason: "missing" });
    expect(relation.reasons).toContain(compareWithholdReasonValues.missingSide);
    expect(relation.explanation).toContain("not zero");
    expect(relation.explanation).not.toContain("differ by");
  });

  it("withholds a period mismatch", () => {
    const canopy = requireRow(COMPARE_CANOPY_MEASURE_ID);
    const relation = withheldRelation(canopy.relation);
    expect(relation.reasons).toContain(
      compareWithholdReasonValues.periodMismatch
    );
    expect(relation.explanation).toContain("periods differ");
  });

  it("orders rows by measure identity when responses arrive out of order", () => {
    const alignment = alignCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver",
      measures: [...compareMeasuresFixture].toReversed() as Measure[],
      outcomes: [
        ready(
          COMPARE_CANOPY_MEASURE_ID,
          compareObservationsFor({
            fips: [COMPARE_LEFT_FIPS, COMPARE_RIGHT_FIPS],
            measureId: COMPARE_CANOPY_MEASURE_ID,
          })
        ),
        ready(COMPARE_CASES_MEASURE_ID, [
          compareObservation({
            fips: COMPARE_RIGHT_FIPS,
            measureId: COMPARE_CASES_MEASURE_ID,
            unit: "cases",
            value: 0,
            valueState: ValueState.ZERO,
          }),
          compareObservation({
            fips: COMPARE_LEFT_FIPS,
            measureId: COMPARE_CASES_MEASURE_ID,
            unit: "cases",
            value: 12,
          }),
        ]),
        ready(
          COMPARE_TICK_MEASURE_ID,
          compareObservationsFor({
            fips: [COMPARE_LEFT_FIPS],
            measureId: COMPARE_TICK_MEASURE_ID,
          })
        ),
      ],
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder",
    });
    expect(alignment.rows.map((item) => item.measureId)).toStrictEqual([
      COMPARE_CASES_MEASURE_ID,
      COMPARE_TICK_MEASURE_ID,
      COMPARE_CANOPY_MEASURE_ID,
    ]);
    const first = alignment.rows[0];
    if (!first) {
      throw new Error("Expected the first aligned row.");
    }
    expect(observationRecord(first.left).observation.value).toBe(12);
  });

  it("does not merge measures that share a display label", () => {
    const sharedLabel = "Reported Lyme cases";
    const measures = [
      {
        ...compareMeasuresFixture[0],
        label: sharedLabel,
        measure_id: "reported-cases-b",
      },
      {
        ...compareMeasuresFixture[0],
        label: sharedLabel,
        measure_id: "reported-cases-a",
      },
    ] as Measure[];
    const alignment = alignCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver",
      measures,
      outcomes: [
        ready("reported-cases-b", [
          compareObservation({
            fips: COMPARE_LEFT_FIPS,
            measureId: "reported-cases-b",
            unit: "cases",
            value: 9,
          }),
          compareObservation({
            fips: COMPARE_RIGHT_FIPS,
            measureId: "reported-cases-b",
            unit: "cases",
            value: 9,
          }),
        ]),
        ready("reported-cases-a", [
          compareObservation({
            fips: COMPARE_LEFT_FIPS,
            measureId: "reported-cases-a",
            unit: "cases",
            value: 2,
          }),
          compareObservation({
            fips: COMPARE_RIGHT_FIPS,
            measureId: "reported-cases-a",
            unit: "cases",
            value: 2,
          }),
        ]),
      ],
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder",
    });
    expect(alignment.rows.map((item) => item.measureId)).toStrictEqual([
      "reported-cases-a",
      "reported-cases-b",
    ]);
    expect(alignment.rows[0]?.relation.kind).toBe("similar");
    const first = alignment.rows[0];
    const second = alignment.rows[1];
    if (!(first && second)) {
      throw new Error("Expected two labeled rows.");
    }
    expect(observationRecord(first.left).observation.value).toBe(2);
    expect(observationRecord(second.left).observation.value).toBe(9);
  });

  it("withholds a release mismatch and does not invent a numeric difference", () => {
    const alignment = alignCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver",
      measures: [compareMeasuresFixture[0] as Measure],
      outcomes: [
        ready(COMPARE_CASES_MEASURE_ID, [
          compareObservation({
            fips: COMPARE_LEFT_FIPS,
            measureId: COMPARE_CASES_MEASURE_ID,
            unit: "cases",
            value: 12,
          }),
          {
            ...compareObservation({
              fips: COMPARE_RIGHT_FIPS,
              measureId: COMPARE_CASES_MEASURE_ID,
              unit: "cases",
              value: 4,
            }),
            release_id: "beta-2025",
          },
        ]),
      ],
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder",
    });
    const relation = alignment.rows[0]?.relation;
    if (!relation) {
      throw new Error("Expected a release-mismatch row.");
    }
    const withheld = withheldRelation(relation);
    expect(withheld.reasons).toContain(
      compareWithholdReasonValues.releaseMismatch
    );
    expect(withheld.explanation).toContain("Release identifiers differ");
    expect("signedDifference" in withheld).toBeFalsy();
  });

  it("builds a cache key from the visible pair order", () => {
    const forward = compareEvidenceQueryKey({
      measureIds: ["b", "a"],
      pair: [COMPARE_LEFT_FIPS, COMPARE_RIGHT_FIPS],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
    });
    const swapped = compareEvidenceQueryKey({
      measureIds: ["a", "b"],
      pair: [COMPARE_RIGHT_FIPS, COMPARE_LEFT_FIPS],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
    });
    expect(forward[2]).toBe(COMPARE_LEFT_FIPS);
    expect(forward[3]).toBe(COMPARE_RIGHT_FIPS);
    expect(forward).not.toStrictEqual(swapped);
    expect(forward[5]).toBe(swapped[5]);
  });
});
