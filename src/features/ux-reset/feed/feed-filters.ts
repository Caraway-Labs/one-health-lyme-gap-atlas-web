import { createParser, parseAsStringEnum } from "nuqs";

import type { ListIntelligenceFeedParams } from "@/generated/models/listIntelligenceFeedParams";
import { AtlasApiError } from "@/lib/api-mutator";

import { localCalendarDaysBefore } from "./feed-published-date";

export const FEED_PUBLISHED_PRESETS = ["7d", "30d", "90d", "all"] as const;

export type FeedPublishedPreset = (typeof FEED_PUBLISHED_PRESETS)[number];

export const DEFAULT_FEED_PUBLISHED: FeedPublishedPreset = "30d";

export const FEED_PUBLISHED_LABELS: Record<FeedPublishedPreset, string> = {
  "7d": "Past 7 days",
  "30d": "Past 30 days",
  "90d": "Past 90 days",
  all: "All dates",
};

/** Select sentinel. It is not a source id and is never sent to the API. */
export const ALL_FEED_SOURCES_VALUE = "__all_sources__";

/** Mirrors the intelligence feed `source_id` pattern. */
export const FEED_SOURCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/;

export const INTELLIGENCE_SOURCE_PAGE_CAP = 10;

const PUBLISHED_DAY_COUNTS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const;

export type FeedFilterState = {
  published: FeedPublishedPreset;
  sourceId: string | null;
};

export type FeedSourceCatalogRow = {
  organization: string;
  registry_version: number;
  source_id: string;
};

export type FeedSourceOption = {
  label: string;
  organization: string;
  sourceId: string;
};

export type FeedSourcePage = {
  nextPageToken: string | null;
  rows: readonly FeedSourceCatalogRow[];
};

export function isFeedPublishedPreset(
  value: string
): value is FeedPublishedPreset {
  return FEED_PUBLISHED_PRESETS.some((preset) => preset === value);
}

export function isFeedSourceId(value: string): boolean {
  return FEED_SOURCE_ID_PATTERN.test(value);
}

