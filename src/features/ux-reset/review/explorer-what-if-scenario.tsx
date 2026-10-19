"use client";

import { Info } from "lucide-react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  adjustCountyScenarios,
  SCENARIO_CONTROL_RANGES,
  SCENARIO_SCORE_DEFAULTS,
  scoreSettingsFromCollection,
  scenarioSettingsEqual,
  type AdjustedCountyScenario,
} from "@/features/ux-reset/review/explorer-scenario-score";
import {
  isLower48CountyFips,
  isLower48ReviewScope,
} from "@/features/ux-reset/review/review-state-fips";
import type { CountyScoreSummary } from "@/generated/models";
import type { ScoreSettings } from "@/lib/atlas-ui";

const LIMITED_SCENARIO_REASON =
  "This county has no published rate on this collection, so the score with your changes is unavailable. The published Atlas score stays in place.";

const SAFETY_FINDING_SUFFIX = " — Not a safety finding";

export const EXPLORER_SCENARIO_HEADING = "Explore different scenarios";

export const EXPLORER_SCENARIO_INTRO =
  "See how different assumptions change which counties may warrant additional surveillance review.";

export const EXPLORER_SCENARIO_EXAMPLE =
  "Try exploring: What if tick and pathogen data carried more weight?";

export const EXPLORER_SCENARIO_RECALCULATION =
  "Changes to these settings recalculate county scores for exploration. They appear in the county list and Atlas score map but do not change published results.";

export const EXPLORER_SCENARIO_WEIGHT_NOTE =
  "This share of the context blend is tick and pathogen data. Community context is social vulnerability, insurance access, and rurality.";

export const EXPLORER_SCENARIO_WEIGHT_TOOLTIP =
  "Reported Lyme disease data is a separate multiplier. It is not part of these two percentages. Tick status is 60% of the tick-and-pathogen signal and pathogen presence is 40%. Those shares stay fixed. Community context is 50% social vulnerability, 30% uninsured share, and 20% rurality. The published default is 65% tick and pathogen data and 35% community context.";

export const EXPLORER_SCENARIO_RATE_NOTE = "This is a scoring reference point.";

export const EXPLORER_SCENARIO_RATE_TOOLTIP =
  "A published rate at this reference point sets the case-data term to 0. A published rate of 0 sets that term to 100. Rates in between are scaled. The unit is cases per 100,000 people. The published default is 10 per 100,000, with a range of 5 to 25.";

export const EXPLORER_SCENARIO_MISSING_NOTE =
  "Used when a county has no published case count.";

export const EXPLORER_SCENARIO_MISSING_TOOLTIP =
  "On the 0–100 case-data term, 100 matches a published rate of 0 and 0 matches a rate at or above the reference point. This number is that term when no county count was published. The published default is 75.";

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

/** Panel display name for an Atlas score band. Classification strings stay unchanged. */
export function followUpCategoryLabel(priority: string): string {
  if (priority.endsWith(SAFETY_FINDING_SUFFIX)) {
    return priority.slice(0, -SAFETY_FINDING_SUFFIX.length);
  }
  return priority;
}

