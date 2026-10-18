import {
  EnvironmentalContextCoverageStatus,
  ValueState,
  type EnvironmentalContext,
  type Observation,
} from "@/generated/models";

export const ENVIRONMENTAL_RELEASE_ID =
  "governed-2026-10-15-january-climate-prod";

export const ENVIRONMENTAL_SAMPLE_DATE = "2025-01-17";

export const ENVIRONMENTAL_SAMPLE_FIPS = "48277";

export const ENVIRONMENTAL_DAY_CONVENTION =
  "Labeled 24-hour period ending in the early morning; not a midnight calendar day";

const SAMPLE_VALUES = {
  nclimgrid_prcp_county_day: {
    unit: "mm",
    value: 0,
    valueState: ValueState.ZERO,
  },
  nclimgrid_tmax_county_day: {
    unit: "degree_Celsius",
    value: "16.29939307942125",
    valueState: ValueState.OBSERVED,
  },
  nclimgrid_tmin_county_day: {
    unit: "degree_Celsius",
    value: "-1.992294192037333",
    valueState: ValueState.OBSERVED,
  },
  nclimgrid_tavg_county_day: {
    unit: "degree_Celsius",
    value: "7.153611977327104",
    valueState: ValueState.OBSERVED,
  },
} as const;

export function environmentalContextFixture(
  status: EnvironmentalContext["coverage_status"] = EnvironmentalContextCoverageStatus.COMPLETE
): EnvironmentalContext {
  return {
    coverage_status: status,
    day_convention: ENVIRONMENTAL_DAY_CONVENTION,
    expected_area_m2: "2416725434.189871",
    geometry_version: "atlas-county-analysis-geometry/1",
    intersected_area_m2: "2416725434.189877",
    metadata_revision_id: "metadata-revision:v1:test",
    source_coverage_fraction: "1.0",
    source_supported_area_m2: "2416725434.189877",
    source_time_present: true,
    upstream_date_modified: "2025-04-04 22:45:24.335274",
    valid_area_m2: "2416725434.189877",
    valid_fraction_of_supported_area: 1,
    weight_version: "atlas-grid-county-area-weight/1",
  };
}

export function environmentalObservation(input: {
  coverage?: EnvironmentalContext["coverage_status"] | null;
  date?: string;
  fips?: string;
  measureId: keyof typeof SAMPLE_VALUES;
  releaseId?: string;
  value?: Observation["value"];
  valueState?: ValueState;
}): Observation {
  const sample = SAMPLE_VALUES[input.measureId];
  const date = input.date ?? ENVIRONMENTAL_SAMPLE_DATE;
  const fips = input.fips ?? ENVIRONMENTAL_SAMPLE_FIPS;
  const value = input.value === undefined ? sample.value : input.value;
  const valueState = input.valueState ?? sample.valueState;
  const coverage =
    input.coverage === undefined
      ? EnvironmentalContextCoverageStatus.COMPLETE
      : input.coverage;
  return {
    atlas_acquired_at: "2026-10-15T11:09:37.794000-07:00",
    atlas_processed_at: null,
    dataset_id: "nclimgrid-daily-v1.0.0-scaled",
    denominator: null,
    environmental_context:
      coverage === null ? null : environmentalContextFixture(coverage),
    evidence: {
      methodology_version: "atlas-nclimgrid-county-day/2",
      provenance_ref: `environmental-observation:${input.measureId}-${fips}`,
      release_id: input.releaseId ?? ENVIRONMENTAL_RELEASE_ID,
      resource_id: `environmental-observation:${input.measureId}-${fips}`,
      resource_type: "observation",
      semantic_version: "2.0.0",
      source_id: "noaa_nclimgrid_daily_202501",
      uri: null,
    },
    geography: { geography_id: fips, geography_type: "county" },
    limitations: [
      "January 2025 descriptive weather context only; no Lyme causal, risk or ML claim.",
    ],
    lineage_source_id: "noaa_nclimgrid_daily",
    measure_id: input.measureId,
    methodology:
      "Valid-area-weighted retained NOAA grid over TIGER 2025 analysis counties.",
    methodology_id: null,
    methodology_version: "atlas-nclimgrid-county-day/2",
    observation_id: `environmental-observation:${input.measureId}-${fips}-${date}`,
    period_end: date,
    period_start: date,
    provenance_ref: `environmental-observation:${input.measureId}-${fips}`,
    release_id: input.releaseId ?? ENVIRONMENTAL_RELEASE_ID,
    release_methodology_version: null,
    semantic_version: "2.0.0",
    source_id: "noaa_nclimgrid_daily_202501",
    source_label: "NOAA NCEI",
    source_published_at: null,
    source_url: null,
    source_vintage: "v1.0.0-scaled-202501",
    temporal_grain: "DAY",
    unit: sample.unit,
    value,
    value_state: valueState,
  };
}

export function environmentalEnvelope(rows: readonly Observation[]) {
  return {
    data: rows,
    links: { self: "/v1/observations" },
    meta: { next_page_token: null },
  };
}
