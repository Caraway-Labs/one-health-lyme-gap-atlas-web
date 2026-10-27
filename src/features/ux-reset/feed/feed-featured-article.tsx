"use client";

import { ExternalLink } from "lucide-react";

import type { FeedListEntry } from "@/generated/models/feedListEntry";
import {
  analyticsControlAttributes,
  type FeedDetailEntrySurface,
} from "@/lib/atlas-analytics";

import { FeedArticleContent } from "./feed-article-content";
import { FeedDecorImage } from "./feed-decor-image";
import { featuredFeedKicker } from "./feed-feature";
import { feedIllustrationAt } from "./feed-illustrations";
import {
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedItemTitle,
  feedPublisherHref,
} from "./feed-presentation";

export function FeedFeaturedArticle({
  entry,
  itemCaveats,
  moreAvailable,
  onOpen,
}: {
  entry: FeedListEntry;
  itemCaveats: readonly string[];
  moreAvailable: boolean;
  onOpen: (entry: FeedListEntry, surface: FeedDetailEntrySurface) => void;
}) {
  const title = feedItemTitle(entry);
  const href = feedPublisherHref(entry.canonical_url);
  return (
    <li className="ux-reset-feed-feature" data-testid="feed-featured">
      <div className="ux-reset-feed-feature-copy">
        <p className="ux-reset-feed-update-pill">
          {featuredFeedKicker(moreAvailable)}
        </p>
        <FeedArticleContent
          entry={entry}
          headingLevel="h2"
          itemCaveats={itemCaveats}
          onOpen={onOpen}
          showExternalIcon={false}
        />
      </div>
      <div className="ux-reset-feed-feature-media">
        <FeedDecorImage
          eager
          sizes="(min-width: 860px) 36rem, 100vw"
          src={feedIllustrationAt(0).src}
        />
        {href ? (
          <a
            {...analyticsControlAttributes("feed_item_open")}
            aria-label={`Open publisher page for ${title} (opens in a new tab)`}
            className="ux-reset-feed-media-link"
            href={href}
            rel={FEED_EXTERNAL_LINK_REL}
            target={FEED_EXTERNAL_LINK_TARGET}
          >
            <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}
