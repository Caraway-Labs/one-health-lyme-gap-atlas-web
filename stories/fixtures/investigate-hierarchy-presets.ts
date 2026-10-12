import {
  buildCountyEvidenceBundle,
  identityFromPublishedCounty,
  investigateBundleWithoutObservations,
  type CountyEvidenceBundle,
} from "@/features/ux-reset/investigate/county-evidence";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import {
  EnvironmentalContextCoverageStatus,
  ValueState,
  type Measure,
  type Observation,
} from "@/generated/models";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_CONTEXT_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../../tests/fixtures/investigate-api-fixtures";
import { syntheticCounty } from "./synthetic-county";

export const hierarchyPresetIds = [
  "representative",
  "zero-suppression",
  "coverage-limitation",
  "same-period-conflict",
  "partial-failure",
  "partial-failure-retrying",
  "county-pending",
  "county-error",
  "catalog-failure",
  "refresh-failure",
  "with-model",
] as const;

export type HierarchyPresetId = (typeof hierarchyPresetIds)[number];

export type HierarchyStoryModel = {
  bundle: CountyEvidenceBundle;
  catalogFailed: boolean;
  countyRecord: PublishedCountyRecord | null;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  countyRecordRefreshError: string | null;
  measures: readonly Measure[];
  showModel: boolean;
  showRetry: boolean;
  retrying: boolean;
};

const measures = investigateMeasuresFixture as Measure[];

const publishedRecord: PublishedCountyRecord = {
  burgdorferiStatus: "Reported",
  evidenceCompleteness: 50,
  fips: syntheticCounty.fips,
  methodologyVersion: "1.0.0",
  pacificusStatus: "No records",
  population: 100_000,
  releaseId: INVESTIGATE_RELEASE_ID,
  releaseLimitation:
    "Synthetic published record. Not a diagnosis or an individual risk estimate.",
  rucc: 1,
  scapularisStatus: "Established",
  sources: [
    {
      key: "tick",
      label: "Synthetic tick status",
      note: "No records is not absence.",
      url: "https://example.com/synthetic-tick-status",
      vintage: "2025",
    },
  ],
  stateUnallocatedRecords: null,
  sviPercentile: null,
  tickStatus: "Established",
  uninsuredPercent: null,
};

function countyIdentity() {
  const identity = identityFromPublishedCounty({
    county: syntheticCounty.name,
    fips: syntheticCounty.fips,
    state: syntheticCounty.stateCode,
  });
  if (!identity) {
    throw new Error("Synthetic county identity is not a county FIPS.");
  }
  return identity;
}

function requireObservation(
  measureId: string,
  scenario: "mixed" | "sparse" = "sparse"
): Observation {
  const [observation] = investigateObservationsFor({
    fips: syntheticCounty.fips,
    measureId,
    scenario,
  });
  if (!observation) {
    throw new Error(
      `Missing ${measureId} fixture for ${syntheticCounty.fips}.`
    );
  }
  return observation;
}

