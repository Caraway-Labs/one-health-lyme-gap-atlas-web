import {
  mergeCompareQueryValues,
  parseCompareFipsList,
  serializeCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { isCountyFips } from "@/lib/county-geography";

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
