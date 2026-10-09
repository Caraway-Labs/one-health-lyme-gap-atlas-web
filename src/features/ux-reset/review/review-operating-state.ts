import type { Candidate, DataGap, StateReview } from "@/generated/models";
import type { StateReviewResultState } from "@/generated/models/stateReviewResultState";

import { REVIEW_FIELD_UNAVAILABLE } from "./review-governed-values";
import { isLower48ReviewScope, stateFipsPrefix } from "./review-state-fips";

export const reviewPictureStateValues = {
  candidatesFound: "candidates_found",
  dataGapOnly: "data_gap_only",
  insufficientEvidence: "insufficient_evidence",
  noneStandOut: "none_stand_out",
  unsupported: "unsupported",
} as const;

export type ReviewPictureState =
  (typeof reviewPictureStateValues)[keyof typeof reviewPictureStateValues];

export const REVIEW_REQUEST_FAILURE_MESSAGE =
  "Review results are temporarily unavailable. Atlas did not receive a review result for this scope.";

type ReviewPictureInput = Pick<
  StateReview,
  "data_gaps" | "result_state" | "review_candidates"
>;

/**
 * Methodology precedence: one or more candidates means `candidates_found`.
 * Data gaps may accompany any state, including a mixed `candidates_found`
 * result. Any other pairing is not a finding.
 */
export function reviewResultPayloadConsistent(
  review: ReviewPictureInput
): boolean {
  const hasCandidates = review.review_candidates.length > 0;
  switch (review.result_state) {
    case "candidates_found": {
      return hasCandidates;
    }
    case "insufficient_evidence":
    case "none_stand_out":
    case "unsupported": {
      return !hasCandidates;
    }
    default: {
      const exhaustive: never = review.result_state;
      void exhaustive;
      return false;
    }
  }
}

/**
 * Headline for a successful review response.
 * Data-gap-only is the unsupported result that lists gaps and no candidates.
 * `data_gaps` must already be counties in the requested state. Other backend
 * states stay distinct, including when those gaps are also present.
 */
export function reviewPictureState(
  review: ReviewPictureInput
): ReviewPictureState {
  switch (review.result_state) {
    case "candidates_found": {
      return reviewPictureStateValues.candidatesFound;
    }
    case "insufficient_evidence": {
      return reviewPictureStateValues.insufficientEvidence;
    }
    case "none_stand_out": {
      return reviewPictureStateValues.noneStandOut;
    }
    case "unsupported": {
      if (
        review.review_candidates.length === 0 &&
        review.data_gaps.length > 0
      ) {
        return reviewPictureStateValues.dataGapOnly;
      }
      return reviewPictureStateValues.unsupported;
    }
    default: {
      const exhaustive: never = review.result_state;
      void exhaustive;
      return reviewPictureStateValues.unsupported;
    }
  }
}

