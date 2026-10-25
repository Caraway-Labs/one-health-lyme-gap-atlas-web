import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedListEntryPublicationDateState } from "@/generated/models/feedListEntryPublicationDateState";
import type { FeedListEntrySourceFamily } from "@/generated/models/feedListEntrySourceFamily";
import type { FeedSource } from "@/generated/models/feedSource";
import type { FeedSources } from "@/generated/models/feedSources";
import type { MetadataFeed } from "@/generated/models/metadataFeed";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const FEED_META_LIMITATIONS = [
  "Publication intelligence, not disease occurrence or a public-health alert.",
  "Source health is not published; item fetch timestamps are not health evidence.",
] as const;

type FeedFixtureItem = {
  canonicalUrl?: string | null;
  limitations?: string[];
  organization: string;
  publicationDateState?: FeedListEntryPublicationDateState;
  publishedAt?: string | null;
  publisher?: string | null;
  sourceId: string;
  title?: string | null;
  trust: (typeof BriefingSourceReviewedTrustClassification)[keyof typeof BriefingSourceReviewedTrustClassification];
};

function hexId(seed: string): string {
  return Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64);
}

export function intelligenceFeedEntry(
  seed: string,
  item: FeedFixtureItem
): FeedListEntry {
  const publicationDateState = item.publicationDateState ?? "present";
  const publishedAt =
    item.publishedAt === undefined
      ? publicationDateState === "present"
        ? "2026-03-02T15:04:00Z"
        : null
      : item.publishedAt;
  return {
    canonical_url:
      item.canonicalUrl === undefined
        ? `https://example.org/${item.sourceId}`
        : item.canonicalUrl,
    contract_version: "2.0.0",
    fetched_at: "2026-03-03T12:00:00Z",
    item_id: hexId(`item${seed}`),
    limitations: item.limitations ?? [],
    provenance: {
      artifact_id: `artifact-${item.sourceId}`,
      artifact_sha256: SHA,
      fetch_version: "fetch-v2",
      normalization_version: "intelligence-identity-v2",
      parser_version: "rss-atom-native-v2",
      run_id: `run-${item.sourceId}`,
    },
    publication_date_state: publicationDateState,
    published_at: publishedAt,
    publisher:
      item.publisher === undefined ? item.organization : item.publisher,
    revision_id: hexId(`rev${seed}`),
    source: {
      organization: item.organization,
      registry_version: 1,
      reviewed_trust_classification: item.trust,
      source_id: item.sourceId,
    },
    title:
      item.title === undefined ? `${item.organization} update` : item.title,
    source_family: sourceFamilyFor(item.sourceId),
    source_family_label: item.publisher ?? item.organization,
    description: { text: null, state: "not_provided" },
    tags: [],
    authors: [],
    pmid: null,
    pubmed_url: null,
    attribution: item.publisher ?? item.organization,
    abstract_preview: null,
    abstract_has_more: false,
    abstract_state: null,
    copyright_line: null,
  };
}

function sourceFamilyFor(sourceId: string): FeedListEntrySourceFamily {
  if (sourceId.includes("pubmed")) return "pubmed";
  if (sourceId.includes("cdc")) return "cdc_other";
  if (sourceId.includes("nysdoh") || sourceId.includes("state")) {
    return "state_local";
  }
  return "other";
}

export const mixedIntelligenceFeedItems: FeedListEntry[] = [
  intelligenceFeedEntry("cdc", {
    canonicalUrl: "https://www.cdc.gov/lyme/index.html",
    organization: "Centers for Disease Control and Prevention",
    publisher: "CDC",
    sourceId: "cdc-lyme",
    title: "Lyme disease surveillance update",
    trust: BriefingSourceReviewedTrustClassification.official_public_health,
  }),
  intelligenceFeedEntry("pubmed", {
    canonicalUrl: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    organization: "National Library of Medicine",
    publicationDateState: "not_provided",
    publishedAt: null,
    publisher: "PubMed",
    sourceId: "pubmed-lyme",
    title: "County-level Lyme reporting, a review",
    trust: BriefingSourceReviewedTrustClassification.research_index,
  }),
  intelligenceFeedEntry("state", {
    canonicalUrl: "https://www.health.ny.gov/diseases/communicable/lyme/",
    limitations: ["This item is publication metadata, not a case count."],
    organization: "New York State Department of Health",
    publicationDateState: "withheld",
    publishedAt: null,
    publisher: null,
    sourceId: "nysdoh-lyme",
    title: "New York Lyme disease information",
    trust: BriefingSourceReviewedTrustClassification.reviewed_other,
  }),
];

export function intelligenceSourcesEnvelope(
  data: FeedSource[],
  nextPageToken: string | null = null
): FeedSources {
  return {
    data,
    meta: {
      limitations: [...FEED_META_LIMITATIONS],
      next_page_token: nextPageToken,
      projection_version: "intelligence-feed-read-v2",
      source_health_available: false,
    },
    source_catalog_complete: false,
  };
}

export function intelligenceFeedEnvelope(
  data: FeedListEntry[],
  nextPageToken: string | null = null
): MetadataFeed {
  return {
    data,
    meta: {
      limitations: [...FEED_META_LIMITATIONS],
      next_page_token: nextPageToken,
      projection_version: "intelligence-feed-read-v2",
      source_health_available: false,
    },
  };
}
