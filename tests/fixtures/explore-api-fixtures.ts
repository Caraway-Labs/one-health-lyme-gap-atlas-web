import { ValueState, type Observation } from "@/generated/models";

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 10,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

export const EXPLORE_PRECIPITATION_MEASURE_ID = "precipitation-mm";
export const EXPLORE_CASES_MEASURE_ID = "reported-cases";
export const EXPLORE_TICK_MEASURE_ID = "tick-abundance";

export const exploreMetadataFixture = {
  bundle_sha256: "abc",
  generated_at: "2026-01-01T00:00:00.000Z",
  limitations: "Sample",
  loaded_at: "2026-01-01T00:00:00.000Z",
  methodology_version: "1",
  release_id: "alpha-2026",
  schema_version: "1",
  scope: "US",
  score_defaults: {},
  sources: [],
  states: [
    { code: "CO", name: "Colorado" },
    { code: "NY", name: "New York" },
  ],
};

export const exploreMeasuresFixture = [
  {
    definition: "County-linked reported Lyme disease cases.",
    geography_semantics: "COUNTY_FIPS_5",
    geography_types: null,
    indicator_id: "human-cases",
    label: "Reported Lyme cases",
    limitations: [],
    measure_id: EXPLORE_CASES_MEASURE_ID,
    measure_type: "count",
    semantic_version: "1.0.0",
    temporal_grains: null,
    temporal_semantics: "2023",
    unit: "cases",
  },
  {
    definition: "Daily precipitation total.",
    geography_semantics: "COUNTY",
    geography_types: ["county"],
    indicator_id: "precipitation",
    label: "Daily precipitation",
    limitations: [],
    measure_id: EXPLORE_PRECIPITATION_MEASURE_ID,
    measure_type: "continuous",
    semantic_version: "1.0.0",
    temporal_grains: ["DAY"],
    temporal_semantics: "DAY",
    unit: "mm",
  },
  {
    definition: "County tick abundance index.",
    geography_semantics: "COUNTY_FIPS_5",
    geography_types: null,
    indicator_id: "ticks",
    label: "Tick abundance",
    limitations: [],
    measure_id: EXPLORE_TICK_MEASURE_ID,
    measure_type: "index",
    semantic_version: "1.0.0",
    temporal_grains: null,
    temporal_semantics: "2023",
    unit: "ticks",
  },
];

export const exploreMeasuresEnvelope = {
  data: exploreMeasuresFixture,
  links: { self: "/v1/measures" },
  meta: {},
};

function scoreCounty(input: {
  color: string;
  county: string;
  fips: string;
  score: number;
  state?: string;
  stateName?: string;
}) {
  return {
    burgdorferi_status: "observed",
    color: input.color,
    county: input.county,
    evidence_completeness: 50,
    fips: input.fips,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: { ...scoreBreakdown, score: input.score },
    state: input.state ?? "CO",
    state_name: input.stateName ?? "Colorado",
    tick_status: "observed",
  };
}

/** Boulder has the higher score so a ranking would list it first. */
export const exploreScoresFixture = {
  counties: [
    scoreCounty({
      color: "#112233",
      county: "Boulder",
      fips: "08013",
      score: 90,
    }),
    scoreCounty({
      color: "#445566",
      county: "Adams",
      fips: "08001",
      score: 10,
    }),
    scoreCounty({
      color: "#778899",
      county: "Adams",
      fips: "36001",
      score: 20,
      state: "NY",
      stateName: "New York",
    }),
  ],
  methodology_version: "1",
  release_id: "alpha-2026",
  settings: {
    ecological_share: 65,
    low_incidence_breakpoint: 10,
    missing_human_weakness: 75,
  },
};

export const exploreGeometryFixture = {
  features: [
    {
      geometry: {
        coordinates: [
          [
            [-105.1, 39.6],
            [-104.8, 39.6],
            [-104.8, 39.9],
            [-105.1, 39.9],
            [-105.1, 39.6],
          ],
        ],
        type: "Polygon",
      },
      properties: { fips: "08001" },
      type: "Feature",
    },
    {
      geometry: {
        coordinates: [
          [
            [-105.7, 39.9],
            [-105.2, 39.9],
            [-105.2, 40.3],
            [-105.7, 40.3],
            [-105.7, 39.9],
          ],
        ],
        type: "Polygon",
      },
      properties: { fips: "08013" },
      type: "Feature",
    },
  ],
  type: "FeatureCollection",
};

