import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
import { mapPublishedRow } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { CountyDetail } from "@/generated/models";

export function reviewHumanFloorEvidence(
  detail: CountyDetail
): EvidenceObjectModel {
  const source = detail.release.sources.find((entry) => entry.key === "human");
  const floor = detail.case_count_floor_2023;
  const hasFloor =
    detail.human_status === "published_count_floor" &&
    floor !== null &&
    Number.isFinite(floor) &&
    floor >= 0;
  const humanStatus = detail.human_status.trim().toLowerCase();
  const missingStatus = [
    "suppressed",
    "missing",
    "no_county_linked_record",
    "unavailable",
  ].includes(humanStatus)
    ? humanStatus
    : "Unavailable";
  const state = mapPublishedRow({
    claimLabel: "Published 2023 human case-count floor",
    inspectAnchor: "review-human-floor",
    sourceNote: source?.note,
    subject: hasFloor
      ? { kind: "numeric", value: floor }
      : {
          kind: "status",
          status: missingStatus,
        },
  });
  return {
    availability: state.availability,
    claimLabel: "Published 2023 human case-count floor",
    displayValue: hasFloor
      ? `${floor.toLocaleString("en-US")} (published count floor)`
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
      observationPeriod: "2023",
      sourceFamily: source?.label || "Unavailable",
      sourceUrl: source?.url || null,
      technical: {
        releaseId: detail.release.release_id,
        sourceId: source?.key,
      },
    },
    reasonCode: state.reasonCode,
    valueNote: hasFloor
      ? "A floor, not an exact case total."
      : `Published status: ${detail.human_status.replaceAll("_", " ")}. Missing, suppressed, or unallocated records are not converted to zero.`,
  };
}
