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

/** A state scope or county in the URL is an explicit location. Profile defaults do not replace it. */
export function hasExplicitReviewLocation(
  searchParams: ScopeSearchParams
): boolean {
  return searchParams.has("scope") || searchParams.has("county");
}

export function parsedReviewScopeFromUrl(
  searchParams: ScopeSearchParams
): ReviewScope {
  return parseUxResetSharedContext(searchParams).scope;
}

/**
 * The saved starting view applies only when the URL has neither `scope` nor
 * `county`. A present `scope` param, including an invalid value canonicalized
 * to ALL, wins. A `county` param is an explicit location even when `scope` is
 * omitted, so the profile default does not replace it.
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
