"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
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
import { countyScoreSummaryScoringMethodologyVersionDefault } from "@/generated/zod/countyScoreSummary.zod";
import type { ScoreSettings } from "@/lib/atlas-ui";

import "./explorer-visual-first.css";

const LIMITED_SCENARIO_REASON =
  "This county has no published rate on this collection, so the score with your changes is unavailable. The published Atlas score stays in place.";

const SAFETY_FINDING_SUFFIX = " — Not a safety finding";

const PUBLISHED_HUMAN_STATUS = "published_count_floor";

export const EXPLORER_SCENARIO_HEADING = "Explore scoring assumptions";

export const EXPLORER_SCENARIO_INTRO =
  "Adjust the assumptions. See how county scores and rankings change.";

export const EXPLORER_SCENARIO_FOOTER =
  "Changes are for exploration and do not alter published results. The score supports surveillance review; it does not estimate individual infection risk.";

export const EXPLORER_SCENARIO_WEIGHT_LABEL = "Tick and pathogen weight";

export const EXPLORER_SCENARIO_WEIGHT_DESCRIPTION =
  "Give tick and pathogen data more influence, or give community context more influence.";

export const EXPLORER_SCENARIO_INCIDENCE_LABEL = "Effect of reported incidence";

export const EXPLORER_SCENARIO_INCIDENCE_DESCRIPTION =
  "Higher reported incidence lowers the score. Choose how strongly it lowers it.";

export const EXPLORER_SCENARIO_MISSING_LABEL = "Missing county case data";

export const EXPLORER_SCENARIO_MISSING_DESCRIPTION =
  "Choose the assumed human disease component when published case data are unavailable.";

export const EXPLORER_SCENARIO_MISSING_SUPPORT =
  "Can affect other counties and their rankings. This is not an estimated case count.";

export const EXPLORER_SCENARIO_MISSING_INACTIVE = "Does not affect this county";

export const EXPLORER_SCENARIO_DEFAULT_STATUS =
  "No change · Using default settings";

export const EXPLORER_SCENARIO_UNCHANGED_STATUS =
  "No score change for this county · Scenario settings";

export const EXPLORER_SCENARIO_FORMULA = `Score = (H / 100) × [w × E + (1 − w) × C]
H = 100 / (1 + I / k), when published incidence is available
H = missing-data assumption, otherwise
E = 0.60 × T + 0.40 × P
C = 0.50 × S + 0.30 × U + 0.20 × R`;

const SCENARIO_TOPICS = [
  {
    body: "The score combines tick and pathogen data with community context, then adjusts that combination using reported Lyme disease incidence. Higher reported incidence lowers the gap review score gradually.",
    title: "What the score combines",
  },
  {
    body: "Your changes update scores and rankings in the county list. Map colors update when the Gap review score layer is selected. Other map layers keep their published values.",
    title: "What updates on the page",
  },
  {
    body: "In a state view, the scenario applies to counties in that state. In the United States view, it applies to the lower 48 states and Washington, DC. A county’s score stays the same if your adjustment does not affect its calculation.",
    title: "Which counties are included",
  },
  {
    body: "Counties without published case data use the missing-data assumption. If required inputs are unavailable, an adjusted score may not be shown. Missing data are not treated as zero cases.",
    title: "When data are missing",
  },
  {
    body: "The page address includes your settings, so you can share the scenario. Changes are not saved as published results. Select Reset defaults to return to the published scoring settings.",
    title: "Sharing and resetting",
  },
  {
    body: "The score supports surveillance review. It does not estimate infections or individual risk. These adjustments do not change the separate machine-learning surveillance-priority results.",
    title: "How to interpret the result",
  },
] as const;

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
      /** Set for the United States view, where the county name is not unique. */
      countyState?: string;
      governedPriority: string;
      governedScore: number;
      /** True only when this county has a published incidence value. */
      publishedIncidence?: boolean;
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

/** Comparison-strip status for a moved slider. Zero stays a no-change sentence. */
export function formatExplorerScenarioChangeStatus(
  deltaPoints: number
): string {
  const delta = formatExplorerScenarioDelta(deltaPoints);
  if (delta === "0.0 points") {
    return "No score change for this county";
  }
  return `${delta.replace(" points", "")} points from published score`;
}