function observation(input: {
  fips: string;
  limitations?: string[];
  measureId: string;
  periodEnd: string;
  periodStart: string;
  releaseId?: string;
  sourceLabel: string;
  temporalGrain: string;
  unit: string;
  value: number | null;
  valueState?: (typeof ValueState)[keyof typeof ValueState];
}): Observation {
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "explore-fixture",
    denominator: null,
    evidence: {
      provenance_ref: `prov/${input.measureId}/${input.fips}`,
      resource_id: input.measureId,
      resource_type: "dataset",
    },
    geography: { geography_id: input.fips, geography_type: "county" },
    limitations: input.limitations ?? [],
    lineage_source_id: null,
    measure_id: input.measureId,
    methodology: null,
    methodology_id: "method-1",
    methodology_version: "1.0.0",
    observation_id: `obs-${input.measureId}-${input.fips}`,
    period_end: input.periodEnd,
    period_start: input.periodStart,
    provenance_ref: `prov/${input.measureId}/${input.fips}`,
    release_id: input.releaseId ?? "alpha-2026",
    release_methodology_version: null,
    semantic_version: "1.0.0",
    source_id: input.measureId,
    source_label: input.sourceLabel,
    source_published_at: null,
    source_url: null,
    source_vintage: "2026.1",
    temporal_grain: input.temporalGrain,
    unit: input.unit,
    value: input.value,
    value_state: input.valueState ?? ValueState.OBSERVED,
  };
}

export function exploreObservationsForMeasure(
  measureId: string,
  releaseId = "alpha-2026"
): Observation[] {
  if (
    measureId === EXPLORE_CASES_MEASURE_ID ||
    measureId === EXPLORE_TICK_MEASURE_ID
  ) {
    const unit = measureId === EXPLORE_CASES_MEASURE_ID ? "cases" : "ticks";
    return [
      observation({
        fips: "08013",
        measureId,
        periodEnd: "2023-12-31",
        periodStart: "2023-01-01",
        releaseId,
        sourceLabel: "CDC surveillance",
        temporalGrain: "YEAR",
        unit,
        value: 40,
      }),
      observation({
        fips: "08001",
        measureId,
        periodEnd: "2023-12-31",
        periodStart: "2023-01-01",
        releaseId,
        sourceLabel: "CDC surveillance",
        temporalGrain: "YEAR",
        unit,
        value: 2,
      }),
      observation({
        fips: "36001",
        measureId,
        periodEnd: "2023-12-31",
        periodStart: "2023-01-01",
        releaseId,
        sourceLabel: "CDC surveillance",
        temporalGrain: "YEAR",
        unit,
        value: 9,
      }),
    ];
  }
  return [
    observation({
      fips: "08001",
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodEnd: "2025-01-01",
      periodStart: "2025-01-01",
      releaseId,
      sourceLabel: "NOAA precipitation",
      temporalGrain: "DAY",
      unit: "mm",
      value: 18,
    }),
    observation({
      fips: "36001",
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodEnd: "2025-01-01",
      periodStart: "2025-01-01",
      releaseId,
      sourceLabel: "NOAA precipitation",
      temporalGrain: "DAY",
      unit: "mm",
      value: 1,
    }),
    observation({
      fips: "08013",
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      periodEnd: "2025-01-01",
      periodStart: "2025-01-01",
      releaseId,
      sourceLabel: "NOAA precipitation",
      temporalGrain: "DAY",
      unit: "mm",
      value: 4.5,
    }),
  ];
}

export function exploreObservationsEnvelope(measureId: string) {
  return {
    data: exploreObservationsForMeasure(measureId),
    links: { self: "/v1/observations" },
    meta: {},
  };
}

export const exploreMissingZeroObservation = observation({
  fips: "08001",
  measureId: EXPLORE_CASES_MEASURE_ID,
  periodEnd: "2023-12-31",
  periodStart: "2023-01-01",
  sourceLabel: "CDC surveillance",
  temporalGrain: "YEAR",
  unit: "cases",
  value: 0,
  valueState: ValueState.MISSING,
});
