import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
import { mapPublishedRow } from "@/features/ux-reset/investigate/published-county-hierarchy";
import {
  compactPublishedCaseCount,
  formatPublishedIncidenceRate,
  MINIMUM_REPORTED_CASES_LABEL,
  MINIMUM_REPORTED_CASES_TOOLTIP,
  MINIMUM_REPORTED_INCIDENCE_LABEL,
  MINIMUM_REPORTED_INCIDENCE_TOOLTIP,
  publishedHumanFloorValue,
  publishedIncidenceExplanation,
  PUBLISHED_LYME_CASE_YEAR,
  REPORTED_CASES_LABEL,
} from "@/features/ux-reset/review/published-human-case-copy";
import type { CountyDetail } from "@/generated/models";

function missingHumanStatus(detail: CountyDetail): string {
  const humanStatus = detail.human_status.trim().toLowerCase();
  return [
    "suppressed",
    "missing",
    "no_county_linked_record",
    "unavailable",
  ].includes(humanStatus)
    ? humanStatus
    : "Unavailable";
}

function unpublishedNote(detail: CountyDetail): string {
  return `Published status: ${detail.human_status.replaceAll("_", " ")}. Missing, suppressed, or unallocated records are not converted to zero.`;
}

export function reviewHumanFloorEvidence(
  detail: CountyDetail
): EvidenceObjectModel {
  const source = detail.release.sources.find((entry) => entry.key === "human");
  const floor = publishedHumanFloorValue(
    detail.human_status,
    detail.case_count_floor_2023
  );
  const hasFloor = floor !== null;
  const claimLabel = hasFloor
    ? MINIMUM_REPORTED_CASES_LABEL
    : REPORTED_CASES_LABEL;
  const state = mapPublishedRow({
    claimLabel,
    inspectAnchor: "review-human-floor",
    sourceNote: source?.note,
    subject: hasFloor
      ? { kind: "numeric", value: floor }
      : {
          kind: "status",
          status: missingHumanStatus(detail),
        },
  });
  return {
    availability: state.availability,
    claimLabel,
    displayValue: hasFloor
      ? compactPublishedCaseCount(floor)
      : formatGovernedEvidenceValue({
          value: null,
          valueState: state.valueState,
        }),
    provenance: {
      datasetVintage: source?.vintage || null,
      evidenceType: "Unavailable",
      inspectSummary: source?.note || "Source context was not returned.",
      limitations: [...state.limitations],
      materialCaveat: state.limitations[0] ?? null,
      methodVersion: detail.release.methodology_version,
      observationPeriod: PUBLISHED_LYME_CASE_YEAR,
      sourceFamily: source?.label || "Unavailable",
      sourceUrl: source?.url || null,
      technical: {
        releaseId: detail.release.release_id,
        sourceId: source?.key,
      },
    },
    reasonCode: state.reasonCode,
    valueNote: hasFloor
      ? MINIMUM_REPORTED_CASES_TOOLTIP
      : unpublishedNote(detail),
  };
}

/** Incidence provenance for a published lower bound. Absent when no bound exists. */
export function reviewHumanIncidenceEvidence(
  detail: CountyDetail
): EvidenceObjectModel | null {
  const source = detail.release.sources.find((entry) => entry.key === "human");
  const floor = publishedHumanFloorValue(
    detail.human_status,
    detail.incidence_floor_2023
  );
  if (floor === null) {
    return null;
  }
  const state = mapPublishedRow({
    claimLabel: MINIMUM_REPORTED_INCIDENCE_LABEL,
    inspectAnchor: "review-human-incidence",
    sourceNote: source?.note,
    subject: { kind: "numeric", value: floor },
  });
  return {
    availability: state.availability,
    claimLabel: MINIMUM_REPORTED_INCIDENCE_LABEL,
    displayValue: publishedIncidenceExplanation(
      formatPublishedIncidenceRate(floor)
    ),
    provenance: {
      datasetVintage: source?.vintage || null,
      evidenceType: "Unavailable",
      inspectSummary: source?.note || "Source context was not returned.",
      limitations: [...state.limitations],
      materialCaveat: state.limitations[0] ?? null,
      methodVersion: detail.release.methodology_version,
      observationPeriod: PUBLISHED_LYME_CASE_YEAR,
      sourceFamily: source?.label || "Unavailable",
      sourceUrl: source?.url || null,
      technical: {
        releaseId: detail.release.release_id,
        sourceId: source?.key,
      },
    },
    reasonCode: state.reasonCode,
    valueNote: MINIMUM_REPORTED_INCIDENCE_TOOLTIP,
  };
}
