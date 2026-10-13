"use client";

import { ScoringCalculationPreview } from "@/components/scoring-calculation-preview";
import { Button } from "@/components/ui/button";
import {
  SCENARIO_CONTROL_RANGES,
  SCENARIO_SCORE_DEFAULTS,
  scenarioSettingsEqual,
  type AdjustedCountyScenario,
} from "@/features/ux-reset/review/explorer-scenario-score";
import type { ScoreSettings } from "@/lib/atlas-ui";

type ExplorerWhatIfScenarioProps = {
  onChange: (settings: ScoreSettings) => void;
  settings: ScoreSettings;
};

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
      <input
        aria-describedby={noteId}
        aria-label={label}
        aria-valuetext={valueLabel}
        max={max}
        min={min}
        step={step}
        type="range"
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
  onChange,
  settings,
}: ExplorerWhatIfScenarioProps) {
  const atDefaults = scenarioSettingsEqual(settings, SCENARIO_SCORE_DEFAULTS);
  return (
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
          <strong>{100 - settings.ecological_share}% community context</strong>.
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
          County list scores update with these assumptions. Map colors update on
          the Atlas gap score layer. When a published incidence is available,
          the threshold uses that incidence. When it is not on the scores
          collection, raising the threshold leaves the adjusted result
          unavailable and the governed score stays in place. A missing incidence
          is not treated as zero.
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
