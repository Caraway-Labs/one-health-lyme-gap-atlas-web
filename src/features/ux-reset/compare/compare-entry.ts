import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import {
  mergeCompareQueryValues,
  parseCompareFipsList,
  parseUxResetSharedContext,
  serializeCompareFipsList,
  sharedContextToSearchParams,
  UX_RESET_COMPARE_COUNTY_LIMIT,
  type UxResetSharedContext,
} from "@/features/ux-reset/context-params";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import {
  RESET_COMPARE_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import { isCountyFips } from "@/lib/county-geography";

/**
 * Explicit Compare return targets. The value lives on the Compare URL.
 * Review and Investigate do not read it back.
 */
export const compareReturnTargets = {
  investigate: "investigate",
  review: "review",
} as const;

export type CompareReturnTarget =
  (typeof compareReturnTargets)[keyof typeof compareReturnTargets];

type CompareEntrySearchParams = Pick<URLSearchParams, "get" | "getAll" | "has">;

export function parseCompareReturnTarget(
  value: string | null | undefined
): CompareReturnTarget | null {
  if (
    value === compareReturnTargets.review ||
    value === compareReturnTargets.investigate
  ) {
    return value;
  }
  return null;
}

export function compareReturnLabel(target: CompareReturnTarget): string {
  switch (target) {
    case "review": {
      return "Return to Review";
    }
    case "investigate": {
      return "Return to Investigate";
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

export function compareReturnPath(target: CompareReturnTarget): string {
  switch (target) {
    case "review": {
      return RESET_REVIEW_PATH;
    }
    case "investigate": {
      return RESET_INVESTIGATE_PATH;
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

/**
 * Pair carried into Compare.
 * A validated two-county list is kept, so a later county is not added.
 * One saved county is replaced by the county selected now, and remains only
 * when nothing valid is selected. An empty list becomes that county alone.
 * A second county is never chosen here.
 */
export function compareEntryPair(input: {
  compare: readonly string[];
  county: string | null;
}): string[] {
  const existing = parseCompareFipsList(input.compare.join(","));
  if (existing.length >= UX_RESET_COMPARE_COUNTY_LIMIT) {
    return existing;
  }
  if (input.county && isCountyFips(input.county)) {
    return parseCompareFipsList(input.county);
  }
  return existing;
}

/**
 * Canonical Compare entry URL. The pair uses the shared compare serializer.
 * `return` is appended only when the caller names Review or Investigate.
 */
export function buildCompareEntryHref(input: {
  county: string | null;
  dataset: string | null;
  period: string | null;
  returnTo: CompareReturnTarget | null;
  scope: string;
  sourcePath: string;
  sourceSearchParams: CompareEntrySearchParams;
}): string {
  const parsed = parseUxResetSharedContext(input.sourceSearchParams);
  const county = input.county ?? parsed.county;
  const context: UxResetSharedContext = {
    compare: compareEntryPair({ compare: parsed.compare, county }),
    county,
    dataset: input.dataset ?? parsed.dataset,
    period: input.period ?? parsed.period,
    scope: input.scope.length > 0 ? input.scope : parsed.scope,
  };
  const href = uxResetShellHandoffHref(
    RESET_COMPARE_PATH,
    input.sourcePath,
    sharedContextToSearchParams(context)
  );
  if (!input.returnTo) {
    return href;
  }
  const [path, query = ""] = href.split("?");
  const next = new URLSearchParams(query);
  next.set("return", input.returnTo);
  const serialized = next.toString();
  return serialized ? `${path}?${serialized}` : path;
}

/**
 * What the shared compare parser kept, plus the raw-token issues it dropped.
 * The pair always comes from `mergeCompareQueryValues`.
 */
export type CompareEntry = {
  duplicateFips: string[];
  invalidTokens: string[];
  overfull: boolean;
  pair: string[];
};

export type ResolvedCompareEntry = CompareEntry & {
  /** A raw URL pair differed from the pair on screen and was not applied. */
  staleUrlIgnored: boolean;
};

export function classifyCompareEntry(
  rawValues: readonly string[]
): CompareEntry {
  const tokens: string[] = [];
  for (const value of rawValues) {
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        tokens.push(trimmed);
      }
    }
  }
  const invalidTokens: string[] = [];
  const seen = new Set<string>();
  const duplicateFips: string[] = [];
  for (const token of tokens) {
    if (!isCountyFips(token)) {
      invalidTokens.push(token);
      continue;
    }
    if (seen.has(token)) {
      if (!duplicateFips.includes(token)) {
        duplicateFips.push(token);
      }
      continue;
    }
    seen.add(token);
  }
  return {
    duplicateFips,
    invalidTokens,
    overfull: seen.size > UX_RESET_COMPARE_COUNTY_LIMIT,
    pair: mergeCompareQueryValues(rawValues),
  };
}

function entryFromPair(pair: readonly string[]): CompareEntry {
  return classifyCompareEntry([serializeCompareFipsList(pair)]);
}

/**
 * An in-progress edit stays on screen while a previous URL still names another
 * pair. Once nuqs matches that edit, a later URL change (Back, Forward, or a
 * new direct link) is shown. Invalid tokens are read only from a URL that
 * matches the pair on screen.
 */
export function resolveVisibleCompareEntry(input: {
  pendingPair: readonly string[] | null;
  rawCompareValues: readonly string[];
  statePair: readonly string[];
}): ResolvedCompareEntry {
  const fromRaw = classifyCompareEntry(input.rawCompareValues);
  const fromState = entryFromPair(input.statePair);
  const pending = input.pendingPair ? entryFromPair(input.pendingPair) : null;
  if (pending && pending.pair.join(",") !== fromState.pair.join(",")) {
    return {
      ...pending,
      staleUrlIgnored: fromRaw.pair.join(",") !== pending.pair.join(","),
    };
  }
  const visible = pending ?? fromState;
  const hydrated =
    !pending && fromState.pair.length === 0 && fromRaw.pair.length > 0;
  const pair = hydrated ? fromRaw.pair : visible.pair;
  if (fromRaw.pair.join(",") === pair.join(",")) {
    return { ...fromRaw, pair, staleUrlIgnored: false };
  }
  return { ...entryFromPair(pair), staleUrlIgnored: true };
}

/**
 * Replace one column. Returns null when the edit would repeat a county or
 * fill the second column before the first exists.
 */
export function replaceCompareSlot(
  pair: readonly string[],
  slot: 0 | 1,
  fips: string
): string[] | null {
  const canonical = parseCompareFipsList(pair.join(","));
  if (!isCountyFips(fips)) {
    return null;
  }
  if (slot === 1 && canonical.length === 0) {
    return null;
  }
  const other = slot === 0 ? canonical[1] : canonical[0];
  if (other === fips) {
    return null;
  }
  if (slot === 0) {
    return canonical[1] ? [fips, canonical[1]] : [fips];
  }
  const first = canonical[0];
  if (!first) {
    return null;
  }
  return [first, fips];
}

export function removeCompareMember(
  pair: readonly string[],
  fips: string
): string[] {
  return parseCompareFipsList(pair.filter((item) => item !== fips).join(","));
}

export function compareCountyOptionLabel(
  county: Pick<
    ExploreCountyIdentity,
    "county" | "fips" | "state" | "stateName"
  > | null,
  fips: string
): string {
  if (!county) {
    return `County ${fips}`;
  }
  const state = county.stateName || county.state;
  return `${county.county}, ${state} (${county.fips})`;
}

export function compareRecoveryMessages(input: {
  entry: CompareEntry;
  unknownFips: readonly string[];
}): string[] {
  const messages: string[] = [];
  if (input.entry.invalidTokens.length > 0) {
    messages.push(
      "This link included an identifier that is not a county FIPS. It was not used."
    );
  }
  if (input.entry.duplicateFips.length > 0) {
    messages.push(
      "The same county was listed more than once. Repeated identifiers were removed."
    );
  }
  if (input.entry.overfull) {
    messages.push(
      "Compare keeps two counties. Later counties in this link were not added."
    );
  }
  for (const fips of input.unknownFips) {
    messages.push(
      `County ${fips} is not in the published county list for this release.`
    );
  }
  if (input.entry.pair.length === 0) {
    messages.push(
      "Choose two counties to compare. Atlas will not select counties for you."
    );
  } else if (input.entry.pair.length === 1) {
    messages.push("One county is selected. Choose a second county to compare.");
  }
  return messages;
}
