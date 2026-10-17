"use client";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { ScoringCalculationPreview } from "@/components/scoring-calculation-preview";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  adjustCountyScenarios,
  SCENARIO_CONTROL_RANGES,
  SCENARIO_SCORE_DEFAULTS,
  scoreSettingsFromCollection,
  scenarioSettingsEqual,
  type AdjustedCountyScenario,
} from "@/features/ux-reset/review/explorer-scenario-score";
import type { CountyScoreSummary } from "@/generated/models";
import type { ScoreSettings } from "@/lib/atlas-ui";

const LIMITED_SCENARIO_REASON =
  "Published incidence is not on this collection, so this change is limited.";

export const EXPLORER_SCENARIO_IMPACT_MICROCOPY =
  "Published scores are fixed official values. Adjusted values are browser-only exploratory calculations: a surveillance-review / Atlas gap-score scenario, not a personal Lyme disease-risk estimate or a new ML prediction. These categories are separate from Tier 1 ML surveillance-priority labels.";

export type ExplorerWhatIfImpactState =
  | { status: "none" }
  | { status: "pending" }
  | { status: "error" }
  | { status: "unavailable" }
  | {
      /**
       * True when the sliders differ from the governed baseline.
       * A null scenario map then means every in-scope county is unchanged.
       * It does not mean the baseline, and it is never a stand-in for limited.
       */
      assumptionsChanged: boolean;
      countyName: string;
      governedPriority: string;
      governedScore: number;
      scenario: AdjustedCountyScenario | null;
      status: "ready";
    };

type ExplorerScenarioImpactView =
  | { kind: "pending" }
  | { kind: "error" }
  | {
      collapsed: string;
      expanded: string;
      kind: "placeholder";
      placeholder: "none" | "unavailable";
    }
  | {
      collapsed: string;
      countyName: string;
      governedLabel: string;
      governedPriority: string;
      kind: "baseline";
    }
  | {
      accessibleLead: string;
      adjustedLabel: string;
      adjustedPriority: string;
      collapsed: string;
      countyName: string;
      deltaLabel: string;
      governedLabel: string;
      governedPriority: string;
      kind: "definite";
      priorityText: string;
      resultKind: "adjusted" | "unchanged";
    }
  | {
      collapsed: string;
      countyName: string;
      governedLabel: string;
      governedPriority: string;
      kind: "limited";
      reason: string;
    };

type ExplorerWhatIfScenarioProps = {
  impact: ExplorerWhatIfImpactState;
  onChange: (settings: ScoreSettings) => void;
  onRetryScores?: () => void;
  scoresRetrying?: boolean;
  settings: ScoreSettings;
};

export function formatExplorerScenarioScore(score: number): string {
  return (Math.round(score * 10) / 10).toFixed(1);
}

/** Signed point change. Positive and negative values keep a sign; no change is `0.0`. */
export function formatExplorerScenarioDelta(deltaPoints: number): string {
  const rounded = Math.round(deltaPoints * 10) / 10;
  if (rounded === 0) {
    return "0.0 points";
  }
  const absolute = Math.abs(rounded).toFixed(1);
  return rounded > 0 ? `+${absolute} points` : `\u2212${absolute} points`;
}

function priorityChangeText(published: string, adjusted: string): string {
  if (published === adjusted) {
    return "Priority unchanged";
  }
  return `Priority changed: ${published} → ${adjusted}`;
}

function collectionSettingsRecord(
  settings: Record<string, number> | ScoreSettings | undefined
): Record<string, number> | undefined {
  if (!settings) {
    return undefined;
  }
  return {
    ecological_share: settings.ecological_share,
    low_incidence_breakpoint: settings.low_incidence_breakpoint,
    missing_human_weakness: settings.missing_human_weakness,
  };
}

export function resolveExplorerWhatIfImpact(input: {
  collectionSettings: Record<string, number> | ScoreSettings | undefined;
  counties: readonly CountyScoreSummary[] | undefined;
  countyFips: string | null;
  scopeCode: string;
  scoresStatus: "error" | "loading" | "ready";
  settings: ScoreSettings;
}): ExplorerWhatIfImpactState {
  if (!input.countyFips) {
    return { status: "none" };
  }
  if (input.scoresStatus === "loading") {
    return { status: "pending" };
  }
  if (input.scoresStatus === "error") {
    return { status: "error" };
  }
  if (!input.counties) {
    return { status: "unavailable" };
  }
  const inScope = input.counties.filter(
    (county) => county.state === input.scopeCode
  );
  const selected = inScope.find((county) => county.fips === input.countyFips);
  if (!selected) {
    return { status: "unavailable" };
  }
  const baseline = scoreSettingsFromCollection(
    collectionSettingsRecord(input.collectionSettings)
  );
  const scenarios = adjustCountyScenarios(inScope, input.settings, baseline);
  return {
    assumptionsChanged: !scenarioSettingsEqual(input.settings, baseline),
    countyName: selected.county.trim() || "Selected county",
    governedPriority: selected.priority.trim(),
    governedScore: selected.score.score,
    scenario: scenarios?.get(selected.fips) ?? null,
    status: "ready",
  };
}

