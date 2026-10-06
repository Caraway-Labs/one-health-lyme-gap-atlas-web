import {
  parseCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import type {
  CountyEvidenceBundle,
  CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";

export const investigateContinueDestinations = {
  action: "action",
  compare: "compare",
} as const;

export type InvestigateContinueDestination =
  (typeof investigateContinueDestinations)[keyof typeof investigateContinueDestinations];

/**
 * One cross-page path. A complete two-county compare set is the return path.
 * Otherwise a loaded county can continue to Action. Neither link is a
 * recommended workflow.
 */
export function investigateContinueDestination(input: {
  compare: readonly string[];
  evidenceReady: boolean;
}): InvestigateContinueDestination | null {
  const pair = parseCompareFipsList(input.compare.join(","));
  if (pair.length === UX_RESET_COMPARE_COUNTY_LIMIT) {
    return investigateContinueDestinations.compare;
  }
  if (input.evidenceReady) {
    return investigateContinueDestinations.action;
  }
  return null;
}

export type InvestigatePdfContext = {
  caveats: readonly string[];
  countyFips: string;
  periods: readonly string[];
  releaseId: string;
  requestedPeriod: string | null;
  sources: readonly string[];
};

function visibleObservations(
  bundle: CountyEvidenceBundle
): readonly CountyEvidenceObservation[] {
  const records: CountyEvidenceObservation[] = [];
  for (const family of bundle.families) {
    records.push(...family.observations);
  }
  records.push(...bundle.unassigned);
  return records;
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

/**
 * County, release, periods, sources, and caveats copied from the observations
 * already on the page. Empty families contribute nothing.
 */
export function investigatePdfContext(
  bundle: CountyEvidenceBundle,
  requestedPeriod: string | null
): InvestigatePdfContext {
  const sources: string[] = [];
  const periods: string[] = [];
  const caveats: string[] = [];
  for (const record of visibleObservations(bundle)) {
    appendUnique(sources, record.evidence.provenance.sourceFamily);
    appendUnique(periods, record.evidence.provenance.observationPeriod);
    for (const limitation of record.evidence.provenance.limitations) {
      appendUnique(caveats, limitation);
    }
  }
  return {
    caveats,
    countyFips: bundle.county.fips,
    periods,
    releaseId: bundle.releaseId,
    requestedPeriod,
    sources,
  };
}

export function investigateExportIdentity(
  context: InvestigatePdfContext
): string {
  return JSON.stringify([
    context.countyFips,
    context.releaseId,
    context.requestedPeriod,
    context.periods,
    context.sources,
    context.caveats,
  ]);
}
