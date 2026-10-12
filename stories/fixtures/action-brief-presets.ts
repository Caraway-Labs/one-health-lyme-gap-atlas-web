import {
  buildCountyEvidenceBundle,
  identityFromPublishedCounty,
  type CountyEvidenceBundle,
} from "@/features/ux-reset/investigate/county-evidence";
import type { InvestigateQueryOutcome } from "@/features/ux-reset/investigate/investigate-request-state";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { InvestigateRecovery } from "@/features/ux-reset/investigate/use-investigate-workspace";
import type { Measure } from "@/generated/models";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../../tests/fixtures/investigate-api-fixtures";
import {
  isLower48OrDcFips,
  syntheticCounty,
  syntheticReleaseId,
} from "./synthetic-county";

export const actionBriefPresetIds = [
  "ready",
  "governed-limitation",
  "blocked-catalog",
  "blocked-failed",
  "blocked-absent",
  "blocked-not-loaded",
  "recovery",
  "over-limit",
] as const;

export type ActionBriefPresetId = (typeof actionBriefPresetIds)[number];

export const SYNTHETIC_LOCAL_NOTE =
  "Synthetic local note for the Adams County preview. Atlas does not save this note.";

export const SYNTHETIC_RELEASE_LIMITATION =
  "Synthetic release limitation for Adams County. This sentence is governed evidence in the brief.";

const OVER_LIMIT_UNIT = "Synthetic local note. ";

export const syntheticLocalNoteOverLimit = `${OVER_LIMIT_UNIT.repeat(46)}over-limit`;

export type ActionBriefStoryModel = {
  catalogFailed: boolean;
  countyRecord: PublishedCountyRecord | null;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  localContext: string;
  measures: readonly Measure[];
  observationOutcome: InvestigateQueryOutcome;
  period: string | null;
  realBundle: CountyEvidenceBundle | null;
  recovery: InvestigateRecovery | null;
  showsReset: boolean;
};

const casesMeasure = investigateMeasuresFixture.find(
  (measure) => measure.measure_id === INVESTIGATE_CASES_MEASURE_ID
);

function casesBundle(): CountyEvidenceBundle {
  if (!isLower48OrDcFips(syntheticCounty.fips)) {
    throw new Error(
      "Action brief fixtures must stay in the lower 48 and the District of Columbia."
    );
  }
  const identity = identityFromPublishedCounty({
    county: syntheticCounty.name,
    fips: syntheticCounty.fips,
    state: syntheticCounty.stateCode,
  });
  if (!(identity && casesMeasure)) {
    throw new Error("Synthetic Adams County case bundle is incomplete.");
  }
  const [observation] = investigateObservationsFor({
    fips: syntheticCounty.fips,
    measureId: INVESTIGATE_CASES_MEASURE_ID,
    scenario: "mixed",
  });
  if (!observation || observation.release_id !== syntheticReleaseId) {
    throw new Error("Synthetic case observation is not on release alpha-2026.");
  }
  return buildCountyEvidenceBundle({
    domainsRequestFailed: false,
    identity,
    indicatorDomains: indicatorDomainsById(
      investigateIndicatorsFixture,
      syntheticReleaseId
    ),
    measures: [casesMeasure as Measure],
    outcomes: [
      {
        measureId: INVESTIGATE_CASES_MEASURE_ID,
        observations: [observation],
        status: "ready",
      },
    ],
    releaseId: syntheticReleaseId,
  });
}

function governedCountyRecord(
  releaseLimitation: string
): PublishedCountyRecord {
  return {
    burgdorferiStatus: "",
    evidenceCompleteness: 0,
    fips: syntheticCounty.fips,
    methodologyVersion: "1.0.0",
    pacificusStatus: null,
    population: null,
    releaseId: syntheticReleaseId,
    releaseLimitation,
    rucc: null,
    scapularisStatus: null,
    sources: [],
    stateUnallocatedRecords: null,
    sviPercentile: null,
    tickStatus: "",
    uninsuredPercent: null,
  };
}

function readyModel(input: {
  countyRecord: PublishedCountyRecord | null;
  localContext: string;
}): ActionBriefStoryModel {
  return {
    catalogFailed: false,
    countyRecord: input.countyRecord,
    countyRecordError: null,
    countyRecordLoading: false,
    localContext: input.localContext,
    measures: casesMeasure ? [casesMeasure as Measure] : [],
    observationOutcome: "loaded",
    period: "2023",
    realBundle: casesBundle(),
    recovery: null,
    showsReset: true,
  };
}

function blockedModel(input: {
  bundle: CountyEvidenceBundle | null;
  catalogFailed: boolean;
  observationOutcome: InvestigateQueryOutcome;
  recovery: InvestigateRecovery | null;
}): ActionBriefStoryModel {
  return {
    catalogFailed: input.catalogFailed,
    countyRecord: null,
    countyRecordError: null,
    countyRecordLoading: false,
    localContext: "",
    measures: [],
    observationOutcome: input.observationOutcome,
    period: "2023",
    realBundle: input.bundle,
    recovery: input.recovery,
    showsReset: false,
  };
}

export function actionBriefPreset(
  id: ActionBriefPresetId
): ActionBriefStoryModel {
  switch (id) {
    case "ready": {
      return readyModel({
        countyRecord: null,
        localContext: SYNTHETIC_LOCAL_NOTE,
      });
    }
    case "governed-limitation": {
      return readyModel({
        countyRecord: governedCountyRecord(SYNTHETIC_RELEASE_LIMITATION),
        localContext: SYNTHETIC_LOCAL_NOTE,
      });
    }
    case "over-limit": {
      if (syntheticLocalNoteOverLimit.length <= 1000) {
        throw new Error(
          "The over-limit local note must exceed 1,000 characters."
        );
      }
      return readyModel({
        countyRecord: null,
        localContext: syntheticLocalNoteOverLimit,
      });
    }
    case "blocked-catalog": {
      return blockedModel({
        bundle: casesBundle(),
        catalogFailed: true,
        observationOutcome: "loaded",
        recovery: null,
      });
    }
    case "blocked-failed": {
      return blockedModel({
        bundle: null,
        catalogFailed: false,
        observationOutcome: "failed-first-load",
        recovery: null,
      });
    }
    case "blocked-absent": {
      return blockedModel({
        bundle: null,
        catalogFailed: false,
        observationOutcome: "settled-absent",
        recovery: null,
      });
    }
    case "blocked-not-loaded": {
      return blockedModel({
        bundle: null,
        catalogFailed: false,
        observationOutcome: "never-loaded",
        recovery: null,
      });
    }
    case "recovery": {
      return blockedModel({
        bundle: casesBundle(),
        catalogFailed: false,
        observationOutcome: "loaded",
        recovery: "missing",
      });
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}