/**
 * Display name for the supported scoring method.
 * The version comes from the scores contract, not a separate label.
 */
export function surveillanceGapScoreVersionLabel(
  methodologyVersion: string = countyScoreSummaryScoringMethodologyVersionDefault
): string {
  const match = /^surveillance-gap-score-v(?<version>\d+(?:\.\d+)*)$/.exec(
    methodologyVersion
  );
  const version = match?.groups?.version;
  if (!version) {
    return methodologyVersion;
  }
  return `Surveillance Gap Score v${version}`;
}

function countyHasPublishedIncidence(county: CountyScoreSummary): boolean {
  return (
    county.human_status === PUBLISHED_HUMAN_STATUS &&
    typeof county.incidence_floor_2023 === "number" &&
    Number.isFinite(county.incidence_floor_2023) &&
    county.incidence_floor_2023 >= 0
  );
}

function settingsStatus(settings: ScoreSettings): string {
  return `Tick / pathogen weight ${settings.ecological_share}% · Incidence setting ${settings.smooth_k} per 100,000 · Missing-data component ${settings.missing_human_weakness} out of 100`;
}

function countyIdentity(name: string, state: string | undefined): string {
  if (!state) {
    return name;
  }
  return `${name}, ${state}`;
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
    smooth_k: settings.smooth_k,
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
    countyState: input.scopeCode === "ALL" ? selected.state : undefined,
    governedPriority: selected.priority.trim(),
    governedScore: selected.score.score,
    publishedIncidence: countyHasPublishedIncidence(selected),
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
  const deltaLabel = formatExplorerScenarioChangeStatus(deltaPoints);
  const collapsed =
    deltaLabel === "No score change for this county"
      ? EXPLORER_SCENARIO_UNCHANGED_STATUS
      : `${deltaLabel} · Scenario settings`;
  return {
    accessibleLead: "Published score to the score with your changes.",
    adjustedLabel: input.adjustedLabel,
    adjustedPriority: input.adjustedPriority,
    collapsed,
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
        collapsed: EXPLORER_SCENARIO_DEFAULT_STATUS,
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
        collapsed: "Score with your changes unavailable",
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

type ScenarioSliderProps = {
  description: string;
  endLabels: readonly [string, string];
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  quietNote?: string;
  step: number;
  supporting?: string;
  value: number;
  valueAnnouncement: string;
  valueDetail: string;
  valueText: string;
};

function ScenarioSlider({
  description,
  endLabels,
  label,
  max,
  min,
  onChange,
  quietNote,
  step,
  supporting,
  value,
  valueAnnouncement,
  valueDetail,
  valueText,
}: ScenarioSliderProps) {
  const slug = label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase();
  const descriptionId = `explorer-scenario-${slug}-description`;
  const controlId = `explorer-scenario-${slug}-control`;
  return (
    <div className="ux-reset-explorer-scenario-control">
      <div className="ux-reset-explorer-scenario-control-copy">
        <label htmlFor={controlId}>{label}</label>
        <p id={descriptionId}>{description}</p>
        {supporting ? <p>{supporting}</p> : null}
        {quietNote ? (
          <p
            className="ux-reset-explorer-scenario-quiet"
            data-testid="explorer-scenario-missing-applicability"
          >
            {quietNote}
          </p>
        ) : null}
      </div>
      <div className="ux-reset-explorer-scenario-control-input">
        <p className="ux-reset-explorer-scenario-value">
          <strong>{valueText}</strong>
          <span>{valueDetail}</span>
        </p>
        <Slider
          aria-describedby={descriptionId}
          aria-label={label}
          aria-valuetext={valueAnnouncement}
          id={controlId}
          max={max}
          min={min}
          step={step}
          value={value}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
        />
        <div className="ux-reset-explorer-scenario-ends">
          <span>{endLabels[0]}</span>
          <span>{endLabels[1]}</span>
        </div>
      </div>
    </div>
  );
}

function ScoreFigure({
  label,
  numeric,
  value,
}: {
  label: string;
  numeric: boolean;
  value: string;
}) {
  return (
    <div className="ux-reset-explorer-scenario-impact-cell">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        {numeric ? <span>out of 100</span> : null}
      </dd>
    </div>
  );
}

function ScenarioImpactSummary({ view }: { view: ExplorerScenarioImpactView }) {
  if (view.kind === "pending" || view.kind === "error") {
    return null;
  }
  return (
    <p
      className="ux-reset-explorer-scenario-impact-summary"
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
    </p>
  );
}

function adjustedScoreFigure(view: ExplorerScenarioImpactView): {
  numeric: boolean;
  value: string;
} {
  switch (view.kind) {
    case "baseline": {
      return { numeric: true, value: view.governedLabel };
    }
    case "definite": {
      return { numeric: true, value: view.adjustedLabel };
    }
    case "limited": {
      return { numeric: false, value: "Unavailable" };
    }
    case "pending":
    case "error":
    case "placeholder": {
      return { numeric: false, value: "" };
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function ScenarioImpactDetails({
  countyState,
  view,
}: {
  countyState?: string;
  view: ExplorerScenarioImpactView;
}) {
  switch (view.kind) {
    case "pending":
    case "error": {
      return null;
    }
    case "placeholder": {
      return (
        <section
          aria-labelledby="explorer-scenario-impact-heading"
          className="ux-reset-explorer-scenario-impact"
          data-impact={view.placeholder}
          data-testid="explorer-scenario-impact"
        >
          <h3 id="explorer-scenario-impact-heading">Gap review score</h3>
          <ScenarioImpactSummary view={view} />
          {view.expanded === view.collapsed ? null : <p>{view.expanded}</p>}
        </section>
      );
    }
    case "baseline":
    case "definite":
    case "limited": {
      const adjusted = adjustedScoreFigure(view);
      const categoryLabel = followUpCategoryLabel(view.governedPriority);
      return (
        <section
          aria-labelledby="explorer-scenario-impact-heading"
          className="ux-reset-explorer-scenario-impact"
          data-impact={view.kind === "definite" ? view.resultKind : view.kind}
          data-testid="explorer-scenario-impact"
        >
          <h3 id="explorer-scenario-impact-heading">Gap review score</h3>
          <p className="ux-reset-explorer-scenario-impact-county">
            {countyIdentity(view.countyName, countyState)}
          </p>
          <div className="ux-reset-explorer-scenario-impact-scores">
            <dl>
              <ScoreFigure
                label="Published score"
                numeric
                value={view.governedLabel}
              />
            </dl>
            <div
              aria-hidden="true"
              className="ux-reset-explorer-scenario-impact-arrow"
            />
            <dl>
              <ScoreFigure
                label="Score with your changes"
                numeric={adjusted.numeric}
                value={adjusted.value}
              />
            </dl>
          </div>
          <ScenarioImpactSummary view={view} />
          {view.kind === "limited" ? <p>{view.reason}</p> : null}
          {view.kind === "definite" ? (
            <p data-testid="explorer-scenario-category">{view.priorityText}</p>
          ) : (
            <p>{categoryLabel}</p>
          )}
        </section>
      );
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function ScenarioExplanation() {
  return (
    <div className="ux-reset-explorer-scenario-topics">
      {SCENARIO_TOPICS.map((topic) => (
        <section key={topic.title}>
          <h4>{topic.title}</h4>
          <p>{topic.body}</p>
        </section>
      ))}
    </div>
  );
}
function ScenarioEquation() {
  const defaults = SCENARIO_SCORE_DEFAULTS;
  return (
    <details
      className="ux-reset-explorer-scenario-disclosure"
      data-testid="explorer-scenario-equation"
    >
      <summary>View the equation and technical details</summary>
      <div className="ux-reset-explorer-scenario-equation-body">
        <p>
          <strong>{surveillanceGapScoreVersionLabel()}</strong>
        </p>
        <p>
          {`Tick/pathogen weight ${defaults.ecological_share}%; k = ${defaults.smooth_k} per 100,000; missing-data component ${defaults.missing_human_weakness} out of 100.`}
        </p>
        <p className="ux-reset-explorer-scenario-formula">
          {EXPLORER_SCENARIO_FORMULA}
        </p>
        <dl className="ux-reset-explorer-scenario-definitions">
          <div>
            <dt>H</dt>
            <dd>Human disease component.</dd>
          </div>
          <div>
            <dt>I</dt>
            <dd>
              Published 2023 minimum incidence per 100,000 people. This is the
              published minimum, not actual infection incidence.
            </dd>
          </div>
          <div>
            <dt>k</dt>
            <dd>
              Controls the incidence reduction. When incidence equals k, H is
              50.
            </dd>
          </div>
          <div>
            <dt>w</dt>
            <dd>
              {`Tick and pathogen weight expressed as a fraction; ${(SCENARIO_SCORE_DEFAULTS.ecological_share / 100).toFixed(2)} by default.`}
            </dd>
          </div>
          <div>
            <dt>T</dt>
            <dd>
              Tick status: established = 100; reported = 55; unknown or no
              records = 0. Unknown and No records stay distinct in the county
              data. Both contribute zero in this formula.
            </dd>
          </div>
          <div>
            <dt>P</dt>
            <dd>Pathogen status: present = 100; otherwise = 0.</dd>
          </div>
          <div>
            <dt>S</dt>
            <dd>SVI percentile × 100.</dd>
          </div>
          <div>
            <dt>U</dt>
            <dd>Uninsured percentile × 100.</dd>
          </div>
          <div>
            <dt>R</dt>
            <dd>(RUCC − 1) / 8 × 100, limited to 0–100.</dd>
          </div>
        </dl>
        <p>
          Missing SVI or uninsured inputs contribute zero; missing RUCC is
          treated as 1. Zero contribution does not mean absence. Scores use
          unrounded components and are rounded to one decimal.
        </p>
      </div>
    </details>
  );
}

/**
 * What-if assumptions for Atlas Explorer. The governed score stays on the
 * county row; these controls only change the browser scenario. They open in a
 * non-modal side sheet so the map stays visible and live while sliders move,
 * and a persistent badge marks any non-default scenario (UX audit B5, C6).
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
  const countyState =
    impact.status === "ready" ? impact.countyState : undefined;
  const missingQuietNote =
    impact.status === "ready" && impact.publishedIncidence
      ? EXPLORER_SCENARIO_MISSING_INACTIVE
      : undefined;
  const communityShare = 100 - settings.ecological_share;
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
      <div
        className="ux-reset-explorer-scenario-control-group"
        data-active={atDefaults ? "false" : "true"}
        data-testid="explorer-scenario-trigger-group"
      >
        <Sheet disablePointerDismissal modal={false}>
          <SheetTrigger
            render={
              <Button
                data-testid="explorer-what-if-summary"
                size="sm"
                type="button"
                variant={atDefaults ? "outline" : "secondary"}
              />
            }
          >
            <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
            <span className="max-sm:sr-only">Scenarios</span>
            {atDefaults ? null : (
              <Badge
                className="ux-reset-explorer-scenario-active"
                data-testid="explorer-scenario-active"
                variant="outline"
              >
                Scenario active
              </Badge>
            )}
          </SheetTrigger>
          {atDefaults ? null : (
            <Button
              aria-label="Reset scenario to published defaults"
              data-testid="explorer-scenario-quick-reset"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => {
                onChange(SCENARIO_SCORE_DEFAULTS);
              }}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          )}
          <SheetContent
            className="ux-reset-explorer-scenario ux-reset-explorer-scenario-sheet"
            data-testid="explorer-what-if-scenario"
            overlay={false}
            side="right"
          >
            <SheetHeader className="ux-reset-explorer-scenario-sheet-header">
              <SheetTitle className="ux-reset-explorer-scenario-heading">
                {EXPLORER_SCENARIO_HEADING}
              </SheetTitle>
              <SheetDescription className="ux-reset-explorer-scenario-intro">
                {EXPLORER_SCENARIO_INTRO}
              </SheetDescription>
            </SheetHeader>
            <div className="ux-reset-explorer-scenario-body">
              <div className="ux-reset-explorer-scenario-settings">
                <p data-testid="explorer-scenario-settings">
                  {settingsStatus(settings)}
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
                  <RotateCcw aria-hidden="true" data-icon="inline-start" />
                  Reset defaults
                </Button>
              </div>
              <ScenarioImpactDetails
                countyState={countyState}
                view={impactView}
              />
              <div className="ux-reset-explorer-scenario-controls">
                <ScenarioSlider
                  description={EXPLORER_SCENARIO_WEIGHT_DESCRIPTION}
                  endLabels={[
                    "More community weight",
                    "More tick / pathogen weight",
                  ]}
                  label={EXPLORER_SCENARIO_WEIGHT_LABEL}
                  max={SCENARIO_CONTROL_RANGES.ecological_share.max}
                  min={SCENARIO_CONTROL_RANGES.ecological_share.min}
                  step={SCENARIO_CONTROL_RANGES.ecological_share.step}
                  value={settings.ecological_share}
                  valueAnnouncement={`${settings.ecological_share}% tick / pathogen, ${communityShare}% community`}
                  valueDetail={`${communityShare}% community`}
                  valueText={`${settings.ecological_share}% tick / pathogen`}
                  onChange={(value) => {
                    onChange({ ...settings, ecological_share: value });
                  }}
                />
                <ScenarioSlider
                  description={EXPLORER_SCENARIO_INCIDENCE_DESCRIPTION}
                  endLabels={["Stronger reduction", "Gentler reduction"]}
                  label={EXPLORER_SCENARIO_INCIDENCE_LABEL}
                  max={SCENARIO_CONTROL_RANGES.smooth_k.max}
                  min={SCENARIO_CONTROL_RANGES.smooth_k.min}
                  step={SCENARIO_CONTROL_RANGES.smooth_k.step}
                  value={settings.smooth_k}
                  valueAnnouncement={`${settings.smooth_k} per 100,000`}
                  valueDetail={`Default: ${SCENARIO_SCORE_DEFAULTS.smooth_k}`}
                  valueText={`${settings.smooth_k} per 100,000`}
                  onChange={(value) => {
                    onChange({ ...settings, smooth_k: value });
                  }}
                />
                <ScenarioSlider
                  description={EXPLORER_SCENARIO_MISSING_DESCRIPTION}
                  endLabels={[
                    "Lower assumed component",
                    "Higher assumed component",
                  ]}
                  label={EXPLORER_SCENARIO_MISSING_LABEL}
                  max={SCENARIO_CONTROL_RANGES.missing_human_weakness.max}
                  min={SCENARIO_CONTROL_RANGES.missing_human_weakness.min}
                  quietNote={missingQuietNote}
                  step={SCENARIO_CONTROL_RANGES.missing_human_weakness.step}
                  supporting={EXPLORER_SCENARIO_MISSING_SUPPORT}
                  value={settings.missing_human_weakness}
                  valueAnnouncement={`${settings.missing_human_weakness} out of 100`}
                  valueDetail={`Default: ${SCENARIO_SCORE_DEFAULTS.missing_human_weakness}`}
                  valueText={`${settings.missing_human_weakness} out of 100`}
                  onChange={(value) => {
                    onChange({ ...settings, missing_human_weakness: value });
                  }}
                />
              </div>
              <Collapsible
                className="ux-reset-explorer-scenario-disclosure"
                data-testid="explorer-scenario-methods"
              >
                <CollapsibleTrigger className="ux-reset-explorer-scenario-methods-trigger">
                  <span>How these scenarios work</span>
                  <ChevronDown aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent keepMounted>
                  <ScenarioExplanation />
                  <ScenarioEquation />
                </CollapsibleContent>
              </Collapsible>
              <p
                className="ux-reset-explorer-scenario-footer"
                data-testid="explorer-scenario-footer"
              >
                {EXPLORER_SCENARIO_FOOTER}
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
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
