import type { StateReview } from "@/generated/models";
import type { StateReviewResultState } from "@/generated/models/stateReviewResultState";
import { isContiguousUsCounty } from "@/lib/atlas-geometry";

import { stateFipsPrefix } from "./review-state-fips";

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
 * Headline for a successful review response.
 * Data-gap-only is the unsupported result that lists gaps and no candidates.
 * Other backend states stay distinct, including when gaps are also present.
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
      return exhaustive;
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
      return exhaustive;
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
/** AtlasMap draws the contiguous United States. Alaska and Hawaii stay in the list. */
export function reviewScopeHasContiguousMap(scopeCode: string): boolean {
  const prefix = stateFipsPrefix(scopeCode);
  return prefix !== null && isContiguousUsCounty(prefix);
}

export function reviewMapCounties(input: {
  candidateFips: readonly string[];
  geometryFips: readonly string[];
  scopeCode: string;
}): ReviewMapCounty[] {
  const prefix = stateFipsPrefix(input.scopeCode);
  const inState = prefix
    ? input.geometryFips.filter((fips) => fips.startsWith(prefix))
    : [];
  const fips = inState.length > 0 ? inState : input.candidateFips;
  return fips.map((entry) => ({
    fips: entry,
    state: input.scopeCode,
  }));
}
