import {
  uxResetContextHandoffSearchParams,
  uxResetShellHandoffHref,
} from "@/features/ux-reset/context-handoff";
import {
  evidenceAvailabilityValues,
  type EvidenceAvailability,
} from "@/features/ux-reset/evidence/types";
import {
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import type { CountyScoreSummary } from "@/generated/models";
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
  stateCode: string;
  stateName: string;
  why: string;
};

export type ReviewPreviewResponse = {
  county: CountyScoreSummary;
  requestedFips: string;
};

function isAbsentStatus(status: string): boolean {
  return ABSENT_COUNTY_STATUSES.has(status.trim().toLowerCase());
}

export function reviewCountyPreviewAvailability(
  county: CountyScoreSummary
): EvidenceAvailability {
  const absentCount = [
    county.burgdorferi_status,
    county.human_status,
    county.tick_status,
  ].filter((status) => isAbsentStatus(status)).length;
  if (absentCount === 3) {
    return evidenceAvailabilityValues.unavailable;
  }
  if (absentCount > 0 || county.evidence_completeness < 100) {
    return evidenceAvailabilityValues.limited;
  }
  return evidenceAvailabilityValues.available;
}

function reviewCountyPreviewCaveat(county: CountyScoreSummary): string {
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

function reviewCountyPreviewWhy(county: CountyScoreSummary): string {
  const priority = plainPriority(county.priority);
  if (isAbsentStatus(county.human_status)) {
    return `${priority}. A county-level published Lyme case count is unavailable in this release.`;
  }
  return `${priority}. Published county inputs in this release are available for review.`;
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