export function reviewPictureSummary(state: ReviewPictureState): string {
  switch (state) {
    case reviewPictureStateValues.candidatesFound: {
      return "The approved review method returned counties to inspect.";
    }
    case reviewPictureStateValues.dataGapOnly: {
      return "No review candidate was returned. Listed data gaps are separate from suggestions.";
    }
    case reviewPictureStateValues.insufficientEvidence: {
      return "There is not enough eligible evidence to evaluate this scope.";
    }
    case reviewPictureStateValues.noneStandOut: {
      return "Nothing stands out under the approved method. That is not a finding of no Lyme activity.";
    }
    case reviewPictureStateValues.unsupported: {
      return "No review rule is enabled for this result.";
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function isGovernedReviewResultState(
  value: string
): value is StateReviewResultState {
  switch (value) {
    case "candidates_found":
    case "insufficient_evidence":
    case "none_stand_out":
    case "unsupported": {
      return true;
    }
    default: {
      return false;
    }
  }
}

export function reviewResultStateLabel(
  resultState: StateReviewResultState
): string {
  switch (resultState) {
    case "candidates_found": {
      return "Candidates found";
    }
    case "insufficient_evidence": {
      return "Insufficient evidence";
    }
    case "none_stand_out": {
      return "Nothing stands out";
    }
    case "unsupported": {
      return "Unsupported";
    }
    default: {
      const exhaustive: never = resultState;
      void exhaustive;
      return "Unavailable";
    }
  }
}

export type ReviewMapCounty = {
  fips: string;
  state: string;
};

/**
 * Frame the map to the requested state. Candidate counties are not ranked,
 * and data-gap counties are not added as suggestions.
 */
const UNSUPPORTED_REVIEW_SCOPE_LABELS: Record<string, string> = {
  AK: "Alaska",
  HI: "Hawaii",
};

/**
 * Atlas Review covers the lower 48 and DC. National scope stays available.
 * Any other code, including Alaska, Hawaii, and territories, is not a scope.
 */
export function isUnsupportedReviewScope(scopeCode: string): boolean {
  if (scopeCode === "ALL") {
    return false;
  }
  return !isLower48ReviewScope(scopeCode);
}

export function unsupportedReviewScopeMessage(scopeCode: string): string {
  const name = UNSUPPORTED_REVIEW_SCOPE_LABELS[scopeCode] ?? scopeCode;
  return `${name} is not supported — lower 48 only.`;
}

const REVIEW_COUNTY_FIPS_PATTERN = /^\d{5}$/;

/**
 * Review URL county after one normalization. Unsupported scopes drop it.
 * A lower-48 or DC scope keeps it only when the FIPS prefix matches.
 * National scope is not a state prefix check.
 */
export function normalizeReviewCounty(
  scopeCode: string,
  county: string | null
): string | null {
  if (county === null || isUnsupportedReviewScope(scopeCode)) {
    return null;
  }
  if (!isLower48ReviewScope(scopeCode)) {
    return county;
  }
  return reviewCandidateFipsForScope(county, scopeCode);
}

/**
 * County geography for Review: gaps, candidates, rule-coverage county keys,
 * and URL or handoff context. Five digits in the requested lower-48 or DC
 * state. Blank, malformed, other-state, Alaska, and Hawaii values are omitted.
 * Evidence-reference FIPS are display-only and do not use this check.
 */
export function reviewCandidateFipsForScope(
  fips: string,
  scopeCode: string
): string | null {
  const trimmed = fips.trim();
  if (!isLower48ReviewScope(scopeCode)) {
    return null;
  }
  const prefix = stateFipsPrefix(scopeCode);
  if (
    !(
      prefix &&
      REVIEW_COUNTY_FIPS_PATTERN.test(trimmed) &&
      trimmed.startsWith(prefix)
    )
  ) {
    return null;
  }
  return trimmed;
}

export type ScopedReviewCandidate = {
  candidate: Candidate;
  countyFips: string;
  /** Trimmed name. Null when blank, so it cannot be validated as geography. */
  countyName: string | null;
};

/** Blank contract names stay null. Display uses `reviewCandidateCountyLabel`. */
export function reviewCountyName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function reviewCandidateCountyLabel(countyName: string | null): string {
  return countyName ?? REVIEW_FIELD_UNAVAILABLE;
}

export type ScopedReviewCandidateList = {
  candidates: ScopedReviewCandidate[];
  /** Later rows whose FIPS was already kept. They are not a second county. */
  omittedDuplicateCount: number;
  /** Blank, malformed, or other-state FIPS. */
  omittedOutOfScopeCount: number;
};

/**
 * Candidates the Review UI, Ask Atlas, handoffs, and shell links share.
 * The first valid FIPS in the requested state is the only record for that
 * county. Later copies and out-of-scope FIPS are counted, not published.
 */
export function scopedReviewCandidates(
  candidates: readonly Candidate[],
  scopeCode: string
): ScopedReviewCandidateList {
  const scoped: ScopedReviewCandidate[] = [];
  const seen = new Set<string>();
  let omittedDuplicateCount = 0;
  let omittedOutOfScopeCount = 0;
  for (const candidate of candidates) {
    const countyFips = reviewCandidateFipsForScope(
      candidate.county_fips,
      scopeCode
    );
    if (!countyFips) {
      omittedOutOfScopeCount += 1;
      continue;
    }
    if (seen.has(countyFips)) {
      omittedDuplicateCount += 1;
      continue;
    }
    seen.add(countyFips);
    scoped.push({
      candidate: { ...candidate, county_fips: countyFips },
      countyFips,
      countyName: reviewCountyName(candidate.county_name),
    });
  }
  return {
    candidates: scoped,
    omittedDuplicateCount,
    omittedOutOfScopeCount,
  };
}

export type ScopedReviewGap = {
  countyFips: string;
  gap: DataGap;
};

export type ScopedReviewGapList = {
  gaps: ScopedReviewGap[];
  /** Blank, malformed, or other-state FIPS. They are not Review geography. */
  omittedOutOfScopeCount: number;
};

/**
 * Data gaps that can appear in the requested state. Out-of-scope rows are
 * counted and are not used for the picture headline or the gap list.
 */
export function scopedReviewGaps(
  gaps: readonly DataGap[],
  scopeCode: string
): ScopedReviewGapList {
  const scoped: ScopedReviewGap[] = [];
  let omittedOutOfScopeCount = 0;
  for (const gap of gaps) {
    const countyFips = reviewCandidateFipsForScope(gap.county_fips, scopeCode);
    if (!countyFips) {
      omittedOutOfScopeCount += 1;
      continue;
    }
    scoped.push({
      countyFips,
      gap: { ...gap, county_fips: countyFips },
    });
  }
  return { gaps: scoped, omittedOutOfScopeCount };
}

/**
 * Counties the map can draw. Only display-geometry features in the requested
 * lower-48 or DC state count. Candidate FIPS are not polygons and do not
 * frame Alaska, Hawaii, or a state the geometry collection omitted.
 */
export function reviewMapCounties(input: {
  geometryFips: readonly string[];
  scopeCode: string;
}): ReviewMapCounty[] {
  const counties: ReviewMapCounty[] = [];
  for (const fips of input.geometryFips) {
    const countyFips = reviewCandidateFipsForScope(fips, input.scopeCode);
    if (!countyFips) {
      continue;
    }
    counties.push({ fips: countyFips, state: input.scopeCode });
  }
  return counties;
}
