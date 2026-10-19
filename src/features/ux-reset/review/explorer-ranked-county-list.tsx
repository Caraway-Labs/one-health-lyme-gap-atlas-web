"use client";

import {
  formatGapScore,
  type ExplorerRankedCounty,
} from "@/features/ux-reset/review/explorer-ranked-counties";
import type { AdjustedCountyScenario } from "@/features/ux-reset/review/explorer-scenario-score";
import { ExplorerAdjustedScenarioLine } from "@/features/ux-reset/review/explorer-what-if-scenario";

export function ExplorerRankedCountyList({
  candidateFips,
  emptyLabel,
  onSelect,
  rows,
  scenarios,
  scopeKey,
  selectedFips,
  showEyebrow = true,
  testId,
}: {
  candidateFips?: ReadonlySet<string>;
  emptyLabel: string;
  onSelect: (fips: string) => void;
  rows: readonly ExplorerRankedCounty[];
  scenarios?: ReadonlyMap<string, AdjustedCountyScenario> | null;
  scopeKey: string;
  selectedFips: string;
  showEyebrow?: boolean;
  testId: string;
}) {
  const scored = rows.filter((row) => row.rank !== null);
  const unscored = rows.filter((row) => row.rank === null);

  return (
    <div className="ux-reset-ranked-counties">
      <header className="ux-reset-ranked-counties-header">
        {showEyebrow ? (
          <p className="ux-reset-ranked-counties-eyebrow">Counties</p>
        ) : null}
        <h2>Choose a county</h2>
      </header>
      {rows.length === 0 ? (
        <p className="type-small" data-testid="explorer-ranked-empty">
          {emptyLabel}
        </p>
      ) : (
        <div
          key={scopeKey}
          aria-label="Ranked counties"
          className="ux-reset-review-candidate-list ux-reset-ranked-county-list"
          role="list"
        >
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
  const displayed = scenario?.kind === "adjusted" ? scenario.score : row.score;
  const color = scenario?.kind === "adjusted" ? scenario.colorToken : row.color;
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className="ux-reset-ranked-row"
      data-fips={row.fips}
      data-rank={row.rank ?? undefined}
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
        <span className="ux-reset-ranked-score is-unavailable">
          <span className="sr-only">No published Atlas gap score. </span>—
        </span>
      ) : (
        <span
          className="ux-reset-ranked-score"
          style={{ background: color ?? undefined }}
        >
          <span className="sr-only">{`Published score ${row.score}. Atlas gap score `}</span>
          {formatGapScore(displayed)}
        </span>
      )}
      <span className="sr-only">
        <ExplorerAdjustedScenarioLine scenario={scenario} showRank={false} />
      </span>
    </button>
  );
}
