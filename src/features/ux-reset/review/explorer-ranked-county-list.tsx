"use client";

import { ArrowDownAZ, CircleOff, SlidersHorizontal } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatGapScore,
  type ExplorerRankedCounty,
} from "@/features/ux-reset/review/explorer-ranked-counties";
import type { AdjustedCountyScenario } from "@/features/ux-reset/review/explorer-scenario-score";
import { ExplorerAdjustedScenarioLine } from "@/features/ux-reset/review/explorer-what-if-scenario";

import "./explorer-visual-first.css";

/** Governed order is the published ranking. The others are viewing aids. */
const SORT_KEYS = ["rank", "name", "evidence"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const SORT_LABELS = {
  evidence: "Evidence",
  name: "Name",
  rank: "Priority",
} as const satisfies Record<SortKey, string>;

function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.some((key) => key === value);
}

function sortRows(
  rows: readonly ExplorerRankedCounty[],
  sort: SortKey
): ExplorerRankedCounty[] {
  switch (sort) {
    case "rank": {
      return [...rows];
    }
    case "name": {
      return [...rows].toSorted(
        (left, right) =>
          left.county.localeCompare(right.county, "en") ||
          left.fips.localeCompare(right.fips)
      );
    }
    case "evidence": {
      // A county with no published completeness stays after every number. It
      // is never sorted as zero.
      return [...rows].toSorted((left, right) => {
        if (left.completeness === null && right.completeness === null) {
          return 0;
        }
        if (left.completeness === null) {
          return 1;
        }
        if (right.completeness === null) {
          return -1;
        }
        return right.completeness - left.completeness;
      });
    }
    default: {
      const exhaustive: never = sort;
      return exhaustive;
    }
  }
}

export function ExplorerRankedCountyList({
  candidateFips,
  emptyLabel,
  note,
  onSelect,
  rows,
  scenarioActive = false,
  scenarios,
  scopeKey,
  selectedFips,
  testId,
}: {
  candidateFips?: ReadonlySet<string>;
  emptyLabel: string;
  note?: string;
  onSelect: (fips: string) => void;
  rows: readonly ExplorerRankedCounty[];
  /** True when the scenario settings differ from the published defaults. */
  scenarioActive?: boolean;
  scenarios?: ReadonlyMap<string, AdjustedCountyScenario> | null;
  scopeKey: string;
  selectedFips: string;
  testId: string;
}) {
  return (
    <ExplorerRankedCountyListBody
      key={scopeKey}
      candidateFips={candidateFips}
      emptyLabel={emptyLabel}
      note={note}
      rows={rows}
      scenarioActive={scenarioActive}
      scenarios={scenarios}
      selectedFips={selectedFips}
      testId={testId}
      onSelect={onSelect}
    />
  );
}

