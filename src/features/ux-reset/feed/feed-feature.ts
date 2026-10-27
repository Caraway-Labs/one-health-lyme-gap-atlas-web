import type { FeedListEntry } from "@/generated/models/feedListEntry";

import { feedPublicationDate } from "./feed-presentation";

export const FEATURED_FEED_KICKER = "Latest update";
export const FEATURED_FEED_SUBSET_KICKER = "Newest dated item loaded";
export const FEATURED_FEED_SUBSET_NOTE =
  "The featured article is the newest dated item among the articles loaded so far.";

/** Milliseconds for a contract date that is present and parseable. */
export function feedPublicationTime(entry: FeedListEntry): number | null {
  const date = feedPublicationDate(entry);
  if (date.kind !== "present") {
    return null;
  }
  const time = Date.parse(date.iso);
  return Number.isNaN(time) ? null : time;
}

export type FeaturedFeedSelection = {
  featured: FeedListEntry | null;
  rest: FeedListEntry[];
};

/**
 * Newest valid dated article in this loaded set. Equal timestamps keep the
 * earlier item. Undated items stay in their original order. The featured item
 * is removed from the grid. This is not a claim about articles still unloaded.
 */
export function selectFeaturedFeedArticle(
  entries: readonly FeedListEntry[]
): FeaturedFeedSelection {
  let featuredIndex = -1;
  let newest = Number.NEGATIVE_INFINITY;
  for (const [index, entry] of entries.entries()) {
    const time = feedPublicationTime(entry);
    if (time === null || time <= newest) {
      continue;
    }
    newest = time;
    featuredIndex = index;
  }
  if (featuredIndex < 0) {
    return { featured: null, rest: [...entries] };
  }
  return {
    featured: entries[featuredIndex] ?? null,
    rest: entries.filter((_, index) => index !== featuredIndex),
  };
}

/** Badge copy. A partial page must not be labeled as the global latest item. */
export function featuredFeedKicker(moreAvailable: boolean): string {
  return moreAvailable ? FEATURED_FEED_SUBSET_KICKER : FEATURED_FEED_KICKER;
}
