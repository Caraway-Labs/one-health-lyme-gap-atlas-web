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

/**
 * A county whose adjusted result is a definite score.
 * `adjusted` recomputes that score. `unchanged` keeps the governed score,
 * priority, and map color because the moved slider does not affect the county.
 * `limited` has no definite score, category, or rank: the published incidence
 * is not available, so a higher threshold must not be invented as zero.
 */
export type AdjustedCountyScenario = {
  governedPriority: string;
  governedScore: number;
} & (
  | {
      colorToken: string;
      humanWeakness: number;
      kind: "adjusted";
      priority: string;
      rank: number;
      score: number;
    }
  | {
      kind: "limited";
    }
  | {
      kind: "unchanged";
      priority: string;
      rank: number;
      score: number;
    }
);

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

/**
 * Published human signal for the scenario.
 * A caller may pass a typed incidence when the threshold moved. The scores
 * collection does not declare incidence, so the UI does not read one from
 * that payload. A governed signal of 0 hides every incidence at or above the
 * baseline threshold, and raising that threshold without a typed incidence is
 * limited rather than a new zero.
 */
function scenarioHuman(
  county: CountyScoreSummary,
  settings: ScoreSettings,
  baseline: ScoreSettings,
  exactIncidence: number | undefined
): number | "limited" {
  if (county.human_status !== PUBLISHED_HUMAN_STATUS) {
    return settings.missing_human_weakness;
  }
  const governedHuman = county.score.human_weakness;
  const breakpointChanged =
    settings.low_incidence_breakpoint !== baseline.low_incidence_breakpoint;
  if (!breakpointChanged) {
    return governedHuman;
  }
  if (typeof exactIncidence === "number") {
    return (
      100 * clamp(1 - exactIncidence / settings.low_incidence_breakpoint, 0, 1)
    );
  }
  if (
    governedHuman <= 0 &&
    settings.low_incidence_breakpoint > baseline.low_incidence_breakpoint
  ) {
    return "limited";
  }
  if (governedHuman <= 0 || governedHuman >= 100) {
    return governedHuman;
  }
  const incidence =
    baseline.low_incidence_breakpoint * (1 - governedHuman / 100);
  return 100 * clamp(1 - incidence / settings.low_incidence_breakpoint, 0, 1);
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
type ScenarioDraft =
  | {
      kind: "adjusted";
      colorToken: string;
      humanWeakness: number;
      priority: string;
      score: number;
    }
  | { kind: "limited" }
  | { kind: "unchanged" };

function scenarioDraft(
  county: CountyScoreSummary,
  settings: ScoreSettings,
  baseline: ScoreSettings,
  exactIncidence: number | undefined
): ScenarioDraft {
  const rawHuman = scenarioHuman(county, settings, baseline, exactIncidence);
  if (rawHuman === "limited") {
    return { kind: "limited" };
  }
  const human = round1(rawHuman);
  const governedHuman = round1(county.score.human_weakness);
  const shareChanged = settings.ecological_share !== baseline.ecological_share;
  const shareAffectsScore = shareChanged && human !== 0;
  if (!shareAffectsScore && human === governedHuman) {
    return { kind: "unchanged" };
  }
  const score = scenarioScore(county, settings, rawHuman);
  return {
    colorToken: scenarioColorToken(score, county.in_contiguous_tick_scope),
    humanWeakness: human,
    kind: "adjusted",
    priority: priorityLabel(score),
    score,
  };
}

/**
 * `exactIncidenceByFips` is an optional typed input for callers that already
 * hold incidence. The scores response is not one of those callers.
 */
export function adjustCountyScenarios(
  counties: readonly CountyScoreSummary[],
  settings: ScoreSettings,
  baseline: ScoreSettings = SCENARIO_SCORE_DEFAULTS,
  exactIncidenceByFips: Readonly<Record<string, number>> = {}
): ReadonlyMap<string, AdjustedCountyScenario> | null {
  if (scenarioSettingsEqual(settings, baseline)) {
    return null;
  }
  const pending = counties.map((county) => ({
    county,
    draft: scenarioDraft(
      county,
      settings,
      baseline,
      exactIncidenceByFips[county.fips]
    ),
  }));
  const scenarioActive = pending.some(
    (entry) => entry.draft.kind === "adjusted" || entry.draft.kind === "limited"
  );
  if (!scenarioActive) {
    return null;
  }
  const rankable = pending
    .filter(
      (
        entry
      ): entry is {
        county: CountyScoreSummary;
        draft: Exclude<ScenarioDraft, { kind: "limited" }>;
      } => entry.draft.kind !== "limited"
    )
    .toSorted((left, right) => {
      const leftScore =
        left.draft.kind === "adjusted"
          ? left.draft.score
          : left.county.score.score;
      const rightScore =
        right.draft.kind === "adjusted"
          ? right.draft.score
          : right.county.score.score;
      return (
        rightScore - leftScore ||
        left.county.fips.localeCompare(right.county.fips)
      );
    });
  const rankByFips = new Map<string, number>();
  for (const [index, entry] of rankable.entries()) {
    rankByFips.set(entry.county.fips, index + 1);
  }
  const ranked = new Map<string, AdjustedCountyScenario>();
  const rankFor = (fips: string): number => {
    const value = rankByFips.get(fips);
    if (value === undefined) {
      throw new Error(`Scenario rank missing for county ${fips}.`);
    }
    return value;
  };
  for (const entry of pending) {
    const governedPriority = entry.county.priority;
    const governedScore = entry.county.score.score;
    switch (entry.draft.kind) {
      case "adjusted": {
        ranked.set(entry.county.fips, {
          ...entry.draft,
          governedPriority,
          governedScore,
          rank: rankFor(entry.county.fips),
        });
        break;
      }
      case "limited": {
        ranked.set(entry.county.fips, {
          governedPriority,
          governedScore,
          kind: "limited",
        });
        break;
      }
      case "unchanged": {
        ranked.set(entry.county.fips, {
          governedPriority,
          governedScore,
          kind: "unchanged",
          priority: governedPriority,
          rank: rankFor(entry.county.fips),
          score: governedScore,
        });
        break;
      }
      default: {
        const exhaustive: never = entry.draft;
        return exhaustive;
      }
    }
  }
  return ranked;
}
