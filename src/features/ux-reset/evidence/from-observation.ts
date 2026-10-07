import type { Observation } from "@/generated/models";
import { formatAtlasTimestamp } from "@/lib/atlas-evidence-metadata";

import { evidenceTypeFromGovernedMetadata } from "./evidence-type";
import { formatObservationPeriod } from "./format-period";
import type {
  EvidenceAvailability,
  EvidenceObjectModel,
  EvidenceProvenanceModel,
  EvidenceReasonCode,
} from "./types";
import {
  availabilityFromGovernedValueState,
  evidenceAvailabilityLabel,
  evidenceReasonLabel,
  formatGovernedEvidenceValue,
  hasGovernedMaterialLimitations,
  materialCaveatShort,
  normalizeGovernedLimitations,
  reasonCodeForEvidence,
} from "./value-state-contract";

export type ObservationEvidenceInput = {
  observation: Observation;
  claimLabel: string;
  /** Governed `Measure.measure_type` when the caller resolved catalog metadata. */
  measureType?: string | null;
  valueNote?: string | null;
};

function datasetVintageFromObservation(
  observation: Observation
): string | null {
  const sourceVintage = observation.source_vintage?.trim();
  return sourceVintage || null;
}

function governedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Publication time already on the observation. An unreadable timestamp is
 * omitted rather than replaced with a guessed date.
 */
function sourcePublishedAtFromObservation(
  observation: Observation
): string | null {
  const published = governedText(observation.source_published_at);
  if (!published) {
    return null;
  }
  const formatted = formatAtlasTimestamp(published);
  return formatted === "Unavailable" ? null : formatted;
}

/** Vintage and source publication time only. Missing metadata stays Unavailable. */
export function evidenceInspectFreshness(
  provenance: Pick<
    EvidenceProvenanceModel,
    "datasetVintage" | "sourcePublishedAt"
  >
): string {
  const parts: string[] = [];
  const vintage = provenance.datasetVintage?.trim();
  if (vintage) {
    parts.push(`Dataset vintage ${vintage}`);
  }
  const published = provenance.sourcePublishedAt?.trim();
  if (published) {
    parts.push(`Source published ${published}`);
  }
  if (parts.length === 0) {
    return "Unavailable";
  }
  return `${parts.join(". ")}.`;
}

/** Method narrative and version from the observation. Neither field is inferred. */
export function evidenceInspectMethod(
  provenance: Pick<EvidenceProvenanceModel, "methodLabel" | "methodVersion">
): string {
  const narrative = provenance.methodLabel?.trim() ?? "";
  const version = provenance.methodVersion?.trim() ?? "";
  if (narrative && version) {
    return `${narrative}. Version ${version}.`;
  }
  if (narrative) {
    return narrative;
  }
  if (version) {
    return `Version ${version}`;
  }
  return "Unavailable";
}

/** Top-level availability plus the governed reason. These stay separate labels. */
export function evidenceInspectState(
  availability: EvidenceAvailability,
  reasonCode: EvidenceReasonCode
): string {
  return `${evidenceAvailabilityLabel(availability)}. ${evidenceReasonLabel(reasonCode)}.`;
}

export function evidenceObjectFromObservation({
  claimLabel,
  measureType,
  observation,
  valueNote,
}: ObservationEvidenceInput): EvidenceObjectModel {
  const limitations = normalizeGovernedLimitations(observation.limitations);
  const hasMaterialLimitations = hasGovernedMaterialLimitations(limitations);
  const materialCaveat = materialCaveatShort(limitations);
  const availability = availabilityFromGovernedValueState({
    hasMaterialLimitations,
    valueState: observation.value_state,
  });
  const reasonCode = reasonCodeForEvidence({
    hasMaterialLimitations,
    valueState: observation.value_state,
  });

  const sourceFamily =
    observation.source_label?.trim() ||
    observation.source_id?.trim() ||
    "Unavailable";
  const observationPeriod = formatObservationPeriod(
    observation.period_start,
    observation.period_end,
    observation.temporal_grain
  );
  const datasetVintage = datasetVintageFromObservation(observation);
  const evidenceType = evidenceTypeFromGovernedMetadata(measureType);

  const inspectSummary = [
    `${sourceFamily} covering ${observationPeriod}.`,
    datasetVintage ? `Dataset vintage ${datasetVintage}.` : null,
    evidenceType === "Unavailable" ? null : `Evidence type: ${evidenceType}.`,
    materialCaveat,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    availability,
    claimLabel,
    displayValue: formatGovernedEvidenceValue({
      unit: observation.unit,
      value: observation.value,
      valueState: observation.value_state,
    }),
    provenance: {
      datasetVintage,
      evidenceType,
      inspectSummary,
      limitations,
      materialCaveat,
      methodLabel: governedText(observation.methodology),
      methodVersion: governedText(observation.methodology_version),
      observationPeriod,
      sourceFamily,
      sourcePublishedAt: sourcePublishedAtFromObservation(observation),
      sourceUrl: observation.source_url?.trim() || null,
      technical: {
        methodologyVersion: observation.methodology_version,
        observationId: observation.observation_id,
        provenanceRef: observation.provenance_ref,
        releaseId: observation.release_id,
        sourceId: observation.source_id,
      },
    },
    reasonCode,
    valueNote: valueNote ?? null,
  };
}
