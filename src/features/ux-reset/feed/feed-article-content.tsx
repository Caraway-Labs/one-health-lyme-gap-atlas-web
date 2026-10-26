"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import {
  analyticsControlAttributes,
  type FeedDetailEntrySurface,
} from "@/lib/atlas-analytics";

import {
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedCardAuthorLine,
  feedCardSummary,
  feedCardTags,
  feedItemTitle,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
} from "./feed-presentation";

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
        <div>
          <p className="ux-reset-feed-summary-text" data-testid="feed-abstract">
            {summary.text}
          </p>
          {summary.copyrightLine === null ? null : (
            <p
              className="type-small ux-reset-feed-copyright"
              data-testid="feed-abstract-copyright"
            >
              {summary.copyrightLine}
            </p>
          )}
        </div>
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
