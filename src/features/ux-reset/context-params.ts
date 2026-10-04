import { createParser, parseAsString } from "nuqs";
import { z } from "zod";

import { isCountyFips } from "@/lib/county-geography";

const DATASET_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATE_SCOPE_PATTERN = /^[A-Z]{2}$/;
const MAX_COMPARE_COUNTIES = 5;

export const UX_RESET_SHARED_CONTEXT_PARAM_KEYS = [
  "scope",
  "county",
  "compare",
  "dataset",
  "period",
] as const;

export type UxResetSharedContextParamKey =
  (typeof UX_RESET_SHARED_CONTEXT_PARAM_KEYS)[number];

/** Page-local URL keys — never copied across UX Reset routes. */
export const UX_RESET_PAGE_LOCAL_PARAM_KEYS = {
  action: ["plan", "role"] as const,
  assistant: ["conversation"] as const,
  compare: ["metric"] as const,
  explore: ["view", "metric", "page", "selected", "map_scope"] as const,
  feed: ["tab"] as const,
  investigate: ["evidence", "eco", "breakpoint", "missing", "q"] as const,
  review: ["sort", "page"] as const,
  settings: [] as const,
} as const;

export function parseCompareFipsList(value: string): string[] {
  const parts = value.split(",");
  const unique: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!isCountyFips(trimmed) || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
    if (unique.length >= MAX_COMPARE_COUNTIES) {
      break;
    }
  }
  return unique;
}

export function serializeCompareFipsList(fips: readonly string[]): string {
  return parseCompareFipsList(fips.join(",")).join(",");
}

function parseReviewScope(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "ALL") {
    return "ALL";
  }
  if (STATE_SCOPE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

const reviewScopeParser = createParser({
  parse: parseReviewScope,
  serialize: (value) => value,
});

const countyFipsParser = createParser({
  parse: (value) => (isCountyFips(value) ? value : null),
  serialize: (value) => value,
});

const compareListParser = createParser({
  parse: parseCompareFipsList,
  serialize: serializeCompareFipsList,
});

const datasetParser = createParser({
  parse: (value) => (DATASET_PATTERN.test(value) ? value : null),
  serialize: (value) => value,
});

const periodParser = createParser({
  parse: (value) => (ISO_DATE_PATTERN.test(value) ? value : null),
  serialize: (value) => value,
});

/**
 * Shared nuqs parsers for UX Reset routes. Pages compose these with local parsers;
 * only keys accepted by the handoff matrix should survive navigation.
 */
export const uxResetSharedContextParsers = {
  compare: compareListParser,
  county: countyFipsParser,
  dataset: datasetParser,
  period: periodParser,
  scope: reviewScopeParser.withDefault("ALL"),
};

export const uxResetSharedContextSchema = z.object({
  compare: z.array(z.string().regex(/^\d{5}$/)).max(MAX_COMPARE_COUNTIES),
  county: z
    .string()
    .regex(/^\d{5}$/)
    .nullable(),
  dataset: z.string().regex(DATASET_PATTERN).nullable(),
  period: z.string().regex(ISO_DATE_PATTERN).nullable(),
  scope: z.union([z.literal("ALL"), z.string().regex(STATE_SCOPE_PATTERN)]),
});

export type UxResetSharedContext = z.infer<typeof uxResetSharedContextSchema>;

type SearchParamReader = Pick<URLSearchParams, "get" | "getAll" | "has">;

export function parseUxResetSharedContext(
  searchParams: SearchParamReader
): UxResetSharedContext {
  const scopeRaw = searchParams.get("scope");
  const scope = scopeRaw ? parseReviewScope(scopeRaw) : "ALL";
  const countyRaw = searchParams.get("county");
  const county = countyRaw && isCountyFips(countyRaw) ? countyRaw : null;
  const compare: string[] = [];
  if (searchParams.has("compare")) {
    for (const value of searchParams.getAll("compare")) {
      compare.push(...parseCompareFipsList(value));
    }
  }
  const datasetRaw = searchParams.get("dataset");
  const dataset =
    datasetRaw && DATASET_PATTERN.test(datasetRaw) ? datasetRaw : null;
  const periodRaw = searchParams.get("period");
  const period =
    periodRaw && ISO_DATE_PATTERN.test(periodRaw) ? periodRaw : null;

  return uxResetSharedContextSchema.parse({
    compare: [...new Set(compare)].slice(0, MAX_COMPARE_COUNTIES),
    county,
    dataset,
    period,
    scope: scope ?? "ALL",
  });
}

export function sharedContextToSearchParams(
  context: UxResetSharedContext
): URLSearchParams {
  const params = new URLSearchParams();
  if (context.scope !== "ALL") {
    params.set("scope", context.scope);
  }
  if (context.county) {
    params.set("county", context.county);
  }
  if (context.compare.length > 0) {
    params.set("compare", serializeCompareFipsList(context.compare));
  }
  if (context.dataset) {
    params.set("dataset", context.dataset);
  }
  if (context.period) {
    params.set("period", context.period);
  }
  return params;
}

/** Explore-only selection list; may map into `compare` when entering Compare. */
export function readExploreSelectedFips(
  searchParams: SearchParamReader
): string[] {
  if (!searchParams.has("selected")) {
    return [];
  }
  const merged: string[] = [];
  for (const value of searchParams.getAll("selected")) {
    merged.push(...parseCompareFipsList(value));
  }
  return [...new Set(merged)].slice(0, MAX_COMPARE_COUNTIES);
}

export const uxResetExploreLocalParsers = {
  map_scope: parseAsString,
  metric: parseAsString,
  page: parseAsString,
  selected: compareListParser,
  view: parseAsString,
};
