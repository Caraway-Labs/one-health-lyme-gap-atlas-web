import { describe, expect, it } from "vitest";

import {
  assertExploreObservations,
  buildExploreSelection,
  choroplethBin,
  commitExploreSelection,
  countyDirectoryFromScoreSummaries,
  countyExploreMeasures,
  ExploreContractError,
  exploreRequestStatusCopy,
  filterDirectoryByMapScope,
  numericExploreValue,
  resolveExploreMapScope,
  resolveExploreTimeBound,
  resolveRequestedMeasureId,
  type ExploreCommittedSelection,
  type ExploreTimeBound,
} from "@/features/ux-reset/explore/explore-model";
import type { Measure } from "@/generated/models";
import { ValueState } from "@/generated/models";

import {
  EXPLORE_CASES_MEASURE_ID,
  EXPLORE_PRECIPITATION_MEASURE_ID,
  exploreMeasuresFixture,
  exploreMissingZeroObservation,
  exploreObservationsForMeasure,
  exploreScoresFixture,
} from "./fixtures/explore-api-fixtures";

const measures = exploreMeasuresFixture as Measure[];
const casesMeasure = measures.find(
  (measure) => measure.measure_id === EXPLORE_CASES_MEASURE_ID
);
const precipitationMeasure = measures.find(
  (measure) => measure.measure_id === EXPLORE_PRECIPITATION_MEASURE_ID
);

function timeBoundFor(measure: Measure): ExploreTimeBound {
  const bound = resolveExploreTimeBound(
    measure,
    measure.temporal_semantics === "DAY" ? "2025-01-01" : null
  );
  if (!bound) {
    throw new Error("Fixture measure has no governed time bound.");
  }
  return bound;
}

function selectionFor(
  measure: Measure,
  observations = exploreObservationsForMeasure(measure.measure_id)
): ExploreCommittedSelection {
  return buildExploreSelection({
    directory: countyDirectoryFromScoreSummaries(exploreScoresFixture.counties),
    mapScope: "CO",
    measure,
    observations,
    releaseId: "alpha-2026",
    timeBound: timeBoundFor(measure),
  });
}

describe("Explore measure selection", () => {
  it("lists measures by exact geography semantics in label order", () => {
    const ordered = countyExploreMeasures([
      ...measures,
      {
        ...measures[0],
        geography_semantics: "STATE",
        geography_types: ["state"],
        label: "State only",
        measure_id: "state-only",
      },
      {
        ...measures[0],
        geography_semantics: null,
        geography_types: ["county"],
        label: "Untyped county",
        measure_id: "untyped-county",
      },
    ] as Measure[]);
    expect(ordered.map((measure) => measure.measure_id)).toStrictEqual([
      EXPLORE_PRECIPITATION_MEASURE_ID,
      EXPLORE_CASES_MEASURE_ID,
      "tick-abundance",
    ]);
  });

  it("keeps an explicit metric and otherwise chooses a resolvable bound", () => {
    const catalog = countyExploreMeasures(measures);
    expect(
      resolveRequestedMeasureId(catalog, EXPLORE_CASES_MEASURE_ID, null)
    ).toBe(EXPLORE_CASES_MEASURE_ID);
    expect(resolveRequestedMeasureId(catalog, "not-a-measure", null)).toBe(
      EXPLORE_CASES_MEASURE_ID
    );
    expect(resolveRequestedMeasureId(catalog, null, "2025-01-01")).toBe(
      EXPLORE_PRECIPITATION_MEASURE_ID
    );
    expect(resolveExploreTimeBound(catalog[0], null)).toBeNull();
  });

  it("frames the map from map_scope without replacing review scope", () => {
    const stateCodes = ["CO", "NY"];
    expect(
      resolveExploreMapScope({
        mapScopeParam: "NY",
        reviewScope: "CO",
        stateCodes,
      })
    ).toBe("NY");
    expect(
      resolveExploreMapScope({
        mapScopeParam: "ALL",
        reviewScope: "CO",
        stateCodes,
      })
    ).toBe("ALL");
    expect(
      resolveExploreMapScope({
        mapScopeParam: "ZZ",
        reviewScope: "CO",
        stateCodes,
      })
    ).toBe("CO");
  });
});

