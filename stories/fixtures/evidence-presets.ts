import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import {
  releaseEvidenceLoadStateValues,
  type EvidenceObjectModel,
  type EvidenceProvenanceModel,
  type ReleaseEvidenceContextModel,
  type ReleaseEvidenceLoadState,
} from "@/features/ux-reset/evidence/types";
import type { Observation } from "@/generated/models";

import {
  exactDecimalStringObservation,
  missingNumericObservation,
  noaaDailyPrecipitationObservation,
  noaaDailyPrecipitationWithoutVintage,
  publishedZeroObservation,
  suppressedNumericObservation,
} from "../../tests/fixtures/ux-reset-evidence-observations";
import { syntheticReleaseId } from "./synthetic-county";

const syntheticVintage = "v1.0.0-scaled-202501";
const syntheticSourceUrl = "https://example.com/synthetic-precipitation-source";
const syntheticConfiguration = "ab".repeat(32);

function storyObservation(observation: Observation): Observation {
  return { ...observation, release_id: syntheticReleaseId };
}

export const evidenceObjectPresetIds = [
  "observed-nonzero",
  "published-zero",
  "suppressed",
  "missing",
  "precise-caveat",
] as const;

export type EvidenceObjectPresetId = (typeof evidenceObjectPresetIds)[number];

const observedNonzero = evidenceObjectFromObservation({
  claimLabel: "Synthetic daily precipitation",
  measureType: "continuous",
  observation: storyObservation({
    ...noaaDailyPrecipitationWithoutVintage,
    source_vintage: syntheticVintage,
  }),
});

const publishedZero = evidenceObjectFromObservation({
  claimLabel: "Synthetic published zero",
  measureType: "continuous",
  observation: storyObservation(publishedZeroObservation),
});

const suppressed = evidenceObjectFromObservation({
  claimLabel: "Synthetic suppressed cell",
  measureType: "count",
  observation: storyObservation(suppressedNumericObservation),
});

const missing = evidenceObjectFromObservation({
  claimLabel: "Synthetic missing record",
  measureType: "count",
  observation: storyObservation(missingNumericObservation),
});

const preciseCaveat = evidenceObjectFromObservation({
  claimLabel: "Synthetic precise value",
  measureType: "continuous",
  observation: storyObservation(exactDecimalStringObservation),
  valueNote:
    "Synthetic example. Full published precision is kept for this small value.",
});

const evidenceObjectPresets = {
  missing,
  "observed-nonzero": observedNonzero,
  "precise-caveat": preciseCaveat,
  "published-zero": publishedZero,
  suppressed,
} as const satisfies Record<EvidenceObjectPresetId, EvidenceObjectModel>;

