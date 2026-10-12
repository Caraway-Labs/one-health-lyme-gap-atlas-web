import {
  ValueState,
  type CountyDetail,
  type Measure,
  type Observation,
} from "@/generated/models";

import {
  investigateMeasuresFixture,
  investigateMetadataFixture,
} from "./investigate-api-fixtures";
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

const compareScore = {
  access_signal: 10,
  community: 22,
  ecological: 30,
  human_weakness: 18,
  pathogen_signal: 10,
  rural_signal: 10,
  score: 64,
  svi_signal: 10,
  tick_signal: 10,
};

/**
 * Published county record for Compare tests.
 * Boulder (08013) carries numeric zeros on suppressed human fields so a test
 * can prove those zeros are not displayed.
 */
export function compareCountyDetail(fips: string): CountyDetail {
  const suppressed = fips === COMPARE_RIGHT_FIPS;
  return {
    burgdorferi_status: suppressed ? "No records" : "Present",
    case_count_floor_2023: suppressed ? 0 : 12,
    color: "navy",
    county: suppressed ? "Boulder" : "County",
    evidence_completeness: suppressed ? 20 : 80,
    fips,
    human_status: suppressed ? "suppressed" : "published_count_floor",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: suppressed ? 0 : 4.2,
    pacificus_status: suppressed ? null : "No records",
    population: suppressed ? null : 716_492,
    priority: suppressed ? "Watch" : "Priority 1 — Investigate",
    release: {
      ...investigateMetadataFixture,
      limitations: suppressed ? "" : "Not a diagnosis.",
      release_id: COMPARE_RELEASE_ID,
      sources: [
        {
          key: "human",
          label: "CDC published human cases",
          note: "A floor is not an exact total.",
          url: "https://www.cdc.gov/",
          vintage: "2023",
        },
        {
          key: "tick",
          label: "CDC county tick status",
          note: "No records is not absence.",
          url: "https://www.cdc.gov/",
          vintage: "through 2025",
        },
        {
          key: "context_svi",
          label: "Social vulnerability",
          note: "Percentile context.",
          url: "https://www.atsdr.cdc.gov/",
          vintage: "2022",
        },
      ],
    },
    rucc_2023: suppressed ? null : 2,
    scapularis_status: suppressed ? null : "Reported",
    score: {
      ...compareScore,
      community: suppressed ? 8 : 22,
      score: suppressed ? 40 : 64,
    },
    state: "CO",
    state_name: "Colorado",
    state_unallocated_records_2023: suppressed ? null : 3,
    svi_percentile: suppressed ? null : 0.91,
    tick_status: suppressed ? "No records" : "Established",
    uninsured_percent: suppressed ? null : 11.2,
    uninsured_percentile: null,
  };
}
