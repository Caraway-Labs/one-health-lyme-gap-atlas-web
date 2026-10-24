"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compareReviewCategoryTone } from "@/features/ux-reset/compare/compare-county-profile";
import {
  COMPARE_ALL_STATES,
  COMPARE_PICKER_RESULT_LIMIT,
  compareStateFilterOptions,
  filterCompareCountyOptions,
} from "@/features/ux-reset/compare/compare-county-search";
import type { CompareCountyOption } from "@/features/ux-reset/compare/use-compare-workspace";
import { cn } from "@/lib/utils";

export type ReviewCategoryBadge =
  | { kind: "published"; label: string }
  | { kind: "recognized"; priority: string };

export type CompareSlotLetter = "A" | "B";

export function ReviewCategoryMark({
  badge,
  fips,
  testIdPrefix = "compare-review-category",
}: {
  badge: ReviewCategoryBadge;
  fips: string;
  testIdPrefix?: string;
}) {
  const testId = `${testIdPrefix}-${fips}`;
  switch (badge.kind) {
    case "recognized": {
      const tone = compareReviewCategoryTone(badge.priority);
      if (!tone) {
        return (
          <Badge
            data-review-tone="neutral"
            data-testid={testId}
            variant="outline"
          >
            {badge.priority}
          </Badge>
        );
      }
      return (
        <span data-review-tone={tone} data-testid={testId}>
          <AtlasPriorityBadge priority={badge.priority} />
        </span>
      );
    }
    case "published": {
      return (
        <Badge
          data-review-tone="neutral"
          data-testid={testId}
          variant="outline"
        >
          {badge.label}
        </Badge>
      );
    }
    default: {
      const exhaustive: never = badge;
      return exhaustive;
    }
  }
}

/** County slot identity stays explicit in text as well as color. */
export function CompareSlotMarker({
  className,
  expanded = false,
  letter,
}: {
  className?: string;
  expanded?: boolean;
  letter: CompareSlotLetter;
}) {
  return (
    <Badge
      aria-hidden="true"
      className={cn("ux-reset-compare-slot-marker", className)}
      data-slot-letter={letter}
    >
      {expanded ? `COUNTY ${letter}` : letter}
    </Badge>
  );
}

function resultsStatus(total: number, shown: number): string {
  if (total === 0) {
    return "";
  }
  if (total > shown) {
    return `Showing the first ${shown} of ${total} counties. Keep typing or choose a state to narrow the list.`;
  }
  return total === 1 ? "1 county matches." : `${total} counties match.`;
}

export function CompareCountyPicker({
  autoFocus = false,
  clearLabel,
  label,
  letter,
  onClear,
  onSelect,
  options,
  reviewCategory,
  selectedFips,
  testId,
}: {
  autoFocus?: boolean;
  clearLabel: string;
  label: string;
  letter: CompareSlotLetter;
  onClear: (() => void) | null;
  onSelect: (fips: string) => void;
  options: readonly CompareCountyOption[];
  reviewCategory: ReviewCategoryBadge | null;
  selectedFips: string;
  testId: string;
}) {
  const [stateCode, setStateCode] = useState(COMPARE_ALL_STATES);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = options.find((option) => option.fips === selectedFips);
  const states = useMemo(() => compareStateFilterOptions(options), [options]);
  const { matches, total } = useMemo(
    () => filterCompareCountyOptions(options, { query, stateCode }),
    [options, query, stateCode]
  );
  const stateName =
    states.find((state) => state.code === stateCode)?.name ?? "All states";

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div
      className="ux-reset-compare-slot"
      data-slot-letter={letter}
      data-testid={`${testId}-card`}
    >
      <div className="ux-reset-compare-slot-label">
        <span className="flex items-center gap-1.5">
          <CompareSlotMarker expanded letter={letter} />
          <span className="sr-only">{label}</span>
        </span>
        {reviewCategory && selectedFips ? (
          <ReviewCategoryMark badge={reviewCategory} fips={selectedFips} />
        ) : null}
      </div>
      <div className="ux-reset-compare-picker-row">
        <Select
          value={stateCode}
          onValueChange={(next) => {
            setStateCode(next ?? COMPARE_ALL_STATES);
          }}
        >
          <SelectTrigger
            aria-label={`Filter ${letter} by state`}
            className="h-8 w-full"
            data-testid={`${testId}-state`}
          >
            <SelectValue>{stateName}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72">
            <SelectItem value={COMPARE_ALL_STATES}>All states</SelectItem>
            {states.map((state) => (
              <SelectItem key={state.code} value={state.code}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Combobox
          autoHighlight
          filter={null}
          isItemEqualToValue={(item, value) => item.fips === value.fips}
          itemToStringLabel={(item) => item.label}
          items={matches}
          value={selected ?? null}
          onInputValueChange={(next, details) => {
            setQuery(details.reason === "input-change" ? next : "");
          }}
          onOpenChange={(open) => {
            if (!open) {
              setQuery("");
            }
          }}
          onValueChange={(next) => {
            if (next) {
              onSelect(next.fips);
            }
          }}
        >
          <ComboboxInputGroup>
            <ComboboxInput
              aria-label={label}
              autoComplete="off"
              data-testid={testId}
              placeholder="Search county, state, or FIPS"
              ref={inputRef}
            />
            <ComboboxTrigger aria-label={`Show counties for ${label}`} />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>
              {query.trim()
                ? `No county matches “${query.trim()}”${
                    stateCode === COMPARE_ALL_STATES ? "." : ` in ${stateName}.`
                  }`
                : "No counties are available."}
            </ComboboxEmpty>
            <ComboboxList>
              {(option: CompareCountyOption) => (
                <ComboboxItem
                  disabled={option.disabled}
                  key={option.fips}
                  value={option}
                >
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxStatus>
              {resultsStatus(
                total,
                Math.min(total, COMPARE_PICKER_RESULT_LIMIT)
              )}
            </ComboboxStatus>
          </ComboboxContent>
        </Combobox>
      </div>
      {selectedFips ? (
        <div
          className="ux-reset-compare-chip"
          data-fips={selectedFips}
          data-testid={`compare-chip-${selectedFips}`}
        >
          <p className="ux-reset-compare-identity">
            <span className="ux-reset-compare-county-name">
              {selected?.countyName ?? selected?.label ?? selectedFips}
            </span>
            <span className="ux-reset-compare-fips">
              {selected?.stateLabel ? `${selected.stateLabel} · ` : ""}FIPS{" "}
              {selectedFips}
            </span>
          </p>
          {onClear ? (
            <div className="ux-reset-compare-slot-actions">
              <Button
                aria-label={clearLabel}
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={onClear}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
