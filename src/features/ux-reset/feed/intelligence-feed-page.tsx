"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { resetRouteById } from "@/features/ux-reset/paths";
import type { FeedEntry } from "@/generated/models/feedEntry";
import {
  trackFeedFilterApplied,
  trackFeedFilterCleared,
} from "@/lib/atlas-analytics";

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
import {
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedItemTitle,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
  feedRequestFailure,
} from "./feed-presentation";
import { IntelligenceFeedFilters } from "./intelligence-feed-filters";
import {
  resetIntelligenceFeedToFirstPage,
  useIntelligenceFeed,
} from "./use-intelligence-feed";
import { useIntelligenceSources } from "./use-intelligence-sources";

const EMPTY_TITLE = "No new items";
const EMPTY_BODY =
  "Approved trusted sources have no items in this feed right now.";
const FILTERED_EMPTY_TITLE = "No items match these filters";
const FILTERED_EMPTY_BODY = "Try another source or a wider date range.";
const DATE_WINDOW_EMPTY_TITLE = "No items in this date window";
const DATE_WINDOW_EMPTY_BODY = `${FEED_PUBLISHED_LABELS[DEFAULT_FEED_PUBLISHED]} has no matching items. All dates includes older items and items without a publication date.`;
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

function FeedPublicationDateText({ entry }: { entry: FeedEntry }) {
  const date = feedPublicationDate(entry);
  if (date.kind === "present") {
    return <time dateTime={date.iso}>{date.text}</time>;
  }
  return date.text;
}

function FeedItem({ entry }: { entry: FeedEntry }) {
  const title = feedItemTitle(entry);
  const href = feedPublisherHref(entry.canonical_url);
  const publisher = feedPublisherLabel(entry);
  return (
    <li>
      <Card>
        <CardHeader className="ux-reset-feed-item">
          <h2 className="type-card">
            {href ? (
              <a
                className="ux-reset-feed-title-link"
                href={href}
                rel={FEED_EXTERNAL_LINK_REL}
                target={FEED_EXTERNAL_LINK_TARGET}
              >
                {title}
                <ExternalLink aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              title
            )}
          </h2>
          <dl className="ux-reset-feed-meta">
            <div>
              <dt>Publisher</dt>
              <dd>{publisher}</dd>
            </div>
            <div>
              <dt>Publication date</dt>
              <dd>
                <FeedPublicationDateText entry={entry} />
              </dd>
            </div>
          </dl>
        </CardHeader>
        {entry.limitations.length > 0 ? (
          <CardContent>
            <FeedLimitations limitations={entry.limitations} />
          </CardContent>
        ) : null}
      </Card>
    </li>
  );
}

function FeedRetry({ onRetry }: { onRetry: () => Promise<unknown> }) {
  return (
    <Button
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
  const route = resetRouteById("feed");
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
    const defaultWindowOnly = activeFeedFilterCount(filters) === 0;
    state = "filtered-empty";
    body = (
      <>
        <FeedLimitations limitations={limitations} />
        <AtlasStatusMessage
          action={
            defaultWindowOnly ? (
              <Button
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
            defaultWindowOnly ? DATE_WINDOW_EMPTY_TITLE : FILTERED_EMPTY_TITLE
          }
          titleAs="h2"
          tone="empty"
        >
          {defaultWindowOnly ? DATE_WINDOW_EMPTY_BODY : FILTERED_EMPTY_BODY}
        </AtlasStatusMessage>
      </>
    );
  } else {
    state = "ready";
    body = (
      <>
        <FeedLimitations limitations={limitations} />
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
        <ul className="ux-reset-feed-list">
          {items.map((entry) => (
            <FeedItem
              entry={entry}
              key={`${entry.item_id}:${entry.revision_id}`}
            />
          ))}
        </ul>
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
        <h1 id="intelligence-feed-heading">{route.label}</h1>
        <p className="type-body">{route.description}</p>
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
        sourceOptions={sourceOptions}
        sourcesError={sources.isError}
      />
      <p
        aria-atomic="true"
        aria-live="polite"
        className="type-small ux-reset-feed-summary"
      >
        {summary}
      </p>
      {body}
    </section>
  );
}
