"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import {
  analyticsControlAttributes,
  type FeedDetailEntrySurface,
} from "@/lib/atlas-analytics";

import {
  FEED_ABSTRACT_SHOWN_MESSAGE,
  FEED_ABSTRACT_UNAVAILABLE_MESSAGE,
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  FEED_ITEM_MISSING_MESSAGE,
  feedCardAbstractDisplay,
  feedCardAuthorLine,
  feedCardSummary,
  feedCardTags,
  feedExpandedAbstract,
  feedItemLookupFailure,
  feedItemTitle,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
  type FeedCardSummary,
  type FeedItemLookupFailure,
} from "./feed-presentation";
import { useIntelligenceFeedEntry } from "./use-intelligence-feed-entry";

function FeedPublicationDateText({ entry }: { entry: FeedListEntry }) {
  const date = feedPublicationDate(entry);
  if (date.kind === "present") {
    return <time dateTime={date.iso}>{date.text}</time>;
  }
  return <span>{date.text}</span>;
}

function FeedArticleTitle({
  headingLevel,
  href,
  showExternalIcon,
  title,
}: {
  headingLevel: "h2" | "h3";
  href: string | null;
  showExternalIcon: boolean;
  title: string;
}) {
  const Heading = headingLevel;
  return (
    <Heading
      className="ux-reset-feed-headline"
      data-testid="feed-article-title"
    >
      {href ? (
        <a
          className={
            showExternalIcon
              ? "ux-reset-feed-title-link"
              : "ux-reset-feed-title-link ux-reset-feed-title-link-plain"
          }
          {...analyticsControlAttributes("feed_item_open")}
          href={href}
          rel={FEED_EXTERNAL_LINK_REL}
          target={FEED_EXTERNAL_LINK_TARGET}
        >
          <span className="ux-reset-feed-title-text">{title}</span>
          {showExternalIcon ? <ExternalLink aria-hidden="true" /> : null}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        title
      )}
    </Heading>
  );
}

