import { evidenceTypeFromGovernedMetadata } from "@/features/ux-reset/evidence/evidence-type";
import {
  evidenceAvailabilityValues,
  type EvidenceObjectModel,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import type { ReviewCountyPreviewModel } from "@/features/ux-reset/review/review-county-preview";
import type { Candidate } from "@/generated/models";

const CANDIDATE_FOLLOW_UP_LABEL = "Suggested next check";

function observedBasis(candidate: Candidate): string {
  if (candidate.evidence_references.length === 0) {
    return "The review result did not include an observed basis for this county.";
  }
  return candidate.evidence_references
    .map(
      (reference) =>
        `${reference.target}: ${reference.status} (${reference.source_product}, as of ${reference.source_as_of})`
    )
    .join(" ");
}

function candidateCaveat(candidate: Candidate): string {
  const parts = [...candidate.limitations];
  const freshness = candidate.freshness_comparability.trim();
  if (freshness) {
    parts.push(freshness);
  }
  if (parts.length === 0) {
    return "The review result did not include an additional caveat.";
  }
  return parts.join(" ");
}

function candidateQualification(
  candidate: Candidate,
  caveat: string,
  effectiveContext: string,
  methodologyId: string,
  methodologyVersion: string
): EvidenceObjectModel {
  const reference = candidate.evidence_references[0];
  const sourceFamily = reference?.family.trim() || "Unavailable";
  const observationPeriod =
    reference?.source_as_of.trim() || effectiveContext.trim() || "Unavailable";
  const evidenceType = evidenceTypeFromGovernedMetadata(reference?.target);
  const limitations = [
    ...candidate.limitations,
    ...candidate.reason_codes.map((code) => `Reason code ${code}`),
  ];
  return {
    availability: evidenceAvailabilityValues.limited,
    claimLabel: "Evidence state",
    displayValue: evidenceAvailabilityLabel(evidenceAvailabilityValues.limited),
    provenance: {
      evidenceType,
      inspectSummary: `${candidate.reason_text} ${caveat} Method ${methodologyId} ${methodologyVersion}.`,
      limitations: limitations.length > 0 ? limitations : [caveat],
      materialCaveat: caveat,
      observationPeriod,
      sourceFamily,
      technical: {
        methodologyVersion,
        provenanceRef: reference?.public_record_ref ?? null,
        releaseId: reference?.release_id ?? null,
        sourceId: reference?.source_product ?? null,
      },
    },
    reasonCode: "MATERIAL_LIMITATION",
  };
}

/**
 * Preview fields come from one candidate record. Completeness on the
 * contract is limited; this does not invent an available or ranked score.
 */
export function buildReviewCandidatePreview(input: {
  candidate: Candidate;
  effectiveContext: string;
  methodologyId: string;
  methodologyVersion: string;
  stateCode: string;
  stateName: string;
}): ReviewCountyPreviewModel {
  const caveat = candidateCaveat(input.candidate);
  const nextCheck = input.candidate.suggested_next_check.trim();
  return {
    availability: evidenceAvailabilityValues.limited,
    caveat,
    countyName: input.candidate.county_name,
    fips: input.candidate.county_fips,
    followUp: nextCheck || "The review result did not include a next check.",
    followUpLabel: CANDIDATE_FOLLOW_UP_LABEL,
    observedBasis: observedBasis(input.candidate),
    qualification: candidateQualification(
      input.candidate,
      caveat,
      input.effectiveContext,
      input.methodologyId,
      input.methodologyVersion
    ),
    stateCode: input.stateCode,
    stateName: input.stateName,
    why: input.candidate.reason_text,
  };
}
