"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { resetRouteById } from "@/features/ux-reset/paths";
import type { FeedEntry } from "@/generated/models/feedEntry";

import {
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedItemTitle,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
  feedRequestFailure,
} from "./feed-presentation";
import { useIntelligenceFeed } from "./use-intelligence-feed";

const EMPTY_TITLE = "No new items";
const EMPTY_BODY =
  "Approved trusted sources have no items in this feed right now.";

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
  const feed = useIntelligenceFeed();
  const pages = feed.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data);
  const limitations = pages[0]?.meta.limitations ?? [];
  // TanStack Query keeps feed.data when a later fetch fails and sets isError.
  // A failed "Show more" is also isFetchNextPageError. A window-focus, remount,
  // or explicit refetch is isRefetchError. Replace the page only when no items
  // have loaded; otherwise keep the list and show the failure beside it.
  const nextPageFailure =
    items.length > 0 && feed.isFetchNextPageError
      ? feedRequestFailure(feed.error)
      : null;
  const refreshFailure =
    items.length > 0 && feed.isRefetchError
      ? feedRequestFailure(feed.error)
      : null;
  const failure =
    items.length === 0 && feed.isError ? feedRequestFailure(feed.error) : null;

  let body: ReactNode;
  let state: "empty" | "error" | "loading" | "ready" | "unavailable";
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
  } else if (items.length === 0) {
    state = "empty";
    body = (
      <>
        <FeedLimitations limitations={limitations} />
        <AtlasStatusMessage title={EMPTY_TITLE} titleAs="h2" tone="empty">
          {EMPTY_BODY}
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
            disabled={feed.isFetchingNextPage}
            onClick={() => {
              void feed.fetchNextPage();
            }}
            type="button"
            variant="outline"
          >
            {feed.isFetchingNextPage ? "Loading more items" : "Show more items"}
          </Button>
        ) : null}
      </>
    );
  }

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
      {body}
    </section>
  );
}
