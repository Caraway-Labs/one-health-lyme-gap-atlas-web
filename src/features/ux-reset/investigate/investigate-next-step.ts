import {
  parseCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import type {
  CountyEvidenceBundle,
  CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  selectInvestigatePdfMeasures,
  type InvestigatePdfMeasure,
  type InvestigatePdfOmission,
} from "@/features/ux-reset/investigate/investigate-pdf-selection";
import type { Observation } from "@/generated/models";
import { isCountyFips } from "@/lib/county-geography";

export const investigateContinueDestinations = {
  compare: "compare",
} as const;

export type InvestigateContinueDestination =
  (typeof investigateContinueDestinations)[keyof typeof investigateContinueDestinations];

/**
 * Return to Compare when the URL already has a validated two-county pair.
 * Continue to Action is a separate offer once a county evidence bundle exists.
 * Return to Review stays in the county header.
 */
export function investigateContinueDestination(input: {
  compare: readonly string[];
}): InvestigateContinueDestination | null {
  const pair = parseCompareFipsList(input.compare.join(","));
  if (pair.length === UX_RESET_COMPARE_COUNTY_LIMIT) {
    return investigateContinueDestinations.compare;
  }
  return null;
}

export const investigateCompareOfferKinds = {
  return: "return",
  start: "start",
} as const;

export type InvestigateCompareOfferKind =
  (typeof investigateCompareOfferKinds)[keyof typeof investigateCompareOfferKinds];

export type InvestigateCompareOffer = {
  kind: InvestigateCompareOfferKind;
  label: "Compare" | "Return to Compare";
};

export type InvestigateActionOffer = {
  label: "Continue to Action";
};

/**
 * Offer Action only after this county's evidence bundle has loaded.
 * A published identity alone is not the evidence context Action repeats.
 */
export function investigateActionOffer(input: {
  bundle: Pick<CountyEvidenceBundle, "county" | "releaseId"> | null;
}): InvestigateActionOffer | null {
  if (!input.bundle?.county.fips || !input.bundle.releaseId) {
    return null;
  }
  return { label: "Continue to Action" };
}

/**
 * Start Compare only for a county that has already resolved to a published
 * identity or evidence bundle. Return when a two-county pair is already in
 * the link, including when the county on screen did not resolve.
 * A neighbor is not chosen.
 */
export function investigateCompareOffer(input: {
  compare: readonly string[];
  resolvedCounty: string | null;
}): InvestigateCompareOffer | null {
  const existing = parseCompareFipsList(input.compare.join(","));
  if (existing.length === UX_RESET_COMPARE_COUNTY_LIMIT) {
    return {
      kind: investigateCompareOfferKinds.return,
      label: "Return to Compare",
    };
  }
  const county =
    input.resolvedCounty && isCountyFips(input.resolvedCounty)
      ? input.resolvedCounty
      : null;
  if (county) {
    return { kind: investigateCompareOfferKinds.start, label: "Compare" };
  }
  return null;
}

export type InvestigatePdfContext = {
  observations?: readonly Observation[];
  included?: readonly InvestigatePdfMeasure[];
  omitted?: readonly InvestigatePdfOmission[];
  incomplete?: boolean;
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
 * already on the page. The PDF includes published measures and names the rest.
 */
export function investigatePdfContext(
  bundle: CountyEvidenceBundle,
  requestedPeriod: string | null
): InvestigatePdfContext {
  const sources: string[] = [];
  const periods: string[] = [];
  const caveats: string[] = [];
  const records = visibleObservations(bundle);
  for (const record of records) {
    appendUnique(sources, record.evidence.provenance.sourceFamily);
    appendUnique(periods, record.evidence.provenance.observationPeriod);
    for (const limitation of record.evidence.provenance.limitations) {
      appendUnique(caveats, limitation);
    }
  }
  const selection = selectInvestigatePdfMeasures({
    countyFips: bundle.county.fips,
    failures: bundle.measureFailures,
    readyMeasureIds: bundle.readyMeasureIds,
    records: records.map((record) => ({
      measureId: record.measureId,
      measureLabel: record.measureLabel,
      observation: record.observation,
    })),
    releaseId: bundle.releaseId,
    unsupportedPeriodMeasureIds: bundle.unsupportedPeriodMeasureIds,
  });
  return {
    observations: selection.observations,
    included: selection.included,
    omitted: selection.omitted,
    incomplete:
      bundle.measureFailures.length > 0 ||
      bundle.unsupportedPeriodMeasureIds.length > 0,
    caveats,
    countyFips: bundle.county.fips,
    periods,
    releaseId: bundle.releaseId,
    requestedPeriod,
    sources,
  };
}

export type InvestigatePdfExportOffer =
  | {
      omitted: readonly InvestigatePdfOmission[];
      reason: string;
      state: "unavailable";
    }
  | {
      included: readonly InvestigatePdfMeasure[];
      measureIds: string[];
      omitted: readonly InvestigatePdfOmission[];
      periodEnd: string;
      periodStart: string;
      reason: string;
      state: "available";
    };

function selectionForContext(context: InvestigatePdfContext) {
  if (context.included) {
    const [first] = context.observations ?? [];
    return {
      included: context.included,
      observations: context.observations ?? [],
      omitted: context.omitted ?? [],
      periodEnd: first?.period_end ?? null,
      periodStart: first?.period_start ?? null,
    };
  }
  return selectInvestigatePdfMeasures({
    countyFips: context.countyFips,
    failures: [],
    readyMeasureIds: [],
    records: (context.observations ?? []).map((observation) => ({
      measureId: observation.measure_id,
      measureLabel: observation.measure_id,
      observation,
    })),
    releaseId: context.releaseId,
    unsupportedPeriodMeasureIds: [],
  });
}

/** Published measures select the server-owned county-v2 report. The rest stay listed. */
export function investigateCountyReportExportOffer(
  context: InvestigatePdfContext
): InvestigatePdfExportOffer {
  const selection = selectionForContext(context);
  const periodStart = selection.periodStart;
  const periodEnd = selection.periodEnd;
  if (
    !(
      periodStart &&
      periodEnd &&
      selection.included.length > 0 &&
      isCountyFips(context.countyFips) &&
      context.releaseId
    )
  ) {
    return {
      omitted: selection.omitted,
      reason: "No published measure can be included in the county report.",
      state: "unavailable",
    };
  }
  return {
    included: selection.included,
    measureIds: selection.included.map((measure) => measure.measureId),
    omitted: selection.omitted,
    periodEnd,
    periodStart,
    reason: `Export published measures for ${periodStart} through ${periodEnd}.`,
    state: "available",
  };
}
