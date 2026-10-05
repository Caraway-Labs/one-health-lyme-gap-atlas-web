import { parseUxResetSharedContext } from "@/features/ux-reset/context-params";
import { reviewStartForSelection } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";

export type ReviewScope = "ALL" | string;

type ScopeSearchParams = Pick<URLSearchParams, "get" | "getAll" | "has">;

export function hasExplicitReviewScopeParam(
  searchParams: ScopeSearchParams
): boolean {
  return searchParams.has("scope");
}

export function parsedReviewScopeFromUrl(
  searchParams: ScopeSearchParams
): ReviewScope {
  return parseUxResetSharedContext(searchParams).scope;
}

/**
 * Profile default jurisdiction applies only when the URL omits `scope`. A present
 * `scope` param (including invalid values canonicalized to ALL) wins over profile.
 */
export function resolveStartingReviewScope(
  hasExplicitScopeParam: boolean,
  parsedScope: ReviewScope,
  profileStateCode: string | null | undefined,
  stateOptions: readonly AtlasStateOption[]
): ReviewScope {
  if (hasExplicitScopeParam) {
    return parsedScope;
  }
  const trimmed = profileStateCode?.trim().toUpperCase() ?? "";
  const selection = trimmed
    ? { kind: "state" as const, stateCode: trimmed }
    : { kind: "unselected" as const };
  return reviewStartForSelection(selection, {
    options: stateOptions,
    status: "ready",
  }).scope;
}

export function reviewScopeMatchesPresentation(
  activeScope: ReviewScope,
  presentationScope: ReviewScope | undefined
): boolean {
  return presentationScope !== undefined && presentationScope === activeScope;
}