export function evidenceObjectPreset(
  preset: EvidenceObjectPresetId
): EvidenceObjectModel {
  switch (preset) {
    case "observed-nonzero":
    case "published-zero":
    case "suppressed":
    case "missing":
    case "precise-caveat": {
      return evidenceObjectPresets[preset];
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export const evidenceStripPresetIds = [
  "available-with-vintage",
  "available-without-optional",
  "limited-with-caveat",
  "unavailable-without-optional",
] as const;

export type EvidenceStripPresetId = (typeof evidenceStripPresetIds)[number];

export function evidenceStripPreset(
  preset: EvidenceStripPresetId
): EvidenceObjectModel {
  switch (preset) {
    case "available-with-vintage": {
      return observedNonzero;
    }
    case "available-without-optional": {
      return publishedZero;
    }
    case "limited-with-caveat": {
      return suppressed;
    }
    case "unavailable-without-optional": {
      return missing;
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export const releaseEvidencePresetIds = [
  "ready-complete",
  "ready-limited",
  "loading",
  "error-default",
  "error-synthetic",
  "ready-without-context",
] as const;

export type ReleaseEvidencePresetId = (typeof releaseEvidencePresetIds)[number];

const completeReleaseContext = {
  availability: "available",
  evidenceScope: "Adams County, Colorado (08001). Synthetic scope.",
  limitation:
    "Synthetic limitation. This fixture is not a live release and does not assess freshness.",
  methodologyLabel: "Synthetic methodology 1.0.0",
  releaseSummary: "Synthetic release alpha-2026",
  sourcePeriods: "2023",
} as const satisfies ReleaseEvidenceContextModel;

const limitedReleaseContext = {
  availability: "limited",
  evidenceScope: "Adams County, Colorado (08001). Synthetic scope.",
  methodologyLabel: "Synthetic methodology 1.0.0",
  releaseSummary: "Synthetic release alpha-2026",
  sourcePeriods: "2023",
} as const satisfies ReleaseEvidenceContextModel;

export type ReleaseEvidenceStoryModel = {
  context: ReleaseEvidenceContextModel | null;
  errorMessage: string | null;
  loadState: ReleaseEvidenceLoadState;
};

export function releaseEvidencePreset(
  preset: ReleaseEvidencePresetId
): ReleaseEvidenceStoryModel {
  switch (preset) {
    case "ready-complete": {
      return {
        context: completeReleaseContext,
        errorMessage: null,
        loadState: releaseEvidenceLoadStateValues.ready,
      };
    }
    case "ready-limited": {
      return {
        context: limitedReleaseContext,
        errorMessage: null,
        loadState: releaseEvidenceLoadStateValues.ready,
      };
    }
    case "loading": {
      return {
        context: completeReleaseContext,
        errorMessage: "Synthetic release request failed.",
        loadState: releaseEvidenceLoadStateValues.loading,
      };
    }
    case "error-default": {
      return {
        context: completeReleaseContext,
        errorMessage: null,
        loadState: releaseEvidenceLoadStateValues.error,
      };
    }
    case "error-synthetic": {
      return {
        context: completeReleaseContext,
        errorMessage:
          "Synthetic release request failed. This is not an evidence state.",
        loadState: releaseEvidenceLoadStateValues.error,
      };
    }
    case "ready-without-context": {
      return {
        context: null,
        errorMessage: null,
        loadState: releaseEvidenceLoadStateValues.ready,
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export const provenancePresetIds = [
  "full-reason",
  "state-label-missing",
  "technical-unreadable",
] as const;

export type ProvenancePresetId = (typeof provenancePresetIds)[number];

type ReasonProvenanceProps = {
  availability: EvidenceObjectModel["availability"];
  provenance: EvidenceProvenanceModel;
  reasonCode: NonNullable<EvidenceObjectModel["reasonCode"]>;
  stateLabel?: undefined;
};

type StateLabelProvenanceProps = {
  availability?: undefined;
  provenance: EvidenceProvenanceModel;
  reasonCode?: undefined;
  stateLabel: string;
};

export type ProvenanceStoryProps =
  | ReasonProvenanceProps
  | StateLabelProvenanceProps;

function withTechnical(
  model: EvidenceObjectModel,
  technical: EvidenceProvenanceModel["technical"]
): EvidenceProvenanceModel {
  return {
    ...model.provenance,
    referenceLines: [
      "Synthetic reference A for obs-noaa-daily-2025-01-01.",
      "Synthetic reference B for prov/noaa/daily/2025-01-01.",
    ],
    sourceUrl: syntheticSourceUrl,
    technical,
  };
}

export function provenancePreset(
  preset: ProvenancePresetId
): ProvenanceStoryProps {
  switch (preset) {
    case "full-reason": {
      const model = evidenceObjectFromObservation({
        claimLabel: "Synthetic precipitation with limitations",
        measureType: "continuous",
        observation: storyObservation(noaaDailyPrecipitationObservation),
      });
      if (!model.reasonCode) {
        throw new Error("Precipitation fixture did not produce a reason code.");
      }
      return {
        availability: model.availability,
        provenance: withTechnical(model, {
          ...model.provenance.technical,
          configurationSha256: syntheticConfiguration,
          evaluatedAt: "Jan 15, 2026, 12:00 AM UTC",
          evaluatedAtRaw: "2026-01-15T00:00:00Z",
        }),
        reasonCode: model.reasonCode,
      };
    }
    case "state-label-missing": {
      return {
        provenance: {
          datasetVintage: null,
          evidenceType: missing.provenance.evidenceType,
          inspectSummary:
            "Synthetic missing record. Optional provenance was not returned.",
          limitations: [],
          materialCaveat: null,
          methodLabel: null,
          methodVersion: null,
          observationPeriod: missing.provenance.observationPeriod,
          sourceFamily: missing.provenance.sourceFamily,
          sourcePublishedAt: null,
          sourceUrl: null,
          technical: null,
        },
        stateLabel: "Unavailable",
      };
    }
    case "technical-unreadable": {
      if (!observedNonzero.reasonCode) {
        throw new Error("Observed fixture did not produce a reason code.");
      }
      return {
        availability: observedNonzero.availability,
        provenance: withTechnical(observedNonzero, {
          configurationSha256: "not-a-digest",
          evaluatedAt: "not-a-timestamp",
          evaluatedAtRaw: "2026-01-15",
          methodologyVersion: "1.0.0",
          observationId: "obs-synthetic-unreadable-08001",
          provenanceRef: "prov/synthetic/unreadable/08001",
          releaseId: syntheticReleaseId,
        }),
        reasonCode: observedNonzero.reasonCode,
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
