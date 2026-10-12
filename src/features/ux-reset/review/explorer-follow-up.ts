import type { Candidate, StateReview } from "@/generated/models";

import {
  reviewCandidatesWithheld,
  scopedReviewCandidates,
} from "./review-operating-state";

/**
 * Suggested follow-up for one selected county, taken only from that county's
 * review candidate. A factual county does not receive a generated step.
 */
export type ExplorerFollowUpState =
  | { status: "loading" }
  | { status: "not-in-scope" }
  | { status: "request-failed" }
  | {
      category: string | null;
      firstStep: string | null;
      limitations: readonly string[];
      rationale: string | null;
      status: "candidate";
    }
  | { status: "factual" }
  | { status: "withheld" };

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

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function explorerReviewLoad(input: {
  inScope: boolean;
  reviewError: boolean;
  reviewReady: boolean;
}): "error" | "loading" | "ready" | "unavailable" {
  if (!input.inScope) {
    return "unavailable";
  }
  if (input.reviewError) {
    return "error";
  }
  if (input.reviewReady) {
    return "ready";
  }
  return "loading";
}

export function explorerFollowUpSelection(input: {
  review: Pick<
    StateReview,
    "data_gaps" | "result_state" | "review_candidates"
  > | null;
  scopeCode: string;
}): { candidates: readonly Candidate[] | null; withheld: boolean } {
  if (!input.review) {
    return { candidates: null, withheld: false };
  }
  if (reviewCandidatesWithheld(input.review)) {
    return { candidates: [], withheld: true };
  }
  return {
    candidates: scopedReviewCandidates(
      input.review.review_candidates,
      input.scopeCode
    ).candidates.map((entry) => entry.candidate),
    withheld: false,
  };
}

export function explorerFollowUpState(input: {
  candidates: readonly Candidate[] | null;
  county: string | null;
  metadataFailed: boolean;
  review: "error" | "loading" | "ready" | "unavailable";
  withheld: boolean;
}): ExplorerFollowUpState {
  if (input.review === "unavailable") {
    return { status: "not-in-scope" };
  }
  if (input.metadataFailed || input.review === "error") {
    return { status: "request-failed" };
  }
  if (input.review === "loading" || input.candidates === null) {
    return { status: "loading" };
  }
  if (input.withheld) {
    return { status: "withheld" };
  }
  if (!input.county) {
    return { status: "factual" };
  }
  const candidate =
    input.candidates.find((entry) => entry.county_fips === input.county) ??
    null;
  if (!candidate) {
    return { status: "factual" };
  }
  const categoryCodes = trimmedUnique(candidate.reason_codes);
  return {
    category: categoryCodes.length > 0 ? categoryCodes.join(", ") : null,
    firstStep: optionalText(candidate.suggested_next_check),
    limitations: trimmedUnique(candidate.limitations),
    rationale: optionalText(candidate.reason_text),
    status: "candidate",
  };
}
