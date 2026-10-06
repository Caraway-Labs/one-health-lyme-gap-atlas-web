import {
  uxResetContextHandoffSearchParams,
  uxResetShellHandoffHref,
} from "@/features/ux-reset/context-handoff";
import { evidenceTypeFromGovernedMetadata } from "@/features/ux-reset/evidence/evidence-type";
import {
  evidenceAvailabilityValues,
  type EvidenceAvailability,
  type EvidenceObjectModel,
  type EvidenceReasonCode,
} from "@/features/ux-reset/evidence/types";
import {
  availabilityFromGovernedValueState,
  evidenceAvailabilityLabel,
} from "@/features/ux-reset/evidence/value-state-contract";
import {
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import { ValueState, type CountyScoreSummary } from "@/generated/models";
import { plainPriority, suggestedFollowUpForColor } from "@/lib/atlas-ui";

const ABSENT_COUNTY_STATUSES = new Set([
  "",
  "missing",
  "no records",
  "no_county_linked_record",
  "unavailable",
]);

/**
 * Review-only keys and compare are not Investigate filters. When the Review
 * URL has them, the preview says they were dropped instead of reinterpreting
 * them as county evidence.
 */
const REVIEW_INVESTIGATE_DROP_NOTES: Record<string, string> = {
  compare:
    "Compare is not part of Investigate. This opens the selected county only.",
  page: "The Review list page stays on Review. Browser Back returns to it.",
  sort: "Review sort stays on Review and is not copied to Investigate.",
};

export type ReviewCountyPreviewModel = {
  availability: EvidenceAvailability;
  caveat: string;
  countyName: string;
  fips: string;
  followUp: string;
  /**
   * Visible evidence-state qualification for limited and unavailable inputs.
   * Null when the score row does not show a limitation.
   */
  qualification: EvidenceObjectModel | null;
  stateCode: string;
  stateName: string;
  why: string;
};

export type ReviewPreviewResponse = {
  county: CountyScoreSummary;
  requestedFips: string;
};

function countyStatuses(county: CountyScoreSummary): string[] {
  return [county.burgdorferi_status, county.human_status, county.tick_status];
}

function isAbsentStatus(status: string): boolean {
  return ABSENT_COUNTY_STATUSES.has(status.trim().toLowerCase());
}

/** Score rows carry the governed `SUPPRESSED` code as a status string. */
function isSuppressedStatus(status: string): boolean {
  return status.trim().toLowerCase() === ValueState.SUPPRESSED.toLowerCase();
}

function hasSuppressedStatus(county: CountyScoreSummary): boolean {
  return countyStatuses(county).some((status) => isSuppressedStatus(status));
}

export function reviewCountyPreviewAvailability(
  county: CountyScoreSummary
): EvidenceAvailability {
  const statuses = countyStatuses(county);
  const absentCount = statuses.filter((status) =>
    isAbsentStatus(status)
  ).length;
  if (absentCount === statuses.length) {
    return evidenceAvailabilityValues.unavailable;
  }
  if (hasSuppressedStatus(county)) {
    return availabilityFromGovernedValueState({
      valueState: ValueState.SUPPRESSED,
    });
  }
  if (absentCount > 0 || county.evidence_completeness < 100) {
    return evidenceAvailabilityValues.limited;
  }
  return evidenceAvailabilityValues.available;
}

function reviewCountyPreviewCaveat(county: CountyScoreSummary): string {
  if (hasSuppressedStatus(county)) {
    return "Suppressed or privacy-protected. Suppression limits this preview and is not treated as zero cases.";
  }
  if (isAbsentStatus(county.human_status)) {
    return "A county-level published Lyme case count is unavailable. Missing data is not treated as zero cases.";
  }
  if (isAbsentStatus(county.tick_status)) {
    return "The published tick table has no county record. No record does not establish that ticks are absent.";
  }
  if (isAbsentStatus(county.burgdorferi_status)) {
    return "The published pathogen table has no county record. No record does not establish that the pathogen is absent.";
  }
  if (county.evidence_completeness < 100) {
    return "Some scored inputs are unavailable in this release.";
  }
  return "Published inputs in this release can be reviewed for this county.";
}

const SCORE_SUMMARY_METADATA_LIMIT =
  "Source family, observation period, evidence type, and provenance for this status are not included in the county score summary.";

function reviewCountyPreviewWhy(county: CountyScoreSummary): string {
  return plainPriority(county.priority);
}

function reviewPreviewReasonCode(
  county: CountyScoreSummary,
  availability: EvidenceAvailability
): EvidenceReasonCode {
  if (hasSuppressedStatus(county)) {
    return ValueState.SUPPRESSED;
  }
  if (availability === evidenceAvailabilityValues.unavailable) {
    return ValueState.UNAVAILABLE;
  }
  return "MATERIAL_LIMITATION";
}

/**
 * Limited and unavailable score rows need a visible qualification. The score
 * summary has no observation provenance, so missing metadata stays Unavailable
 * and the caveat states the limitation without calling inputs available or
 * treating a missing record as biological absence.
 */
function reviewCountyPreviewQualification(
  county: CountyScoreSummary
): EvidenceObjectModel | null {
  const availability = reviewCountyPreviewAvailability(county);
  if (availability === evidenceAvailabilityValues.available) {
    return null;
  }
  const caveat = reviewCountyPreviewCaveat(county);
  return {
    availability,
    claimLabel: "Evidence state",
    displayValue: evidenceAvailabilityLabel(availability),
    provenance: {
      evidenceType: evidenceTypeFromGovernedMetadata(null),
      inspectSummary: `${caveat} ${SCORE_SUMMARY_METADATA_LIMIT}`,
      limitations: [caveat, SCORE_SUMMARY_METADATA_LIMIT],
      materialCaveat: caveat,
      observationPeriod: "Unavailable",
      sourceFamily: "Unavailable",
    },
    reasonCode: reviewPreviewReasonCode(county, availability),
  };
}

export function buildReviewCountyPreview(
  county: CountyScoreSummary
): ReviewCountyPreviewModel {
  return {
    availability: reviewCountyPreviewAvailability(county),
    caveat: reviewCountyPreviewCaveat(county),
    countyName: county.county,
    fips: county.fips,
    followUp: suggestedFollowUpForColor(county.color),
    qualification: reviewCountyPreviewQualification(county),
    stateCode: county.state,
    stateName: county.state_name,
    why: reviewCountyPreviewWhy(county),
  };
}

/**
 * Commit one preview for the current selection.
 * A response is used only when its requested FIPS and county FIPS are the
 * selection. An earlier response cannot replace a newer county, and identity,
 * why, and caveat always come from that same county record.
 */
export function reviewPreviewForSelection(input: {
  counties: readonly CountyScoreSummary[];
  response: ReviewPreviewResponse | null;
  selectedFips: string;
}): ReviewCountyPreviewModel | null {
  const selected =
    input.counties.find((county) => county.fips === input.selectedFips) ?? null;
  if (!selected) {
    return null;
  }
  const response = input.response;
  const responseMatches =
    response !== null &&
    response.requestedFips === input.selectedFips &&
    response.county.fips === input.selectedFips;
  const source = responseMatches ? response.county : selected;
  if (source.fips !== input.selectedFips) {
    return buildReviewCountyPreview(selected);
  }
  return buildReviewCountyPreview(source);
}

export function reviewInvestigateDropNotes(
  droppedKeys: readonly string[]
): string[] {
  const notes: string[] = [];
  for (const key of droppedKeys) {
    const note = REVIEW_INVESTIGATE_DROP_NOTES[key];
    if (note) {
      notes.push(note);
    }
  }
  return notes;
}

export function buildReviewInvestigateHandoff(input: {
  period: string | null;
  releaseId: string;
  scopeCode: string;
  searchParams: Pick<URLSearchParams, "toString">;
  selectedFips: string;
}): { droppedNotes: string[]; href: string } {
  const source = new URLSearchParams(input.searchParams.toString());
  source.set("scope", input.scopeCode);
  source.set("county", input.selectedFips);
  source.set("dataset", input.releaseId);
  if (input.period) {
    source.set("period", input.period);
  } else {
    source.delete("period");
  }
  const handoff = uxResetContextHandoffSearchParams(
    RESET_REVIEW_PATH,
    RESET_INVESTIGATE_PATH,
    source
  );
  return {
    droppedNotes: reviewInvestigateDropNotes(handoff.dropped),
    href: uxResetShellHandoffHref(
      RESET_INVESTIGATE_PATH,
      RESET_REVIEW_PATH,
      source
    ),
  };
}
