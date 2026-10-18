"use client";

import { Download, Info, X } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EXPLORER_AVAILABLE_DATA_OPTIONS,
  EXPLORER_COUNTY_EXPORT_NOTE,
  type ExplorerCountyReference,
  explorerCountyOptionLimit,
  explorerCountySelectionLabel,
  filterExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";
import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
import type { EvidenceView } from "@/lib/atlas-ui";

type ExplorerCountyToolbarProps = {
  availableData: EvidenceView;
  counties: readonly ExplorerCountyReference[];
  countyQuery: string;
  downloadDisabled: boolean;
  scope: ReviewScope;
  selectedFips: string | null;
  stateOptions: readonly AtlasStateOption[];
  onAvailableDataChange: (value: EvidenceView) => void;
  onClearSelection: () => void;
  onCountyQueryChange: (value: string) => void;
  onCountySelect: (county: ExplorerCountyReference) => void;
  onDownload: () => void;
  onScopeChange: (scope: ReviewScope) => void;
};

function isEvidenceView(value: string): value is EvidenceView {
  return EXPLORER_AVAILABLE_DATA_OPTIONS.some(
    (option) => option.value === value
  );
}

export function ExplorerCountyToolbar({
  availableData,
  counties,
  countyQuery,
  downloadDisabled,
  scope,
  selectedFips,
  stateOptions,
  onAvailableDataChange,
  onClearSelection,
  onCountyQueryChange,
  onCountySelect,
  onDownload,
  onScopeChange,
}: ExplorerCountyToolbarProps) {
  const listId = useId();
  const searchId = "explorer-county-search";
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exportHelpOpen, setExportHelpOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState(false);
  const [trackedSelection, setTrackedSelection] = useState(selectedFips);
  if (trackedSelection !== selectedFips) {
    setTrackedSelection(selectedFips);
    setEditingQuery(false);
  }
  const matches = useMemo(
    () =>
      filterExplorerCountyReference(counties, {
        evidence: availableData,
        query: countyQuery,
        scope,
      }),
    [availableData, counties, countyQuery, scope]
  );
  const optionLimit = explorerCountyOptionLimit();
  const options = matches.slice(0, optionLimit);
  const selectedOption = EXPLORER_AVAILABLE_DATA_OPTIONS.find(
    (option) => option.value === availableData
  );
  const activeOption = options[activeIndex] ?? options[0];
  const hiddenMatchCount = Math.max(0, matches.length - options.length);
  const selectedCounty =
    selectedFips === null
      ? undefined
      : counties.find((county) => county.fips === selectedFips);
  const showingSelection = !editingQuery && selectedCounty !== undefined;
  const displayValue = showingSelection
    ? explorerCountySelectionLabel(selectedCounty)
    : countyQuery;

  const selectCounty = (county: ExplorerCountyReference | undefined) => {
    if (!county) {
      return;
    }
    setEditingQuery(false);
    onCountySelect(county);
    setOpen(false);
  };

  const clearCounty = () => {
    setEditingQuery(false);
    setOpen(false);
    onCountyQueryChange("");
    onClearSelection();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (options.length === 0) {
          return;
        }
        if (!open) {
          setOpen(true);
          setActiveIndex(event.key === "ArrowDown" ? 0 : options.length - 1);
          return;
        }
        setActiveIndex((current) => {
          const index = options[current] ? current : 0;
          const delta = event.key === "ArrowDown" ? 1 : -1;
          return (index + delta + options.length) % options.length;
        });
        return;
      }
      case "Enter": {
        event.preventDefault();
        if (open && activeOption) {
          selectCounty(activeOption);
          return;
        }
        const exactFips = matches.find(
          (county) => county.fips === countyQuery.trim()
        );
        if (exactFips) {
          selectCounty(exactFips);
          return;
        }
        if (matches.length === 1) {
          selectCounty(matches[0]);
        }
        return;
      }
      case "Escape": {
        event.preventDefault();
        setOpen(false);
        return;
      }
      case "Home": {
        if (!open || options.length === 0) {
          return;
        }
        event.preventDefault();
        setActiveIndex(0);
        return;
      }
      case "End": {
        if (!open || options.length === 0) {
          return;
        }
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      }
      default: {
        break;
      }
    }
  };

  return (
    <section
      aria-label="County selection"
      className="ux-reset-explorer-toolbar"
      data-testid="explorer-county-toolbar"
    >
      <ReviewScopeSelector
        scope={scope}
        showVisibleLabel={false}
        stateOptions={stateOptions}
        onScopeChange={onScopeChange}
      />
      <div className="ux-reset-review-scope-field ux-reset-county-combobox">
        <div className="relative min-w-0">
          <Input
            aria-activedescendant={
              open && activeOption
                ? `${listId}-${activeOption.fips}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            aria-label="County name or five-digit FIPS"
            autoComplete="off"
            className="truncate pr-8 text-sm"
            data-testid="explorer-county-search"
            id={searchId}
            placeholder="Search county or FIPS"
            role="combobox"
            title={displayValue || undefined}
            type="search"
            value={displayValue}
            onBlur={() => {
              setOpen(false);
            }}
            onChange={(event) => {
              setEditingQuery(true);
              onCountyQueryChange(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={(event) => {
              if (showingSelection) {
                event.currentTarget.select();
                return;
              }
              if (countyQuery.trim().length > 0) {
                setOpen(true);
              }
            }}
            onKeyDown={onSearchKeyDown}
          />
          {displayValue.length > 0 ? (
            <Button
              aria-label="Clear county"
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
              data-testid="explorer-county-clear"
              size="icon"
              type="button"
              variant="ghost"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={clearCounty}
            >
              <X />
            </Button>
          ) : null}
        </div>
        {open ? (
          <div className="ux-reset-county-combobox-list">
            {options.length === 0 ? (
              <p className="type-small">No counties match that name or FIPS.</p>
            ) : (
              <div id={listId} role="listbox">
                {options.map((county) => {
                  const selected = county.fips === activeOption?.fips;
                  return (
                    <button
                      aria-selected={selected}
                      className="ux-reset-county-combobox-option"
                      data-active={selected ? "true" : "false"}
                      data-testid="explorer-county-option"
                      id={`${listId}-${county.fips}`}
                      key={county.fips}
                      role="option"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectCounty(county);
                      }}
                    >
                      {explorerCountySelectionLabel(county)}
                    </button>
                  );
                })}
              </div>
            )}
            {hiddenMatchCount > 0 ? (
              <p className="type-small">
                {options.length} of {matches.length} counties. Keep typing to
                narrow this list.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="ux-reset-review-scope-field">
        <Select
          value={availableData}
          onValueChange={(value) => {
            if (value && isEvidenceView(value)) {
              onAvailableDataChange(value);
            }
          }}
        >
          <SelectTrigger
            {...analyticsControlAttributes("filter_evidence")}
            aria-label="Available data"
            className="w-full min-w-0"
            data-testid="explorer-available-data"
          >
            <SelectValue>{selectedOption?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EXPLORER_AVAILABLE_DATA_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="ux-reset-explorer-download">
        <Button
          {...analyticsControlAttributes("csv_download")}
          aria-describedby="explorer-county-export-note"
          aria-label="Download county list as CSV"
          className="min-w-0 flex-1"
          data-export-scope="state,county-search,available-data"
          data-testid="explorer-download-counties"
          disabled={downloadDisabled}
          type="button"
          variant="secondary"
          onClick={onDownload}
        >
          <Download />
          Download CSV
        </Button>
        <TooltipProvider delay={0}>
          <Tooltip open={exportHelpOpen} onOpenChange={setExportHelpOpen}>
            <TooltipTrigger
              closeOnClick={false}
              render={
                <Button
                  aria-label="About the county list download"
                  className="shrink-0"
                  data-testid="explorer-download-help"
                  size="icon"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setExportHelpOpen(true);
                  }}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent
              align="end"
              className="max-w-sm text-left whitespace-normal"
              data-testid="explorer-county-export-tooltip"
              role="tooltip"
              side="bottom"
            >
              {EXPLORER_COUNTY_EXPORT_NOTE}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <p
          className="sr-only"
          data-testid="explorer-county-export-note"
          id="explorer-county-export-note"
        >
          {EXPLORER_COUNTY_EXPORT_NOTE}
        </p>
      </div>
    </section>
  );
}