function definiteScenarioImpact(input: {
  adjustedLabel: string;
  adjustedPriority: string;
  countyName: string;
  governedLabel: string;
  governedPriority: string;
  resultKind: "adjusted" | "unchanged";
}): ExplorerScenarioImpactView {
  const deltaLabel = formatExplorerScenarioDelta(
    Number(input.adjustedLabel) - Number(input.governedLabel)
  );
  return {
    accessibleLead: "Published to adjusted.",
    adjustedLabel: input.adjustedLabel,
    adjustedPriority: input.adjustedPriority,
    collapsed: `${input.governedLabel} → ${input.adjustedLabel} · ${deltaLabel}`,
    countyName: input.countyName,
    deltaLabel,
    governedLabel: input.governedLabel,
    governedPriority: input.governedPriority,
    kind: "definite",
    priorityText: priorityChangeText(
      input.governedPriority,
      input.adjustedPriority
    ),
    resultKind: input.resultKind,
  };
}

function presentReadyImpact(
  impact: Extract<ExplorerWhatIfImpactState, { status: "ready" }>
): ExplorerScenarioImpactView {
  const governedLabel = formatExplorerScenarioScore(impact.governedScore);
  if (impact.scenario === null) {
    if (!impact.assumptionsChanged) {
      return {
        collapsed: `Published score ${governedLabel} · No adjustments`,
        countyName: impact.countyName,
        governedLabel,
        governedPriority: impact.governedPriority,
        kind: "baseline",
      };
    }
    return definiteScenarioImpact({
      adjustedLabel: governedLabel,
      adjustedPriority: impact.governedPriority,
      countyName: impact.countyName,
      governedLabel,
      governedPriority: impact.governedPriority,
      resultKind: "unchanged",
    });
  }
  switch (impact.scenario.kind) {
    case "limited": {
      return {
        collapsed: `Published score ${governedLabel} · Adjusted scenario unavailable`,
        countyName: impact.countyName,
        governedLabel,
        governedPriority: impact.governedPriority,
        kind: "limited",
        reason: LIMITED_SCENARIO_REASON,
      };
    }
    case "adjusted":
    case "unchanged": {
      return definiteScenarioImpact({
        adjustedLabel: formatExplorerScenarioScore(impact.scenario.score),
        adjustedPriority: impact.scenario.priority,
        countyName: impact.countyName,
        governedLabel,
        governedPriority: impact.governedPriority,
        resultKind: impact.scenario.kind,
      });
    }
    default: {
      const exhaustive: never = impact.scenario;
      return exhaustive;
    }
  }
}

