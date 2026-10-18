import {
  CountyContextObservationTemporalGrain,
  CountyContextValueType,
  ValueState,
  type CountyContextObservation,
} from "@/generated/models";

export const POPULATION_RURALITY_RELEASE_ID = "alpha-2026";

export const POPULATION_RURALITY_SAMPLE_FIPS = "08001";

const SHARED_LIMITATION =
  "Contextual source measure; not a causal driver or individual risk measure.";

type MeasureSample = {
  categoryLabel: string | null;
  definition: string;
  denominator: string;
  limitation: string;
  measureId: CountyContextObservation["measure_id"];
  periodEnd: string | null;
  periodStart: string | null;
  sourceField: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  temporalGrain: CountyContextObservation["temporal_grain"];
  unit: string;
  value: CountyContextObservation["value"];
  valueState: ValueState;
  valueType: (typeof CountyContextValueType)[keyof typeof CountyContextValueType];
  vintageYear: number;
};

const SAMPLES = {
  population_2022: {
    categoryLabel: null,
    definition:
      "County total population estimate reported in E_TOTPOP for the 2022 SVI product's 2018-2022 ACS period.",
    denominator: "NONE",
    limitation:
      "An estimate of county population, not an uninsured count or a direct measure of Lyme disease risk.",
    measureId: "population_2022",
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "E_TOTPOP",
    sourceId: "context_svi",
    sourceLabel: "CDC/ATSDR Social Vulnerability Index 2022 (2018-2022 ACS)",
    sourceUrl:
      "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "people",
    value: 520_149,
    valueState: ValueState.OBSERVED,
    valueType: CountyContextValueType.integer,
    vintageYear: 2022,
  },
  rucc_2023: {
    categoryLabel: "Metro: area population at least 1 million",
    definition:
      "USDA ERS 2023 Rural-Urban Continuum Code category from the RUCC_2023 source attribute for a county.",
    denominator: "NONE",
    limitation:
      "Codes 1-9 are vintage-specific categories, not ordered distances, annual observations, causal drivers, or individual risk.",
    measureId: "rucc_2023",
    periodEnd: null,
    periodStart: null,
    sourceField: "RUCC_2023",
    sourceId: "context_rucc",
    sourceLabel: "USDA ERS Rural-Urban Continuum Codes",
    sourceUrl:
      "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
    temporalGrain: CountyContextObservationTemporalGrain.VINTAGE_YEAR,
    unit: "code",
    value: 1,
    valueState: ValueState.OBSERVED,
    valueType: CountyContextValueType.integer,
    vintageYear: 2023,
  },
  svi_percentile_2022: {
    categoryLabel: null,
    definition:
      "Overall county Social Vulnerability Index percentile reported in RPL_THEMES for the 2022 SVI product.",
    denominator: "NONE",
    limitation:
      "National county percentile rank for this product and vintage; not a percentage of people, causal driver, or individual risk.",
    measureId: "svi_percentile_2022",
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "RPL_THEMES",
    sourceId: "context_svi",
    sourceLabel: "CDC/ATSDR Social Vulnerability Index 2022 (2018-2022 ACS)",
    sourceUrl:
      "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percentile",
    value: "0.7264",
    valueState: ValueState.OBSERVED,
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
  uninsured_percent_2022: {
    categoryLabel: null,
    definition:
      "County percentage of the civilian noninstitutionalized population that is uninsured, reported in EP_UNINSUR for the 2022 SVI product.",
    denominator: "civilian_noninstitutionalized_population",
    limitation:
      "The denominator is the civilian noninstitutionalized population, not E_TOTPOP; this percentage does not establish individual risk.",
    measureId: "uninsured_percent_2022",
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "EP_UNINSUR",
    sourceId: "context_svi",
    sourceLabel: "CDC/ATSDR Social Vulnerability Index 2022 (2018-2022 ACS)",
    sourceUrl:
      "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percent",
    value: "10.8",
    valueState: ValueState.OBSERVED,
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
  uninsured_percentile_2022: {
    categoryLabel: null,
    definition:
      "County percentile rank of the uninsured percentage reported in EPL_UNINSUR for the 2022 SVI product.",
    denominator: "NONE",
    limitation:
      "National county percentile rank of EP_UNINSUR; not an uninsured population percentage or individual risk.",
    measureId: "uninsured_percentile_2022",
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "EPL_UNINSUR",
    sourceId: "context_svi",
    sourceLabel: "CDC/ATSDR Social Vulnerability Index 2022 (2018-2022 ACS)",
    sourceUrl:
      "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percentile",
    value: "0.6742",
    valueState: ValueState.OBSERVED,
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
} as const satisfies Record<string, MeasureSample>;

export type PopulationRuralityFixtureMeasureId = keyof typeof SAMPLES;

export function populationRuralityObservation(input: {
  categoryLabel?: string | null;
  fips?: string;
  measureId: PopulationRuralityFixtureMeasureId;
  releaseId?: string;
  value?: CountyContextObservation["value"];
  valueState?: ValueState;
}): CountyContextObservation {
  const sample = SAMPLES[input.measureId];
  const fips = input.fips ?? POPULATION_RURALITY_SAMPLE_FIPS;
  const releaseId = input.releaseId ?? POPULATION_RURALITY_RELEASE_ID;
  const value = input.value === undefined ? sample.value : input.value;
  const valueState = input.valueState ?? sample.valueState;
  const categoryLabel =
    input.categoryLabel === undefined
      ? sample.categoryLabel
      : input.categoryLabel;
  return {
    atlas_acquired_at: "2026-09-17T21:15:53-07:00",
    atlas_processed_at: null,
    county_context: {
      allowed_value_states:
        sample.measureId === "rucc_2023"
          ? [ValueState.OBSERVED]
          : [ValueState.OBSERVED, ValueState.ZERO, ValueState.MISSING],
      category_label: categoryLabel,
      contract_version: "atlas-county-context-consumer/1",
      definition: sample.definition,
      metadata_methodology_version: "semantic-1.0.0",
      source_field: sample.sourceField,
      value_type: sample.valueType,
      vintage_year: sample.vintageYear,
    },
    dataset_id: "county-context",
    denominator: sample.denominator,
    environmental_context: null,
    evidence: {
      methodology_version: "svi_numeric_projection_v2",
      provenance_ref: `county-context:${input.measureId}-${fips}`,
      release_id: releaseId,
      resource_id: `county-context:${input.measureId}-${fips}`,
      resource_type: "observation",
      semantic_version: "1.0.0",
      source_id: sample.sourceId,
      uri: null,
    },
    geography: { geography_id: fips, geography_type: "county" },
    limitations: [sample.limitation, SHARED_LIMITATION],
    lineage_source_id: sample.sourceId,
    measure_id: sample.measureId,
    methodology: sample.definition,
    methodology_id: null,
    methodology_version:
      sample.measureId === "rucc_2023"
        ? "semantic_county_assembly_v1"
        : "svi_numeric_projection_v2",
    observation_id: `county-context:${input.measureId}-${fips}`,
    period_end: sample.periodEnd,
    period_start: sample.periodStart,
    provenance_ref: `county-context:${input.measureId}-${fips}`,
    release_id: releaseId,
    release_methodology_version: null,
    semantic_version: sample.measureId === "rucc_2023" ? "2.0.0" : "1.0.0",
    source_id: sample.sourceId,
    source_label: sample.sourceLabel,
    source_published_at: null,
    source_url: sample.sourceUrl,
    source_vintage:
      sample.vintageYear === 2023 ? "2023" : "2022 (2018-2022 ACS)",
    surveillance_context: null,
    temporal_grain: sample.temporalGrain,
    unit: sample.unit,
    value,
    value_state: valueState,
  };
}

export function populationRuralityEnvelope(
  rows: readonly CountyContextObservation[]
) {
  return {
    data: rows,
    links: { self: "/v1/observations" },
    meta: { next_page_token: null },
  };
}
