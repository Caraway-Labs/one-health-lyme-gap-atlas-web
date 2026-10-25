import { describe, expect, it, vi } from "vitest";

import {
  activeFeedFilterCount,
  buildFeedListParams,
  feedRequestNarrows,
  collectIntelligenceSourcePages,
  feedPublishedParser,
  feedResultSummary,
  feedSourceOptions,
  feedSourceParser,
  INTELLIGENCE_SOURCE_PAGE_CAP,
  isFeedQueryTooBroad,
  isStaleFeedPageToken,
  publishedFromForPreset,
  withFeedPageToken,
} from "@/features/ux-reset/feed/feed-filters";
import { AtlasApiError } from "@/lib/api-mutator";

describe("intelligence feed filters", () => {
  it("builds inclusive local dates for month, year, and leap boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T15:00:00.000Z"));
    expect(publishedFromForPreset("7d", new Date(), "UTC")).toBe("2025-12-25");
    vi.setSystemTime(new Date("2026-03-01T15:00:00.000Z"));
    expect(publishedFromForPreset("30d", new Date(), "UTC")).toBe("2026-01-30");
    expect(publishedFromForPreset("90d", new Date(), "UTC")).toBe("2025-12-01");
    expect(
      publishedFromForPreset("30d", new Date("2024-03-01T00:00:00.000Z"), "UTC")
    ).toBe("2024-01-31");
    expect(publishedFromForPreset("all", new Date(), "UTC")).toBeUndefined();
    vi.useRealTimers();
  });

  it("keeps the local calendar date across a DST boundary", () => {
    const now = new Date("2026-03-09T04:30:00.000Z");
    expect(publishedFromForPreset("7d", now, "America/New_York")).toBe(
      "2026-03-02"
    );
    const exactWeekEarlier = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(
      new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/New_York",
        year: "numeric",
      }).format(exactWeekEarlier)
    ).toBe("2026-03-01");
  });

  it("maps filters to source_id and published_from only", () => {
    const now = new Date("2026-04-15T18:00:00.000Z");
    expect(
      buildFeedListParams({ published: "30d", sourceId: null }, now)
    ).toStrictEqual({ published_from: publishedFromForPreset("30d", now) });
    expect(
      buildFeedListParams({ published: "all", sourceId: "cdc-lyme" }, now)
    ).toStrictEqual({ source_id: "cdc-lyme" });
    expect(
      buildFeedListParams({ published: "all", sourceId: null }, now)
    ).toBeUndefined();
    expect(
      withFeedPageToken(
        buildFeedListParams({ published: "7d", sourceId: "cdc-lyme" }, now),
        "page-2"
      )
    ).toStrictEqual({
      page_token: "page-2",
      published_from: publishedFromForPreset("7d", now),
      source_id: "cdc-lyme",
    });
    const params = buildFeedListParams(
      { published: "90d", sourceId: "cdc-lyme" },
      now
    );
    expect(params && "published_to" in params).toBeFalsy();
  });

  it("parses shareable filter params and rejects invalid values", () => {
    expect({
      defaultPublished: feedPublishedParser.defaultValue,
      emptySource: feedSourceParser.parse(""),
      invalidPublished: feedPublishedParser.parse("nope"),
      invalidSource: feedSourceParser.parse("bad id"),
      published: feedPublishedParser.parse("7d"),
      publishedAll: feedPublishedParser.parse("all"),
      publishedWide: feedPublishedParser.parse("90d"),
      source: feedSourceParser.parse("cdc-lyme"),
    }).toStrictEqual({
      defaultPublished: "all",
      emptySource: null,
      invalidPublished: null,
      invalidSource: null,
      published: "7d",
      publishedAll: "all",
      publishedWide: "90d",
      source: "cdc-lyme",
    });
  });

  it("dedupes registry versions, disambiguates organizations, and sorts A–Z", () => {
    expect(
      feedSourceOptions([
        {
          organization: "State Health Department",
          registry_version: 1,
          source_id: "state-b",
        },
        {
          organization: "Centers for Disease Control and Prevention",
          registry_version: 1,
          source_id: "cdc-old",
        },
        {
          organization: "State Health Department",
          registry_version: 2,
          source_id: "state-a",
        },
        {
          organization: "Centers for Disease Control and Prevention",
          registry_version: 4,
          source_id: "cdc-lyme",
        },
        {
          organization: "Obsolete name",
          registry_version: 2,
          source_id: "cdc-lyme",
        },
      ]).map((option) => option.label)
    ).toStrictEqual([
      "Centers for Disease Control and Prevention (cdc-lyme)",
      "Centers for Disease Control and Prevention (cdc-old)",
      "State Health Department (state-a)",
      "State Health Department (state-b)",
    ]);
    expect(
      feedSourceOptions([
        {
          organization: "Obsolete name",
          registry_version: 2,
          source_id: "cdc-lyme",
        },
        {
          organization: "Centers for Disease Control and Prevention",
          registry_version: 4,
          source_id: "cdc-lyme",
        },
      ]).map((option) => option.label)
    ).toStrictEqual(["Centers for Disease Control and Prevention"]);
  });

  it("stops paging the source catalog at the cap", async () => {
    const tokens: (string | undefined)[] = [];
    const rows = await collectIntelligenceSourcePages(async (pageToken) => {
      tokens.push(pageToken);
      return {
        nextPageToken: `page-${tokens.length}`,
        rows: [
          {
            organization: `Org ${tokens.length}`,
            registry_version: 1,
            source_id: `src-${tokens.length}`,
          },
        ],
      };
    });
    expect(tokens).toHaveLength(INTELLIGENCE_SOURCE_PAGE_CAP);
    expect(tokens[0]).toBeUndefined();
    expect(rows).toHaveLength(INTELLIGENCE_SOURCE_PAGE_CAP);
  });

  it("describes loaded rows without a total", () => {
    expect(feedResultSummary(1, false)).toBe("Showing 1 item");
    expect(feedResultSummary(24, false)).toBe("Showing 24 items");
    expect(feedResultSummary(100, true)).toBe(
      "Showing 100 items · more available"
    );
    expect({
      allDates: activeFeedFilterCount({ published: "all", sourceId: null }),
      past30: activeFeedFilterCount({ published: "30d", sourceId: null }),
      sourceAndWeek: activeFeedFilterCount({
        published: "7d",
        sourceId: "cdc-lyme",
      }),
    }).toStrictEqual({
      allDates: 0,
      past30: 1,
      sourceAndWeek: 2,
    });
  });

  it("narrows only when a source or a shorter date window is selected", () => {
    expect({
      allDates: feedRequestNarrows({ published: "all", sourceId: null }),
      past30: feedRequestNarrows({ published: "30d", sourceId: null }),
      sourceOnly: feedRequestNarrows({
        published: "all",
        sourceId: "cdc-lyme",
      }),
    }).toStrictEqual({
      allDates: false,
      past30: true,
      sourceOnly: true,
    });
  });

  it("distinguishes a too-broad query from a stale page token", () => {
    const tooBroad = new AtlasApiError(
      "Narrow the source or publication dates.",
      "/v1/intelligence/feed",
      400,
      "req-broad",
      null,
      {
        code: "QUERY_TOO_BROAD",
        detail: "Narrow the source or publication dates.",
      }
    );
    const stale = new AtlasApiError(
      "Projection changed; restart pagination.",
      "/v1/intelligence/feed",
      400,
      "req-stale",
      null,
      { detail: "Projection changed; restart pagination." }
    );
    expect(isFeedQueryTooBroad(tooBroad)).toBeTruthy();
    expect(isStaleFeedPageToken(tooBroad)).toBeFalsy();
    expect(isStaleFeedPageToken(stale)).toBeTruthy();
    expect(isFeedQueryTooBroad(stale)).toBeFalsy();
  });
});
