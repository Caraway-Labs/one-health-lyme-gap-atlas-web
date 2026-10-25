import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedEntryPublicationDateState } from "@/generated/models/feedEntryPublicationDateState";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  formatUtcCalendarDate,
  parseAtlasDateTime,
} from "@/lib/atlas-evidence-metadata";

/** External publisher links match the rest of the workspace. */
export const FEED_EXTERNAL_LINK_REL = "noopener noreferrer";
export const FEED_EXTERNAL_LINK_TARGET = "_blank";

const UNTITLED_ITEM = "Untitled item";

const MISSING_PUBLICATION_DATE: Record<
  Exclude<FeedEntryPublicationDateState, "present">,
  string
> = {
  invalid: "Publication date not available",
  not_provided: "Publication date not provided",
  withheld: "Publication date withheld",
};

export type FeedPublicationDate =
  | { iso: string; kind: "present"; text: string }
  | { kind: "missing"; text: string };

export type FeedRequestFailure = "error" | "unavailable";

export function feedItemTitle(entry: FeedEntry): string {
  const title = entry.title?.trim() ?? "";
  return title.length > 0 ? title : UNTITLED_ITEM;
}

/** Publisher text from the contract, then the governed source organization. */
export function feedPublisherLabel(entry: FeedEntry): string {
  const publisher = entry.publisher?.trim() ?? "";
  if (publisher.length > 0) {
    return publisher;
  }
  return entry.source.organization;
}

/**
 * Show a publication date only when the contract says it is present and the
 * timestamp parses. Fetch time is not a substitute.
 */
export function feedPublicationDate(entry: FeedEntry): FeedPublicationDate {
  if (entry.publication_date_state === "present") {
    const parsed = parseAtlasDateTime(entry.published_at);
    if (parsed) {
      return {
        iso: parsed,
        kind: "present",
        text: formatUtcCalendarDate(parsed.slice(0, 10)),
      };
    }
    return {
      kind: "missing",
      text: MISSING_PUBLICATION_DATE.invalid,
    };
  }
  switch (entry.publication_date_state) {
    case "invalid":
    case "not_provided":
    case "withheld": {
      return {
        kind: "missing",
        text: MISSING_PUBLICATION_DATE[entry.publication_date_state],
      };
    }
    default: {
      const exhaustive: never = entry.publication_date_state;
      return exhaustive;
    }
  }
}

/** http(s) publisher URLs only. Other schemes are not opened from the feed. */
export function feedPublisherHref(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return null;
  }
  return url.href;
}

/** Disabled or unavailable is HTTP 503. Every other failure is a request error. */
export function feedRequestFailure(error: unknown): FeedRequestFailure {
  if (error instanceof AtlasApiError && error.status === 503) {
    return "unavailable";
  }
  return "error";
}

/**
 * Display string returned by the API on each feed entry. The generated client
 * does not include this property until that contract is regenerated.
 */
const SOURCE_FAMILY_LABEL_FIELD = "source_family_label";

export const FEED_CARD_AUTHOR_LIMIT = 3;
export const FEED_CARD_TAG_LIMIT = 3;
export const FEED_NCBI_COPYRIGHT_HREF =
  "https://www.ncbi.nlm.nih.gov/home/about/policies/";
export const FEED_ITEM_MISSING_MESSAGE = "This item is no longer in the feed.";
export const FEED_ITEM_UNAVAILABLE_MESSAGE =
  "The feed is unavailable right now.";
export const FEED_ABSTRACT_NOT_PROVIDED_MESSAGE =
  "No abstract in the PubMed record.";
export const FEED_FOOTER_PUBLIC_DOMAIN =
  "CDC and NIH content is public domain unless noted. PubMed abstracts remain subject to their publishers' copyright; see each abstract's notice.";
export const FEED_FOOTER_NON_ENDORSEMENT =
  "Use does not imply endorsement by CDC, HHS, NIH or the U.S. Government.";

const PMID_PATTERN = /^[1-9][0-9]{0,9}$/;

/** The API display string, unchanged. Null when the payload has no string. */
export function feedSourceFamilyLabel(entry: object): string | null {
  if (!(SOURCE_FAMILY_LABEL_FIELD in entry)) {
    return null;
  }
  const label = (entry as Record<string, unknown>)[SOURCE_FAMILY_LABEL_FIELD];
  return typeof label === "string" ? label : null;
}

function withSourceFamilyLabel<T extends object>(parsed: T, raw: unknown): T {
  if (raw === null || typeof raw !== "object") {
    return parsed;
  }
  const label = feedSourceFamilyLabel(raw);
  if (label === null) {
    return parsed;
  }
  return { ...parsed, [SOURCE_FAMILY_LABEL_FIELD]: label };
}

/**
 * Keep `source_family_label` after response validation. The generated schema
 * drops properties it does not know yet.
 */
