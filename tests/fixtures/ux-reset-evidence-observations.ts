import type { Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";

/** Daily NOAA-style observation (2025-01-01) with dataset vintage separate from period. */
export const noaaDailyPrecipitationObservation: Observation = {
  atlas_acquired_at: "2025-01-02T00:00:00Z",
  atlas_processed_at: "2025-01-02T01:00:00Z",
  dataset_id: "noaa-daily-precip",
  denominator: null,
  evidence: {
    provenance_ref: "prov/noaa/daily/2025-01-01",
    resource_id: "noaa-daily-precip",
    resource_type: "dataset",
  },
  geography: { geography_id: "36061", geography_type: "county" },
  limitations: [
    "Historical availability varies before 1981 for this station composite.",
    "Day boundaries follow UTC for this daily extract.",
  ],
  lineage_source_id: "noaa-lineage",
  measure_id: "precipitation-mm",
  methodology: null,
  methodology_id: "noaa-daily-v1",
  methodology_version: "1.0.0",
  observation_id: "obs-noaa-daily-2025-01-01",
  period_end: "2025-01-01",
  period_start: "2025-01-01",
  provenance_ref: "prov/noaa/daily/2025-01-01",
  release_id: "governed-2026-01-01",
  release_methodology_version: null,
  semantic_version: "2025.1",
  source_id: "noaa",
  source_label: "NOAA daily precipitation",
  source_published_at: null,
  source_url: "https://www.ncei.noaa.gov/",
  source_vintage: "v1.0.0-scaled-202501",
  strata: undefined,
  temporal_grain: "daily",
  unit: "mm",
  value: 0.0001,
  value_state: ValueState.OBSERVED,
};

export const noaaDailyPrecipitationWithoutVintage: Observation = {
  ...noaaDailyPrecipitationObservation,
  limitations: [],
  source_vintage: null,
  value_state: ValueState.OBSERVED,
};

export const exactDecimalStringObservation: Observation = {
  ...noaaDailyPrecipitationObservation,
  limitations: [],
  source_vintage: null,
  temporal_grain: "daily",
  value: "0.123456789012345678901234567890",
  value_state: ValueState.OBSERVED,
};

export const publishedZeroObservation: Observation = {
  ...noaaDailyPrecipitationObservation,
  limitations: [],
  period_end: "2025-01-01",
  period_start: "2025-01-01",
  source_vintage: null,
  value: 0,
  value_state: ValueState.ZERO,
};
