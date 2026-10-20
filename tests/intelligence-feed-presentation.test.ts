import { describe, expect, it } from "vitest";

import {
  FEED_EXTERNAL_LINK_REL,
  FEED_EXTERNAL_LINK_TARGET,
  feedItemTitle,
  feedPublicationDate,
  feedPublisherHref,
  feedPublisherLabel,
  feedRequestFailure,
} from "@/features/ux-reset/feed/feed-presentation";
import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  intelligenceFeedEntry,
  mixedIntelligenceFeedItems,
} from "./fixtures/intelligence-feed-fixtures";

describe("intelligence feed presentation", () => {
  it("keeps a realistic source mix in contract order", () => {
    expect(mixedIntelligenceFeedItems.map(feedPublisherLabel)).toStrictEqual([
      "CDC",
      "PubMed",
      "New York State Department of Health",
    ]);
    expect(
      mixedIntelligenceFeedItems.map((entry) => entry.source.source_id)
    ).toStrictEqual(["cdc-lyme", "pubmed-lyme", "nysdoh-lyme"]);
  });

  it("formats a present publication date and leaves other date states quiet", () => {
    expect(feedPublicationDate(mixedIntelligenceFeedItems[0])).toMatchObject({
      iso: "2026-03-02T15:04:00Z",
      kind: "present",
      text: "March 2, 2026",
    });
    expect(feedPublicationDate(mixedIntelligenceFeedItems[1])).toStrictEqual({
      kind: "missing",
      text: "Publication date not provided",
    });
    expect(feedPublicationDate(mixedIntelligenceFeedItems[2])).toStrictEqual({
      kind: "missing",
      text: "Publication date withheld",
    });
    const invalid = intelligenceFeedEntry("invalid", {
      organization: "CDC",
      publicationDateState: "invalid",
      publishedAt: null,
      sourceId: "cdc-lyme",
      trust: BriefingSourceReviewedTrustClassification.official_public_health,
    });
    expect(feedPublicationDate(invalid).text).toBe(
      "Publication date not available"
    );
  });

  it("does not invent a date from the fetch timestamp", () => {
    const missing = intelligenceFeedEntry("missing-present", {
      organization: "CDC",
      publicationDateState: "present",
      publishedAt: null,
      sourceId: "cdc-lyme",
      trust: BriefingSourceReviewedTrustClassification.official_public_health,
    });
    expect(missing.fetched_at).toBe("2026-03-03T12:00:00Z");
    expect(feedPublicationDate(missing)).toStrictEqual({
      kind: "missing",
      text: "Publication date not available",
    });
  });

  it("uses a quiet title when the contract omits one", () => {
    const untitled = intelligenceFeedEntry("untitled", {
      organization: "CDC",
      sourceId: "cdc-lyme",
      title: null,
      trust: BriefingSourceReviewedTrustClassification.official_public_health,
    });
    expect(feedItemTitle(untitled)).toBe("Untitled item");
  });

  it("accepts http and https publisher links", () => {
    expect(feedPublisherHref("https://www.cdc.gov/lyme/index.html")).toBe(
      "https://www.cdc.gov/lyme/index.html"
    );
    expect(feedPublisherHref("http://example.org/item")).toBe(
      "http://example.org/item"
    );
    expect(feedPublisherHref(null)).toBeNull();
    expect(feedPublisherHref("   ")).toBeNull();
    expect(FEED_EXTERNAL_LINK_REL).toBe("noopener noreferrer");
  });

  it("rejects non-http publisher links and embedded credentials", () => {
    const scriptUrl = ["java", "script:alert(1)"].join("");
    expect(feedPublisherHref(scriptUrl)).toBeNull();
    expect(feedPublisherHref("data:text/html,hi")).toBeNull();
    expect(feedPublisherHref("https://user:secret@example.org/a")).toBeNull();
    expect(FEED_EXTERNAL_LINK_TARGET).toBe("_blank");
  });

  it("treats HTTP 503 as unavailable and other failures as request errors", () => {
    expect(
      feedRequestFailure(
        new AtlasApiError("disabled", "/v1/intelligence/feed", 503, null)
      )
    ).toBe("unavailable");
    expect(
      feedRequestFailure(
        new AtlasApiError("failed", "/v1/intelligence/feed", 500, null)
      )
    ).toBe("error");
    expect(feedRequestFailure(new Error("network"))).toBe("error");
  });
});
