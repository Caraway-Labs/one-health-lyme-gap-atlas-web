import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";
import type { FeedAbstract } from "@/generated/models/feedAbstract";
import type { FeedDescription } from "@/generated/models/feedDescription";
import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedListEntryAbstractState } from "@/generated/models/feedListEntryAbstractState";
import type { FeedListEntryPublicationDateState } from "@/generated/models/feedListEntryPublicationDateState";
import type { FeedListEntrySourceFamily } from "@/generated/models/feedListEntrySourceFamily";
import type { FeedSource } from "@/generated/models/feedSource";
import type { FeedSources } from "@/generated/models/feedSources";
import type { MetadataFeed } from "@/generated/models/metadataFeed";
import type { ProjectionProvenanceParserVersion } from "@/generated/models/projectionProvenanceParserVersion";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const FEED_META_LIMITATIONS = [
  "Publication intelligence, not disease occurrence or a public-health alert.",
  "Source health is not published; item fetch timestamps are not health evidence.",
] as const;

type FeedFixtureItem = {
  abstract?: FeedAbstract | null;
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
  fetchVersion?: string;
  parserVersion?: ProjectionProvenanceParserVersion;
  pmid?: string | null;
  publicationDateState?: FeedListEntryPublicationDateState;
  publishedAt?: string | null;
  publisher?: string | null;
  pubmedUrl?: string | null;
  registryVersion?: number;
  sourceFamily?: FeedListEntrySourceFamily;
  sourceFamilyLabel?: string;
  sourceId: string;
  tags?: string[];
  title?: string | null;
  trust: (typeof BriefingSourceReviewedTrustClassification)[keyof typeof BriefingSourceReviewedTrustClassification];
};

function hexId(seed: string): string {
  return Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64);
}

function listAbstractFields(item: FeedFixtureItem): {
  abstract_has_more: boolean;
  abstract_preview: string | null;
  abstract_state: FeedListEntryAbstractState;
  copyright_line: string | null;
} {
  if (
    item.abstractPreview !== undefined ||
    item.abstractState !== undefined ||
    item.abstractHasMore !== undefined ||
    item.copyrightLine !== undefined
  ) {
    return {
      abstract_has_more: item.abstractHasMore ?? false,
      abstract_preview: item.abstractPreview ?? null,
      abstract_state: item.abstractState ?? null,
      copyright_line: item.copyrightLine ?? null,
    };
  }
  if (item.abstract === undefined || item.abstract === null) {
    return {
      abstract_has_more: false,
      abstract_preview: null,
      abstract_state: null,
      copyright_line: null,
    };
  }
  return {
    abstract_has_more: false,
    abstract_preview:
      item.abstract.state === "present" ? item.abstract.text : null,
    abstract_state: item.abstract.state,
    copyright_line: item.abstract.copyright_line,
  };
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
    ...listAbstractFields(item),
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
    pmid,
    provenance: {
      artifact_id: `artifact-${item.sourceId}`,
      artifact_sha256: SHA,
      fetch_version: item.fetchVersion ?? "fetch-v2",
      normalization_version: "intelligence-identity-v2",
      parser_version: item.parserVersion ?? "rss-atom-native-v2",
      run_id: `run-${item.sourceId}`,
    },
    publication_date_state: publicationDateState,
    published_at: publishedAt,
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
    source_family_label: item.sourceFamilyLabel ?? "Other",
    tags: item.tags ?? [],
    title:
      item.title === undefined ? `${item.organization} update` : item.title,
  };
}

/** By-id entry. The abstract object is the one supplied on the fixture item. */
export function intelligenceFeedDetail(
  seed: string,
  item: FeedFixtureItem
): FeedEntry {
  const list = intelligenceFeedEntry(seed, item);
  const {
    abstract_has_more: _abstractHasMore,
    abstract_preview: _abstractPreview,
    abstract_state: _abstractState,
    copyright_line: _copyrightLine,
    ...shared
  } = list;
  return {
    ...shared,
    abstract: item.abstract === undefined ? null : item.abstract,
  };
}

/**
 * PubMed list row from the Entrez projection: withheld abstract, null preview,
 * and an unknown publisher date. Parser version is entrez-efetch-v1.
 */
export const pubmedEntrezWithheldListEntry: FeedListEntry =
  intelligenceFeedEntry("pubmed-entrez-withheld", {
    abstractHasMore: false,
    abstractPreview: null,
    abstractState: "withheld",
    attribution: "Courtesy of the U.S. National Library of Medicine",
    canonicalUrl: "https://pubmed.ncbi.nlm.nih.gov/40000001/",
    copyrightLine: null,
    description: { state: "not_provided", text: null },
    fetchVersion: "entrez-eutils-v1",
    organization: "U.S. National Library of Medicine",
    parserVersion: "entrez-efetch-v1",
    pmid: "40000001",
    publicationDateState: "not_provided",
    publishedAt: null,
    publisher: "U.S. National Library of Medicine",
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/40000001/",
    sourceFamily: "pubmed",
    sourceFamilyLabel: "PubMed",
    sourceId: "pubmed-tick-borne",
    title: "Tick-borne disease index record without a publisher date",
    trust: BriefingSourceReviewedTrustClassification.research_index,
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
