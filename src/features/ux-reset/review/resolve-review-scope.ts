import { parseUxResetSharedContext } from "@/features/ux-reset/context-params";
import { reviewStartForSelection } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";

import { parseExplorerMapFocus } from "./explorer-map-focus";

export type ReviewScope = "ALL" | string;

type ScopeSearchParams = Pick<URLSearchParams, "get" | "getAll" | "has">;

export function hasExplicitReviewScopeParam(
  searchParams: ScopeSearchParams
): boolean {
  return searchParams.has("scope");
}

/**
 * A state scope, county, or valid national map focus in the URL is an explicit
 * location. Profile defaults do not replace it. Alaska, Hawaii, repeats, and
 * other focus tokens are not a location.
 */
export function hasExplicitReviewLocation(
  searchParams: ScopeSearchParams
): boolean {
  if (searchParams.has("scope") || searchParams.has("county")) {
    return true;
  }
  const focusValues = searchParams.getAll("focus");
  return (
    focusValues.length === 1 && parseExplorerMapFocus(focusValues[0]) !== null
  );
}

export function parsedReviewScopeFromUrl(
  searchParams: ScopeSearchParams
): ReviewScope {
  return parseUxResetSharedContext(searchParams).scope;
}

/**
 * The saved starting view applies only when the URL has neither `scope`,
 * `county`, nor a valid national `focus`. A present `scope` param, including
 * an invalid value canonicalized to ALL, wins. A `county` or valid `focus`
 * param is an explicit location even when `scope` is omitted, so the profile
 * default does not replace the national map.
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
 * True until the one-time Review startup resolution has settled.
 * An explicit arrival URL, or a scope chosen on the current history entry, is ready.
 * After startup settles, a later profile refetch must not reopen this gate.
 */
export function isReviewStartingScopeUnresolved(input: {
  arrivalExplicitScope: boolean;
  metadataError: boolean;
  metadataReady: boolean;
  profileFetched: boolean;
  startupSettled: boolean;
  stateOptions: readonly AtlasStateOption[];
  userChoseScope: boolean;
}): boolean {
  if (
    input.arrivalExplicitScope ||
    input.userChoseScope ||
    input.startupSettled
  ) {
    return false;
  }
  if (!(input.profileFetched && (input.metadataReady || input.metadataError))) {
    return true;
  }
  if (input.stateOptions.length === 0) {
    return false;
  }
  return true;
}
