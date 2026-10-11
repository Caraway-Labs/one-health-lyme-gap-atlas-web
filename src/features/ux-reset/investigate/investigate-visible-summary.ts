import {
  evidenceAvailabilityValues,
  type EvidenceAvailability,
  type EvidenceObjectModel,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  countyEvidenceGap,
  type CountyEvidenceBundle,
  type CountyEvidenceGap,
  type CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  combineCaveatText,
  environmentalCoverageRows,
  governedStatusDisclosure,
  publishedCountyHierarchy,
  publishedRowAnchor,
  type EnvironmentalCoverageContext,
  type PublishedCountyRecord,
  type PublishedHierarchyRow,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { Measure } from "@/generated/models";

export type InvestigateVisibleSummary = {
  text: string;
  title: string;
};

export const COUNTY_RECORD_LOADING_FINDING =
  "The published county record is still loading, so an empty finding is not shown yet.";
export const COUNTY_RECORD_LOADING_LIMITATION =
  "The published county record is still loading, so an empty limitation is not shown yet.";
export const COUNTY_RECORD_FINDING_FAILURE =
  "The published county record could not be loaded, so findings may be incomplete. That is a request failure, not a statement that no finding was returned.";
export const COUNTY_RECORD_LIMITATION_FAILURE =
  "The published county record could not be loaded, so limitations may be incomplete. That is a request failure, not a statement that no limitation was returned.";
export const CATALOG_FINDING_FAILURE =
  "The measure catalog could not be loaded, so no observation finding was requested. That is a request failure, not a statement that no finding was returned.";
export const CATALOG_LIMITATION_FAILURE =
  "The measure catalog could not be loaded, so no observation limitation was requested. That is a request failure, not a statement that no limitation was returned.";

/** Availability of the resolved finding. Empty when the sentence is not an evidence state. */
export type ResolvedFindingAvailability = "" | EvidenceAvailability;

/**
 * The one finding Investigate, Action, Ask Atlas, and the next-step link share.
 * Observation leads win. A published Available or Limited row fills the sentence
 * when the observation series has none. Request failures stay request failures.
 */
export type ResolvedInvestigateFinding = {
  availability: ResolvedFindingAvailability;
  evidence: EvidenceObjectModel | null;
  inspectHref: string | null;
  measureId: string | null;
  measureLabel: string | null;
  text: string;
  title: string;
};

function gapCopy(
  gap: CountyEvidenceGap,
  subject: "finding" | "limitation"
): string {
  switch (gap) {
    case "failed": {
      return subject === "finding"
        ? "County evidence could not be loaded. That is a request failure, not a statement that no finding was published."
        : "A limitation was not read because the evidence requests failed.";
    }
    case "mixed": {
      return "Some measures failed to load, and others were not queried because the period is not a supported bound.";
    }
    case "returned_empty": {
      return subject === "finding"
        ? "No observed or limited finding was returned for this county."
        : "No material limitation was returned on the observations for this county.";
    }
    case "unsupported_period": {
      return "The selected period is not a supported bound for the published measures, so no observation query was sent.";
    }
    default: {
      const exhaustive: never = gap;
      return exhaustive;
    }
  }
}

function gapTitle(
  gap: CountyEvidenceGap,
  subject: "finding" | "limitation"
): string {
  switch (gap) {
    case "failed": {
      return "Evidence did not load";
    }
    case "mixed": {
      return "Evidence is incomplete";
    }
    case "returned_empty": {
      return subject === "finding"
        ? "No returned finding"
        : "No returned limitation";
    }
    case "unsupported_period": {
      return "Period is not supported";
    }
    default: {
      const exhaustive: never = gap;
      return exhaustive;
    }
  }
}

function summaryForGap(
  bundle: CountyEvidenceBundle,
  subject: "finding" | "limitation"
): InvestigateVisibleSummary {
  const gap = countyEvidenceGap(bundle) ?? "returned_empty";
  return {
    text: gapCopy(gap, subject),
    title: gapTitle(gap, subject),
  };
}

const NO_PUBLISHED_ROWS: readonly PublishedHierarchyRow[] = [];

function publishedLeadRow(
  rows: readonly PublishedHierarchyRow[]
): PublishedHierarchyRow | null {
  const available = rows.find(
    (row) => row.evidence.availability === evidenceAvailabilityValues.available
  );
  if (available) {
    return available;
  }
  return (
    rows.find(
      (row) => row.evidence.availability === evidenceAvailabilityValues.limited
    ) ?? null
  );
}

export function publishedFindingRow(
  rows: readonly PublishedHierarchyRow[]
): PublishedHierarchyRow | null {
  return publishedLeadRow(rows);
}

/** First published row whose shared mapping has limitation text. */
export function publishedCaveatRow(
  rows: readonly PublishedHierarchyRow[]
): { row: PublishedHierarchyRow; text: string } | null {
  for (const row of rows) {
    const text = row.state.limitationText;
    if (text) {
      return { row, text };
    }
  }
  return null;
}

/**
 * Observation or published sentence for a loaded county bundle.
 * Request-failure and loading sentences live in `resolveInvestigateFinding`.
 * Published county rows fill the sentence when the observation series has none.
 */
export function investigateFindingSummary(
  bundle: CountyEvidenceBundle,
  publishedRows: readonly PublishedHierarchyRow[] = NO_PUBLISHED_ROWS
): InvestigateVisibleSummary {
  const finding = bundle.leadFinding;
  if (finding) {
    return {
      text: `${finding.measureLabel}: ${finding.evidence.displayValue}. ${evidenceAvailabilityLabel(finding.evidence.availability)}. Period ${finding.evidence.provenance.observationPeriod}. Source ${finding.evidence.provenance.sourceFamily}.`,
      title: finding.measureLabel,
    };
  }
  const published = publishedLeadRow(publishedRows);
  if (!published) {
    return summaryForGap(bundle, "finding");
  }
  return {
    text: `${published.evidence.claimLabel}: ${published.evidence.displayValue}. ${evidenceAvailabilityLabel(published.evidence.availability)}. Period ${published.evidence.provenance.observationPeriod}. Source ${published.evidence.provenance.sourceFamily}.`,
    title: published.evidence.claimLabel,
  };
}

/**
 * Observation or published caveat for a loaded county bundle.
 * Action uses `investigateHandoffLimitation`, which passes these rows through
 * the same loading and request-failure sentences as Investigate.
 */
export function investigateLimitationSummary(
  bundle: CountyEvidenceBundle,
  publishedRows: readonly PublishedHierarchyRow[] = NO_PUBLISHED_ROWS
): InvestigateVisibleSummary {
  const limitation = bundle.leadLimitation;
  if (limitation) {
    return {
      text: `${limitation.observation.measureLabel}: ${limitation.text}`,
      title: limitation.observation.measureLabel,
    };
  }
  const published = publishedCaveatRow(publishedRows);
  if (!published) {
    return summaryForGap(bundle, "limitation");
  }
  return {
    text: `${published.row.evidence.claimLabel}: ${published.text}`,
    title: published.row.evidence.claimLabel,
  };
}

export function visibleCountyObservations(
  bundle: CountyEvidenceBundle
): CountyEvidenceObservation[] {
  const records: CountyEvidenceObservation[] = [];
  for (const family of bundle.families) {
    records.push(...family.observations);
  }
  records.push(...bundle.unassigned);
  return records;
}

function observationInspectHref(observationId: string): string {
  return `#investigate-observation-${observationId}`;
}

function resolvedGap(
  summary: InvestigateVisibleSummary,
  availability: ResolvedFindingAvailability
): ResolvedInvestigateFinding {
  return {
    availability,
    evidence: null,
    inspectHref: null,
    measureId: null,
    measureLabel: null,
    text: summary.text,
    title: summary.title,
  };
}

function unavailableObservationAvailability(
  bundle: CountyEvidenceBundle
): ResolvedFindingAvailability {
  const unavailable = visibleCountyObservations(bundle).some(
    (record) =>
      record.evidence.availability === evidenceAvailabilityValues.unavailable
  );
  return unavailable ? evidenceAvailabilityValues.unavailable : "";
}

/**
 * Published rows for measures the observation series does not already show.
 * Investigate and Action both build the finding from this list.
 */
export function publishedRowsForCounty(input: {
  bundle: CountyEvidenceBundle;
  countyRecord: PublishedCountyRecord | null;
  measures: readonly Measure[];
}): readonly PublishedHierarchyRow[] {
  if (!input.countyRecord) {
    return NO_PUBLISHED_ROWS;
  }
  return publishedCountyHierarchy({
    measures: input.measures,
    observedMeasureIds: visibleCountyObservations(input.bundle).map(
      (record) => record.measureId
    ),
    record: input.countyRecord,
  }).rows;
}

/**
 * Finding text, title, and availability for every surface that repeats
 * Investigate. A published Available or Limited row is kept when the
 * observation series has no lead, including after a catalog failure.
 */
export function resolveInvestigateFinding(input: {
  bundle: CountyEvidenceBundle;
  catalogFailed?: boolean;
  countyRecordError?: string | null;
  countyRecordLoading?: boolean;
  countyRecordPresent?: boolean;
  publishedRows?: readonly PublishedHierarchyRow[];
}): ResolvedInvestigateFinding {
  const rows = input.publishedRows ?? NO_PUBLISHED_ROWS;
  const observation = input.bundle.leadFinding;
  const published = publishedLeadRow(rows);
  if (input.countyRecordLoading && !observation) {
    return resolvedGap(
      {
        text: COUNTY_RECORD_LOADING_FINDING,
        title: "Published county record loading",
      },
      ""
    );
  }
  if (input.countyRecordError && !observation && !input.countyRecordPresent) {
    return resolvedGap(
      {
        text: COUNTY_RECORD_FINDING_FAILURE,
        title: "Published county record did not load",
      },
      ""
    );
  }
  if (input.catalogFailed && !observation && !published) {
    return resolvedGap(
      {
        text: CATALOG_FINDING_FAILURE,
        title: "Measure catalog did not load",
      },
      ""
    );
  }
  const summary = investigateFindingSummary(input.bundle, rows);
  if (observation) {
    return {
      availability: observation.evidence.availability,
      evidence: observation.evidence,
      inspectHref: observationInspectHref(
        observation.observation.observation_id
      ),
      measureId: observation.measureId,
      measureLabel: observation.measureLabel,
      text: summary.text,
      title: summary.title,
    };
  }
  if (published) {
    return {
      availability: published.evidence.availability,
      evidence: published.evidence,
      inspectHref: `#${publishedRowAnchor(published.measureId)}`,
      measureId: published.measureId,
      measureLabel: published.evidence.claimLabel,
      text: summary.text,
      title: summary.title,
    };
  }
  return resolvedGap(summary, unavailableObservationAvailability(input.bundle));
}

function observationUncertaintySentences(
  bundle: CountyEvidenceBundle
): string[] {
  const sentences: string[] = [];
  for (const record of visibleCountyObservations(bundle)) {
    const [leadLimitation] = record.evidence.provenance.limitations;
    const uncertainty = governedStatusDisclosure({
      claimLabel: record.measureLabel,
      limitations: leadLimitation ? [leadLimitation] : [],
      reasonCode: record.evidence.reasonCode ?? record.observation.value_state,
      valueState: record.observation.value_state,
    });
    if (uncertainty.uncertaintyText) {
      sentences.push(`${record.measureLabel}: ${uncertainty.uncertaintyText}`);
    }
  }
  return sentences;
}

function coverageContextsForBundle(
  bundle: CountyEvidenceBundle
): EnvironmentalCoverageContext[] {
  const contexts: EnvironmentalCoverageContext[] = [];
  for (const record of visibleCountyObservations(bundle)) {
    const context = record.observation.environmental_context;
    if (!context) {
      continue;
    }
    contexts.push({
      context,
      measureId: record.measureId,
      measureLabel: record.measureLabel,
      observationId: record.observation.observation_id,
      provenance: record.evidence.provenance,
    });
  }
  return contexts;
}

/**
 * The limitation paragraph Investigate shows, including unavailable-state
 * disclosures that are not the lead caveat. Action repeats this paragraph
 * so a reload does not drop them.
 */
export function investigateHandoffLimitation(input: {
  bundle: CountyEvidenceBundle;
  catalogFailed?: boolean;
  countyRecordError?: string | null;
  countyRecordLoading?: boolean;
  countyRecordPresent?: boolean;
  publishedReleaseLimitation?: string | null;
  publishedRows?: readonly PublishedHierarchyRow[];
}): InvestigateVisibleSummary {
  const rows = input.publishedRows ?? NO_PUBLISHED_ROWS;
  const limitation = input.bundle.leadLimitation;
  const holdEmpty = Boolean(input.countyRecordLoading) && !limitation;
  const countyFailed =
    Boolean(input.countyRecordError) &&
    !limitation &&
    !input.countyRecordPresent;
  const published = holdEmpty || countyFailed ? null : publishedCaveatRow(rows);
  const coverageCaveat =
    environmentalCoverageRows({
      contexts: coverageContextsForBundle(input.bundle),
    }).find((row) => row.state.limitationText) ?? null;
  const releaseLimitation =
    holdEmpty || countyFailed
      ? ""
      : (input.publishedReleaseLimitation?.trim() ?? "");
  const combined = combineCaveatText([
    ...observationUncertaintySentences(input.bundle),
    published
      ? `${published.row.evidence.claimLabel}: ${published.text}`
      : null,
    coverageCaveat?.state.limitationText
      ? `${coverageCaveat.evidence.claimLabel}: ${coverageCaveat.state.limitationText}`
      : null,
    releaseLimitation || null,
  ]);
  if (combined) {
    return {
      text: combined,
      title:
        limitation?.observation.measureLabel ??
        published?.row.evidence.claimLabel ??
        coverageCaveat?.evidence.claimLabel ??
        "Release limitation",
    };
  }
  if (holdEmpty) {
    return {
      text: COUNTY_RECORD_LOADING_LIMITATION,
      title: "Published county record loading",
    };
  }
  if (countyFailed) {
    return {
      text: COUNTY_RECORD_LIMITATION_FAILURE,
      title: "Published county record did not load",
    };
  }
  if (input.catalogFailed && !limitation && !published && !coverageCaveat) {
    return {
      text: CATALOG_LIMITATION_FAILURE,
      title: "Measure catalog did not load",
    };
  }
  return investigateLimitationSummary(input.bundle, rows);
}