function presetDayCount(preset: Exclude<FeedPublishedPreset, "all">): number {
  switch (preset) {
    case "7d":
    case "30d":
    case "90d": {
      return PUBLISHED_DAY_COUNTS[preset];
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

/** Inclusive published_from. All dates omits the parameter. */
export function publishedFromForPreset(
  preset: FeedPublishedPreset,
  now: Date,
  timeZone?: string
): string | undefined {
  if (preset === "all") {
    return undefined;
  }
  return localCalendarDaysBefore(presetDayCount(preset), now, timeZone);
}

/**
 * Params for one feed request. Page token is added by the caller. All sources
 * omits source_id. All dates omits both date params. published_to is never sent.
 */
export function buildFeedListParams(
  filters: FeedFilterState,
  now: Date
): ListIntelligenceFeedParams | undefined {
  const params: ListIntelligenceFeedParams = {};
  if (filters.sourceId) {
    params.source_id = filters.sourceId;
  }
  const publishedFrom = publishedFromForPreset(filters.published, now);
  if (publishedFrom) {
    params.published_from = publishedFrom;
  }
  if (!params.source_id && !params.published_from) {
    return undefined;
  }
  return params;
}

export function withFeedPageToken(
  params: ListIntelligenceFeedParams | undefined,
  pageToken?: string
): ListIntelligenceFeedParams | undefined {
  if (!pageToken) {
    return params;
  }
  return { ...params, page_token: pageToken };
}

export function activeFeedFilterCount(filters: FeedFilterState): number {
  let count = 0;
  if (filters.sourceId) {
    count += 1;
  }
  if (filters.published !== DEFAULT_FEED_PUBLISHED) {
    count += 1;
  }
  return count;
}

/**
 * True when the feed request sends source_id or published_from.
 * The default Past 30 days control still narrows; only All dates with no
 * source is an unfiltered request. Chip count stays separate.
 */
export function feedRequestNarrows(filters: FeedFilterState): boolean {
  return buildFeedListParams(filters, new Date()) !== undefined;
}

export function feedResultSummary(
  count: number,
  moreAvailable: boolean
): string {
  const noun = count === 1 ? "item" : "items";
  const showing = `Showing ${count} ${noun}`;
  if (!moreAvailable) {
    return showing;
  }
  return `${showing} · more available`;
}

/**
 * One option per source id. Duplicate registry versions collapse to the newest
 * row. Shared organization names gain the source id so they stay distinct.
 * Options are sorted A–Z by organization.
 */
export function feedSourceOptions(
  rows: readonly FeedSourceCatalogRow[]
): FeedSourceOption[] {
  const byId = new Map<string, FeedSourceCatalogRow>();
  for (const row of rows) {
    const existing = byId.get(row.source_id);
    if (!existing || row.registry_version > existing.registry_version) {
      byId.set(row.source_id, row);
    }
  }
  const options = [...byId.values()].map((row) => ({
    label: row.organization,
    organization: row.organization,
    sourceId: row.source_id,
  }));
  const organizationCounts = new Map<string, number>();
  for (const option of options) {
    organizationCounts.set(
      option.organization,
      (organizationCounts.get(option.organization) ?? 0) + 1
    );
  }
  for (const option of options) {
    if ((organizationCounts.get(option.organization) ?? 0) > 1) {
      option.label = `${option.organization} (${option.sourceId})`;
    }
  }
  options.sort(
    (left, right) =>
      left.organization.localeCompare(right.organization, "en", {
        sensitivity: "base",
      }) ||
      left.label.localeCompare(right.label, "en", { sensitivity: "base" }) ||
      left.sourceId.localeCompare(right.sourceId)
  );
  return options;
}

export async function collectIntelligenceSourcePages(
  fetchPage: (pageToken?: string) => Promise<FeedSourcePage>
): Promise<FeedSourceCatalogRow[]> {
  const rows: FeedSourceCatalogRow[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < INTELLIGENCE_SOURCE_PAGE_CAP; page += 1) {
    const result = await fetchPage(pageToken);
    rows.push(...result.rows);
    if (!result.nextPageToken) {
      return rows;
    }
    pageToken = result.nextPageToken;
  }
  return rows;
}

function problemFields(error: AtlasApiError): {
  code: string;
  detail: string;
} {
  const body = error.responseBody;
  if (!body || typeof body !== "object") {
    return { code: "", detail: "" };
  }
  const record = body as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : "",
    detail: typeof record.detail === "string" ? record.detail : "",
  };
}

export function isFeedQueryTooBroad(error: unknown): boolean {
  if (!(error instanceof AtlasApiError) || error.status !== 400) {
    return false;
  }
  return problemFields(error).code === "QUERY_TOO_BROAD";
}

/** Show more received a page token the server no longer accepts. */
export function isStaleFeedPageToken(error: unknown): boolean {
  if (!(error instanceof AtlasApiError) || error.status !== 400) {
    return false;
  }
  if (isFeedQueryTooBroad(error)) {
    return false;
  }
  return problemFields(error).detail.includes("Projection changed");
}

export const feedSourceParser = createParser({
  parse(value: string) {
    return isFeedSourceId(value) ? value : null;
  },
  serialize(value: string) {
    return value;
  },
});

export const feedPublishedParser = parseAsStringEnum([
  ...FEED_PUBLISHED_PRESETS,
]).withDefault(DEFAULT_FEED_PUBLISHED);

/** Any non-empty `item` value is kept so a malformed id can be looked up. */
export const feedItemParser = createParser({
  parse(value: string) {
    return value.length > 0 ? value : null;
  },
  serialize(value: string) {
    return value;
  },
});

export const feedSearchParams = {
  item: feedItemParser,
  published: feedPublishedParser,
  source: feedSourceParser,
};
