import type { CompareCountyOption } from "@/features/ux-reset/compare/use-compare-workspace";

export const COMPARE_ALL_STATES = "ALL";
export const COMPARE_PICKER_RESULT_LIMIT = 50;

export type CompareStateFilterOption = {
  code: string;
  name: string;
};

export type CompareCountyMatches = {
  matches: CompareCountyOption[];
  total: number;
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,()/-]+/)
    .filter((word) => word.length > 0);
}

function queryTokens(query: string): string[] {
  return words(query);
}

function optionWords(option: CompareCountyOption): string[] {
  return [
    ...words(option.countyName),
    ...words(option.stateLabel),
    ...words(option.stateCode),
    option.fips,
  ];
}

function tokenMatches(token: string, haystack: readonly string[]): boolean {
  return haystack.some((word) => word.startsWith(token));
}

/**
 * Lower rank sorts first. Names that start with what the user typed come
 * before names that only match on a later word, state, or FIPS.
 */
function matchRank(option: CompareCountyOption, tokens: string[]): number {
  const [first] = tokens;
  if (!first) {
    return 0;
  }
  const name = option.countyName.toLowerCase();
  if (name.startsWith(tokens.join(" "))) {
    return 0;
  }
  if (name.startsWith(first)) {
    return 1;
  }
  return 2;
}

export function compareStateFilterOptions(
  options: readonly CompareCountyOption[]
): CompareStateFilterOption[] {
  const byCode = new Map<string, CompareStateFilterOption>();
  for (const option of options) {
    if (!option.stateCode || byCode.has(option.stateCode)) {
      continue;
    }
    byCode.set(option.stateCode, {
      code: option.stateCode,
      name: option.stateLabel || option.stateCode,
    });
  }
  return [...byCode.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, "en")
  );
}

/**
 * Filters county options by an optional state and a free-text query.
 * The query matches the county name, the state name or code, and the FIPS.
 * Every typed word must match the start of a word in the county record.
 */
export function filterCompareCountyOptions(
  options: readonly CompareCountyOption[],
  input: {
    limit?: number;
    query: string;
    stateCode: string;
  }
): CompareCountyMatches {
  const tokens = queryTokens(input.query);
  const limit = input.limit ?? COMPARE_PICKER_RESULT_LIMIT;
  const matched = options
    .filter((option) => {
      if (
        input.stateCode !== COMPARE_ALL_STATES &&
        option.stateCode !== input.stateCode
      ) {
        return false;
      }
      if (tokens.length === 0) {
        return true;
      }
      const haystack = optionWords(option);
      return tokens.every((token) => tokenMatches(token, haystack));
    })
    .map((option) => ({ option, rank: matchRank(option, tokens) }))
    .toSorted((left, right) => left.rank - right.rank)
    .map((entry) => entry.option);
  return { matches: matched.slice(0, limit), total: matched.length };
}
