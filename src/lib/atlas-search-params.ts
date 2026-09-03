import { createParser, parseAsString, parseAsStringEnum } from "nuqs";

import { EVIDENCE_VIEWS } from "@/lib/atlas-ui";
import type { EvidenceView, ScoreSettings } from "@/lib/atlas-ui";

const fips = createParser({
  parse: (value) => (/^\d{5}$/.test(value) ? value : null),
  serialize: (value) => value,
});

function boundedInteger(
  defaultValue: number,
  min: number,
  max: number,
  step = 1
) {
  return createParser({
    parse: (value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) &&
        parsed >= min &&
        parsed <= max &&
        (parsed - min) % step === 0
        ? parsed
        : null;
    },
    serialize: (value) => value.toString(),
  }).withDefault(defaultValue);
}

export const atlasSearchParams = {
  breakpoint: boundedInteger(10, 5, 25),
  compare: fips,
  county: fips.withDefault("06037"),
  dataset: parseAsString,
  eco: boundedInteger(65, 40, 85, 5),
  evidence: parseAsStringEnum([
    ...EVIDENCE_VIEWS,
  ] as EvidenceView[]).withDefault("all"),
  missing: boundedInteger(75, 40, 90, 5),
  q: parseAsString.withDefault(""),
  state: parseAsString.withDefault("ALL"),
};

export function toScoreSettings(values: {
  breakpoint: number;
  eco: number;
  missing: number;
}): ScoreSettings {
  return {
    ecological_share: values.eco,
    low_incidence_breakpoint: values.breakpoint,
    missing_human_weakness: values.missing,
  };
}

/**
 * The API-selected release is informational rather than user-controlled. Write
 * it synchronously so a queued high-frequency nuqs update cannot overwrite a
 * navigation away from the Atlas route.
 */
export function synchronizeGovernedDataset(releaseId: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("dataset") === releaseId) {
    return;
  }
  url.searchParams.set("dataset", releaseId);
  window.history.replaceState(window.history.state, "", url);
}
