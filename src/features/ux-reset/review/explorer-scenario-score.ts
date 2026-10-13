import type { CountyScoreSummary } from "@/generated/models";
import type { ScoreSettings } from "@/lib/atlas-ui";

/**
 * Governed Atlas gap-score defaults. Explorer requests the scores collection
 * with these values and keeps that response as the governed score.
 * Ranges match the legacy scoring assumptions and the scores query contract.
 */
export const SCENARIO_SCORE_DEFAULTS: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

export const SCENARIO_CONTROL_RANGES = {
  ecological_share: { max: 85, min: 40, step: 5 },
  low_incidence_breakpoint: { max: 25, min: 5, step: 1 },
  missing_human_weakness: { max: 90, min: 40, step: 5 },
} as const;

const TICK_SIGNAL_BY_STATUS: Record<string, number> = {
  Established: 100,
  Reported: 55,
  "No records": 0,
  Unknown: 0,
};

const PUBLISHED_HUMAN_STATUS = "published_count_floor";

export type ScenarioCountyInputs = {
  burgdorferiStatus: string;
  humanStatus: string;
  inContiguousTickScope: boolean;
  incidenceFloor2023: number | null;
  rucc2023: number | null;
  sviPercentile: number | null;
  tickStatus: string;
  uninsuredPercentile: number | null;
};

export type ScenarioScoreParts = {
  accessSignal: number;
  colorToken: string;
  community: number;
  ecological: number;
  humanWeakness: number;
  pathogenSignal: number;
  priority: string;
  ruralSignal: number;
  score: number;
  sviSignal: number;
  tickSignal: number;
};

export type AdjustedCountyScenario = {
  colorToken: string;
  governedPriority: string;
  governedScore: number;
  humanWeakness: number;
  /** Published incidence is at or above the governed threshold, so a higher threshold cannot be applied from the scores collection. */
  limitedBreakpoint: boolean;
  priority: string;
  rank: number;
  score: number;
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Python `round(value, 1)`: half to even, so the port matches the shared scorer. */
function round1(value: number): number {
  const scaled = value * 10;
  const floor = Math.floor(scaled + 1e-10);
  const fraction = scaled - floor;
  let rounded = floor;
  if (fraction > 0.5 + 1e-10) {
    rounded = floor + 1;
  } else if (fraction >= 0.5 - 1e-10 && fraction <= 0.5 + 1e-10) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  }
  return rounded / 10;
}

function integerSetting(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  step: number
): number {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value < min ||
    value > max ||
    value % step !== 0
  ) {
    return fallback;
  }
  return value;
}

export function scoreSettingsFromCollection(
  settings: Record<string, number> | undefined
): ScoreSettings {
  return {
    ecological_share: integerSetting(
      settings?.ecological_share,
      SCENARIO_SCORE_DEFAULTS.ecological_share,
      SCENARIO_CONTROL_RANGES.ecological_share.min,
      SCENARIO_CONTROL_RANGES.ecological_share.max,
      SCENARIO_CONTROL_RANGES.ecological_share.step
    ),
    low_incidence_breakpoint: integerSetting(
      settings?.low_incidence_breakpoint,
      SCENARIO_SCORE_DEFAULTS.low_incidence_breakpoint,
      SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.min,
      SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.max,
      SCENARIO_CONTROL_RANGES.low_incidence_breakpoint.step
    ),
    missing_human_weakness: integerSetting(
      settings?.missing_human_weakness,
      SCENARIO_SCORE_DEFAULTS.missing_human_weakness,
      SCENARIO_CONTROL_RANGES.missing_human_weakness.min,
      SCENARIO_CONTROL_RANGES.missing_human_weakness.max,
      SCENARIO_CONTROL_RANGES.missing_human_weakness.step
    ),
  };
}

export function scenarioSettingsEqual(
  left: ScoreSettings,
  right: ScoreSettings
): boolean {
  return (
    left.ecological_share === right.ecological_share &&
    left.low_incidence_breakpoint === right.low_incidence_breakpoint &&
    left.missing_human_weakness === right.missing_human_weakness
  );
}

export function priorityLabel(score: number): string {
  if (score >= 70) {
    return "Priority 1 — Investigate";
  }
  if (score >= 50) {
    return "Priority 2 — Review";
  }
  if (score >= 30) {
    return "Watch — Monitor signals";
  }
  return "Lower Atlas priority — Not a safety finding";
}

/** Same bands as the shared scorer, expressed as map tokens instead of hex. */
export function scenarioColorToken(score: number, inScope: boolean): string {
  if (!inScope) {
    return "var(--explorer-boundary)";
  }
  if (score >= 75) {
    return "var(--map-ramp-6)";
  }
  if (score >= 65) {
    return "var(--map-ramp-5)";
  }
  if (score >= 50) {
    return "var(--map-ramp-4)";
  }
  if (score >= 35) {
    return "var(--map-ramp-3)";
  }
  if (score >= 20) {
    return "var(--map-ramp-2)";
  }
  return "var(--map-ramp-1)";
}

