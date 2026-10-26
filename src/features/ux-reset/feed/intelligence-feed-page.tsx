"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import {
  analyticsControlAttributes,
  trackFeedFilterApplied,
  trackFeedFilterCleared,
  trackFeedItemDetailOpened,
  type FeedDetailEntrySurface,
} from "@/lib/atlas-analytics";

import {
  selectFeaturedFeedArticle,
  FEATURED_FEED_SUBSET_NOTE,
} from "./feed-feature";
import { FeedFeaturedArticle } from "./feed-featured-article";
import {
  activeFeedFilterCount,
  DEFAULT_FEED_PUBLISHED,
  FEED_PUBLISHED_LABELS,
  feedRequestNarrows,
  feedResultSummary,
  feedSearchParams,
  feedSourceOptions,
  isFeedPublishedPreset,
  isFeedQueryTooBroad,
  isFeedSourceId,
  type FeedFilterState,
  type FeedPublishedPreset,
} from "./feed-filters";
import { FeedItemCard } from "./feed-item-card";
import { FeedItemDetailDialog, type FeedDetailView } from "./feed-item-detail";
import {
  FEED_FOOTER_NON_ENDORSEMENT,
  FEED_FOOTER_PUBLIC_DOMAIN,
  FEED_NCBI_COPYRIGHT_HREF,
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedItemLookupFailure,
  feedRequestFailure,
  itemFeedCaveats,
  sharedFeedCaveats,
} from "./feed-presentation";
import { IntelligenceFeedFilters } from "./intelligence-feed-filters";
import {
  RESEARCH_NEWS_HEADING,
  RESEARCH_NEWS_IMAGERY_NOTE,
  RESEARCH_NEWS_SUBTITLE,
} from "./research-news-controls";
import {
  resetIntelligenceFeedToFirstPage,
  useIntelligenceFeed,
} from "./use-intelligence-feed";
import { useIntelligenceFeedEntry } from "./use-intelligence-feed-entry";
import { useIntelligenceSources } from "./use-intelligence-sources";

const EMPTY_TITLE = "No new items";
const EMPTY_BODY =
  "Approved trusted sources have no items in this feed right now.";
const FILTERED_EMPTY_TITLE = "No items match these filters";
const FILTERED_EMPTY_BODY = "Try another source or a wider date range.";
const DATE_WINDOW_EMPTY_TITLE = "No items in this date window";

function dateWindowEmptyBody(published: FeedPublishedPreset): string {
  return `${FEED_PUBLISHED_LABELS[published]} has no matching items. All dates includes older items and items without a publication date.`;
}
const TOO_BROAD_TITLE = "Too many items to show at once";
const TOO_BROAD_BODY = "Choose a source or a shorter date range.";

function FeedLimitations({ limitations }: { limitations: readonly string[] }) {
  if (limitations.length === 0) {
    return null;
  }
  return (
    <ul className="ux-reset-feed-limitations">
      {limitations.map((limitation) => (
        <li key={limitation}>{limitation}</li>
      ))}
    </ul>
  );
}

function FeedFooter() {
  return (
    <footer className="ux-reset-feed-footer">
      <p>
        {FEED_FOOTER_PUBLIC_DOMAIN}{" "}
        <a
          {...analyticsControlAttributes("feed_ncbi_copyright_open")}
          href={FEED_NCBI_COPYRIGHT_HREF}
          rel={FEED_EXTERNAL_LINK_REL}
          target={FEED_EXTERNAL_LINK_TARGET}
        >
          NCBI copyright and disclaimers
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      <p>{FEED_FOOTER_NON_ENDORSEMENT}</p>
    </footer>
  );
}

function FeedRetry({ onRetry }: { onRetry: () => Promise<unknown> }) {
  return (
    <Button
      {...analyticsControlAttributes("feed_retry")}
      onClick={() => {
        void onRetry();
      }}
      type="button"
      variant="outline"
    >
      Try again
    </Button>
  );
}

