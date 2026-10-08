import { createLoader, createMultiParser, createParser } from "nuqs";
import { z } from "zod";

import { isCountyFips } from "@/lib/county-geography";

const DATASET_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Dataset and release tokens accepted on UX Reset URLs. Callers trim first. */
export function isUxResetDatasetId(value: string): boolean {
  return DATASET_PATTERN.test(value);
}
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const STATE_SCOPE_PATTERN = /^[A-Z]{2}$/;

/** UX Reset Compare V1 baseline (issues 398, 418). */
export const UX_RESET_COMPARE_COUNTY_LIMIT = 2;

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
  compare: ["metric", "return"] as const,
  explore: ["view", "metric", "page", "selected", "map_scope"] as const,
  feed: ["tab"] as const,
  investigate: ["evidence", "eco", "breakpoint", "missing", "q"] as const,
  review: ["sort", "page"] as const,
  settings: [] as const,
} as const;

/**
 * Validates `YYYY-MM-DD` as a real calendar date (UTC). Release-specific period
 * availability is out of scope for this contract.
 */
export function parseCalendarIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!ISO_DATE_SHAPE.test(trimmed)) {
    return null;
  }
  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function parseCompareFipsList(value: string): string[] {
  const parts = value.split(",");
  const unique: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!isCountyFips(trimmed) || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
    if (unique.length >= UX_RESET_COMPARE_COUNTY_LIMIT) {
      break;
    }
  }
  return unique;
}

export function mergeCompareQueryValues(values: readonly string[]): string[] {
  const merged: string[] = [];
  for (const value of values) {
    merged.push(...parseCompareFipsList(value));
  }
  return parseCompareFipsList(merged.join(","));
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

function canonicalScopeFromQueryValues(
  values: readonly string[]
): "ALL" | string {
  if (values.length === 0) {
    return "ALL";
  }
  const parsed = values.map((value) => parseReviewScope(value));
  if (parsed.some((value) => value === null)) {
    return "ALL";
  }
  const unique = [...new Set(parsed)];
  if (unique.length !== 1) {
    return "ALL";
  }
  return unique[0] ?? "ALL";
}

function canonicalCountyFromQueryValues(
  values: readonly string[]
): string | null {
  if (values.length === 0) {
    return null;
  }
  const parsed: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!isCountyFips(trimmed)) {
      return null;
    }
    if (!parsed.includes(trimmed)) {
      parsed.push(trimmed);
    }
  }
  if (parsed.length !== 1) {
    return null;
  }
  return parsed[0] ?? null;
}

function canonicalDatasetFromQuery(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }
  const valid = values.filter((value) => DATASET_PATTERN.test(value));
  if (valid.length !== 1) {
    return null;
  }
  return valid[0] ?? null;
}

function canonicalPeriodFromQuery(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }
  const parsed = values.map((value) => parseCalendarIsoDate(value));
  if (parsed.some((value) => value === null)) {
    return null;
  }
  const unique = [...new Set(parsed)];
  if (unique.length !== 1) {
    return null;
  }
  return unique[0] ?? null;
}

const reviewScopeParser = createMultiParser({
  parse: (values) => canonicalScopeFromQueryValues(values),
  serialize: (value) => [value],
})
  .withOptions({ clearOnDefault: false })
  .withDefault("ALL");

const countyFipsParser = createMultiParser({
  parse: (values) => canonicalCountyFromQueryValues(values),
  serialize: (value) => (value ? [value] : []),
});

const compareListParser = createMultiParser({
  parse: (values) => mergeCompareQueryValues(values),
  serialize: (value) =>
    value.length > 0 ? [serializeCompareFipsList(value)] : [],
}).withDefault([]);

const datasetParser = createMultiParser({
  parse: (values) => canonicalDatasetFromQuery(values),
  serialize: (value) => (value ? [value] : []),
});

const periodParser = createMultiParser({
  parse: (values) => canonicalPeriodFromQuery(values),
  serialize: (value) => (value ? [value] : []),
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
  scope: reviewScopeParser,
};

/** nuqs server/client loader — must match `parseUxResetSharedContext` for the same URL. */
export const loadUxResetSharedContext = createLoader(
  uxResetSharedContextParsers
);

export const uxResetSharedContextSchema = z.object({
  compare: z
    .array(z.string().regex(/^\d{5}$/))
    .max(UX_RESET_COMPARE_COUNTY_LIMIT),
  county: z
    .string()
    .regex(/^\d{5}$/)
    .nullable(),
  dataset: z.string().regex(DATASET_PATTERN).nullable(),
  period: z.string().regex(ISO_DATE_SHAPE).nullable(),
  scope: z.union([z.literal("ALL"), z.string().regex(STATE_SCOPE_PATTERN)]),
});

export type UxResetSharedContext = z.infer<typeof uxResetSharedContextSchema>;

type SearchParamReader = Pick<URLSearchParams, "get" | "getAll" | "has">;

function queryValues(searchParams: SearchParamReader, key: string): string[] {
  if (!searchParams.has(key)) {
    return [];
  }
  return searchParams.getAll(key);
}

export function parseUxResetSharedContext(
  searchParams: SearchParamReader
): UxResetSharedContext {
  const context = {
    compare: mergeCompareQueryValues(queryValues(searchParams, "compare")),
    county: canonicalCountyFromQueryValues(queryValues(searchParams, "county")),
    dataset: canonicalDatasetFromQuery(queryValues(searchParams, "dataset")),
    period: canonicalPeriodFromQuery(queryValues(searchParams, "period")),
    scope: canonicalScopeFromQueryValues(queryValues(searchParams, "scope")),
  };
  return uxResetSharedContextSchema.parse(context);
}

export type SharedContextSerializeOptions = {
  keys?: readonly UxResetSharedContextParamKey[];
};

export function sharedContextToSearchParams(
  context: UxResetSharedContext,
  options: SharedContextSerializeOptions = {}
): URLSearchParams {
  const allowed = options.keys
    ? new Set(options.keys)
    : new Set(UX_RESET_SHARED_CONTEXT_PARAM_KEYS);
  const params = new URLSearchParams();
  if (allowed.has("scope")) {
    params.set("scope", context.scope);
  }
  if (allowed.has("county") && context.county) {
    params.set("county", context.county);
  }
  if (allowed.has("compare") && context.compare.length > 0) {
    params.set("compare", serializeCompareFipsList(context.compare));
  }
  if (allowed.has("dataset") && context.dataset) {
    params.set("dataset", context.dataset);
  }
  if (allowed.has("period") && context.period) {
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
  return mergeCompareQueryValues(searchParams.getAll("selected"));
}

export const uxResetExploreLocalParsers = {
  map_scope: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  metric: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  page: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  selected: compareListParser,
  view: createParser({
    parse: (value) => value,
    serialize: String,
  }),
};
