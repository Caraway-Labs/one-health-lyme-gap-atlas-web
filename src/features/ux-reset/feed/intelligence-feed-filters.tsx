"use client";

import { Search, X } from "lucide-react";
import type { Ref } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import {
  activeFeedFilterCount,
  ALL_FEED_SOURCES_VALUE,
  DEFAULT_FEED_PUBLISHED,
  FEED_PUBLISHED_LABELS,
  FEED_PUBLISHED_PRESETS,
  type FeedFilterState,
  type FeedPublishedPreset,
  type FeedSourceOption,
} from "./feed-filters";
import {
  DEFAULT_RESEARCH_NEWS_SORT,
  DEFAULT_RESEARCH_NEWS_TOPIC,
  RESEARCH_NEWS_PENDING_NOTE,
  RESEARCH_NEWS_PENDING_NOTE_ID,
  RESEARCH_NEWS_SEARCH_ENABLED,
  RESEARCH_NEWS_SORT_ENABLED,
  RESEARCH_NEWS_SORTS,
  RESEARCH_NEWS_TOPIC_FILTER_ENABLED,
  RESEARCH_NEWS_TOPICS,
} from "./research-news-controls";

const PUBLISHED_HELP =
  "Items without a publication date appear under All dates.";

function sourceLabel(
  sourceId: string,
  options: readonly FeedSourceOption[]
): string {
  return (
    options.find((option) => option.sourceId === sourceId)?.label ?? sourceId
  );
}

