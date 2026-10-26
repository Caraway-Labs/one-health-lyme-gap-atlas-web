import { describe, expect, it } from "vitest";

import {
  featuredFeedKicker,
  selectFeaturedFeedArticle,
} from "@/features/ux-reset/feed/feed-feature";
import type { FeedListEntry } from "@/generated/models/feedListEntry";

import { intelligenceFeedEntry } from "./fixtures/intelligence-feed-fixtures";

function dated(
  seed: string,
  publishedAt: string,
  title: string
): FeedListEntry {
  return intelligenceFeedEntry(seed, {
    organization: "Centers for Disease Control and Prevention",
    publicationDateState: "present",
    publishedAt,
    sourceId: "cdc-lyme",
    title,
    trust: "official_public_health",
  });
}

function undated(seed: string, title: string): FeedListEntry {
  return intelligenceFeedEntry(seed, {
    organization: "PubMed",
    publicationDateState: "not_provided",
    publishedAt: null,
    sourceId: "pubmed-lyme",
    title,
    trust: "research_index",
  });
}

describe("featured feed article", () => {
  it("features the newest valid dated item and keeps the others in order", () => {
    const older = dated("older", "2024-01-02T00:00:00Z", "Older");
    const undatedItem = undated("none", "No date");
    const newer = dated("newer", "2026-05-01T12:00:00Z", "Newer");
    const selection = selectFeaturedFeedArticle([older, undatedItem, newer]);
    expect(selection.featured?.title).toBe("Newer");
    expect(selection.rest.map((entry) => entry.title)).toStrictEqual([
      "Older",
      "No date",
    ]);
  });

  it("keeps the earlier item when publication timestamps match", () => {
    const first = dated("a", "2026-03-02T15:04:00Z", "First");
    const second = dated("b", "2026-03-02T15:04:00Z", "Second");
    const selection = selectFeaturedFeedArticle([first, second]);
    expect(selection.featured?.title).toBe("First");
    expect(selection.rest.map((entry) => entry.title)).toStrictEqual([
      "Second",
    ]);
  });

  it("omits the feature when no publication date is valid", () => {
    const invalid = dated("bad", "2026-03-02T15:04:00Z", "Invalid");
    invalid.publication_date_state = "invalid";
    const selection = selectFeaturedFeedArticle([
      undated("a", "Missing"),
      invalid,
    ]);
    expect(selection.featured).toBeNull();
    expect(selection.rest.map((entry) => entry.title)).toStrictEqual([
      "Missing",
      "Invalid",
    ]);
  });

  it("does not call a partial page the latest update", () => {
    expect(featuredFeedKicker(false)).toBe("Latest update");
    expect(featuredFeedKicker(true)).toBe("Newest dated item loaded");
  });
});
