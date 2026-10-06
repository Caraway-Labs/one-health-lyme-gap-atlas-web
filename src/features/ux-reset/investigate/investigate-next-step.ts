import {
  parseCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import type {
  CountyEvidenceBundle,
  CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";
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

export type InvestigatePdfExportOffer = {
  /**
   * The county report contract returns a PDF blob. It does not carry the
   * requested period, observation period, source family, or caveat on this
   * page, so export stays unavailable until that comparison is possible.
   */
  reason: string;
  state: "unavailable";
};

function visibleList(values: readonly string[]): string {
  return values.length > 0 ? values.join("; ") : "none";
}

/**
 * Offer export only when the report is provably the same evidence context.
 * `GET /v1/counties/{fips}/report.pdf` accepts county, release, template, and
 * score settings, and the response schema is an opaque PDF. That cannot prove
 * a match, including for a non-default period or an observation caveat.
 */
export function investigateCountyReportExportOffer(
  context: InvestigatePdfContext
): InvestigatePdfExportOffer {
  const requested = context.requestedPeriod ?? "none";
  return {
    reason: `The county report does not include requested period ${requested}, observation period ${visibleList(context.periods)}, source ${visibleList(context.sources)}, or caveat ${visibleList(context.caveats)}. Export is not offered for this evidence.`,
    state: "unavailable",
  };
}
