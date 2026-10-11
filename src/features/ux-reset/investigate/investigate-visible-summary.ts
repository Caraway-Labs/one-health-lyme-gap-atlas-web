import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  countyEvidenceGap,
  type CountyEvidenceBundle,
  type CountyEvidenceGap,
  type CountyEvidenceObservation,
} from "@/features/ux-reset/investigate/county-evidence";
import type { PublishedHierarchyRow } from "@/features/ux-reset/investigate/published-county-hierarchy";

export type InvestigateVisibleSummary = {
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

/** First published row whose provenance lists a material caveat. */
export function publishedCaveatRow(
  rows: readonly PublishedHierarchyRow[]
): { row: PublishedHierarchyRow; text: string } | null {
  for (const row of rows) {
    const caveat = row.evidence.provenance.materialCaveat?.trim() ?? "";
    const listed =
      row.evidence.provenance.limitations
        .map((entry) => entry.trim())
        .find((entry) => entry.length > 0) ?? "";
    const text = caveat || listed;
    if (text) {
      return { row, text };
    }
  }
  return null;
}

/**
 * The finding sentence Investigate shows for a loaded county bundle.
 * Action repeats this sentence so the handoff does not rewrite the summary.
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
 * The limitation sentence Investigate shows for a loaded county bundle.
 * Published county caveats fill the sentence when the observation series
 * has none. Action's one-argument call stays observation-scoped.
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
