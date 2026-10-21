"use client";

import { ListFilter, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  EXPLORER_AVAILABLE_DATA_OPTIONS,
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

import "./explorer-visual-first.css";

type ExplorerCountyToolbarProps = {
  availableData: EvidenceView;
  counties: readonly ExplorerCountyReference[];
  countyQuery: string;
  scope: ReviewScope;
  scopeLabel: string;
  selectedFips: string | null;
  stateOptions: readonly AtlasStateOption[];
  /** Scenario, resources, export, and release controls. */
  trailing?: ReactNode;
  onAvailableDataChange: (value: EvidenceView) => void;
  onClearSelection: () => void;
  onCountyQueryChange: (value: string) => void;
  onCountySelect: (county: ExplorerCountyReference) => void;
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
  scope,
  scopeLabel,
  selectedFips,
  stateOptions,
  trailing,
  onAvailableDataChange,
  onClearSelection,
  onCountyQueryChange,
  onCountySelect,
  onScopeChange,
}: ExplorerCountyToolbarProps) {
  const listId = useId();
  const searchId = "explorer-county-search";
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const filteredCountyCount = useMemo(
    () =>
      counties.length === 0
        ? null
        : filterExplorerCountyReference(counties, {
            evidence: availableData,
            query: "",
            scope,
          }).length,
    [availableData, counties, scope]
  );

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
      className="ux-reset-explorer-toolbar ux-reset-explorer-context-bar"
      data-testid="explorer-county-toolbar"
    >
      <div className="ux-reset-explorer-context-row">
        <Breadcrumb
          aria-label="Geography"
          className="ux-reset-explorer-breadcrumb"
          data-testid="explorer-breadcrumb"
        >
          <BreadcrumbList>
            <BreadcrumbItem>
              {scope === "ALL" ? (
                <BreadcrumbPage>United States</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <button
                      aria-label="United States"
                      data-testid="explorer-breadcrumb-us"
                      type="button"
                      onClick={() => {
                        onScopeChange("ALL");
                      }}
                    />
                  }
                >
                  United States
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {scope === "ALL" ? null : (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {selectedCounty ? (
                    <BreadcrumbLink
                      render={
                        <button
                          aria-label={scopeLabel}
                          data-testid="explorer-breadcrumb-state"
                          type="button"
                          onClick={clearCounty}
                        />
                      }
                    >
                      {scopeLabel}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{scopeLabel}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {selectedCounty ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedCounty.county}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
        <div
          className="ux-reset-explorer-context-actions"
          data-testid="explorer-context-actions"
        >
          {trailing}
        </div>
      </div>
      <div className="ux-reset-explorer-context-fields">
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
                <p className="type-small">
                  No counties match that name or FIPS.
                </p>
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
        <div className="ux-reset-review-scope-field ux-reset-explorer-filter">
          <ListFilter
            aria-hidden="true"
            className="ux-reset-explorer-filter-icon"
          />
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
          {filteredCountyCount === null ? null : (
            <Badge
              className="ux-reset-explorer-filter-count"
              data-testid="explorer-filter-count"
              variant="secondary"
            >
              {filteredCountyCount}{" "}
              {filteredCountyCount === 1 ? "county" : "counties"}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}
