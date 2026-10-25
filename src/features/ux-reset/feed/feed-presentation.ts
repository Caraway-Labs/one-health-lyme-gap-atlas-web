import type { FeedListEntry } from "@/generated/models/feedListEntry";
import type { FeedListEntryPublicationDateState } from "@/generated/models/feedListEntryPublicationDateState";
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
  Exclude<FeedListEntryPublicationDateState, "present">,
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

export function feedItemTitle(entry: FeedListEntry): string {
  const title = entry.title?.trim() ?? "";
  return title.length > 0 ? title : UNTITLED_ITEM;
}

/** Publisher text from the contract, then the governed source organization. */
export function feedPublisherLabel(entry: FeedListEntry): string {
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
export function feedPublicationDate(entry: FeedListEntry): FeedPublicationDate {
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
