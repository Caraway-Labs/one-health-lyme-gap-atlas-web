"use client";

import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedDetailEntrySurface } from "@/lib/atlas-analytics";

import { FeedArticleContent } from "./feed-article-content";
import { FeedDecorImage } from "./feed-decor-image";
import { feedIllustrationAt } from "./feed-illustrations";

export function FeedItemCard({
  eagerImage = false,
  entry,
  imageSlot = 0,
  itemCaveats,
  onOpen,
}: {
  eagerImage?: boolean;
  entry: FeedListEntry;
  imageSlot?: number;
  itemCaveats: readonly string[];
  onOpen: (entry: FeedListEntry, surface: FeedDetailEntrySurface) => void;
}) {
  const image = feedIllustrationAt(imageSlot);
  return (
    <li className="ux-reset-feed-card">
      <div className="ux-reset-feed-thumb">
        <FeedDecorImage
          eager={eagerImage}
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 24rem"
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
