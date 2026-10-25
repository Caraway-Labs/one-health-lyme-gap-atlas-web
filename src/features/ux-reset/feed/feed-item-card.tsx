"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FeedEntry } from "@/generated/models/feedEntry";
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
  feedSourceFamilyLabel,
} from "./feed-presentation";

function FeedPublicationDateText({ entry }: { entry: FeedEntry }) {
  const date = feedPublicationDate(entry);
  if (date.kind === "present") {
    return <time dateTime={date.iso}>{date.text}</time>;
  }
  return date.text;
}

function FeedExternalTitle({
  href,
  title,
}: {
  href: string | null;
  title: string;
}) {
  if (!href) {
    return title;
  }
  return (
    <a
      className="ux-reset-feed-title-link"
      {...analyticsControlAttributes("feed_item_open")}
      href={href}
      rel={FEED_EXTERNAL_LINK_REL}
      target={FEED_EXTERNAL_LINK_TARGET}
    >
      {title}
      <ExternalLink aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function FeedItemCard({
  entry,
  itemCaveats,
  onOpen,
}: {
  entry: FeedEntry;
  itemCaveats: readonly string[];
  onOpen: (entry: FeedEntry, surface: FeedDetailEntrySurface) => void;
}) {
  const title = feedItemTitle(entry);
  const href = feedPublisherHref(entry.canonical_url);
  const familyLabel = feedSourceFamilyLabel(entry);
  const summary = feedCardSummary(entry);
  const authorLine = feedCardAuthorLine(entry.authors);
  const tags = feedCardTags(entry.tags);
  return (
    <li>
      <Card>
        <CardHeader className="ux-reset-feed-item">
          <h2 className="type-card">
            <FeedExternalTitle href={href} title={title} />
          </h2>
          <dl className="ux-reset-feed-meta">
            <div>
              <dt>Publisher</dt>
              <dd>{feedPublisherLabel(entry)}</dd>
            </div>
            {familyLabel === null ? null : (
              <div>
                <dt>Source family</dt>
                <dd data-testid="feed-source-family">{familyLabel}</dd>
              </div>
            )}
            <div>
              <dt>Publication date</dt>
              <dd>
                <FeedPublicationDateText entry={entry} />
              </dd>
            </div>
          </dl>
          <p className="type-small ux-reset-feed-attribution">
            {entry.attribution}
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
              <p
                className="ux-reset-feed-summary-text ux-reset-feed-clamp-3"
                data-testid="feed-abstract"
              >
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
              <Button
                onClick={() => {
                  onOpen(entry, "feed_card_read_more");
                }}
                type="button"
                variant="outline"
              >
                Read more
              </Button>
            </div>
          ) : null}
          {authorLine ? (
            <dl className="ux-reset-feed-meta">
              <div>
                <dt>Authors</dt>
                <dd>{authorLine}</dd>
              </div>
            </dl>
          ) : null}
          {tags.shown.length > 0 ? (
            <div className="ux-reset-feed-tag-row">
              <ul className="ux-reset-feed-chips">
                {tags.shown.map((tag, index) => (
                  <li key={`${tag}:${index}`}>
                    <Badge
                      className="h-auto max-w-full whitespace-normal"
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
        </CardHeader>
        <CardContent className="ux-reset-feed-item">
          {itemCaveats.length > 0 ? (
            <ul className="ux-reset-feed-limitations">
              {itemCaveats.map((limitation, index) => (
                <li key={`${limitation}:${index}`}>{limitation}</li>
              ))}
            </ul>
          ) : null}
          <Button
            onClick={() => {
              onOpen(entry, "feed_card_details");
            }}
            type="button"
            variant="outline"
          >
            Details
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}