export function IntelligenceFeedExperience() {
  const queryClient = useQueryClient();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [urlState, setUrlState] = useQueryStates(feedSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const filters: FeedFilterState = {
    published: urlState.published,
    sourceId: urlState.source,
  };
  const sources = useIntelligenceSources();
  const sourceOptions = useMemo(
    () => feedSourceOptions(sources.data ?? []),
    [sources.data]
  );
  const feed = useIntelligenceFeed(filters);
  const rawSource = searchParams.get("source");
  const rawPublished = searchParams.get("published");

  useEffect(() => {
    const patch: { published?: null; source?: null } = {};
    if (
      rawPublished !== null &&
      (!isFeedPublishedPreset(rawPublished) ||
        rawPublished === DEFAULT_FEED_PUBLISHED)
    ) {
      patch.published = null;
    }
    // source_catalog_complete is fixed false, so a missing catalog row does not
    // invalidate a syntactically valid deep-linked source id.
    if (rawSource !== null && !isFeedSourceId(rawSource)) {
      patch.source = null;
    }
    if (patch.published === undefined && patch.source === undefined) {
      return;
    }
    void setUrlState(patch, { history: "replace", scroll: false });
  }, [rawPublished, rawSource, setUrlState]);

  const pages = feed.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data);
  const limitations = pages[0]?.meta.limitations ?? [];
  const requestNarrows = feedRequestNarrows(filters);
  const tooBroad =
    items.length === 0 && feed.isError && isFeedQueryTooBroad(feed.error);
  const nextPageFailure =
    items.length > 0 && feed.isFetchNextPageError && !feed.isRestartingPage
      ? feedRequestFailure(feed.error)
      : null;
  const refreshFailure =
    items.length > 0 && feed.isRefetchError
      ? feedRequestFailure(feed.error)
      : null;
  const failure =
    items.length === 0 && feed.isError && !tooBroad
      ? feedRequestFailure(feed.error)
      : null;
  const sharedCaveats = sharedFeedCaveats(items);
  const itemId = urlState.item;
  const itemLookup = useIntelligenceFeedEntry(itemId, itemId !== null);

  const openDetail = (
    entry: FeedListEntry,
    surface: FeedDetailEntrySurface
  ) => {
    trackFeedItemDetailOpened(surface, entry.source_family);
    void setUrlState(
      { item: entry.item_id },
      { history: "push", scroll: false }
    );
  };

  const closeDetail = (open: boolean) => {
    if (open || urlState.item === null) {
      return;
    }
    void setUrlState({ item: null }, { history: "push", scroll: false });
  };

  let detailView: FeedDetailView = { status: "loading" };
  if (itemLookup.isError && !itemLookup.isFetching) {
    detailView = {
      status: feedItemLookupFailure(itemLookup.error),
    };
  } else if (itemLookup.data) {
    detailView = { entry: itemLookup.data, status: "ready" };
  }

  const commitFilters = (next: FeedFilterState) => {
    void resetIntelligenceFeedToFirstPage(queryClient, next);
    void setUrlState(
      {
        published:
          next.published === DEFAULT_FEED_PUBLISHED ? null : next.published,
        source: next.sourceId,
      },
      { history: "push", scroll: false }
    );
  };

  const applySource = (sourceId: string | null) => {
    if (sourceId === filters.sourceId) {
      return;
    }
    const next = { ...filters, sourceId };
    commitFilters(next);
    trackFeedFilterApplied(
      "feed_source",
      sourceId ? "source_selected" : "all",
      activeFeedFilterCount(next)
    );
  };

  const applyPublished = (published: FeedPublishedPreset) => {
    if (published === filters.published) {
      return;
    }
    const next = { ...filters, published };
    commitFilters(next);
    trackFeedFilterApplied(
      "feed_published",
      published,
      activeFeedFilterCount(next)
    );
  };

  const removeSource = () => {
    const next = { ...filters, sourceId: null };
    commitFilters(next);
    trackFeedFilterCleared("single", activeFeedFilterCount(next));
  };

  const removePublished = () => {
    const next = { ...filters, published: DEFAULT_FEED_PUBLISHED };
    commitFilters(next);
    trackFeedFilterCleared("single", activeFeedFilterCount(next));
  };

  const clearFilters = () => {
    commitFilters({ published: DEFAULT_FEED_PUBLISHED, sourceId: null });
    trackFeedFilterCleared("all", 0);
    filterBarRef.current?.focus({ preventScroll: true });
  };

  let body: ReactNode;
  let state:
    | "empty"
    | "error"
    | "filtered-empty"
    | "loading"
    | "ready"
    | "too-broad"
    | "unavailable";
  if (feed.isPending) {
    state = "loading";
    body = (
      <AtlasStatusMessage
        title="Loading the intelligence feed"
        titleAs="h2"
        tone="loading"
      >
        Reading trusted-source items.
      </AtlasStatusMessage>
    );
  } else if (tooBroad) {
    state = "too-broad";
    body = (
      <AtlasStatusMessage title={TOO_BROAD_TITLE} titleAs="h2" tone="empty">
        {TOO_BROAD_BODY}
      </AtlasStatusMessage>
    );
  } else if (failure === "unavailable") {
    state = "unavailable";
    body = (
      <AtlasStatusMessage
        action={<FeedRetry onRetry={() => feed.refetch()} />}
        title="Intelligence feed unavailable"
        titleAs="h2"
        tone="error"
      >
        The feed is disabled or temporarily unavailable.
      </AtlasStatusMessage>
    );
  } else if (failure === "error") {
    state = "error";
    body = (
      <AtlasStatusMessage
        action={<FeedRetry onRetry={() => feed.refetch()} />}
        title="Intelligence feed request failed"
        titleAs="h2"
        tone="error"
      >
        The feed could not be read.
      </AtlasStatusMessage>
    );
  } else if (items.length === 0 && !requestNarrows) {
    state = "empty";
    body = (
      <>
        <FeedLimitations limitations={limitations} />
        <AtlasStatusMessage title={EMPTY_TITLE} titleAs="h2" tone="empty">
          {EMPTY_BODY}
        </AtlasStatusMessage>
      </>
    );
  } else if (items.length === 0) {
    const dateWindowOnly =
      filters.sourceId === null && filters.published !== "all";
    state = "filtered-empty";
    body = (
      <>
        <FeedLimitations limitations={limitations} />
        <AtlasStatusMessage
          action={
            dateWindowOnly ? (
              <Button
                {...analyticsControlAttributes("feed_clear_filters")}
                className="ux-reset-feed-clear"
                onClick={() => {
                  applyPublished("all");
                }}
                type="button"
                variant="outline"
              >
                Show all dates
              </Button>
            ) : (
              <Button
                {...analyticsControlAttributes("feed_clear_filters")}
                className="ux-reset-feed-clear"
                onClick={clearFilters}
                type="button"
                variant="outline"
              >
                Clear filters
              </Button>
            )
          }
          title={
            dateWindowOnly ? DATE_WINDOW_EMPTY_TITLE : FILTERED_EMPTY_TITLE
          }
          titleAs="h2"
          tone="empty"
        >
          {dateWindowOnly
            ? dateWindowEmptyBody(filters.published)
            : FILTERED_EMPTY_BODY}
        </AtlasStatusMessage>
      </>
    );
  } else {
    state = "ready";
    const articles = selectFeaturedFeedArticle(items);
    const moreAvailable = Boolean(feed.hasNextPage);
    body = (
      <>
        {refreshFailure ? (
          <AtlasStatusMessage
            action={<FeedRetry onRetry={() => feed.refetch()} />}
            title={
              refreshFailure === "unavailable"
                ? "A feed refresh is unavailable"
                : "The feed could not be refreshed"
            }
            titleAs="h2"
            tone="error"
          >
            {refreshFailure === "unavailable"
              ? "The feed is disabled or temporarily unavailable. The last loaded items are still shown."
              : "The last loaded items are still shown."}
          </AtlasStatusMessage>
        ) : null}
        {articles.featured ? (
          <ul className="ux-reset-feed-feature-list">
            <FeedFeaturedArticle
              entry={articles.featured}
              itemCaveats={itemFeedCaveats(articles.featured, sharedCaveats)}
              moreAvailable={moreAvailable}
              onOpen={openDetail}
            />
          </ul>
        ) : null}
        {articles.featured && moreAvailable ? (
          <p className="ux-reset-feed-subset-note">
            {FEATURED_FEED_SUBSET_NOTE}
          </p>
        ) : null}
        {articles.rest.length > 0 ? (
          <>
            <h2 className="ux-reset-feed-latest-heading">Latest articles</h2>
            <ul className="ux-reset-feed-list">
              {articles.rest.map((entry, index) => (
                <FeedItemCard
                  eagerImage={index < 2 && articles.featured === null}
                  entry={entry}
                  itemCaveats={itemFeedCaveats(entry, sharedCaveats)}
                  key={`${entry.item_id}:${entry.revision_id}:${index}`}
                  onOpen={openDetail}
                />
              ))}
            </ul>
          </>
        ) : null}
        <p className="ux-reset-feed-imagery-note">
          {RESEARCH_NEWS_IMAGERY_NOTE}
        </p>
        <FeedLimitations limitations={limitations} />
        {sharedCaveats.length > 0 ? (
          <ul
            className="ux-reset-feed-limitations"
            data-testid="feed-shared-caveats"
          >
            {sharedCaveats.map((limitation, index) => (
              <li key={`${limitation}:${index}`}>{limitation}</li>
            ))}
          </ul>
        ) : null}
        {nextPageFailure ? (
          <AtlasStatusMessage
            action={<FeedRetry onRetry={() => feed.fetchNextPage()} />}
            title={
              nextPageFailure === "unavailable"
                ? "More items are unavailable"
                : "More items could not be loaded"
            }
            titleAs="h2"
            tone="error"
          >
            {nextPageFailure === "unavailable"
              ? "The feed is disabled or temporarily unavailable."
              : "The next page of the feed could not be read."}
          </AtlasStatusMessage>
        ) : null}
        {feed.hasNextPage ? (
          <Button
            disabled={feed.isFetchingNextPage || feed.isRestartingPage}
            onClick={() => {
              void feed.fetchNextPage();
            }}
            type="button"
            variant="outline"
          >
            {feed.isFetchingNextPage || feed.isRestartingPage
              ? "Loading more items"
              : "Show more items"}
          </Button>
        ) : null}
      </>
    );
  }

  const summary =
    state === "ready" || state === "empty" || state === "filtered-empty"
      ? feedResultSummary(items.length, Boolean(feed.hasNextPage))
      : "";

  return (
    <section
      aria-labelledby="intelligence-feed-heading"
      className="ux-reset-feed"
      data-feed-state={state}
      data-testid="intelligence-feed"
    >
      <header className="ux-reset-page-header">
        <h1 id="intelligence-feed-heading">{RESEARCH_NEWS_HEADING}</h1>
        <p className="type-body">{RESEARCH_NEWS_SUBTITLE}</p>
      </header>
      <IntelligenceFeedFilters
        filterBarRef={filterBarRef}
        filters={filters}
        onClear={clearFilters}
        onPublishedChange={applyPublished}
        onRemovePublished={removePublished}
        onRemoveSource={removeSource}
        onRetrySources={() => {
          void sources.refetch();
        }}
        onSourceChange={applySource}
        resultSummary={summary}
        sourceOptions={sourceOptions}
        sourcesError={sources.isError}
      />
      {body}
      <FeedFooter />
      <FeedItemDetailDialog
        onOpenChange={closeDetail}
        onRetry={() => {
          void itemLookup.refetch();
        }}
        open={itemId !== null}
        view={detailView}
      />
    </section>
  );
}