export function IntelligenceFeedFilters({
  filters,
  filterBarRef,
  onClear,
  onPublishedChange,
  onRemovePublished,
  onRemoveSource,
  onRetrySources,
  onSourceChange,
  resultSummary,
  sourceOptions,
  sourcesError,
}: {
  filters: FeedFilterState;
  filterBarRef: Ref<HTMLDivElement>;
  onClear: () => void;
  onPublishedChange: (preset: FeedPublishedPreset) => void;
  onRemovePublished: () => void;
  onRemoveSource: () => void;
  onRetrySources: () => void;
  onSourceChange: (sourceId: string | null) => void;
  resultSummary: string;
  sourceOptions: readonly FeedSourceOption[];
  sourcesError: boolean;
}) {
  const filtersActive = activeFeedFilterCount(filters) > 0;
  const selectedSource = filters.sourceId;
  const knownSource = sourceOptions.some(
    (option) => option.sourceId === selectedSource
  );
  const sourceChoices =
    selectedSource && !knownSource
      ? [
          ...sourceOptions,
          {
            label: selectedSource,
            organization: selectedSource,
            sourceId: selectedSource,
          },
        ]
      : sourceOptions;
  const publishedLabel = FEED_PUBLISHED_LABELS[filters.published];
  const selectedSourceLabel = selectedSource
    ? sourceLabel(selectedSource, sourceChoices)
    : null;
  const sourceItems = Object.fromEntries([
    [ALL_FEED_SOURCES_VALUE, "All sources"],
    ...sourceChoices.map((option) => [option.sourceId, option.label]),
  ]);
  const publishedItems = Object.fromEntries(
    FEED_PUBLISHED_PRESETS.map((preset) => [
      preset,
      FEED_PUBLISHED_LABELS[preset],
    ])
  );

  return (
    <div
      aria-label="Feed filters"
      className="ux-reset-feed-filters"
      ref={filterBarRef}
      role="group"
      tabIndex={-1}
    >
      <div className="ux-reset-research-search-row">
        <div className="ux-reset-research-search">
          <label className="sr-only" htmlFor="research-news-search">
            Search articles
          </label>
          <Search aria-hidden="true" />
          <Input
            aria-describedby={RESEARCH_NEWS_PENDING_NOTE_ID}
            className="ux-reset-research-search-input disabled:opacity-100"
            disabled={!RESEARCH_NEWS_SEARCH_ENABLED}
            id="research-news-search"
            placeholder="Search articles"
            type="search"
          />
        </div>
        <div
          aria-describedby={RESEARCH_NEWS_PENDING_NOTE_ID}
          aria-label="Topics"
          className="ux-reset-research-topics"
          role="group"
        >
          {RESEARCH_NEWS_TOPICS.map((topic) => (
            <button
              aria-pressed={topic.id === DEFAULT_RESEARCH_NEWS_TOPIC}
              className="ux-reset-research-topic"
              disabled={!RESEARCH_NEWS_TOPIC_FILTER_ENABLED}
              key={topic.id}
              type="button"
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ux-reset-research-filter-row">
        <div className="ux-reset-feed-controls">
          <div className="ux-reset-feed-field">
            <label className="type-small" htmlFor="intelligence-feed-source">
              Source
            </label>
            <Select
              items={sourceItems}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                onSourceChange(value === ALL_FEED_SOURCES_VALUE ? null : value);
              }}
              value={selectedSource ?? ALL_FEED_SOURCES_VALUE}
            >
              <SelectTrigger
                className="ux-reset-feed-select"
                id="intelligence-feed-source"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="ux-reset-feed-select-menu w-max max-w-[min(28rem,calc(100vw-1.5rem))] min-w-[max(var(--anchor-width),18rem)]"
              >
                <SelectItem
                  className="ux-reset-feed-select-item"
                  textWrap
                  value={ALL_FEED_SOURCES_VALUE}
                >
                  All sources
                </SelectItem>
                {sourceChoices.map((option) => (
                  <SelectItem
                    className="ux-reset-feed-select-item"
                    key={option.sourceId}
                    textWrap
                    value={option.sourceId}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourcesError ? (
              <div className="ux-reset-feed-source-status" role="status">
                <p>Sources couldn&apos;t load</p>
                <Button
                  {...analyticsControlAttributes("feed_sources_retry")}
                  onClick={onRetrySources}
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
          <div className="ux-reset-feed-field">
            <label className="type-small" htmlFor="intelligence-feed-published">
              Published
            </label>
            <Select
              items={publishedItems}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                const preset = FEED_PUBLISHED_PRESETS.find(
                  (item) => item === value
                );
                if (preset) {
                  onPublishedChange(preset);
                }
              }}
              value={filters.published}
            >
              <SelectTrigger
                aria-describedby="intelligence-feed-published-help"
                className="ux-reset-feed-select"
                id="intelligence-feed-published"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="ux-reset-feed-select-menu w-max max-w-[min(28rem,calc(100vw-1.5rem))] min-w-[max(var(--anchor-width),18rem)]"
              >
                {FEED_PUBLISHED_PRESETS.map((preset) => (
                  <SelectItem
                    className="ux-reset-feed-select-item"
                    key={preset}
                    textWrap
                    value={preset}
                  >
                    {FEED_PUBLISHED_LABELS[preset]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ux-reset-feed-field">
            <label className="type-small" htmlFor="research-news-sort">
              Sort
            </label>
            <select
              aria-describedby={RESEARCH_NEWS_PENDING_NOTE_ID}
              defaultValue={DEFAULT_RESEARCH_NEWS_SORT}
              disabled={!RESEARCH_NEWS_SORT_ENABLED}
              id="research-news-sort"
            >
              {RESEARCH_NEWS_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="type-small ux-reset-feed-summary"
        >
          {resultSummary}
        </p>
      </div>
      <p
        className="type-small ux-reset-feed-help"
        id="intelligence-feed-published-help"
      >
        {PUBLISHED_HELP}
      </p>
      <p
        className="ux-reset-research-pending"
        id={RESEARCH_NEWS_PENDING_NOTE_ID}
      >
        {RESEARCH_NEWS_PENDING_NOTE}
      </p>
      {filtersActive ? (
        <div className="ux-reset-feed-active">
          <ul className="ux-reset-feed-chips">
            {selectedSource && selectedSourceLabel ? (
              <li>
                <Badge className="ux-reset-feed-chip h-auto" variant="outline">
                  <span>{`Source: ${selectedSourceLabel}`}</span>
                  <Button
                    {...analyticsControlAttributes("feed_remove_filter")}
                    aria-label={`Remove filter Source: ${selectedSourceLabel}`}
                    className="ux-reset-feed-chip-remove"
                    onClick={onRemoveSource}
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Badge>
              </li>
            ) : null}
            {filters.published === DEFAULT_FEED_PUBLISHED ? null : (
              <li>
                <Badge className="ux-reset-feed-chip h-auto" variant="outline">
                  <span>{`Published: ${publishedLabel}`}</span>
                  <Button
                    {...analyticsControlAttributes("feed_remove_filter")}
                    aria-label={`Remove filter Published: ${publishedLabel}`}
                    className="ux-reset-feed-chip-remove"
                    onClick={onRemovePublished}
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Badge>
              </li>
            )}
          </ul>
          <Button
            {...analyticsControlAttributes("feed_clear_filters")}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
