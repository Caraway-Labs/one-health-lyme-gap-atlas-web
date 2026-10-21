"use client";

import { X } from "lucide-react";
import type { Ref } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
            <SelectContent>
              <SelectItem
                className="ux-reset-feed-select-item"
                value={ALL_FEED_SOURCES_VALUE}
              >
                All sources
              </SelectItem>
              {sourceChoices.map((option) => (
                <SelectItem
                  className="ux-reset-feed-select-item"
                  key={option.sourceId}
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
              <Button onClick={onRetrySources} type="button" variant="outline">
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
            <SelectContent>
              {FEED_PUBLISHED_PRESETS.map((preset) => (
                <SelectItem
                  className="ux-reset-feed-select-item"
                  key={preset}
                  value={preset}
                >
                  {FEED_PUBLISHED_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className="type-small ux-reset-feed-help"
            id="intelligence-feed-published-help"
          >
            {PUBLISHED_HELP}
          </p>
        </div>
      </div>
      {filtersActive ? (
        <div className="ux-reset-feed-active">
          <ul className="ux-reset-feed-chips">
            {selectedSource && selectedSourceLabel ? (
              <li>
                <Badge className="ux-reset-feed-chip h-auto" variant="outline">
                  <span>{`Source: ${selectedSourceLabel}`}</span>
                  <Button
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
          <Button onClick={onClear} type="button" variant="outline">
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
