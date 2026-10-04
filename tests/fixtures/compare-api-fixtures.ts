import { ValueState, type Measure, type Observation } from "@/generated/models";

import { investigateMeasuresFixture } from "./investigate-api-fixtures";
import { reviewScopeScoresFixture } from "./review-scope-api-fixtures";

export const COMPARE_RELEASE_ID = "alpha-2026";
export const COMPARE_LEFT_FIPS = "08001";
export const COMPARE_RIGHT_FIPS = "08013";
export const COMPARE_REPLACEMENT_FIPS = "36001";
export const COMPARE_CASES_MEASURE_ID = "reported-cases";
export const COMPARE_TICK_MEASURE_ID = "tick-pathogen";
export const COMPARE_CANOPY_MEASURE_ID = "tree-canopy";
export const COMPARE_WASHINGTON_RI = "44009";
export const COMPARE_WASHINGTON_MN = "27163";

const scoreTemplate = reviewScopeScoresFixture.counties[0];

export const compareScoresFixture = {
  ...reviewScopeScoresFixture,
  counties: [
    ...reviewScopeScoresFixture.counties,
    {
      ...scoreTemplate,
      county: "Washington",
      fips: COMPARE_WASHINGTON_RI,
      state: "RI",
      state_name: "Rhode Island",
    },
    {
      ...scoreTemplate,
      county: "Washington",
      fips: COMPARE_WASHINGTON_MN,
      state: "MN",
      state_name: "Minnesota",
    },
  ],
};

export const compareMeasuresFixture: Measure[] = [
  ...investigateMeasuresFixture,
] as Measure[];

export function compareObservation(input: {
  fips: string;
  measureId: string;
  periodEnd?: string;
  periodStart?: string;
  unit: string;
  value: number | null;
  valueState?: (typeof ValueState)[keyof typeof ValueState];
}): Observation {
  const periodStart = input.periodStart ?? "2023-01-01";
  const periodEnd = input.periodEnd ?? "2023-12-31";
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "compare-fixture",
    denominator: null,
    evidence: {
      provenance_ref: `prov/${input.measureId}-${input.fips}`,
      resource_id: input.measureId,
      resource_type: "dataset",
    },
    geography: { geography_id: input.fips, geography_type: "county" },
    limitations: [],
    lineage_source_id: null,
    measure_id: input.measureId,
    methodology: null,
    methodology_id: "method-1",
    methodology_version: "1.0.0",
    observation_id: `obs-${input.measureId}-${input.fips}-${periodEnd}`,
    period_end: periodEnd,
    period_start: periodStart,
    provenance_ref: `prov/${input.measureId}-${input.fips}`,
    release_id: COMPARE_RELEASE_ID,
    release_methodology_version: null,
    semantic_version: "1.0.0",
    source_id: "compare-source",
    source_label: "Governed surveillance",
    source_published_at: null,
    source_url: null,
    source_vintage: "2026.1",
    temporal_grain: "YEAR",
    unit: input.unit,
    value: input.value,
    value_state: input.valueState ?? ValueState.OBSERVED,
  };
}

/**
 * Observations are returned with the higher FIPS first so a test that reads
 * array position would attach Boulder’s zero to Denver.
 */
export function compareObservationsFor(input: {
  fips: readonly string[];
  measureId: string;
}): Observation[] {
  const rows: Observation[] = [];
  for (const fips of input.fips) {
    if (
      input.measureId === COMPARE_TICK_MEASURE_ID &&
      fips === COMPARE_RIGHT_FIPS
    ) {
      continue;
    }
    if (input.measureId === COMPARE_CASES_MEASURE_ID) {
      rows.push(
        compareObservation({
          fips,
          measureId: input.measureId,
          unit: "cases",
          value: fips === COMPARE_RIGHT_FIPS ? 0 : 12,
          valueState:
            fips === COMPARE_RIGHT_FIPS ? ValueState.ZERO : ValueState.OBSERVED,
        })
      );
      continue;
    }
    if (input.measureId === COMPARE_TICK_MEASURE_ID) {
      rows.push(
        compareObservation({
          fips,
          measureId: input.measureId,
          unit: "detections",
          value: 4,
        })
      );
      continue;
    }
    rows.push(
      compareObservation({
        fips,
        measureId: input.measureId,
        periodEnd: fips === COMPARE_RIGHT_FIPS ? "2023-06-30" : "2023-12-31",
        unit: "percent",
        value: fips === COMPARE_RIGHT_FIPS ? 22 : 18,
      })
    );
  }
  return rows.toSorted((left, right) =>
    right.geography.geography_id.localeCompare(left.geography.geography_id)
  );
}