function FeedPubMedLink({ href }: { href: string }) {
  return (
    <a
      className="ux-reset-feed-pubmed-link"
      href={href}
      rel={FEED_EXTERNAL_LINK_REL}
      target={FEED_EXTERNAL_LINK_TARGET}
    >
      View on PubMed
      <ExternalLink aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function abstractStatus(
  failure: FeedItemLookupFailure | null,
  fullText: string | null
): string {
  switch (failure) {
    case "missing": {
      return FEED_ITEM_MISSING_MESSAGE;
    }
    case "unavailable": {
      return FEED_ABSTRACT_UNAVAILABLE_MESSAGE;
    }
    case null: {
      return fullText === null ? "" : FEED_ABSTRACT_SHOWN_MESSAGE;
    }
    default: {
      const exhaustive: never = failure;
      return exhaustive;
    }
  }
}

function FeedCardAbstract({
  entry,
  pubmedHref,
  summary,
}: {
  entry: FeedListEntry;
  pubmedHref: string | null;
  summary: Extract<FeedCardSummary, { kind: "abstract" }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const regionId = `feed-abstract-${entry.item_id}-${entry.revision_id}`;
  const lookup = useIntelligenceFeedEntry(
    entry.item_id,
    expanded && summary.hasMore
  );
  const resolved = lookup.data ? feedExpandedAbstract(lookup.data) : null;
  const previewText = summary.text.length > 0 ? summary.text : null;
  const display = feedCardAbstractDisplay({
    expanded,
    preview: {
      copyrightLine: summary.copyrightLine,
      text: previewText,
    },
    resolved,
  });
  const busy = expanded && lookup.isFetching && lookup.data === undefined;
  const showError = expanded && lookup.isError && !lookup.isFetching;
  const failure = showError ? feedItemLookupFailure(lookup.error) : null;
  const { copyrightLine, text } = display;
  const status = abstractStatus(
    failure,
    expanded && resolved !== null ? resolved.text : null
  );
  return (
    <div>
      <div aria-busy={busy} data-testid="feed-abstract-region" id={regionId}>
        {text === null ? null : (
          <p className="ux-reset-feed-summary-text" data-testid="feed-abstract">
            {text}
          </p>
        )}
      </div>
      {copyrightLine === null ? null : (
        <p
          className="type-small ux-reset-feed-copyright"
          data-testid="feed-abstract-copyright"
        >
          {copyrightLine}
        </p>
      )}
      {status.length === 0 ? null : (
        <p
          className={
            status === FEED_ABSTRACT_SHOWN_MESSAGE
              ? "sr-only"
              : "ux-reset-feed-abstract-status"
          }
          data-testid="feed-abstract-status"
          role="status"
        >
          {status}
        </p>
      )}
      {summary.hasMore ? (
        <div className="ux-reset-feed-abstract-actions">
          <Button
            aria-controls={regionId}
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((current) => !current);
            }}
            type="button"
            variant="outline"
          >
            {expanded ? "Show less" : "Show full abstract"}
          </Button>
          {failure === "unavailable" ? (
            <Button
              onClick={() => {
                void lookup.refetch();
              }}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {pubmedHref ? <FeedPubMedLink href={pubmedHref} /> : null}
    </div>
  );
}

export function FeedArticleContent({
  entry,
  headingLevel,
  itemCaveats,
  onOpen,
  showExternalIcon = true,
}: {
  entry: FeedListEntry;
  headingLevel: "h2" | "h3";
  itemCaveats: readonly string[];
  onOpen: (entry: FeedListEntry, surface: FeedDetailEntrySurface) => void;
  showExternalIcon?: boolean;
}) {
  const title = feedItemTitle(entry);
  const href = feedPublisherHref(entry.canonical_url);
  const summary = feedCardSummary(entry);
  const authorLine = feedCardAuthorLine(entry.authors);
  const tags = feedCardTags(entry.tags);
  const pubmedHref = feedPublisherHref(entry.pubmed_url);
  return (
    <div className="ux-reset-feed-article-copy">
      <FeedArticleTitle
        headingLevel={headingLevel}
        href={href}
        showExternalIcon={showExternalIcon}
        title={title}
      />
      <p className="ux-reset-feed-byline">
        <span>{feedPublisherLabel(entry)}</span>
        <span aria-hidden="true"> · </span>
        <FeedPublicationDateText entry={entry} />
        <span aria-hidden="true"> · </span>
        <span data-testid="feed-source-family">
          {entry.source_family_label}
        </span>
      </p>
      {summary.kind === "description" ? (
        <div>
          {summary.authorsLabel ? (
            <p className="type-small ux-reset-feed-kicker">Authors</p>
          ) : null}
          <p
            className="ux-reset-feed-summary-text ux-reset-feed-clamp-2"
            data-testid="feed-description"
          >
            {summary.text}
          </p>
        </div>
      ) : null}
      {summary.kind === "abstract" ? (
        <FeedCardAbstract
          entry={entry}
          pubmedHref={pubmedHref}
          summary={summary}
        />
      ) : null}
      {summary.kind !== "abstract" && pubmedHref !== null ? (
        <FeedPubMedLink href={pubmedHref} />
      ) : null}
      {authorLine ? (
        <p className="type-small ux-reset-feed-attribution">{authorLine}</p>
      ) : null}
      {tags.shown.length > 0 ? (
        <div className="ux-reset-feed-tag-row">
          <ul className="ux-reset-feed-chips">
            {tags.shown.map((tag, index) => (
              <li key={`${tag}:${index}`}>
                <Badge
                  className="ux-reset-feed-topic-tag h-auto max-w-full whitespace-normal"
                  variant="outline"
                >
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
          {tags.more > 0 ? (
            <p className="type-small ux-reset-feed-tag-more">
              +{tags.more} more
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="type-small ux-reset-feed-attribution">
        {entry.attribution}
      </p>
      {itemCaveats.length > 0 ? (
        <details className="ux-reset-feed-item-notes">
          <summary>Item notes</summary>
          <ul className="ux-reset-feed-limitations">
            {itemCaveats.map((limitation, index) => (
              <li key={`${limitation}:${index}`}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="ux-reset-feed-actions">
        {summary.kind === "abstract" && summary.hasMore ? (
          // Read more keeps the detail-panel path and its feed_card_read_more event.
          <Button
            onClick={() => {
              onOpen(entry, "feed_card_read_more");
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Read more
          </Button>
        ) : null}
        <Button
          onClick={() => {
            onOpen(entry, "feed_card_details");
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Details
        </Button>
      </div>
    </div>
  );
}
