import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";
import type { FeedAbstract } from "@/generated/models/feedAbstract";
import type { FeedDescription } from "@/generated/models/feedDescription";
import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedEntryPublicationDateState } from "@/generated/models/feedEntryPublicationDateState";
import type { FeedEntrySourceFamily } from "@/generated/models/feedEntrySourceFamily";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedListEntryAbstractState } from "@/generated/models/feedListEntryAbstractState";
import type { FeedSource } from "@/generated/models/feedSource";
import type { FeedSources } from "@/generated/models/feedSources";
import type { MetadataFeed } from "@/generated/models/metadataFeed";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const FEED_META_LIMITATIONS = [
  "Publication intelligence, not disease occurrence or a public-health alert.",
  "Source health is not published; item fetch timestamps are not health evidence.",
] as const;

type FeedFixtureItem = {
  abstractHasMore?: boolean;
  abstractPreview?: string | null;
  abstractState?: FeedListEntryAbstractState;
  attribution?: string;
  authors?: string[];
  canonicalUrl?: string | null;
  copyrightLine?: string | null;
  description?: FeedDescription;
  limitations?: string[];
  organization: string;
  pmid?: string | null;
  publicationDateState?: FeedEntryPublicationDateState;
  publishedAt?: string | null;
  publisher?: string | null;
  pubmedUrl?: string | null;
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
): FeedListEntry {
  const publicationDateState = item.publicationDateState ?? "present";
  const publishedAt =
    item.publishedAt === undefined
      ? publicationDateState === "present"
        ? "2026-03-02T15:04:00Z"
        : null
      : item.publishedAt;
  const pmid = item.pmid === undefined ? null : item.pmid;
  return {
    abstract_has_more: item.abstractHasMore ?? false,
    abstract_preview:
      item.abstractPreview === undefined ? null : item.abstractPreview,
    abstract_state:
      item.abstractState === undefined ? null : item.abstractState,
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
    pmid,
    publisher:
      item.publisher === undefined ? item.organization : item.publisher,
    pubmed_url:
      item.pubmedUrl === undefined
        ? pmid === null
          ? null
          : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : item.pubmedUrl,
    revision_id: hexId(`rev${seed}`),
    source: {
      organization: item.organization,
      registry_version: item.registryVersion ?? 1,
      reviewed_trust_classification: item.trust,
      source_id: item.sourceId,
    },
    source_family: item.sourceFamily ?? "other",
    source_family_label: item.sourceFamilyLabel ?? "",
    tags: item.tags ?? [],
    copyright_line:
      item.copyrightLine === undefined ? null : item.copyrightLine,
    title:
      item.title === undefined ? `${item.organization} update` : item.title,
  };
}

/** By-id entry. `abstract` is the full record; list preview fields are not on this route. */
export function intelligenceFeedDetail(
  seed: string,
  item: FeedFixtureItem & { abstract?: FeedAbstract | null }
): FeedEntry {
  const listEntry = intelligenceFeedEntry(seed, item);
  return {
    abstract: item.abstract === undefined ? null : item.abstract,
    attribution: listEntry.attribution,
    authors: listEntry.authors,
    canonical_url: listEntry.canonical_url,
    contract_version: listEntry.contract_version,
    description: listEntry.description,
    fetched_at: listEntry.fetched_at,
    item_id: listEntry.item_id,
    limitations: listEntry.limitations,
    pmid: listEntry.pmid,
    provenance: listEntry.provenance,
    publication_date_state: listEntry.publication_date_state,
    published_at: listEntry.published_at,
    publisher: listEntry.publisher,
    pubmed_url: listEntry.pubmed_url,
    revision_id: listEntry.revision_id,
    source: listEntry.source,
    source_family: listEntry.source_family,
    source_family_label: listEntry.source_family_label,
    tags: listEntry.tags,
    title: listEntry.title,
  };
}

/** Present preview that is the whole abstract. */
export const feedPreviewEntry = intelligenceFeedEntry("preview-whole", {
  abstractHasMore: false,
  abstractPreview: "We collected 1,204 host-seeking nymphs.",
  abstractState: "present",
  attribution: "Courtesy of the U.S. National Library of Medicine",
  copyrightLine: "© 2026 Elsevier GmbH.",
  description: { state: "not_provided", text: null },
  organization: "National Library of Medicine",
  pmid: "41234567",
  publisher: "Ticks and Tick-borne Diseases",
  sourceFamily: "pubmed",
  sourceFamilyLabel: "PubMed",
  sourceId: "pubmed-tick-borne",
  title: "Whole abstract preview",
  trust: BriefingSourceReviewedTrustClassification.research_index,
});

/** Present preview that omits the rest of the abstract. */
export const feedPreviewHasMoreEntry = intelligenceFeedEntry("preview-more", {
  abstractHasMore: true,
  abstractPreview: "N".repeat(1000),
  abstractState: "present",
  attribution: "Courtesy of the U.S. National Library of Medicine",
  copyrightLine: "© 2026 Elsevier GmbH.",
  description: { state: "not_provided", text: null },
  organization: "National Library of Medicine",
  pmid: "41234568",
  publisher: "Ticks and Tick-borne Diseases",
  sourceFamily: "pubmed",
  sourceFamilyLabel: "PubMed",
  sourceId: "pubmed-tick-borne",
  title: "Truncated abstract preview",
  trust: BriefingSourceReviewedTrustClassification.research_index,
});

/** Non-PubMed row: every abstract field is null or false. */
export const feedAbstractNullEntry = intelligenceFeedEntry("abstract-null", {
  abstractHasMore: false,
  abstractPreview: null,
  abstractState: null,
  copyrightLine: null,
  organization: "Centers for Disease Control and Prevention",
  pmid: null,
  pubmedUrl: null,
  publisher: "CDC",
  sourceFamily: "cdc_mmwr",
  sourceFamilyLabel: "CDC MMWR",
  sourceId: "cdc-mmwr",
  title: "Entry without an abstract",
  trust: BriefingSourceReviewedTrustClassification.official_public_health,
});

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
