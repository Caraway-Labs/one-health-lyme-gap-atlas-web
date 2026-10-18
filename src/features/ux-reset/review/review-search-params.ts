import { createParser } from "nuqs";

import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";
import { parseExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import {
  parseExplorerCountyMode,
  parseExplorerCountySelection,
} from "@/features/ux-reset/review/explorer-mode";
import {
  SCENARIO_CONTROL_RANGES,
  SCENARIO_SCORE_DEFAULTS,
} from "@/features/ux-reset/review/explorer-scenario-score";

type ScenarioRange = { max: number; min: number; step: number };

const SCENARIO_URL_KEYS = ["eco", "breakpoint", "missing"] as const;

type ScenarioUrlKey = (typeof SCENARIO_URL_KEYS)[number];

/** Integer on the scenario slider range and step. Anything else is invalid. */
export function parseScenarioAssumption(
  value: string,
  range: ScenarioRange
): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < range.min ||
    parsed > range.max ||
    (parsed - range.min) % range.step !== 0
  ) {
    return null;
  }
  return parsed;
}

function scenarioInteger(defaultValue: number, range: ScenarioRange) {
  return createParser({
    parse: (value) => parseScenarioAssumption(value, range),
    serialize: String,
  }).withDefault(defaultValue);
}

const scenarioParsers = {
  breakpoint: scenarioInteger(
    SCENARIO_SCORE_DEFAULTS.low_incidence_breakpoint,
    SCENARIO_CONTROL_RANGES.low_incidence_breakpoint
  ),
  eco: scenarioInteger(
    SCENARIO_SCORE_DEFAULTS.ecological_share,
    SCENARIO_CONTROL_RANGES.ecological_share
  ),
  missing: scenarioInteger(
    SCENARIO_SCORE_DEFAULTS.missing_human_weakness,
    SCENARIO_CONTROL_RANGES.missing_human_weakness
  ),
};

/**
 * Replace invalid scenario params, explicit defaults, and non-canonical
 * integers. Valid non-default values stay so reload and share keep the view.
 */
export function scenarioSearchParamPatch(
  searchParams: Pick<URLSearchParams, "get">
): Partial<Record<ScenarioUrlKey, number>> | null {
  const patch: Partial<Record<ScenarioUrlKey, number>> = {};
  let changed = false;
  for (const key of SCENARIO_URL_KEYS) {
    const raw = searchParams.get(key);
    if (raw === null) {
      continue;
    }
    const parser = scenarioParsers[key];
    const parsed = parser.parse(raw);
    const canonical = parsed ?? parser.defaultValue;
    const needsRewrite =
      parsed === null ||
      canonical === parser.defaultValue ||
      String(canonical) !== raw;
    if (needsRewrite) {
      patch[key] = canonical;
      changed = true;
    }
  }
  return changed ? patch : null;
}

const reviewLocalParsers = {
  layer: createParser({
    parse: (value) => parseExplorerMapLayerId(value),
    serialize: (value) => value,
  }).withDefault("gap_score"),
  mode: createParser({
    parse: (value) => parseExplorerCountyMode(value),
    serialize: (value) => value,
  }),
  page: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  selection: createParser({
    parse: (value) => parseExplorerCountySelection(value),
    serialize: (value) => value,
  }),
  sort: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  ...scenarioParsers,
};

/** Review route URL state: shared reset context plus page-local keys. */
export const reviewSearchParams = {
  ...uxResetSharedContextParsers,
  ...reviewLocalParsers,
};
