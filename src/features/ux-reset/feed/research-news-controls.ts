/**
 * Search, topic, and sort are laid out for the next integration. They do not
 * change the feed request. Source and published stay on FeedFilterState.
 * Flip a flag and pass its change handler to connect a control without
 * rebuilding the page.
 */

export const RESEARCH_NEWS_HEADING = "Research & News";
export const RESEARCH_NEWS_SUBTITLE =
  "Updates on ticks, Lyme disease, and public health.";
export const RESEARCH_NEWS_IMAGERY_NOTE =
  "Illustrative imagery generated with AI. Articles open on publisher websites.";
export const RESEARCH_NEWS_PENDING_NOTE = "Filtering and sorting coming soon.";
export const RESEARCH_NEWS_PENDING_NOTE_ID = "research-news-pending-note";

export const RESEARCH_NEWS_SEARCH_ENABLED = false;
export const RESEARCH_NEWS_TOPIC_FILTER_ENABLED = false;
export const RESEARCH_NEWS_SORT_ENABLED = false;

export const RESEARCH_NEWS_TOPICS = [
  { id: "all", label: "All topics" },
  { id: "lyme-disease", label: "Lyme disease" },
  { id: "tick-surveillance", label: "Tick surveillance" },
  { id: "prevention", label: "Prevention" },
  { id: "other-tickborne", label: "Other tickborne diseases" },
] as const;

export type ResearchNewsTopicId = (typeof RESEARCH_NEWS_TOPICS)[number]["id"];

export const RESEARCH_NEWS_SORTS = [
  { id: "newest", label: "Newest first" },
] as const;

export type ResearchNewsSortId = (typeof RESEARCH_NEWS_SORTS)[number]["id"];

export const DEFAULT_RESEARCH_NEWS_TOPIC: ResearchNewsTopicId = "all";
export const DEFAULT_RESEARCH_NEWS_SORT: ResearchNewsSortId = "newest";
