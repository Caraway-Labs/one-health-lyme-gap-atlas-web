import { createParser } from "nuqs";

import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";
import { parseExplorerMapFocus } from "@/features/ux-reset/review/explorer-map-focus";
import {
  DEFAULT_EXPLORER_MAP_LAYER_ID,
  parseExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  parseExplorerCountyMode,
  parseExplorerCountySelection,
} from "@/features/ux-reset/review/explorer-mode";
import {
  SCENARIO_CONTROL_RANGES,
  SCENARIO_SCORE_DEFAULTS,
} from "@/features/ux-reset/review/explorer-scenario-score";

type ScenarioRange = { max: number; min: number; step: number };

const SCENARIO_URL_KEYS = ["eco", "smooth", "missing"] as const;

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
  smooth: scenarioInteger(
    SCENARIO_SCORE_DEFAULTS.smooth_k,
    SCENARIO_CONTROL_RANGES.smooth_k
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
): (Partial<Record<ScenarioUrlKey, number>> & { breakpoint?: null }) | null {
  if (searchParams.get("breakpoint") !== null) {
    return { breakpoint: null, eco: 65, smooth: 50, missing: 75 };
  }
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

/**
 * Clear a removed or unknown map layer. The parser then uses Gap review score
 * instead of leaving a selector pointed at a layer that is no longer offered.
 */
export function retiredExplorerLayerSearchParamPatch(
  searchParams: Pick<URLSearchParams, "get">
): { layer: null } | null {
  const raw = searchParams.get("layer");
  if (raw === null || parseExplorerMapLayerId(raw) !== null) {
    return null;
  }
  return { layer: null };
}

const reviewLocalParsers = {
  breakpoint: createParser({
    parse: (value) => value,
    serialize: (value) => value,
  }),
  focus: createParser({
    parse: (value) => parseExplorerMapFocus(value),
    serialize: (value) => value,
  }),
  layer: createParser({
    parse: (value) => parseExplorerMapLayerId(value),
    serialize: (value) => value,
  }).withDefault(DEFAULT_EXPLORER_MAP_LAYER_ID),
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
