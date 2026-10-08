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

function governedField(value: string): string {
  return value.trim() || GOVERNED_FIELD_UNAVAILABLE;
}

function observedBasis(candidate: Candidate): string {
  if (candidate.evidence_references.length === 0) {
    return "The review result did not include an observed basis for this county.";
  }
  return candidate.evidence_references
    .map((reference) => {
      const target = governedField(reference.target);
      const status = governedField(reference.status);
      const product = governedField(reference.source_product);
      const county = governedField(reference.county_fips);
      const sourceAsOf = governedField(reference.source_as_of);
      return `${target}: ${status} (${product}, FIPS ${county}, as of ${sourceAsOf})`;
    })
    .join(" ");
}

const ABSENT_CAVEAT = "The review result did not include an additional caveat.";

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

function candidateCaveatParts(candidate: Candidate): string[] {
  return trimmedUnique([
    ...candidate.limitations,
    ...candidate.evidence_references.flatMap(
      (reference) => reference.limitations
    ),
    candidate.freshness_comparability,
  ]);
}

export function reviewCandidateExplanation(candidate: Candidate): string {
  const text = candidate.reason_text.trim();
  if (text) {
    return text;
  }
  const codes = trimmedUnique(candidate.reason_codes);
  if (codes.length > 0) {
    return codes.join(", ");
  }
  return "The review result did not include a reason for this county.";
}

function candidateCaveat(candidate: Candidate): string {
  const parts = candidateCaveatParts(candidate);
  if (parts.length === 0) {
    return ABSENT_CAVEAT;
  }
  return parts.join(" ");
}

function candidateSourceFamilies(candidate: Candidate): string[] {
  return trimmedUnique([
    ...candidate.evidence_families,
    ...candidate.evidence_references.map((reference) => reference.family),
  ]);
}

function sharedReferenceValue(
  references: readonly PublicReviewEvidenceReference[],
  read: (reference: PublicReviewEvidenceReference) => string
): string | null {
  if (references.length === 0) {
    return null;
  }
  let shared = "";
  for (const reference of references) {
    const value = read(reference).trim();
    if (!value || (shared && value !== shared)) {
      return null;
    }
    shared = value;
  }
  return shared;
}

function referenceInspectLine(
  reference: PublicReviewEvidenceReference
): string {
  const family = reference.family.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const product = reference.source_product.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const sourceAsOf =
    reference.source_as_of.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const revision = `; source as of ${sourceAsOf}`;
  const version = reference.source_version.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const versionLabel = `; version ${version}`;
  const county = reference.county_fips.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const retrieved = reference.retrieved_at.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const record =
    reference.public_record_ref.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const recordLabel = `; record ${record}`;
  const release = reference.release_id.trim() || GOVERNED_FIELD_UNAVAILABLE;
  return `${family} (${product}; county ${county}${revision}${versionLabel}; retrieved ${retrieved}${recordLabel}; release ${release})`;
}

function candidateQualification(
  candidate: Candidate,
  caveat: string,
  methodologyId: string,
  methodologyVersion: string
): EvidenceObjectModel {
  const references = candidate.evidence_references;
  const families = candidateSourceFamilies(candidate);
  const caveatParts = candidateCaveatParts(candidate);
  const referenceLines = references.map(referenceInspectLine);
  const referenceSummary = referenceLines.join(" ");
  const methodId = methodologyId.trim() || GOVERNED_FIELD_UNAVAILABLE;
  const methodVersion = methodologyVersion.trim() || GOVERNED_FIELD_UNAVAILABLE;
  return {
    availability: evidenceAvailabilityValues.limited,
    claimLabel: "Evidence state",
    displayValue: evidenceAvailabilityLabel(evidenceAvailabilityValues.limited),
    provenance: {
      evidenceType: GOVERNED_FIELD_UNAVAILABLE,
      inspectSummary:
        `${reviewCandidateExplanation(candidate)} ${caveat} Method ${methodId} ${methodVersion}. ${referenceSummary}`.trim(),
      limitations: caveatParts,
      materialCaveat: caveat,
      methodLabel: methodologyId.trim() || null,
      methodVersion: methodologyVersion.trim() || null,
      observationPeriod: GOVERNED_FIELD_UNAVAILABLE,
      referenceLines,
      sourceFamily:
        families.length > 0 ? families.join(", ") : GOVERNED_FIELD_UNAVAILABLE,
      technical: {
        methodologyVersion: methodologyVersion.trim() || null,
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
    ...(caveatParts.length > 0
      ? { reasonCode: "MATERIAL_LIMITATION" as const }
      : {}),
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
    countyName: governedField(input.candidate.county_name),
    reasonCodes: trimmedUnique(input.candidate.reason_codes),
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
    why: reviewCandidateExplanation(input.candidate),
  };
}
