import { buildCompareEntryHref } from "@/features/ux-reset/compare/compare-entry";
import {
  uxResetContextHandoffSearchParams,
  uxResetShellHandoffHref,
} from "@/features/ux-reset/context-handoff";
import { parseCalendarIsoDate } from "@/features/ux-reset/context-params";
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
import { reviewDatasetId } from "@/features/ux-reset/review/review-governed-values";
import { reviewCandidateFipsForScope } from "@/features/ux-reset/review/review-operating-state";
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
 * Review-only list controls stay on Review. A validated compare pair is a
 * shared key Investigate accepts, so it is not described as dropped.
 */
const REVIEW_INVESTIGATE_DROP_NOTES: Record<string, string> = {
  page: "The Review list page stays on Review. Browser Back returns to it.",
  sort: "Review sort stays on Review and is not copied to Investigate.",
};

export type ReviewCountyPreviewModel = {
  availability: EvidenceAvailability;
  caveat: string;
  countyName: string;
  fips: string;
  followUp: string;
  /** Visible label for the next-check line. Score previews keep the legacy label. */
  followUpLabel?: string;
  /** Observed basis returned with a review candidate. */
  observedBasis?: string;
  /**
   * Visible evidence-state qualification for limited and unavailable inputs.
   * Null when the score row does not show a limitation.
   */
  qualification: EvidenceObjectModel | null;
  /** Why the county surfaced. These are not governed limitations. */
  reasonCodes: readonly string[];
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
  // Completeness above zero means other scored inputs still carry governed
  // signal. Unavailable is a row with no governed inputs.
  if (absentCount === statuses.length && county.evidence_completeness <= 0) {
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
    reasonCodes: [],
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

function writeReviewHandoffCounty(
  source: URLSearchParams,
  selectedFips: string,
  scopeCode: string
): string | null {
  const county = reviewCandidateFipsForScope(selectedFips, scopeCode);
  if (county) {
    source.set("county", county);
    return county;
  }
  source.delete("county");
  return null;
}

function writeReviewHandoffDataset(
  source: URLSearchParams,
  releaseId: string
): string | null {
  const dataset = reviewDatasetId(releaseId);
  if (dataset) {
    source.set("dataset", dataset);
    return dataset;
  }
  source.delete("dataset");
  return null;
}

function writeReviewHandoffPeriod(
  source: URLSearchParams,
  period: string | null
): void {
  const parsed = period ? parseCalendarIsoDate(period) : null;
  if (parsed) {
    source.set("period", parsed);
    return;
  }
  source.delete("period");
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
  writeReviewHandoffCounty(source, input.selectedFips, input.scopeCode);
  writeReviewHandoffDataset(source, input.releaseId);
  writeReviewHandoffPeriod(source, input.period);
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

/**
 * Open Compare for the county on screen. An existing compare list is kept.
 * Otherwise that county is the only member, and Compare asks for the second.
 */
export function buildReviewCompareHandoff(input: {
  period: string | null;
  releaseId: string;
  scopeCode: string;
  searchParams: Pick<URLSearchParams, "get" | "getAll" | "has" | "toString">;
  selectedFips: string;
}): string {
  const source = new URLSearchParams(input.searchParams.toString());
  source.set("scope", input.scopeCode);
  const county = writeReviewHandoffCounty(
    source,
    input.selectedFips,
    input.scopeCode
  );
  const dataset = writeReviewHandoffDataset(source, input.releaseId);
  writeReviewHandoffPeriod(source, input.period);
  return buildCompareEntryHref({
    county,
    dataset,
    period: input.period,
    returnTo: "review",
    scope: input.scopeCode,
    sourcePath: RESET_REVIEW_PATH,
    sourceSearchParams: source,
  });
}