function priorityChangeText(published: string, adjusted: string): string {
  const before = followUpCategoryLabel(published);
  const after = followUpCategoryLabel(adjusted);
  if (before === after) {
    return "Follow-up category unchanged";
  }
  return `Follow-up category changed: ${before} → ${after}`;
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

/**
 * National browse uses the same lower-48 and DC scores as a state Explorer.
 * Alaska, Hawaii, and any other scope stay outside the scenario.
 */
export function explorerScenarioScopeSupported(
  scopeCode: string,
  scopeUnsupported: boolean
): boolean {
  if (scopeUnsupported) {
    return false;
  }
  return scopeCode === "ALL" || isLower48ReviewScope(scopeCode);
}

function scenarioCountiesForScope(
  counties: readonly CountyScoreSummary[],
  scopeCode: string
): CountyScoreSummary[] {
  if (scopeCode === "ALL") {
    return counties.filter(
      (county) =>
        isLower48ReviewScope(county.state) && isLower48CountyFips(county.fips)
    );
  }
  return counties.filter((county) => county.state === scopeCode);
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
  const inScope = scenarioCountiesForScope(input.counties, input.scopeCode);
  const selected = inScope.find((county) => county.fips === input.countyFips);
  if (!selected) {
    return { status: "unavailable" };
  }
  // A national selection is still that county's state calculation. The peer
  // set is the state, so the result matches opening that state.
  const peers =
    input.scopeCode === "ALL"
      ? inScope.filter((county) => county.state === selected.state)
      : inScope;
  const baseline = scoreSettingsFromCollection(
    collectionSettingsRecord(input.collectionSettings)
  );
  const scenarios = adjustCountyScenarios(peers, input.settings, baseline);
  return {
    assumptionsChanged: !scenarioSettingsEqual(input.settings, baseline),
    countyName: selected.county.trim() || "Selected county",
    governedPriority: selected.priority.trim(),
    governedScore: selected.score.score,
    scenario: scenarios?.get(selected.fips) ?? null,
    status: "ready",
  };
}

/**
 * Gap-score county fills only. Other layers keep the governed rows.
 * Limited counties keep their published color. No state or national rollup.
 */
export function applyGapScoreScenarioColors(
  counties: readonly CountyScoreSummary[],
  scenarios: ReadonlyMap<string, AdjustedCountyScenario> | null
): {
  counties: CountyScoreSummary[];
  hasAdjustedColor: boolean;
  hasLimitedScenario: boolean;
} {
  if (!scenarios) {
    return {
      counties: [...counties],
      hasAdjustedColor: false,
      hasLimitedScenario: false,
    };
  }
  let hasAdjustedColor = false;
  let hasLimitedScenario = false;
  const next = counties.map((county) => {
    const scenario = scenarios.get(county.fips);
    if (!scenario) {
      return county;
    }
    switch (scenario.kind) {
      case "adjusted": {
        hasAdjustedColor = true;
        return {
          ...county,
          color: scenario.colorToken,
          priority: `Adjusted scenario · ${scenario.priority}`,
          score: {
            ...county.score,
            score: scenario.score,
          },
        };
      }
      case "limited": {
        hasLimitedScenario = true;
        return county;
      }
      case "unchanged": {
        return county;
      }
      default: {
        const exhaustive: never = scenario;
        return exhaustive;
      }
    }
  });
  return {
    counties: next,
    hasAdjustedColor,
    hasLimitedScenario,
  };
}

export function scenarioGapScoreLegend(input: {
  hasAdjustedColor: boolean;
  hasLimitedScenario: boolean;
}): { note: string; title: string; unit: string } | null {
  if (!(input.hasAdjustedColor || input.hasLimitedScenario)) {
    return null;
  }
  const limitedNote = input.hasLimitedScenario
    ? " Counties without a published incidence on this collection keep the governed score and color."
    : "";
  return {
    note: `Adjusted scenario colors for this what-if. The governed score is unchanged.${limitedNote}`,
    title: "Adjusted scenario",
    unit: "adjusted review-priority score",
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
  const deltaPoints = Number(input.adjustedLabel) - Number(input.governedLabel);
  const deltaLabel = formatExplorerScenarioDelta(deltaPoints);
  return {
    accessibleLead: "Published Atlas score to the score with your changes.",
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
        collapsed: `Published Atlas score ${governedLabel} · No adjustments`,
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
        collapsed: `Published Atlas score ${governedLabel} · Score with your changes unavailable`,
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
        collapsed:
          "Select a county to compare its published Atlas score with the score using your changes.",
        expanded:
          "Select a county to compare its published Atlas score with the score using your changes.",
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
  technical: string;
  valueLabel: string;
  value: number;
  weightShare?: number;
};

function weightValueLabel(share: number): string {
  return `${share}% tick and pathogen data, ${100 - share}% community context`;
}

function WeightValue({ share }: { share: number }) {
  return (
    <strong>
      {share}% tick and pathogen data
      <br />
      {100 - share}% community context
    </strong>
  );
}

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
          <h2 id="explorer-scenario-impact-heading">
            How the changes affect {view.countyName}
          </h2>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              detail={followUpCategoryLabel(view.governedPriority)}
              label="Published Atlas score"
              value={view.governedLabel}
            />
            <ImpactScoreCell
              label="Score with your changes"
              value="No adjustments"
            />
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
          <h2 id="explorer-scenario-impact-heading">
            How the changes affect {view.countyName}
          </h2>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              label="Published Atlas score"
              value={view.governedLabel}
            />
            <ImpactScoreCell
              label="Score with your changes"
              value={view.adjustedLabel}
            />
            <ImpactScoreCell label="Change in points" value={view.deltaLabel} />
          </dl>
          <p
            className="ux-reset-explorer-scenario-impact-priority"
            data-testid="explorer-scenario-category"
          >
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
          <h2 id="explorer-scenario-impact-heading">
            How the changes affect {view.countyName}
          </h2>
          <dl className="ux-reset-explorer-scenario-impact-scores">
            <ImpactScoreCell
              detail={followUpCategoryLabel(view.governedPriority)}
              label="Published Atlas score"
              value={view.governedLabel}
            />
            <ImpactScoreCell
              detail={view.reason}
              label="Score with your changes"
              value="Unavailable"
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
  technical,
  value,
  valueLabel,
  weightShare,
}: ScenarioControlProps) {
  const noteId = `explorer-scenario-${label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const controlId = `${noteId}-control`;
  return (
    <div className="ux-reset-explorer-scenario-control">
      <div className="ux-reset-explorer-scenario-control-label">
        <label htmlFor={controlId}>{label}</label>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Technical note for ${label}`}
                className="ux-reset-explorer-scenario-info"
                size="icon-xs"
                type="button"
                variant="ghost"
              />
            }
          >
            <Info />
          </TooltipTrigger>
          <TooltipContent
            className="max-w-sm text-left whitespace-normal"
            side="top"
          >
            {technical}
          </TooltipContent>
        </Tooltip>
      </div>
      {weightShare === undefined ? (
        <strong>{valueLabel}</strong>
      ) : (
        <WeightValue share={weightShare} />
      )}
      <Slider
        aria-describedby={noteId}
        aria-label={label}
        aria-valuetext={valueLabel}
        id={controlId}
        max={max}
        min={min}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <small id={noteId}>{note}</small>
    </div>
  );
}