describe("Explore displayed selection", () => {
  it("orders counties alphabetically and omits review score fields", () => {
    if (!casesMeasure) {
      throw new Error("Missing cases measure fixture.");
    }
    const selection = selectionFor(casesMeasure);
    expect(
      selection.rows.map((row) => `${row.countyName}, ${row.state}`)
    ).toStrictEqual(["Adams, CO", "Adams, NY", "Boulder, CO"]);
    expect(selection).not.toHaveProperty("priority");
    expect(selection.rows[0]).not.toHaveProperty("score");
    expect(selection.rows[0]).not.toHaveProperty("color");
  });

  it("keeps cases values on one measure identity", () => {
    if (!casesMeasure) {
      throw new Error("Missing cases measure fixture.");
    }
    const selection = selectionFor(casesMeasure);
    expect(selection.measureId).toBe(EXPLORE_CASES_MEASURE_ID);
    expect(selection.unit).toBe("cases");
    expect(selection.observationPeriod).toBe("2023");
    expect(selection.rows.map((row) => row.displayValue)).toStrictEqual([
      "2 cases",
      "9 cases",
      "40 cases",
    ]);
  });

  it("uses a different unit and period for the other measure", () => {
    if (!precipitationMeasure) {
      throw new Error("Missing precipitation measure fixture.");
    }
    const selection = selectionFor(precipitationMeasure);
    expect(selection.unit).toBe("mm");
    expect(selection.observationPeriod).toContain("2025");
    expect(selection.observationPeriod).not.toBe("2023");
    expect(selection.rows[0]?.displayValue).toContain("mm");
  });

  it("does not treat a missing zero as a measured low value", () => {
    if (!casesMeasure) {
      throw new Error("Missing cases measure fixture.");
    }
    const selection = buildExploreSelection({
      directory: filterDirectoryByMapScope(
        countyDirectoryFromScoreSummaries(exploreScoresFixture.counties),
        "CO"
      ).filter((county) => county.fips === "08001"),
      mapScope: "CO",
      measure: casesMeasure,
      observations: [exploreMissingZeroObservation],
      releaseId: "alpha-2026",
      timeBound: timeBoundFor(casesMeasure),
    });
    expect(numericExploreValue(exploreMissingZeroObservation)).toBeNull();
    expect(selection.rows[0]?.displayValue).toBe("Unavailable");
    expect(selection.rows[0]?.choroplethBin).toBe("neutral");
    expect(selection.rows[0]?.availability).toBe("unavailable");
  });

  it("keeps published zero on the numeric ramp", () => {
    expect(
      numericExploreValue({
        ...exploreMissingZeroObservation,
        value: 0,
        value_state: ValueState.ZERO,
      })
    ).toBe(0);
    expect(choroplethBin(0, 0, 10)).toBe(0);
    expect(choroplethBin(10, 0, 10)).toBe(5);
    expect(choroplethBin(null, 0, 10)).toBe("neutral");
  });

  it("does not replace the displayed layer while a request is pending or failed", () => {
    if (!casesMeasure || !precipitationMeasure) {
      throw new Error("Missing measure fixtures.");
    }
    const current = selectionFor(precipitationMeasure);
    const incoming = selectionFor(casesMeasure);
    expect(
      commitExploreSelection({
        current,
        incoming,
        requestStatus: "pending",
        requestedMapScope: "CO",
        requestedMeasureId: EXPLORE_CASES_MEASURE_ID,
        requestedReleaseId: "alpha-2026",
      })
    ).toBe(current);
    expect(
      commitExploreSelection({
        current,
        incoming,
        requestStatus: "error",
        requestedMapScope: "CO",
        requestedMeasureId: EXPLORE_CASES_MEASURE_ID,
        requestedReleaseId: "alpha-2026",
      })
    ).toBe(current);
    expect(
      commitExploreSelection({
        current,
        incoming,
        requestStatus: "success",
        requestedMapScope: "NY",
        requestedMeasureId: EXPLORE_CASES_MEASURE_ID,
        requestedReleaseId: "alpha-2026",
      })?.mapScope
    ).toBe("CO");
    expect(
      commitExploreSelection({
        current,
        incoming,
        requestStatus: "success",
        requestedMapScope: "CO",
        requestedMeasureId: EXPLORE_CASES_MEASURE_ID,
        requestedReleaseId: "alpha-2026",
      })
    ).toBe(incoming);
  });

  it("describes a pending request without renaming the displayed measure", () => {
    const copy = exploreRequestStatusCopy({
      committedMapScopeLabel: "Colorado (CO)",
      committedMeasureLabel: "Daily precipitation",
      failed: false,
      matchesCommitted: false,
      requestedMapScopeLabel: "Colorado (CO)",
      requestedMeasureLabel: "Reported Lyme cases",
    });
    expect(copy?.tone).toBe("loading");
    expect(copy?.message).toContain("Reported Lyme cases");
    expect(copy?.message).toContain("Daily precipitation");
    expect(
      exploreRequestStatusCopy({
        committedMapScopeLabel: "Colorado (CO)",
        committedMeasureLabel: "Daily precipitation",
        failed: true,
        matchesCommitted: true,
        requestedMapScopeLabel: "Colorado (CO)",
        requestedMeasureLabel: "Daily precipitation",
      })
    ).toBeNull();
  });

  it("drops review score fields when building the county directory", () => {
    const directory = countyDirectoryFromScoreSummaries(
      exploreScoresFixture.counties
    );
    expect(directory.map((county) => county.fips).toSorted()).toStrictEqual([
      "08001",
      "08013",
      "36001",
    ]);
    expect(directory[0]).toStrictEqual({
      county: expect.any(String),
      fips: expect.any(String),
      state: "CO",
      stateName: "Colorado",
    });
    expect(directory[0]).not.toHaveProperty("priority");
    expect(directory[0]).not.toHaveProperty("score");
    expect(directory[0]).not.toHaveProperty("color");
  });
});

