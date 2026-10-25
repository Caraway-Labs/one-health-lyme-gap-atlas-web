import { describe, expect, it } from "vitest";

import { GetIntelligenceFeedEntryResponse } from "@/generated/zod/atlas";
import { FeedEntryRead } from "@/generated/zod/feedEntryRead.zod";
import { MetadataFeed } from "@/generated/zod/metadataFeed.zod";

import {
  intelligenceFeedEnvelope,
  mixedIntelligenceFeedItems,
} from "./fixtures/intelligence-feed-fixtures";

const LIVE_LIST_ABSTRACT_FIELDS = {
  abstract_has_more: false,
  abstract_preview: null,
  abstract_state: null,
  copyright_line: null,
  pubmed_url: null,
} as const;

describe("intelligence feed list contract", () => {
  it("parses a live-shaped list response whose abstract fields are all null", () => {
    const response = intelligenceFeedEnvelope(mixedIntelligenceFeedItems);

    expect(response.data.length).toBeGreaterThan(0);
    for (const row of response.data) {
      expect(row).toMatchObject(LIVE_LIST_ABSTRACT_FIELDS);
      expect(row).not.toHaveProperty("abstract");
    }

    const parsed = MetadataFeed.safeParse(response);
    expect(parsed.success).toBeTruthy();
  });

  it("rejects a list row that still carries the removed abstract object", () => {
    const [row] = mixedIntelligenceFeedItems;
    const {
      abstract_has_more: _abstractHasMore,
      abstract_preview: _abstractPreview,
      abstract_state: _abstractState,
      copyright_line: _copyrightLine,
      pubmed_url: _pubmedUrl,
      ...staleRow
    } = row;
    const stale = intelligenceFeedEnvelope([
      { ...staleRow, abstract: null } as unknown as typeof row,
    ]);

    const parsed = MetadataFeed.safeParse(stale);
    expect(parsed.success).toBeFalsy();
    if (parsed.success) {
      return;
    }
    expect(
      parsed.error.issues.some((issue) =>
        issue.path.includes("abstract_preview")
      )
    ).toBeTruthy();
  });

  it("parses a by-id entry that keeps abstract text, state, and copyright", () => {
    const [row] = mixedIntelligenceFeedItems;
    const {
      abstract_has_more: _abstractHasMore,
      abstract_preview: _abstractPreview,
      abstract_state: _abstractState,
      copyright_line: _copyrightLine,
      ...shared
    } = row;
    const detail = {
      data: {
        ...shared,
        abstract: {
          copyright_line: null,
          state: "not_provided",
          text: null,
        },
        pmid: null,
        pubmed_url: null,
      },
      meta: { projection_version: "intelligence-feed-read-v2" },
    };

    expect(FeedEntryRead.safeParse(detail).success).toBeTruthy();
    expect(
      GetIntelligenceFeedEntryResponse.safeParse(detail).success
    ).toBeTruthy();
  });
});
