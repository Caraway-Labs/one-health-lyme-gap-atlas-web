import {
  ValueState,
  type Indicator,
  type Observation,
} from "@/generated/models";

export { exploreMetadataFixture as investigateMetadataFixture } from "./explore-api-fixtures";
export { reviewScopeScoresFixture as investigateScoresFixture } from "./review-scope-api-fixtures";

export const INVESTIGATE_RELEASE_ID = "alpha-2026";
export const INVESTIGATE_CASES_MEASURE_ID = "reported-cases";
export const INVESTIGATE_TICK_MEASURE_ID = "tick-pathogen";
export const INVESTIGATE_CONTEXT_MEASURE_ID = "tree-canopy";
export const INVESTIGATE_CASES_LIMITATION =
  "Case reports do not include every clinical encounter.";
export const INVESTIGATE_TICK_LIMITATION =
  "Surveillance sites do not represent the whole county.";

export const investigateMeasuresFixture = [
  {
    definition: "County-linked reported Lyme disease cases.",
    geography_semantics: "COUNTY_FIPS_5",
    geography_types: ["county"],
    indicator_id: "human-cases",
    label: "Reported Lyme cases",
    limitations: [],
    measure_id: INVESTIGATE_CASES_MEASURE_ID,
    measure_type: "count",
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
    temporal_grains: ["YEAR"],
    temporal_semantics: "2023",
    unit: "cases",
  },
  {
    definition: "Detection of Borrelia burgdorferi in sampled ticks.",
    geography_semantics: "COUNTY_FIPS_5",
    geography_types: ["county"],
    indicator_id: "tick-pathogen",
    label: "Tick pathogen detections",
    limitations: [],
    measure_id: INVESTIGATE_TICK_MEASURE_ID,
    measure_type: "count",
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
    temporal_grains: ["YEAR"],
    temporal_semantics: "2023",
    unit: "detections",
  },
  {
    definition: "Tree canopy cover.",
    geography_semantics: "COUNTY",
    geography_types: ["county"],
    indicator_id: "canopy",
    label: "Tree canopy cover",
    limitations: [],
    measure_id: INVESTIGATE_CONTEXT_MEASURE_ID,
    measure_type: "proportion",
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
    temporal_grains: ["YEAR"],
    temporal_semantics: "2023",
    unit: "percent",
  },
];

export const investigateIndicatorsFixture: Indicator[] = [
  {
    category: null,
    definition: "Human surveillance",
    domain: "human",
    indicator_id: "human-cases",
    label: "Human cases",
    limitations: [],
    measure_ids: [INVESTIGATE_CASES_MEASURE_ID],
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
  },
  {
    category: null,
    definition: "Pathogen in vectors",
    domain: "pathogen",
    indicator_id: "tick-pathogen",
    label: "Tick pathogen",
    limitations: [],
    measure_ids: [INVESTIGATE_TICK_MEASURE_ID],
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
  },
  {
    category: null,
    definition: "Environmental context",
    domain: "environmental",
    indicator_id: "canopy",
    label: "Canopy",
    limitations: [],
    measure_ids: [INVESTIGATE_CONTEXT_MEASURE_ID],
    release_version: INVESTIGATE_RELEASE_ID,
    semantic_version: "1.0.0",
  },
];

const COUNTY_LABELS: Record<string, { label: string; stateCode: string }> = {
  "08001": { label: "Denver County", stateCode: "CO" },
  "08013": { label: "Boulder County", stateCode: "CO" },
  "08014": { label: "Clear Creek County", stateCode: "CO" },
  "36001": { label: "Albany County", stateCode: "NY" },
};

export function investigateGeographyFixture(fips: string) {
  const known = COUNTY_LABELS[fips];
  if (!known) {
    return null;
  }
  return {
    geography: { geography_id: fips, geography_type: "county" as const },
    label: known.label,
    parent: {
      geography_id: known.stateCode,
      geography_type: "state" as const,
    },
  };
}

function observation(input: {
  fips: string;
  limitations?: string[];
  measureId: string;
  observationId: string;
  sourceId: string;
  sourceLabel: string;
  unit: string;
  value: number | null;
  valueState?: (typeof ValueState)[keyof typeof ValueState];
}): Observation {
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "investigate-fixture",
    denominator: null,
    evidence: {
      provenance_ref: `prov/${input.observationId}`,
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
    observation_id: input.observationId,
    period_end: "2023-12-31",
    period_start: "2023-01-01",
    provenance_ref: `prov/${input.observationId}`,
    release_id: INVESTIGATE_RELEASE_ID,
    release_methodology_version: null,
    semantic_version: "1.0.0",
    source_id: input.sourceId,
    source_label: input.sourceLabel,
    source_published_at: null,
    source_url: null,
    source_vintage: "2026.1",
    temporal_grain: "YEAR",
    unit: input.unit,
    value: input.value,
    value_state: input.valueState ?? ValueState.OBSERVED,
  };
}

export type InvestigateScenario = "ambiguous" | "mixed" | "partial" | "sparse";

export function investigateObservationsFor(input: {
  fips: string;
  measureId: string;
  scenario: InvestigateScenario;
}): Observation[] {
  if (input.scenario === "sparse") {
    if (input.measureId !== INVESTIGATE_CASES_MEASURE_ID) {
      return [];
    }
    return [
      observation({
        fips: input.fips,
        limitations: [INVESTIGATE_CASES_LIMITATION],
        measureId: input.measureId,
        observationId: `obs-cases-${input.fips}`,
        sourceId: "cdc-cases",
        sourceLabel: "CDC surveillance",
        unit: "cases",
        value: input.fips === "08013" ? 4 : 7,
      }),
    ];
  }

  if (input.measureId === INVESTIGATE_CASES_MEASURE_ID) {
    const primary = observation({
      fips: input.fips,
      measureId: input.measureId,
      observationId: `obs-cases-${input.fips}`,
      sourceId: "cdc-cases",
      sourceLabel: "CDC surveillance",
      unit: "cases",
      value: input.fips === "08013" ? 40 : 12,
    });
    if (input.scenario !== "ambiguous") {
      return [primary];
    }
    return [
      primary,
      observation({
        fips: input.fips,
        limitations: ["State extract covers a shorter reporting window."],
        measureId: input.measureId,
        observationId: `obs-cases-state-${input.fips}`,
        sourceId: "state-cases",
        sourceLabel: "State health department",
        unit: "cases",
        value: 3,
      }),
    ];
  }

  if (input.measureId === INVESTIGATE_TICK_MEASURE_ID) {
    return [
      observation({
        fips: input.fips,
        limitations: [INVESTIGATE_TICK_LIMITATION],
        measureId: input.measureId,
        observationId: `obs-ticks-${input.fips}`,
        sourceId: "tick-survey",
        sourceLabel: "Tick survey",
        unit: "detections",
        value: 4,
      }),
    ];
  }

  return [
    observation({
      fips: input.fips,
      measureId: input.measureId,
      observationId: `obs-canopy-${input.fips}`,
      sourceId: "nlcd",
      sourceLabel: "National land cover",
      unit: "percent",
      value: 0,
      valueState: ValueState.UNAVAILABLE,
    }),
  ];
}
