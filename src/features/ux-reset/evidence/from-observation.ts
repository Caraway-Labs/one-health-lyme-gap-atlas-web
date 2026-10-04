import type { Observation } from "@/generated/models";

import { evidenceTypeFromGovernedMetadata } from "./evidence-type";
import { formatObservationPeriod } from "./format-period";
import type { EvidenceObjectModel } from "./types";
import {
  availabilityFromGovernedValueState,
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
      observationPeriod,
      sourceFamily,
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
