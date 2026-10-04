import type { Observation } from "@/generated/models";

import { formatObservationPeriod, humanizeEvidenceType } from "./format-period";
import type { EvidenceObjectModel } from "./types";
import {
  availabilityFromGovernedValueState,
  formatGovernedEvidenceValue,
  materialLimitationFromList,
  reasonCodeForEvidence,
} from "./value-state-contract";

export type ObservationEvidenceInput = {
  observation: Observation;
  claimLabel: string;
  valueNote?: string | null;
};

export function evidenceObjectFromObservation({
  claimLabel,
  observation,
  valueNote,
}: ObservationEvidenceInput): EvidenceObjectModel {
  const materialCaveat = materialLimitationFromList(observation.limitations);
  const hasMaterialLimitations = materialCaveat != null;
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
  const observationPeriod =
    observation.source_vintage?.trim() ||
    formatObservationPeriod(observation.period_start, observation.period_end);
  const evidenceType = humanizeEvidenceType(observation.evidence.resource_type);

  const inspectSummary = [
    `${sourceFamily} for ${observationPeriod}.`,
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
      evidenceType,
      inspectSummary,
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
