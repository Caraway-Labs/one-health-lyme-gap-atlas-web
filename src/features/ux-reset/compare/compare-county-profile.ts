"use client";

import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  formatGovernedEvidenceValue,
  materialCaveatShort,
} from "@/features/ux-reset/evidence/value-state-contract";
import { InvestigateContractError } from "@/features/ux-reset/investigate/county-evidence";
import {
  mapPublishedRow,
  publishedCountyHierarchy,
  publishedCountyRecordFromDetail,
  publishedValueStateRole,
  type GovernedPublishedState,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import { reviewHumanFloorEvidence } from "@/features/ux-reset/review/review-published-county-preview";
import type { CountyDetail, SourceMetadata } from "@/generated/models";
import {
  plainPriority,
  reviewReasonsFor,
  type CountyReviewReason,
} from "@/lib/atlas-ui";

/**
 * Side-by-side county-record rows for Compare.
 * Values stay original. This module does not calculate a difference or a trend.
 * Authoritative comparability stays with issue 419.
 */

const MISSING_RECORD =
  "No published county record was returned. This absence is not zero.";
const FAILED_RECORD = "This county record was not used.";
const RELEASE_MISMATCH =
  "This county record is for a different release, so it was not shown.";
const IDENTITY_MISMATCH =
  "This county record did not match the requested county, so it was not shown.";
const MISSING_FIELD = "This published field was not returned. It is not zero.";
const SCORE_NOTE =
  "Published score value. Not a rank, a case count, or a calculated difference.";
const FLOOR_RATE_NOTE = "A floor, not an exact rate.";
const RUCC_NOTE = "Rural-urban classification code. Not a percentage.";
const SVI_NOTE = "A percentile, not a count.";
const UNINSURED_NOTE = "A percent. Not a percentile, and not scaled again.";
const UNALLOCATED_NOTE = "Not a county case count.";
const NO_LIMITATION =
  "No governed limitation was returned for this county record.";
const NO_PUBLISHED_CASE_REASON =
  "No county-level 2023 Lyme case count was published. This may reflect zero cases, privacy suppression, or other reporting limitations; the score treats missing data not as zero cases.";

const PROFILE_ROW_IDS = [
  "review_category",
  "review_reasons",
  "published_review_score",
  "human_weakness",
  "ecological_component",
  "community_component",
  "human_case_floor",
  "incidence_floor",
  "scapularis_status",
  "pacificus_status",
  "tick_status",
  "burgdorferi_status",
  "population_2022",
  "svi_percentile_2022",
  "uninsured_percent_2022",
  "rucc_2023",
  "state_unallocated_2023",
  "release_limitation",
] as const;

export type CompareProfileRowId = (typeof PROFILE_ROW_IDS)[number];

export const compareCountySideStatuses = {
  failed: "failed",
  missing: "missing",
  ready: "ready",
  releaseMismatch: "release_mismatch",
} as const;

export type CompareCountySide =
  | { detail: CountyDetail; status: "ready" }
  | { status: "missing" }
  | { message: string; status: "failed" }
  | { message: string; status: "release_mismatch" };

export type CompareProfileCell =
  | {
      kind: "empty";
      message: string;
      reason: "failed" | "missing" | "release_mismatch";
    }
  | { evidence: EvidenceObjectModel; kind: "evidence" }
  | { kind: "reasons"; reasons: readonly CountyReviewReason[] }
  | { kind: "text"; text: string };

export type CompareProfileRow = {
  id: CompareProfileRowId;
  label: string;
  left: CompareProfileCell;
  right: CompareProfileCell;
};

export type CompareProfileAlignment = {
  leftFips: string;
  /** Both county records were accepted for this release. */
  recordsReady: boolean;
  releaseMismatch: boolean;
  retryable: boolean;
  rightFips: string;
  rows: readonly CompareProfileRow[];
};

const ROW_LABELS: Record<CompareProfileRowId, string> = {
  burgdorferi_status: "Borrelia burgdorferi status",
  community_component: "Community component",
  ecological_component: "Ecological component",
  human_case_floor: "Human case-count floor",
  human_weakness: "Human-data component",
  incidence_floor: "Human incidence floor",
  pacificus_status: "Ixodes pacificus status",
  population_2022: "Population",
  published_review_score: "Published review score",
  release_limitation: "Evidence limitations",
  review_category: "Review category",
  review_reasons: "Review reasons",
  rucc_2023: "Rural-urban classification",
  scapularis_status: "Ixodes scapularis status",
  state_unallocated_2023: "State-unallocated human records",
  svi_percentile_2022: "Social vulnerability percentile",
  tick_status: "Tick surveillance status",
  uninsured_percent_2022: "Uninsured percent",
};

const HIERARCHY_ROW_IDS = [
  "scapularis_status",
  "pacificus_status",
  "tick_status",
  "burgdorferi_status",
  "population_2022",
  "svi_percentile_2022",
  "uninsured_percent_2022",
  "rucc_2023",
] as const;

type HierarchyRowId = (typeof HIERARCHY_ROW_IDS)[number];

export function compareProfilePeriodQualification(
  period: string | null
): string {
  const base =
    "Human case and incidence floors are the published 2023 snapshot. A floor is not an exact total. Other rows keep each county record's status and vintage. This section does not calculate a difference or a trend.";
  if (!period || period.startsWith("2023-")) {
    return base;
  }
  return `${base} The selected period ${period} is not applied to these rows.`;
}

export function compareCountyFailureSide(error: unknown): CompareCountySide {
  if (error instanceof InvestigateContractError) {
    if (error.code === "release_mismatch") {
      return {
        message: RELEASE_MISMATCH,
        status: compareCountySideStatuses.releaseMismatch,
      };
    }
    return {
      message: IDENTITY_MISMATCH,
      status: compareCountySideStatuses.failed,
    };
  }
  return {
    message: FAILED_RECORD,
    status: compareCountySideStatuses.failed,
  };
}

function emptyCell(
  reason: "failed" | "missing" | "release_mismatch",
  message: string
): CompareProfileCell {
  return { kind: "empty", message, reason };
}

function sideEmpty(side: CompareCountySide): CompareProfileCell | null {
  switch (side.status) {
    case "ready": {
      return null;
    }
    case "missing": {
      return emptyCell("missing", MISSING_RECORD);
    }
    case "failed": {
      return emptyCell("failed", side.message || FAILED_RECORD);
    }
    case "release_mismatch": {
      return emptyCell("release_mismatch", side.message || RELEASE_MISMATCH);
    }
    default: {
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

function missingField(): CompareProfileCell {
  return emptyCell("missing", MISSING_FIELD);
}

function sourceFor(detail: CountyDetail, key: string): SourceMetadata | null {
  return detail.release.sources.find((source) => source.key === key) ?? null;
}

function provenanceFor(input: {
  detail: CountyDetail;
  observationPeriod: string;
  source: SourceMetadata | null;
  state: GovernedPublishedState;
}): EvidenceObjectModel["provenance"] {
  const sourceFamily = input.source?.label.trim() || "Unavailable";
  const vintage = input.source?.vintage.trim() || null;
  const limitations = [...input.state.limitations];
  return {
    datasetVintage: vintage,
    evidenceType: "Unavailable",
    inspectSummary:
      input.source?.note.trim() || "Source context was not returned.",
    limitations,
    materialCaveat: materialCaveatShort(limitations),
    methodVersion: input.detail.release.methodology_version.trim() || null,
    observationPeriod: input.observationPeriod,
    sourceFamily,
    sourceUrl: input.source?.url.trim() || null,
    technical: {
      methodologyVersion:
        input.detail.release.methodology_version.trim() || null,
      releaseId: input.detail.release.release_id,
      sourceId: input.source?.key ?? null,
    },
  };
}

function evidenceCell(input: {
  claimLabel: string;
  detail: CountyDetail;
  displayValue: string;
  observationPeriod: string;
  source: SourceMetadata | null;
  state: GovernedPublishedState;
  valueNote: string | null;
}): CompareProfileCell {
  return {
    evidence: {
      availability: input.state.availability,
      claimLabel: input.claimLabel,
      displayValue: input.displayValue,
      provenance: provenanceFor(input),
      reasonCode: input.state.reasonCode,
      valueNote: input.valueNote,
    },
    kind: "evidence",
  };
}

function numericCell(input: {
  claimLabel: string;
  detail: CountyDetail;
  observationPeriod: string;
  sourceKey: string;
  value: number | null;
  valueNote: string;
}): CompareProfileCell {
  if (input.value === null || !Number.isFinite(input.value)) {
    return missingField();
  }
  const source = sourceFor(input.detail, input.sourceKey);
  const state = mapPublishedRow({
    claimLabel: input.claimLabel,
    inspectAnchor: `compare-${input.sourceKey}`,
    sourceNote: source?.note,
    subject: { kind: "numeric", value: input.value },
  });
  return evidenceCell({
    claimLabel: input.claimLabel,
    detail: input.detail,
    displayValue: formatGovernedEvidenceValue({
      unit: null,
      value: input.value,
      valueState: state.valueState,
    }),
    observationPeriod: input.observationPeriod,
    source,
    state,
    valueNote: input.valueNote,
  });
}

function statusCell(
  detail: CountyDetail,
  claimLabel: string,
  status: string,
  sourceKey: string
): CompareProfileCell {
  const trimmed = status.trim();
  if (!trimmed) {
    return missingField();
  }
  const source = sourceFor(detail, sourceKey);
  const state = mapPublishedRow({
    claimLabel,
    inspectAnchor: `compare-${sourceKey}`,
    sourceNote: source?.note,
    subject: { kind: "status", status: trimmed },
  });
  const displayValue = formatGovernedEvidenceValue({
    unit: null,
    value: trimmed,
    valueState: state.valueState,
  });
  return evidenceCell({
    claimLabel,
    detail,
    displayValue,
    observationPeriod: "Unavailable",
    source,
    state,
    valueNote:
      displayValue === "Unavailable"
        ? `Published status: ${trimmed.replaceAll("_", " ")}. This is not zero.`
        : null,
  });
}

function scoreCell(
  detail: CountyDetail,
  claimLabel: string,
  value: number
): CompareProfileCell {
  return numericCell({
    claimLabel,
    detail,
    observationPeriod: "Unavailable",
    sourceKey: "score",
    value,
    valueNote: SCORE_NOTE,
  });
}

/**
 * A published incidence floor is usable only when the human status is the
 * published floor and the number is finite and non-negative.
 */
function acceptedIncidenceFloor(detail: CountyDetail): number | null {
  const floor = detail.incidence_floor_2023;
  if (
    detail.human_status === "published_count_floor" &&
    floor !== null &&
    Number.isFinite(floor) &&
    floor >= 0
  ) {
    return floor;
  }
  return null;
}

function recognizedReviewCategory(priority: string): boolean {
  const normalized = priority.toLowerCase();
  return (
    priority.includes("Priority 1") ||
    priority.includes("Priority 2") ||
    normalized.includes("watch") ||
    normalized.includes("lower")
  );
}

function reviewCategoryDisplay(
  priority: string,
  state: GovernedPublishedState
): string {
  if (publishedValueStateRole(state.valueState) === "uncertainty") {
    return formatGovernedEvidenceValue({
      unit: null,
      value: null,
      valueState: state.valueState,
    });
  }
  if (recognizedReviewCategory(priority)) {
    return plainPriority(priority);
  }
  return priority;
}

function compareReviewReasons(
  detail: CountyDetail
): readonly CountyReviewReason[] {
  const reasons = reviewReasonsFor(detail);
  const [human, ...rest] = reasons;
  const incidence = compareIncidenceFloorEvidence(detail);
  const humanText =
    acceptedIncidenceFloor(detail) === null
      ? NO_PUBLISHED_CASE_REASON
      : `The minimum rate supported by the published 2023 county data was ${incidence.displayValue}.`;
  return [
    {
      label: human?.label ?? "Published Lyme case data",
      text: humanText,
    },
    ...rest,
  ];
}

/**
 * Incidence uses the same published-floor rule as the case-count floor.
 * A missing, suppressed, or non-floor status is never rendered as zero.
 */
export function compareIncidenceFloorEvidence(
  detail: CountyDetail
): EvidenceObjectModel {
  const source = sourceFor(detail, "human");
  const floor = acceptedIncidenceFloor(detail);
  const hasFloor = floor !== null;
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
    claimLabel: "Published 2023 human incidence floor",
    inspectAnchor: "compare-incidence-floor",
    sourceNote: source?.note,
    subject: hasFloor
      ? { kind: "numeric", value: floor }
      : { kind: "status", status: missingStatus },
  });
  const displayValue = hasFloor
    ? `${formatGovernedEvidenceValue({
        unit: null,
        value: floor,
        valueState: state.valueState,
      })} cases per 100,000 (published incidence floor)`
    : formatGovernedEvidenceValue({
        unit: null,
        value: null,
        valueState: state.valueState,
      });
  return {
    availability: state.availability,
    claimLabel: "Published 2023 human incidence floor",
    displayValue,
    provenance: provenanceFor({
      detail,
      observationPeriod: "2023",
      source,
      state,
    }),
    reasonCode: state.reasonCode,
    valueNote: hasFloor
      ? FLOOR_RATE_NOTE
      : `Published status: ${detail.human_status.replaceAll("_", " ")}. Missing, suppressed, or unallocated records are not converted to zero.`,
  };
}

function hierarchyById(detail: CountyDetail): Map<string, EvidenceObjectModel> {
  const record = publishedCountyRecordFromDetail(detail);
  const hierarchy = publishedCountyHierarchy({
    measures: [],
    observedMeasureIds: [],
    record,
  });
  const byId = new Map<string, EvidenceObjectModel>();
  for (const row of hierarchy.rows) {
    byId.set(row.measureId, row.evidence);
  }
  if (!byId.has("tick_status") && record.tickStatus.trim()) {
    const cell = statusCell(
      detail,
      "Tick surveillance status",
      record.tickStatus,
      "tick"
    );
    if (cell.kind === "evidence") {
      byId.set("tick_status", cell.evidence);
    }
  }
  return byId;
}

function withValueNote(
  evidence: EvidenceObjectModel,
  note: string
): EvidenceObjectModel {
  const current = evidence.valueNote?.trim();
  return {
    ...evidence,
    valueNote: current ? `${current} ${note}` : note,
  };
}

function hierarchyCell(
  detail: CountyDetail,
  rowId: HierarchyRowId,
  hierarchy: Map<string, EvidenceObjectModel>
): CompareProfileCell {
  const evidence = hierarchy.get(rowId);
  if (!evidence) {
    return missingField();
  }
  switch (rowId) {
    case "rucc_2023": {
      return { evidence: withValueNote(evidence, RUCC_NOTE), kind: "evidence" };
    }
    case "svi_percentile_2022": {
      return { evidence: withValueNote(evidence, SVI_NOTE), kind: "evidence" };
    }
    case "uninsured_percent_2022": {
      return {
        evidence: withValueNote(evidence, UNINSURED_NOTE),
        kind: "evidence",
      };
    }
    case "burgdorferi_status":
    case "pacificus_status":
    case "population_2022":
    case "scapularis_status":
    case "tick_status": {
      return { evidence, kind: "evidence" };
    }
    default: {
      const exhaustive: never = rowId;
      return exhaustive;
    }
  }
}

function readyCell(
  detail: CountyDetail,
  rowId: CompareProfileRowId,
  hierarchy: Map<string, EvidenceObjectModel>
): CompareProfileCell {
  switch (rowId) {
    case "review_category": {
      const priority = detail.priority.trim();
      if (!priority) {
        return missingField();
      }
      const state = mapPublishedRow({
        claimLabel: "Review category",
        inspectAnchor: "compare-review-category",
        subject: { kind: "status", status: priority },
      });
      return evidenceCell({
        claimLabel: "Review category",
        detail,
        displayValue: reviewCategoryDisplay(priority, state),
        observationPeriod: "Unavailable",
        source: null,
        state,
        valueNote: `Published priority label: ${priority}. Not a rank against the other county.`,
      });
    }
    case "review_reasons": {
      return { kind: "reasons", reasons: compareReviewReasons(detail) };
    }
    case "published_review_score": {
      return scoreCell(detail, "Published review score", detail.score.score);
    }
    case "human_weakness": {
      return scoreCell(
        detail,
        "Human-data component",
        detail.score.human_weakness
      );
    }
    case "ecological_component": {
      return scoreCell(detail, "Ecological component", detail.score.ecological);
    }
    case "community_component": {
      return scoreCell(detail, "Community component", detail.score.community);
    }
    case "human_case_floor": {
      return { evidence: reviewHumanFloorEvidence(detail), kind: "evidence" };
    }
    case "incidence_floor": {
      return {
        evidence: compareIncidenceFloorEvidence(detail),
        kind: "evidence",
      };
    }
    case "state_unallocated_2023": {
      return numericCell({
        claimLabel: "State-unallocated human records",
        detail,
        observationPeriod: "2023",
        sourceKey: "human",
        value: detail.state_unallocated_records_2023,
        valueNote: UNALLOCATED_NOTE,
      });
    }
    case "release_limitation": {
      const text = detail.release.limitations.trim();
      return { kind: "text", text: text || NO_LIMITATION };
    }
    case "burgdorferi_status":
    case "pacificus_status":
    case "population_2022":
    case "rucc_2023":
    case "scapularis_status":
    case "svi_percentile_2022":
    case "tick_status":
    case "uninsured_percent_2022": {
      return hierarchyCell(detail, rowId, hierarchy);
    }
    default: {
      const exhaustive: never = rowId;
      return exhaustive;
    }
  }
}

function cellsFor(
  side: CompareCountySide,
  rowId: CompareProfileRowId,
  hierarchy: Map<string, EvidenceObjectModel> | null
): CompareProfileCell {
  const blocked = sideEmpty(side);
  if (blocked) {
    return blocked;
  }
  if (side.status !== "ready" || !hierarchy) {
    return emptyCell("failed", FAILED_RECORD);
  }
  return readyCell(side.detail, rowId, hierarchy);
}

export function alignCompareCountyProfiles(input: {
  left: CompareCountySide;
  leftFips: string;
  right: CompareCountySide;
  rightFips: string;
}): CompareProfileAlignment {
  const leftHierarchy =
    input.left.status === "ready" ? hierarchyById(input.left.detail) : null;
  const rightHierarchy =
    input.right.status === "ready" ? hierarchyById(input.right.detail) : null;
  const rows: CompareProfileRow[] = PROFILE_ROW_IDS.map((id) => ({
    id,
    label: ROW_LABELS[id],
    left: cellsFor(input.left, id, leftHierarchy),
    right: cellsFor(input.right, id, rightHierarchy),
  }));
  return {
    leftFips: input.leftFips,
    recordsReady:
      input.left.status === "ready" && input.right.status === "ready",
    releaseMismatch:
      input.left.status === "release_mismatch" ||
      input.right.status === "release_mismatch",
    retryable:
      input.left.status === "failed" || input.right.status === "failed",
    rightFips: input.rightFips,
    rows,
  };
}