export function retainSourceFamilyLabel<T>(parsed: T, raw: unknown): T {
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    raw === null ||
    typeof raw !== "object" ||
    !("data" in parsed) ||
    !("data" in raw)
  ) {
    return parsed;
  }
  const parsedData = parsed.data;
  const rawData = raw.data;
  if (Array.isArray(parsedData) && Array.isArray(rawData)) {
    return {
      ...parsed,
      data: parsedData.map((item, index) =>
        item !== null && typeof item === "object"
          ? withSourceFamilyLabel(item, rawData[index])
          : item
      ),
    };
  }
  if (
    parsedData !== null &&
    typeof parsedData === "object" &&
    !Array.isArray(parsedData)
  ) {
    return { ...parsed, data: withSourceFamilyLabel(parsedData, rawData) };
  }
  return parsed;
}

export type FeedItemLookupFailure = "missing" | "unavailable";

/** 404 and 422 are the same not-in-feed panel. 503 and network failures retry. */
export function feedItemLookupFailure(error: unknown): FeedItemLookupFailure {
  if (
    error instanceof AtlasApiError &&
    (error.status === 404 || error.status === 422)
  ) {
    return "missing";
  }
  return "unavailable";
}

/**
 * Strings present on every rendered entry, in the first entry's order.
 * An empty list has none. A single entry shares all of its caveats.
 */
export function sharedFeedCaveats(entries: readonly FeedEntry[]): string[] {
  const first = entries[0];
  if (!first) {
    return [];
  }
  const shared: string[] = [];
  const seen = new Set<string>();
  for (const text of first.limitations) {
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    const onEveryEntry = entries.every((entry) =>
      entry.limitations.includes(text)
    );
    if (onEveryEntry) {
      shared.push(text);
    }
  }
  return shared;
}

/** Entry limitations that are not shared by every rendered entry, in API order. */
export function itemFeedCaveats(
  entry: FeedEntry,
  shared: readonly string[]
): string[] {
  const sharedText = new Set(shared);
  return entry.limitations.filter((text) => !sharedText.has(text));
}

export function feedPubMedHref(pmid: string | null): string | null {
  if (pmid === null || !PMID_PATTERN.test(pmid)) {
    return null;
  }
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/** Visible "Authors" label for an EID description when the authors array is empty. */
export function feedDescriptionUsesAuthorsLabel(entry: FeedEntry): boolean {
  return entry.source_family === "cdc_eid" && entry.authors.length === 0;
}

export type FeedCardSummary =
  | { authorsLabel: boolean; kind: "description"; text: string }
  | { copyrightLine: string | null; kind: "abstract"; text: string }
  | { kind: "none" };

/** Description wins when both are present. Anything else leaves the card blank. */
export function feedCardSummary(entry: FeedEntry): FeedCardSummary {
  if (
    entry.description.state === "present" &&
    entry.description.text !== null
  ) {
    return {
      authorsLabel: feedDescriptionUsesAuthorsLabel(entry),
      kind: "description",
      text: entry.description.text,
    };
  }
  if (entry.abstract?.state === "present" && entry.abstract.text !== null) {
    return {
      copyrightLine: entry.abstract.copyright_line,
      kind: "abstract",
      text: entry.abstract.text,
    };
  }
  return { kind: "none" };
}

export type FeedPanelAbstract =
  | { copyrightLine: string | null; kind: "text"; text: string }
  | { kind: "not_provided" }
  | { kind: "none" };

export function feedPanelAbstract(entry: FeedEntry): FeedPanelAbstract {
  const abstract = entry.abstract;
  if (abstract === null) {
    return { kind: "none" };
  }
  switch (abstract.state) {
    case "present": {
      if (abstract.text === null) {
        return { kind: "none" };
      }
      return {
        copyrightLine: abstract.copyright_line,
        kind: "text",
        text: abstract.text,
      };
    }
    case "not_provided": {
      return { kind: "not_provided" };
    }
    case "empty":
    case "suppressed":
    case "withheld": {
      return { kind: "none" };
    }
    default: {
      const exhaustive: never = abstract.state;
      return exhaustive;
    }
  }
}

export function feedPanelDescription(
  entry: FeedEntry
): { authorsLabel: boolean; text: string } | null {
  if (
    entry.description.state !== "present" ||
    entry.description.text === null
  ) {
    return null;
  }
  return {
    authorsLabel: feedDescriptionUsesAuthorsLabel(entry),
    text: entry.description.text,
  };
}

/** First three names, then "et al." when the record has more. */
export function feedCardAuthorLine(authors: readonly string[]): string | null {
  if (authors.length === 0) {
    return null;
  }
  const shown = authors.slice(0, FEED_CARD_AUTHOR_LIMIT).join(", ");
  if (authors.length > FEED_CARD_AUTHOR_LIMIT) {
    return `${shown} et al.`;
  }
  return shown;
}

export function feedCardTags(tags: readonly string[]): {
  more: number;
  shown: string[];
} {
  return {
    more: Math.max(0, tags.length - FEED_CARD_TAG_LIMIT),
    shown: tags.slice(0, FEED_CARD_TAG_LIMIT),
  };
}