describe("Explore release identity", () => {
  it("rejects observations from another release", () => {
    if (!casesMeasure) {
      throw new Error("Missing cases measure fixture.");
    }
    expect(() =>
      assertExploreObservations({
        measureId: casesMeasure.measure_id,
        observations: exploreObservationsForMeasure(
          casesMeasure.measure_id,
          "beta-2026"
        ),
        releaseId: "alpha-2026",
        timeBound: timeBoundFor(casesMeasure),
      })
    ).toThrow(ExploreContractError);
  });

  it("rejects a response that mixes release identities", () => {
    if (!casesMeasure) {
      throw new Error("Missing cases measure fixture.");
    }
    const [first, second] = exploreObservationsForMeasure(
      casesMeasure.measure_id
    );
    if (!(first && second)) {
      throw new Error("Missing observation fixtures.");
    }
    expect(() =>
      assertExploreObservations({
        measureId: casesMeasure.measure_id,
        observations: [{ ...second, release_id: "beta-2026" }, first],
        releaseId: "alpha-2026",
        timeBound: timeBoundFor(casesMeasure),
      })
    ).toThrow(/mixes release identities/);
  });

  it("keeps the previous layer when the incoming release does not match", () => {
    if (!casesMeasure || !precipitationMeasure) {
      throw new Error("Missing measure fixtures.");
    }
    const current = selectionFor(precipitationMeasure);
    const incoming = {
      ...selectionFor(casesMeasure),
      releaseId: "beta-2026",
    };
    expect(
      commitExploreSelection({
        current,
        incoming,
        requestStatus: "success",
        requestedMapScope: "CO",
        requestedMeasureId: EXPLORE_CASES_MEASURE_ID,
        requestedReleaseId: "alpha-2026",
      })
    ).toBe(current);
  });
});
