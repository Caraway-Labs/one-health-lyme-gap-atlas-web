import {
  parseCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import type {
  CountyEvidenceBundle,
  CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";
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
    observations: visibleObservations(bundle).map(
      (record) => record.observation
    ),
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
  | { reason: string; state: "unavailable" }
  | {
      reason: string;
      state: "available";
      periodStart: string;
      periodEnd: string;
      measureIds: string[];
    };

/** Only complete canonical evidence can select the server-owned county-v2 report. */
export function investigateCountyReportExportOffer(
  context: InvestigatePdfContext
): InvestigatePdfExportOffer {
  const records = context.observations ?? [];
  const first = records[0];
  const unavailable = {
    reason: `A matching report is unavailable for requested period ${context.requestedPeriod ?? "none"}, observation period ${context.periods.join("; ")}, source ${context.sources.join("; ")}, and caveat ${context.caveats.join("; ")}. Complete canonical evidence and provenance are required.`,
    state: "unavailable" as const,
  };
  if (
    !first ||
    context.incomplete ||
    !isCountyFips(context.countyFips) ||
    !context.releaseId
  ) {
    return unavailable;
  }
  const start = Date.parse(first.period_start);
  const end = Date.parse(first.period_end);
  const days = (end - start) / 86_400_000 + 1;
  if (
    !Number.isFinite(days) ||
    days < 1 ||
    days > 500 ||
    new Date(start).toISOString().slice(0, 10) !== first.period_start ||
    new Date(end).toISOString().slice(0, 10) !== first.period_end ||
    (context.requestedPeriod && context.requestedPeriod !== first.period_start)
  ) {
    return unavailable;
  }
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  for (const observation of records) {
    if (
      ids.has(observation.observation_id) ||
      observation.geography.geography_type !== "county" ||
      observation.geography.geography_id !== context.countyFips ||
      observation.release_id !== context.releaseId ||
      observation.period_start !== first.period_start ||
      observation.period_end !== first.period_end ||
      !["OBSERVED", "ZERO", "SUPPRESSED"].includes(observation.value_state) ||
      ![
        observation.measure_id,
        observation.source_id,
        observation.source_label,
        observation.lineage_source_id,
        observation.dataset_id,
        observation.provenance_ref,
        observation.methodology_version,
        observation.semantic_version,
      ].every((value) => value?.trim())
    ) {
      return unavailable;
    }
    ids.add(observation.observation_id);
    counts.set(
      observation.measure_id,
      (counts.get(observation.measure_id) ?? 0) + 1
    );
  }
  if (counts.size > 20 || [...counts.values()].some((count) => count > 500)) {
    return unavailable;
  }
  return {
    state: "available",
    reason:
      "Export the county evidence with its observation period, sources, and caveats.",
    periodStart: first.period_start,
    periodEnd: first.period_end,
    measureIds: [...counts.keys()].sort(),
  };
}
