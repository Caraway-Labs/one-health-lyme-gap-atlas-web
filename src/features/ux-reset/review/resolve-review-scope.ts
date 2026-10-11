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

/**
 * Scope token to write when the raw query is not already canonical.
 * Uses the shared parser. Null means the URL already matches that parse.
 */
export function reviewScopeQueryCanonicalRewrite(
  searchParams: ScopeSearchParams
): ReviewScope | null {
  if (!searchParams.has("scope")) {
    return null;
  }
  const rawValues = searchParams.getAll("scope");
  const canonical = parsedReviewScopeFromUrl(searchParams);
  if (rawValues.length === 1 && rawValues[0] === canonical) {
    return null;
  }
  return canonical;
}

/**
 * True until an omitted Review scope can be shown.
 * An explicit arrival URL or a scope the user already chose is ready.
 * A saved state default stays pending so national orientation does not flash.
 */
export function isReviewStartingScopeUnresolved(input: {
  arrivalExplicitScope: boolean;
  metadataError: boolean;
  metadataReady: boolean;
  profileFetched: boolean;
  profileStateCode: string | null | undefined;
  scope: ReviewScope;
  stateOptions: readonly AtlasStateOption[];
  userChoseScope: boolean;
}): boolean {
  if (input.arrivalExplicitScope || input.userChoseScope) {
    return false;
  }
  if (!(input.profileFetched && (input.metadataReady || input.metadataError))) {
    return true;
  }
  if (input.stateOptions.length === 0) {
    return false;
  }
  return (
    resolveStartingReviewScope(
      false,
      input.scope,
      input.profileStateCode,
      input.stateOptions
    ) !== input.scope
  );
}
