import { parseUxResetSharedContext } from "@/features/ux-reset/context-params";
import {
  type AtlasStateOption,
  isAtlasStateCode,
} from "@/lib/atlas-state-geography";

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
  if (trimmed && isAtlasStateCode(trimmed, stateOptions)) {
    return trimmed;
  }
  return "ALL";
}

export function reviewScopeMatchesPresentation(
  activeScope: ReviewScope,
  presentationScope: ReviewScope | undefined
): boolean {
  return presentationScope !== undefined && presentationScope === activeScope;
}
