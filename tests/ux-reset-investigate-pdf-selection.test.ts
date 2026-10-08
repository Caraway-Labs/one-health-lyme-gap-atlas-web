import { describe, expect, it } from "vitest";

import { selectInvestigatePdfMeasures } from "@/features/ux-reset/investigate/investigate-pdf-selection";
import { ValueState, type Observation } from "@/generated/models";

import {
  investigateObservationsFor,
  INVESTIGATE_TICK_MEASURE_ID,
} from "./fixtures/investigate-api-fixtures";

function record(
  measureId: string,
  overrides: Partial<Observation> = {},
  label = measureId
) {
  const [base] = investigateObservationsFor({
    fips: "08001",
    measureId: INVESTIGATE_TICK_MEASURE_ID,
    scenario: "mixed",
  });
  if (!base) throw new Error("Missing fixture");
  return {
    measureId,
    measureLabel: label,
    observation: {
      ...base,
      measure_id: measureId,
      observation_id: `obs-${measureId}`,
      ...overrides,
    },
  };
}

function select(
  input: Partial<Parameters<typeof selectInvestigatePdfMeasures>[0]> = {}
) {
  return selectInvestigatePdfMeasures({
    countyFips: "08001",
    failures: [],
    readyMeasureIds: [],
    records: [],
    releaseId: "alpha-2026",
    unsupportedPeriodMeasureIds: [],
    ...input,
  });
}

describe("Investigate PDF measure selection", () => {
  it("includes every published value state", () => {
    const states = [
      ValueState.OBSERVED,
      ValueState.ZERO,
      ValueState.SUPPRESSED,
      ValueState.MISSING,
      ValueState.UNAVAILABLE,
      ValueState.NO_COUNTY_LINKED_RECORD,
    ] as const;
    const selection = select({
      records: states.map((state, index) =>
        record(`measure-${index}`, { value_state: state })
      ),
    });
    expect(
      selection.included.map((measure) => measure.measureId)
    ).toStrictEqual(states.map((_, index) => `measure-${index}`));
    expect(selection.omitted).toStrictEqual([]);
  });

  it("omits identity, provenance, period, and unsupported-state problems", () => {
    const selection = select({
      records: [
        record("wrong-county", {
          geography: { geography_id: "08013", geography_type: "county" },
        }),
        record("blank-source", { source_label: "  " }),
        record("bad-period", { period_start: "2023/01/01" }),
        record("impossible-day", { period_start: "2023-13-40" }),
        record("long-period", {
          period_end: "2024-12-31",
          period_start: "2022-01-01",
        }),
        record("unexpected-state", {
          value_state: "NOT_A_STATE" as Observation["value_state"],
        }),
      ],
    });
    expect(
      selection.omitted.map((measure) => [measure.measureId, measure.reason])
    ).toStrictEqual([
      ["bad-period", "The observation period is outside the report limit."],
      ["blank-source", "Missing provenance."],
      ["impossible-day", "The observation period is outside the report limit."],
      ["long-period", "The observation period is outside the report limit."],
      ["unexpected-state", "Unsupported evidence state."],
      ["wrong-county", "Does not match this county and release."],
    ]);
    expect(selection.included).toStrictEqual([]);
  });

  it("names failed, unsupported, and empty measures without duplicating them", () => {
    const selection = select({
      failures: [
        { measureId: "rucc_2023", measureLabel: "RUCC 2023", message: "" },
        {
          measureId: "rucc_2023",
          measureLabel: "RUCC 2023",
          message: "duplicate",
        },
      ],
      readyMeasureIds: ["tree-canopy", "rucc_2023"],
      records: [record("rucc_2023", {}, "RUCC 2023")],
      unsupportedPeriodMeasureIds: ["population_2022"],
    });
    expect(
      selection.omitted.map((measure) => [measure.measureId, measure.reason])
    ).toStrictEqual([
      ["population_2022", "No published data for this period."],
      ["rucc_2023", "This measure could not be loaded."],
      ["tree-canopy", "No published data for this release."],
    ]);
  });

  it("keeps the largest period and breaks equal counts lexicographically", () => {
    const majority = select({
      records: [
        record("later", {
          period_end: "2024-12-31",
          period_start: "2024-01-01",
        }),
        record("early-a", {
          period_end: "2023-12-31",
          period_start: "2023-01-01",
        }),
        record("early-b", {
          period_end: "2023-12-31",
          period_start: "2023-01-01",
        }),
        record("losing", {
          period_end: "2022-12-31",
          period_start: "2022-01-01",
        }),
      ],
    });
    const tie = select({
      records: [
        record("later", {
          period_end: "2024-12-31",
          period_start: "2024-01-01",
        }),
        record("earlier", {
          period_end: "2023-12-31",
          period_start: "2023-01-01",
        }),
      ],
    });
    expect({
      majority: majority.included.map((measure) => measure.measureId),
      majorityOmitted: majority.omitted.map((measure) => measure.reason),
      tie: tie.included.map((measure) => measure.measureId),
      tieOmitted: tie.omitted.map((measure) => measure.reason),
    }).toStrictEqual({
      majority: ["early-a", "early-b"],
      majorityOmitted: [
        "Different observation period.",
        "Different observation period.",
      ],
      tie: ["earlier"],
      tieOmitted: ["Different observation period."],
    });
  });

  it("stops at the observation and measure limits", () => {
    const crowded = record("crowded");
    const tooManyRows = select({
      records: Array.from({ length: 501 }, (_, index) => ({
        ...crowded,
        observation: {
          ...crowded.observation,
          observation_id: `obs-${index}`,
        },
      })),
    });
    const tooManyMeasures = select({
      records: Array.from({ length: 21 }, (_, index) =>
        record(`m${String(index).padStart(2, "0")}`)
      ),
    });
    expect({
      rows: tooManyRows.omitted.map((measure) => measure.reason),
      measures: tooManyMeasures.omitted.map((measure) => [
        measure.measureId,
        measure.reason,
      ]),
      kept: tooManyMeasures.included.length,
    }).toStrictEqual({
      rows: ["Too many observations to include in one report."],
      measures: [["m20", "The report includes at most 20 measures."]],
      kept: 20,
    });
  });
});