export function presentExplorerScenarioImpact(
  state: ExplorerWhatIfImpactState
): ExplorerScenarioImpactView {
  switch (state.status) {
    case "none": {
      return {
        collapsed: "Select a county",
        expanded:
          "Select a county to see its published score and any adjusted scenario.",
        kind: "placeholder",
        placeholder: "none",
      };
    }
    case "pending": {
      return { kind: "pending" };
    }
    case "error": {
      return { kind: "error" };
    }
    case "unavailable": {
      return {
        collapsed: "Score comparison unavailable",
        expanded: "Score comparison is unavailable for this county.",
        kind: "placeholder",
        placeholder: "unavailable",
      };
    }
    case "ready": {
      return presentReadyImpact(state);
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

type ScenarioControlProps = {
  label: string;
  max: number;
  min: number;
  note: string;
  onChange: (value: number) => void;
  step: number;
  valueLabel: string;
  value: number;
};

function ImpactScoreCell({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="ux-reset-explorer-scenario-impact-cell">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        {detail ? <span>{detail}</span> : null}
      </dd>
    </div>
  );
}

function ScenarioImpactSummary({ view }: { view: ExplorerScenarioImpactView }) {
  if (view.kind === "pending" || view.kind === "error") {
    return null;
  }
  return (
    <span
      className="ux-reset-explorer-scenario-impact-summary"
      data-impact={view.kind === "placeholder" ? view.placeholder : view.kind}
      data-testid="explorer-scenario-impact-summary"
    >
      {view.kind === "definite" ? (
        <span
          className="sr-only"
          data-testid="explorer-scenario-impact-description"
        >
          {view.accessibleLead}
        </span>
      ) : null}
      {view.collapsed}
    </span>
  );
}

function ScenarioImpactDetails({ view }: { view: ExplorerScenarioImpactView }) {
  switch (view.kind) {
    case "pending":
    case "error": {
      return null;
    }
    case "placeholder": {
      return (
        <p
          data-impact={view.placeholder}
          data-testid="explorer-scenario-impact"
        >
          {view.expanded}
        </p>
      );
    }
    case "baseline": {
      return (
        <section
          aria-labelledby="explorer-scenario-impact-heading"
          className="ux-reset-explorer-scenario-impact"
          data-impact="baseline"
          data-testid="explorer-scenario-impact"
        >
          <h3 id="explorer-scenario-impact-heading">
            Scenario impact — {view.countyName}
          </h3>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              detail={view.governedPriority}
              label="Published score"
              value={view.governedLabel}
            />
            <ImpactScoreCell label="Adjusted scenario" value="No adjustments" />
          </dl>
        </section>
      );
    }
    case "definite": {
      return (
        <section
          aria-labelledby="explorer-scenario-impact-heading"
          className="ux-reset-explorer-scenario-impact"
          data-impact={view.resultKind}
          data-testid="explorer-scenario-impact"
        >
          <h3 id="explorer-scenario-impact-heading">
            Scenario impact — {view.countyName}
          </h3>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              detail={view.governedPriority}
              label="Published score"
              value={view.governedLabel}
            />
            <ImpactScoreCell
              detail={view.adjustedPriority}
              label="Adjusted scenario"
              value={view.adjustedLabel}
            />
            <ImpactScoreCell label="Change" value={view.deltaLabel} />
          </dl>
          <p className="ux-reset-explorer-scenario-impact-priority">
            {view.priorityText}
          </p>
        </section>
      );
    }
    case "limited": {
      return (
        <section
          aria-labelledby="explorer-scenario-impact-heading"
          className="ux-reset-explorer-scenario-impact"
          data-impact="limited"
          data-testid="explorer-scenario-impact"
        >
          <h3 id="explorer-scenario-impact-heading">
            Scenario impact — {view.countyName}
          </h3>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              detail={view.governedPriority}
              label="Published score"
              value={view.governedLabel}
            />
            <ImpactScoreCell
              detail={view.reason}
              label="Adjusted scenario"
              value="Adjusted scenario unavailable"
            />
          </dl>
        </section>
      );
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function ScenarioControl({
  label,
  max,
  min,
  note,
  onChange,
  step,
  value,
  valueLabel,
}: ScenarioControlProps) {
  const noteId = `explorer-scenario-${label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <label className="ux-reset-explorer-scenario-control">
      <span>{label}</span>
      <strong>{valueLabel}</strong>
      <Slider
        aria-describedby={noteId}
        aria-label={label}
        aria-valuetext={valueLabel}
        max={max}
        min={min}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <small id={noteId}>{note}</small>
    </label>
  );
}

/**
 * Collapsed what-if assumptions for Atlas Explorer.
 * The governed score stays on the county row; these controls only change the
 * browser scenario.
 */
export function ExplorerWhatIfScenario({
  impact,
  onChange,
  onRetryScores,
  scoresRetrying = false,
  settings,
}: ExplorerWhatIfScenarioProps) {
  const atDefaults = scenarioSettingsEqual(settings, SCENARIO_SCORE_DEFAULTS);
  const impactView = presentExplorerScenarioImpact(impact);
  return (
    <>
      {impact.status === "error" ? (
        <AtlasStatusMessage
          className="ux-reset-explorer-scenario-scores-error"
          tone="error"
        >
          <p>
            The published scores could not be loaded. This is a request failure,
            not missing evidence.
          </p>
          {onRetryScores ? (
            <Button
              data-testid="explorer-scenario-scores-retry"
              disabled={scoresRetrying}
              type="button"
              variant="secondary"
              onClick={onRetryScores}
            >
              {scoresRetrying
                ? "Retrying published scores…"
                : "Retry published scores"}
            </Button>
          ) : null}
        </AtlasStatusMessage>
      ) : null}
      <details
        className="ux-reset-explorer-scenario"
        data-testid="explorer-what-if-scenario"
      >
        <summary data-testid="explorer-what-if-summary">
          <span className="ux-reset-explorer-scenario-heading">
            <span>What-if scenario</span>
            <small>Scoring calculation · exploratory assumptions</small>
          </span>
          <ScoringCalculationPreview settings={settings} />
          <ScenarioImpactSummary view={impactView} />
          <span className="ux-reset-explorer-scenario-affordance">
            <span className="ux-reset-explorer-scenario-affordance-closed">
              View &amp; adjust assumptions
            </span>
            <span className="ux-reset-explorer-scenario-affordance-open">
              Hide assumptions
            </span>
            <span
              aria-hidden="true"
              className="ux-reset-explorer-scenario-chevron"
            />
          </span>
        </summary>
        <div className="ux-reset-explorer-scenario-body">
          <p>
            The score combines the published human surveillance signal with{" "}
            <strong>
              {settings.ecological_share}% tick and pathogen evidence
            </strong>{" "}
            and{" "}
            <strong>{`${100 - settings.ecological_share}% community context.`}</strong>{" "}
            Missing county records are never treated as zero cases. Moving a
            slider recalculates an adjusted scenario in this browser for the
            counties in view. The governed score stays the published value.
          </p>
          <p>
            This is a follow-up priority calculation for surveillance review. It
            is not a diagnosis, an individual exposure estimate, or a prediction
            of future cases. Adjusted values are not written to the release.
          </p>
          <p>
            County list scores update with these assumptions. Map colors update
            on the Atlas gap score layer. This scores collection does not
            include published incidence. Raising the threshold leaves counties
            whose governed human signal is already 0 with an unavailable
            adjusted result, and the governed score stays in place. A missing
            incidence is not treated as zero.
          </p>
          <ScenarioImpactDetails view={impactView} />
          <p
            className="type-small ux-reset-explorer-scenario-impact-note"
            data-testid="explorer-scenario-impact-microcopy"
          >
            {EXPLORER_SCENARIO_IMPACT_MICROCOPY}
          </p>
          <div className="ux-reset-explorer-scenario-controls">
            <ScenarioControl
              label="Tick and pathogen share"
              max={SCENARIO_CONTROL_RANGES.ecological_share.max}
              min={SCENARIO_CONTROL_RANGES.ecological_share.min}
              note="Balances tick and pathogen evidence with community context."
              step={SCENARIO_CONTROL_RANGES.ecological_share.step}
              value={settings.ecological_share}
              valueLabel={`${settings.ecological_share}%`}
              onChange={(value) => {
                onChange({ ...settings, ecological_share: value });
              }}
            />
            <ScenarioControl
              label="Published-record threshold"
              max={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.max}
              min={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.min}
              note="At this published incidence value, the human-signal weakness is zero."
              step={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.step}
              value={settings.low_incidence_breakpoint}
              valueLabel={`${settings.low_incidence_breakpoint} per 100,000`}
              onChange={(value) => {
                onChange({ ...settings, low_incidence_breakpoint: value });
              }}
            />
            <ScenarioControl
              label="Missing county-record value"
              max={SCENARIO_CONTROL_RANGES.missing_human_weakness.max}
              min={SCENARIO_CONTROL_RANGES.missing_human_weakness.min}
              note="Represents uncertainty where no county-level record is publishable."
              step={SCENARIO_CONTROL_RANGES.missing_human_weakness.step}
              value={settings.missing_human_weakness}
              valueLabel={String(settings.missing_human_weakness)}
              onChange={(value) => {
                onChange({ ...settings, missing_human_weakness: value });
              }}
            />
          </div>
          <Button
            data-testid="explorer-scenario-reset"
            disabled={atDefaults}
            type="button"
            variant="secondary"
            onClick={() => {
              onChange(SCENARIO_SCORE_DEFAULTS);
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </details>
    </>
  );
}

export function explorerScenarioSelectionText(
  scenario: AdjustedCountyScenario
): string {
  switch (scenario.kind) {
    case "adjusted":
    case "unchanged": {
      return `Governed score ${scenario.governedScore}. Adjusted scenario ${scenario.score}. ${scenario.priority}. This follow-up priority scenario keeps the governed score and is not personal disease risk.`;
    }
    case "limited": {
      return `Governed score ${scenario.governedScore}. Adjusted scenario unavailable. Published incidence is not on this collection, so this change is limited. The governed score stays in place. This follow-up priority scenario is not personal disease risk.`;
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

export function ExplorerAdjustedScenarioLine({
  scenario,
}: {
  scenario?: AdjustedCountyScenario | null;
}) {
  if (!scenario) {
    return null;
  }
  switch (scenario.kind) {
    case "adjusted":
    case "unchanged": {
      return (
        <span
          className="ux-reset-explorer-scenario-result"
          data-scenario={scenario.kind}
          data-testid="explorer-scenario-score"
        >
          Adjusted scenario {scenario.score}. {scenario.priority}. Scenario rank{" "}
          {scenario.rank}.
        </span>
      );
    }
    case "limited": {
      return (
        <span
          className="ux-reset-explorer-scenario-result"
          data-scenario="limited"
          data-testid="explorer-scenario-score"
        >
          Adjusted scenario unavailable. Published incidence is not on this
          collection, so this change is limited. The governed score stays in
          place.
        </span>
      );
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}