function bundleFrom(
  outcomes: Parameters<typeof buildCountyEvidenceBundle>[0]["outcomes"]
): CountyEvidenceBundle {
  return buildCountyEvidenceBundle({
    domainsRequestFailed: false,
    identity: countyIdentity(),
    indicatorDomains: indicatorDomainsById(
      investigateIndicatorsFixture,
      INVESTIGATE_RELEASE_ID
    ),
    measures,
    outcomes,
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

function readyOutcomes(
  observationsFor: (measureId: string) => readonly Observation[]
): Parameters<typeof buildCountyEvidenceBundle>[0]["outcomes"] {
  return measures.map((measure) => ({
    measureId: measure.measure_id,
    observations: observationsFor(measure.measure_id),
    status: "ready" as const,
  }));
}

function representativeBundle(): CountyEvidenceBundle {
  return bundleFrom(
    readyOutcomes((measureId) =>
      investigateObservationsFor({
        fips: syntheticCounty.fips,
        measureId,
        scenario: "mixed",
      })
    )
  );
}

function zeroSuppressionBundle(): CountyEvidenceBundle {
  const cases = requireObservation(INVESTIGATE_CASES_MEASURE_ID);
  const ticks = requireObservation(INVESTIGATE_TICK_MEASURE_ID, "mixed");
  return bundleFrom(
    readyOutcomes((measureId) => {
      if (measureId === INVESTIGATE_CASES_MEASURE_ID) {
        return [
          {
            ...cases,
            limitations: [],
            observation_id: "obs-cases-zero-08001",
            value: 0,
            value_state: ValueState.ZERO,
          },
        ];
      }
      if (measureId === INVESTIGATE_TICK_MEASURE_ID) {
        return [
          {
            ...ticks,
            limitations: ["Publisher suppressed this cell for privacy."],
            observation_id: "obs-ticks-suppressed-08001",
            value: 4,
            value_state: ValueState.SUPPRESSED,
          },
        ];
      }
      return [];
    })
  );
}

function coverageBundle(): CountyEvidenceBundle {
  const canopy = requireObservation(INVESTIGATE_CONTEXT_MEASURE_ID, "mixed");
  return bundleFrom(
    readyOutcomes((measureId) => {
      if (measureId !== INVESTIGATE_CONTEXT_MEASURE_ID) {
        return measureId === INVESTIGATE_CASES_MEASURE_ID
          ? [requireObservation(INVESTIGATE_CASES_MEASURE_ID)]
          : [];
      }
      return [
        {
          ...canopy,
          environmental_context: {
            coverage_status:
              EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
            day_convention: "labeled-24h",
            expected_area_m2: null,
            geometry_version: "synthetic-geometry-1",
            intersected_area_m2: null,
            metadata_revision_id: "synthetic-metadata-1",
            source_coverage_fraction: "0.42",
            source_supported_area_m2: null,
            source_time_present: true,
            upstream_date_modified: null,
            valid_area_m2: null,
            valid_fraction_of_supported_area: null,
            weight_version: "synthetic-weight-1",
          },
          observation_id: "obs-canopy-partial-08001",
        },
      ];
    })
  );
}

function conflictBundle(): CountyEvidenceBundle {
  const cases = requireObservation(INVESTIGATE_CASES_MEASURE_ID);
  return bundleFrom(
    readyOutcomes((measureId) => {
      if (measureId !== INVESTIGATE_CASES_MEASURE_ID) {
        return [];
      }
      return [
        {
          ...cases,
          limitations: [],
          observation_id: "obs-cases-conflict-a-08001",
          value: 4,
        },
        {
          ...cases,
          limitations: [],
          observation_id: "obs-cases-conflict-b-08001",
          value: 9,
        },
      ];
    })
  );
}

function partialFailureBundle(): CountyEvidenceBundle {
  const cases = requireObservation(INVESTIGATE_CASES_MEASURE_ID);
  return bundleFrom(
    measures.map((measure) => {
      if (measure.measure_id === INVESTIGATE_TICK_MEASURE_ID) {
        return {
          measureId: measure.measure_id,
          message: "Synthetic measure request failed.",
          retryAtMs: null,
          status: "failed" as const,
        };
      }
      return {
        measureId: measure.measure_id,
        observations:
          measure.measure_id === INVESTIGATE_CASES_MEASURE_ID ? [cases] : [],
        status: "ready" as const,
      };
    })
  );
}

function base(
  input: Partial<HierarchyStoryModel> & Pick<HierarchyStoryModel, "bundle">
): HierarchyStoryModel {
  return {
    catalogFailed: false,
    countyRecord: null,
    countyRecordError: null,
    countyRecordLoading: false,
    countyRecordRefreshError: null,
    measures,
    showModel: false,
    showRetry: false,
    retrying: false,
    ...input,
  };
}

export function hierarchyPreset(
  preset: HierarchyPresetId
): HierarchyStoryModel {
  switch (preset) {
    case "representative": {
      return base({
        bundle: representativeBundle(),
        countyRecord: publishedRecord,
      });
    }
    case "zero-suppression": {
      return base({ bundle: zeroSuppressionBundle() });
    }
    case "coverage-limitation": {
      return base({ bundle: coverageBundle() });
    }
    case "same-period-conflict": {
      return base({ bundle: conflictBundle() });
    }
    case "partial-failure": {
      return base({ bundle: partialFailureBundle(), showRetry: true });
    }
    case "partial-failure-retrying": {
      return base({
        bundle: partialFailureBundle(),
        retrying: true,
        showRetry: true,
      });
    }
    case "county-pending": {
      return base({
        bundle: representativeBundle(),
        countyRecordLoading: true,
      });
    }
    case "county-error": {
      return base({
        bundle: representativeBundle(),
        countyRecordError:
          "Synthetic published county record could not be loaded. This is a request failure, not zero evidence.",
      });
    }
    case "catalog-failure": {
      return base({
        bundle: investigateBundleWithoutObservations({
          county: countyIdentity(),
          releaseId: INVESTIGATE_RELEASE_ID,
        }),
        catalogFailed: true,
      });
    }
    case "refresh-failure": {
      return base({
        bundle: representativeBundle(),
        countyRecord: publishedRecord,
        countyRecordRefreshError:
          "Synthetic refresh failed after the county record had loaded. Loaded evidence stays visible.",
      });
    }
    case "with-model": {
      return base({
        bundle: representativeBundle(),
        countyRecord: publishedRecord,
        showModel: true,
      });
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
