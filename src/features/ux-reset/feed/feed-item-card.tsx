"use client";

import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedDetailEntrySurface } from "@/lib/atlas-analytics";

import { FeedArticleContent } from "./feed-article-content";
import { FeedDecorImage } from "./feed-decor-image";
import { feedCardIllustration } from "./feed-illustrations";

export function FeedItemCard({
  eagerImage = false,
  entry,
  itemCaveats,
  onOpen,
}: {
  eagerImage?: boolean;
  entry: FeedListEntry;
  itemCaveats: readonly string[];
  onOpen: (entry: FeedListEntry, surface: FeedDetailEntrySurface) => void;
}) {
  const image = feedCardIllustration(entry);
  return (
    <li className="ux-reset-feed-card">
      <div className="ux-reset-feed-thumb">
        <FeedDecorImage
          eager={eagerImage}
          sizes="(max-width: 520px) 100vw, 8rem"
          src={image.src}
        />
      </div>
      <FeedArticleContent
        entry={entry}
        headingLevel="h3"
        itemCaveats={itemCaveats}
        onOpen={onOpen}
      />
    </li>
  );
}