function ExplorerRankedCountyListBody({
  candidateFips,
  emptyLabel,
  note,
  onSelect,
  rows,
  scenarioActive,
  scenarios,
  selectedFips,
  testId,
}: {
  candidateFips?: ReadonlySet<string>;
  emptyLabel: string;
  note?: string;
  onSelect: (fips: string) => void;
  rows: readonly ExplorerRankedCounty[];
  scenarioActive: boolean;
  scenarios?: ReadonlyMap<string, AdjustedCountyScenario> | null;
  selectedFips: string;
  testId: string;
}) {
  const [sort, setSort] = useState<SortKey>("rank");
  const ordered = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const scored = ordered.filter((row) => row.rank !== null);
  const unscored = ordered.filter((row) => row.rank === null);

  return (
    <div className="ux-reset-ranked-counties">
      <header className="ux-reset-ranked-counties-header">
        <h2 data-testid="explorer-counties-heading">Counties</h2>
        {scenarioActive ? (
          <Badge data-testid="explorer-list-scenario-badge" variant="outline">
            <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
            Scenario scores
          </Badge>
        ) : null}
      </header>
      {note ? (
        <p
          className="type-small"
          data-testid="explorer-national-shortlist-note"
        >
          {note}
        </p>
      ) : null}
      {rows.length > 1 ? (
        <div className="ux-reset-ranked-sort">
          <span className="ux-reset-ranked-sort-label" id="explorer-sort-label">
            <ArrowDownAZ aria-hidden="true" />
            Sort
          </span>
          <ToggleGroup
            aria-labelledby="explorer-sort-label"
            data-testid="explorer-ranked-sort"
            size="sm"
            spacing={1}
            value={[sort]}
            variant="outline"
            onValueChange={(next) => {
              const [key] = next;
              setSort(key && isSortKey(key) ? key : "rank");
            }}
          >
            {SORT_KEYS.map((key) => (
              <ToggleGroupItem
                data-testid={`explorer-sort-${key}`}
                key={key}
                value={key}
              >
                {SORT_LABELS[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="type-small" data-testid="explorer-ranked-empty">
          {emptyLabel}
        </p>
      ) : (
        <div
          aria-label="Ranked counties"
          className="ux-reset-review-candidate-list ux-reset-ranked-county-list"
          role="list"
        >
          <div
            aria-hidden="true"
            className="ux-reset-ranked-columns"
            data-testid="explorer-ranked-columns"
          >
            <span>#</span>
            <span>County</span>
            <span>Review priority</span>
            <span>Evidence</span>
          </div>
          {scored.map((row) => (
            <div key={row.fips} role="listitem">
              <RankedCountyButton
                candidate={candidateFips?.has(row.fips) ?? false}
                row={row}
                scenario={scenarios?.get(row.fips)}
                selected={row.fips === selectedFips}
                testId={testId}
                onSelect={onSelect}
              />
            </div>
          ))}
          {unscored.length > 0 ? (
            <div className="ux-reset-ranked-unscored" role="presentation">
              <p>No published Atlas gap score</p>
            </div>
          ) : null}
          {unscored.map((row) => (
            <div key={row.fips} role="listitem">
              <RankedCountyButton
                candidate={candidateFips?.has(row.fips) ?? false}
                row={row}
                scenario={scenarios?.get(row.fips)}
                selected={row.fips === selectedFips}
                testId={testId}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bar width for a 0-100 published value. Never negative, never past full. */
function barPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function RankedCountyButton({
  candidate,
  onSelect,
  row,
  scenario,
  selected,
  testId,
}: {
  candidate: boolean;
  onSelect: (fips: string) => void;
  row: ExplorerRankedCounty;
  scenario?: AdjustedCountyScenario;
  selected: boolean;
  testId: string;
}) {
  const name = `${row.county}, ${row.state}`;
  const adjusted = scenario?.kind === "adjusted";
  const displayed = adjusted ? scenario.score : row.score;
  const color = adjusted ? scenario.colorToken : row.color;
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className="ux-reset-ranked-row"
      data-fips={row.fips}
      data-rank={row.rank ?? undefined}
      data-scenario={adjusted ? "adjusted" : undefined}
      data-testid={candidate ? "review-candidate" : testId}
      title={name}
      type="button"
      onClick={() => {
        onSelect(row.fips);
      }}
    >
      <span className="ux-reset-ranked-number">
        {row.rank === null ? (
          <span className="sr-only">Not ranked</span>
        ) : (
          row.rank
        )}
      </span>
      <span className="ux-reset-ranked-name">{name}</span>
      {displayed === null ? (
        <span className="ux-reset-ranked-score is-unavailable atlas-state-unavailable">
          <CircleOff aria-hidden="true" />
          <span aria-hidden="true">No score</span>
          <span className="sr-only">No published Atlas gap score. </span>
        </span>
      ) : (
        <span className="ux-reset-ranked-score">
          <span className="sr-only">
            {`Published score ${row.score}. Atlas gap score `}
          </span>
          <span className="ux-reset-ranked-score-value">
            {adjusted ? (
              <SlidersHorizontal
                aria-hidden="true"
                className="ux-reset-ranked-scenario-mark"
              />
            ) : null}
            {formatGapScore(displayed)}
          </span>
          <span
            aria-hidden="true"
            className="ux-reset-ranked-bar"
            style={
              {
                "--ranked-bar-color": color ?? undefined,
                "--ranked-bar-size": `${barPercent(displayed)}%`,
              } as CSSProperties
            }
          />
        </span>
      )}
      <RankedCompleteness value={row.completeness} />
      <span className="sr-only">
        <ExplorerAdjustedScenarioLine scenario={scenario} showRank={false} />
      </span>
    </button>
  );
}

function RankedCompleteness({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        aria-hidden="true"
        className="ux-reset-ranked-evidence atlas-state-unavailable"
        data-testid="explorer-ranked-evidence"
      />
    );
  }
  return (
    <Meter
      aria-label="Evidence completeness"
      className="ux-reset-ranked-evidence"
      data-testid="explorer-ranked-evidence"
      max={100}
      min={0}
      value={value}
    >
      <span className="ux-reset-ranked-evidence-value">{value}%</span>
    </Meter>
  );
}
