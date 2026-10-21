import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  publishedCountyHierarchy,
  publishedCountyRecordFromDetail,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import {
  reviewHumanFloorEvidence,
  reviewHumanIncidenceEvidence,
} from "@/features/ux-reset/review/review-human-floor-evidence";
import type { CountyDetail } from "@/generated/models";

const TICK_MEASURES = [
  "scapularis_status",
  "pacificus_status",
  "tick_status",
] as const;

const RATIONALE_MEASURES: Record<number, readonly string[]> = {
  2: TICK_MEASURES,
  3: ["burgdorferi_status"],
  4: ["svi_percentile_2022"],
  5: ["uninsured_percent_2022"],
  6: ["rucc_2023"],
};

/**
 * Shared evidence models for the six published preview items.
 * Tick presence keeps one model per published species claim.
 * Period stays the hierarchy value, including explicit Unavailable.
 */
export function reviewRationaleEvidence(
  detail: CountyDetail
): Map<number, EvidenceObjectModel[]> {
  const hierarchy = publishedCountyHierarchy({
    measures: [],
    observedMeasureIds: [],
    record: publishedCountyRecordFromDetail(detail),
  });
  const byMeasure = new Map(
    hierarchy.rows.map((row) => [row.measureId, row.evidence])
  );
  const humanEvidence = [reviewHumanFloorEvidence(detail)];
  const incidenceEvidence = reviewHumanIncidenceEvidence(detail);
  if (incidenceEvidence) {
    humanEvidence.push(incidenceEvidence);
  }
  const evidence = new Map<number, EvidenceObjectModel[]>([[1, humanEvidence]]);
  for (const [number, measureIds] of Object.entries(RATIONALE_MEASURES)) {
    const models = measureIds.flatMap((measureId) => {
      const model = byMeasure.get(measureId);
      return model ? [model] : [];
    });
    evidence.set(Number(number), models);
  }
  return evidence;
}
