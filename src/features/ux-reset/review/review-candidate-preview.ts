import {
  evidenceAvailabilityValues,
  type EvidenceObjectModel,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import type { ReviewCountyPreviewModel } from "@/features/ux-reset/review/review-county-preview";
import type {
  Candidate,
  PublicReviewEvidenceReference,
} from "@/generated/models";

const CANDIDATE_FOLLOW_UP_LABEL = "Suggested next check";
const GOVERNED_FIELD_UNAVAILABLE = "Unavailable";

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

function trimmedUnique(values: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
  }
  return unique;
}

function sharedReferenceValue(
  references: readonly PublicReviewEvidenceReference[],
  read: (reference: PublicReviewEvidenceReference) => string
): string | null {
  const unique = trimmedUnique(references.map(read));
  if (unique.length !== 1) {
    return null;
  }
  return unique[0] ?? null;
}

function referenceInspectLine(
  reference: PublicReviewEvidenceReference
): string {
  const family = reference.family.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const product = reference.source_product.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const sourceAsOf = reference.source_as_of.trim();
  const revision = sourceAsOf ? `; source as of ${sourceAsOf}` : "";
  const record = reference.public_record_ref.trim();
  const recordLabel = record ? `; record ${record}` : "";
  return `${family} (${product}${revision}${recordLabel})`;
}

function candidateQualification(
  candidate: Candidate,
  caveat: string,
  methodologyId: string,
  methodologyVersion: string
): EvidenceObjectModel {
  const references = candidate.evidence_references;
  const families = trimmedUnique(
    references.map((reference) => reference.family)
  );
  const limitations = [
    ...candidate.limitations,
    ...candidate.reason_codes.map((code) => `Reason code ${code}`),
  ];
  const referenceSummary = references.map(referenceInspectLine).join(" ");
  return {
    availability: evidenceAvailabilityValues.limited,
    claimLabel: "Evidence state",
    displayValue: evidenceAvailabilityLabel(evidenceAvailabilityValues.limited),
    provenance: {
      evidenceType: GOVERNED_FIELD_UNAVAILABLE,
      inspectSummary:
        `${candidate.reason_text} ${caveat} Method ${methodologyId} ${methodologyVersion}. ${referenceSummary}`.trim(),
      limitations: limitations.length > 0 ? limitations : [caveat],
      materialCaveat: caveat,
      observationPeriod: GOVERNED_FIELD_UNAVAILABLE,
      sourceFamily:
        families.length > 0 ? families.join(", ") : GOVERNED_FIELD_UNAVAILABLE,
      technical: {
        methodologyVersion,
        provenanceRef: sharedReferenceValue(
          references,
          (reference) => reference.public_record_ref
        ),
        releaseId: sharedReferenceValue(
          references,
          (reference) => reference.release_id
        ),
        sourceId: sharedReferenceValue(
          references,
          (reference) => reference.source_product
        ),
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
      input.methodologyId,
      input.methodologyVersion
    ),
    stateCode: input.stateCode,
    stateName: input.stateName,
    why: input.candidate.reason_text,
  };
}