function ScenarioMethods() {
  return (
    <details
      className="ux-reset-explorer-scenario-methods"
      data-testid="explorer-scenario-methods"
    >
      <summary>How these scenarios work</summary>
      <div className="ux-reset-explorer-scenario-methods-body">
        <p>
          The score multiplies a case-data term by a blend of tick and pathogen
          data and community context. The weight slider sets that blend.
          Reported Lyme disease data supplies the case-data term.
        </p>
        <p>
          The rate reference point scales a published county rate onto the
          case-data term. It is a scoring reference. Counties at or above the
          reference point do not get a higher score from low case data.
        </p>
        <p>
          Counties without a published case count use the missing-data
          assumption. If you raise the reference point and this view has no
          published rate for a county whose case-data term is already 0, the
          score with your changes is unavailable and the published Atlas score
          stays.
        </p>
        <p>
          On a state view, the county list updates for counties in that state.
          On the United States view, it updates for counties in the lower 48
          states and the District of Columbia. The Atlas score map updates
          colors for those same counties while the Atlas gap score layer is
          selected. Other map layers keep published colors. Counties the change
          does not affect keep the published Atlas score.
        </p>
        <p>
          These settings stay in the page address so you can share the scenario.
          They are not saved as published Atlas results.
        </p>
        <p>
          Follow-up categories are the Atlas score bands: Priority 1 —
          Investigate at 70 and above, Priority 2 — Review from 50 to less than
          70, Watch — Monitor signals from 30 to less than 50, and Lower Atlas
          priority below 30. These bands are separate from Tier 1 ML
          surveillance-priority labels.
        </p>
      </div>
    </details>
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
            not missing data.
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
            <span>{EXPLORER_SCENARIO_HEADING}</span>
          </span>
          <ScenarioImpactSummary view={impactView} />
          <span className="ux-reset-explorer-scenario-affordance">
            <span className="ux-reset-explorer-scenario-affordance-closed">
              Adjust assumptions
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
          <p>{EXPLORER_SCENARIO_INTRO}</p>
          <p
            className="ux-reset-explorer-scenario-example"
            data-testid="explorer-scenario-example"
          >
            {EXPLORER_SCENARIO_EXAMPLE}
          </p>
          <TooltipProvider delay={300}>
            <div className="ux-reset-explorer-scenario-controls">
              <ScenarioControl
                label="Weight given to tick and pathogen data"
                max={SCENARIO_CONTROL_RANGES.ecological_share.max}
                min={SCENARIO_CONTROL_RANGES.ecological_share.min}
                note={EXPLORER_SCENARIO_WEIGHT_NOTE}
                step={SCENARIO_CONTROL_RANGES.ecological_share.step}
                technical={EXPLORER_SCENARIO_WEIGHT_TOOLTIP}
                value={settings.ecological_share}
                valueLabel={weightValueLabel(settings.ecological_share)}
                weightShare={settings.ecological_share}
                onChange={(value) => {
                  onChange({ ...settings, ecological_share: value });
                }}
              />
              <ScenarioControl
                label="Reported Lyme disease rate reference point"
                max={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.max}
                min={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.min}
                note={EXPLORER_SCENARIO_RATE_NOTE}
                step={SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.step}
                technical={EXPLORER_SCENARIO_RATE_TOOLTIP}
                value={settings.low_incidence_breakpoint}
                valueLabel={`${settings.low_incidence_breakpoint} per 100,000`}
                onChange={(value) => {
                  onChange({ ...settings, low_incidence_breakpoint: value });
                }}
              />
              <ScenarioControl
                label="Assumption for missing county case data"
                max={SCENARIO_CONTROL_RANGES.missing_human_weakness.max}
                min={SCENARIO_CONTROL_RANGES.missing_human_weakness.min}
                note={EXPLORER_SCENARIO_MISSING_NOTE}
                step={SCENARIO_CONTROL_RANGES.missing_human_weakness.step}
                technical={EXPLORER_SCENARIO_MISSING_TOOLTIP}
                value={settings.missing_human_weakness}
                valueLabel={String(settings.missing_human_weakness)}
                onChange={(value) => {
                  onChange({ ...settings, missing_human_weakness: value });
                }}
              />
            </div>
          </TooltipProvider>
          <ScenarioImpactDetails view={impactView} />
          <p
            className="type-small ux-reset-explorer-scenario-impact-note"
            data-testid="explorer-scenario-recalculation"
          >
            {EXPLORER_SCENARIO_RECALCULATION}
          </p>
          <Button
            data-testid="explorer-scenario-reset"
            disabled={atDefaults}
            type="button"
            variant="secondary"
            onClick={() => {
              onChange(SCENARIO_SCORE_DEFAULTS);
            }}
          >
            Reset
          </Button>
          <ScenarioMethods />
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
      return `Governed score ${scenario.governedScore}. Adjusted scenario ${scenario.score}. ${scenario.priority}.`;
    }
    case "limited": {
      return `Governed score ${scenario.governedScore}. Adjusted scenario unavailable. Published incidence is not on this collection, so this change is limited. The governed score stays in place.`;
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

export function ExplorerAdjustedScenarioLine({
  scenario,
  showRank = true,
}: {
  scenario?: AdjustedCountyScenario | null;
  /** National browse is not a ranking. State Explorer keeps the state rank. */
  showRank?: boolean;
}) {
  if (!scenario) {
    return null;
  }
  switch (scenario.kind) {
    case "adjusted":
    case "unchanged": {
      const rank = showRank ? ` Scenario rank ${scenario.rank}.` : "";
      return (
        <span
          className="ux-reset-explorer-scenario-result"
          data-scenario={scenario.kind}
          data-testid="explorer-scenario-score"
        >
          {`Adjusted scenario ${scenario.score}. ${scenario.priority}.${rank}`}
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
