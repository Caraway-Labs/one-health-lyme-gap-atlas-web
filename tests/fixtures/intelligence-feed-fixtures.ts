import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";
import type { FeedAbstract } from "@/generated/models/feedAbstract";
import type { FeedDescription } from "@/generated/models/feedDescription";
import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedEntryPublicationDateState } from "@/generated/models/feedEntryPublicationDateState";
import type { FeedEntrySourceFamily } from "@/generated/models/feedEntrySourceFamily";
import type { FeedSource } from "@/generated/models/feedSource";
import type { FeedSources } from "@/generated/models/feedSources";
import type { MetadataFeed } from "@/generated/models/metadataFeed";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const FEED_META_LIMITATIONS = [
  "Publication intelligence, not disease occurrence or a public-health alert.",
  "Source health is not published; item fetch timestamps are not health evidence.",
] as const;

type FeedFixtureItem = {
  abstract?: FeedAbstract | null;
  attribution?: string;
  authors?: string[];
  canonicalUrl?: string | null;
  description?: FeedDescription;
  limitations?: string[];
  organization: string;
  pmid?: string | null;
  publicationDateState?: FeedEntryPublicationDateState;
  publishedAt?: string | null;
  publisher?: string | null;
  registryVersion?: number;
  sourceFamily?: FeedEntrySourceFamily;
  sourceFamilyLabel?: string;
  sourceId: string;
  tags?: string[];
  title?: string | null;
  trust: (typeof BriefingSourceReviewedTrustClassification)[keyof typeof BriefingSourceReviewedTrustClassification];
};

function hexId(seed: string): string {
  return Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64);
}

export function intelligenceFeedEntry(
  seed: string,
  item: FeedFixtureItem
): FeedEntry {
  const publicationDateState = item.publicationDateState ?? "present";
  const publishedAt =
    item.publishedAt === undefined
      ? publicationDateState === "present"
        ? "2026-03-02T15:04:00Z"
        : null
      : item.publishedAt;
  return {
    abstract: item.abstract === undefined ? null : item.abstract,
    attribution: item.attribution ?? "Source: fixture",
    authors: item.authors ?? [],
    canonical_url:
      item.canonicalUrl === undefined
        ? `https://example.org/${item.sourceId}`
        : item.canonicalUrl,
    contract_version: "2.0.0",
    description: item.description ?? { state: "withheld", text: null },
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
    pmid: item.pmid === undefined ? null : item.pmid,
    publisher:
      item.publisher === undefined ? item.organization : item.publisher,
    revision_id: hexId(`rev${seed}`),
    source: {
      organization: item.organization,
      registry_version: item.registryVersion ?? 1,
      reviewed_trust_classification: item.trust,
      source_id: item.sourceId,
    },
    source_family: item.sourceFamily ?? "other",
    ...(item.sourceFamilyLabel === undefined
      ? {}
      : { source_family_label: item.sourceFamilyLabel }),
    tags: item.tags ?? [],
    title:
      item.title === undefined ? `${item.organization} update` : item.title,
  };
}

export const mixedIntelligenceFeedItems: FeedEntry[] = [
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
  data: FeedEntry[],
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