/**
 * Port of `lyme_gap_atlas_shared.scoring.score_county`.
 * Unknown tick status contributes no positive signal, matching `Unknown`.
 */
export function scoreCounty(
  county: ScenarioCountyInputs,
  settings: ScoreSettings
): ScenarioScoreParts {
  const human =
    county.humanStatus === PUBLISHED_HUMAN_STATUS &&
    county.incidenceFloor2023 !== null
      ? 100 *
        clamp(
          1 - county.incidenceFloor2023 / settings.low_incidence_breakpoint,
          0,
          1
        )
      : settings.missing_human_weakness;
  const tickSignal = TICK_SIGNAL_BY_STATUS[county.tickStatus] ?? 0;
  const pathogenSignal = county.burgdorferiStatus === "Present" ? 100 : 0;
  const ecological = 0.6 * tickSignal + 0.4 * pathogenSignal;
  const sviSignal = (county.sviPercentile || 0) * 100;
  const accessSignal = (county.uninsuredPercentile || 0) * 100;
  const ruralSignal = clamp((((county.rucc2023 || 1) - 1) / 8) * 100);
  const community = 0.5 * sviSignal + 0.3 * accessSignal + 0.2 * ruralSignal;
  const share = settings.ecological_share / 100;
  const score = (human * (share * ecological + (1 - share) * community)) / 100;
  const roundedScore = round1(score);
  return {
    accessSignal: round1(accessSignal),
    colorToken: scenarioColorToken(roundedScore, county.inContiguousTickScope),
    community: round1(community),
    ecological: round1(ecological),
    humanWeakness: round1(human),
    pathogenSignal,
    priority: priorityLabel(roundedScore),
    ruralSignal: round1(ruralSignal),
    score: roundedScore,
    sviSignal: round1(sviSignal),
    tickSignal,
  };
}

function scenarioHuman(
  county: CountyScoreSummary,
  settings: ScoreSettings,
  baseline: ScoreSettings
): { human: number; limitedBreakpoint: boolean } {
  if (county.human_status !== PUBLISHED_HUMAN_STATUS) {
    return {
      human: settings.missing_human_weakness,
      limitedBreakpoint: false,
    };
  }
  const governedHuman = county.score.human_weakness;
  if (governedHuman <= 0) {
    return {
      human: 0,
      limitedBreakpoint:
        settings.low_incidence_breakpoint > baseline.low_incidence_breakpoint,
    };
  }
  if (governedHuman >= 100) {
    return { human: 100, limitedBreakpoint: false };
  }
  if (settings.low_incidence_breakpoint === baseline.low_incidence_breakpoint) {
    return { human: governedHuman, limitedBreakpoint: false };
  }
  const incidence =
    baseline.low_incidence_breakpoint * (1 - governedHuman / 100);
  const human =
    100 * clamp(1 - incidence / settings.low_incidence_breakpoint, 0, 1);
  return { human: round1(human), limitedBreakpoint: false };
}

function scenarioScore(
  county: CountyScoreSummary,
  settings: ScoreSettings,
  human: number
): number {
  const ecological =
    0.6 * county.score.tick_signal + 0.4 * county.score.pathogen_signal;
  const community =
    0.5 * county.score.svi_signal +
    0.3 * county.score.access_signal +
    0.2 * county.score.rural_signal;
  const share = settings.ecological_share / 100;
  return round1((human * (share * ecological + (1 - share) * community)) / 100);
}

/**
 * Client-side what-if for counties already on the governed scores collection.
 * Returns null when the sliders still match that collection, so callers keep
 * the governed score, priority, and color untouched.
 */
export function adjustCountyScenarios(
  counties: readonly CountyScoreSummary[],
  settings: ScoreSettings,
  baseline: ScoreSettings = SCENARIO_SCORE_DEFAULTS
): ReadonlyMap<string, AdjustedCountyScenario> | null {
  if (scenarioSettingsEqual(settings, baseline)) {
    return null;
  }
  const pending = counties.map((county) => {
    const human = scenarioHuman(county, settings, baseline);
    const score = scenarioScore(county, settings, human.human);
    return {
      colorToken: scenarioColorToken(score, county.in_contiguous_tick_scope),
      fips: county.fips,
      governedPriority: county.priority,
      governedScore: county.score.score,
      humanWeakness: human.human,
      limitedBreakpoint: human.limitedBreakpoint,
      priority: priorityLabel(score),
      score,
    };
  });
  pending.sort(
    (left, right) =>
      right.score - left.score || left.fips.localeCompare(right.fips)
  );
  const ranked = new Map<string, AdjustedCountyScenario>();
  for (const [index, entry] of pending.entries()) {
    ranked.set(entry.fips, {
      colorToken: entry.colorToken,
      governedPriority: entry.governedPriority,
      governedScore: entry.governedScore,
      humanWeakness: entry.humanWeakness,
      limitedBreakpoint: entry.limitedBreakpoint,
      priority: entry.priority,
      rank: index + 1,
      score: entry.score,
    });
  }
  return ranked;
}
