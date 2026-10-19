import type { CountyDetail, CountyScoreSummary } from "@/generated/models";

export const EVIDENCE_VIEWS = new Set([
  "all",
  "ecological",
  "human",
  "complete",
]);

export type EvidenceView = "all" | "ecological" | "human" | "complete";

/**
 * `evidence_completeness` is a whole percent of six scored inputs.
 * Five of six rounds to 83. A threshold of 5 would treat that percent as a
 * field count and let low-percent counties through “Most data fields available”.
 */
export const MOST_DATA_FIELDS_COMPLETENESS_PERCENT = 83;

export interface ScoreSettings {
  ecological_share: number;
  low_incidence_breakpoint: number;
  missing_human_weakness: number;
}

export const REVIEW_REASON_LABELS = [
  "Published Lyme case data",
  "Tick presence",
  "Lyme bacterium detection",
] as const;

export interface CountyReviewReason {
  label: string;
  text: string;
}

export type PriorityTone = "urgent" | "review" | "watch" | "lower";

export function priorityTone(priority: string): PriorityTone {
  if (priority.includes("Priority 1")) {
    return "urgent";
  }
  if (priority.includes("Priority 2")) {
    return "review";
  }
  if (priority.toLowerCase().includes("watch")) {
    return "watch";
  }
  return "lower";
}

export function plainPriority(priority: string) {
  if (priority.includes("Priority 1")) {
    return "Highest review priority";
  }
  if (priority.includes("Priority 2")) {
    return "Moderate review priority";
  }
  if (priority.toLowerCase().includes("watch")) {
    return "Monitor for changes";
  }
  return "Lower review priority";
}

const NUMBERED_REVIEW_CATEGORY = /(?:^|\s)Priority (?<number>\d+)\b/g;
const PRIORITY_1_CATEGORY = /(?:^|\s)Priority 1\b/;
const PRIORITY_2_CATEGORY = /(?:^|\s)Priority 2\b/;
const WATCH_CATEGORY = /(?:^|\s)watch(?:\s|$)/i;
const LOWER_CATEGORY = /(?:^|\s)lower(?:\s|$)/i;

function hasUnfamiliarNumberedCategory(priority: string): boolean {
  NUMBERED_REVIEW_CATEGORY.lastIndex = 0;
  for (const match of priority.matchAll(NUMBERED_REVIEW_CATEGORY)) {
    const number = match.groups?.number;
    if (number !== "1" && number !== "2") {
      return true;
    }
  }
  return false;
}

/**
 * The four review categories a priority badge may name.
 * Unfamiliar numbers, including "Priority 10", and any other published
 * text stay null so callers do not relabel them as lower priority.
 */
export function recognizedPlainPriority(
  priority: string
):
  | "Highest review priority"
  | "Lower review priority"
  | "Moderate review priority"
  | "Monitor for changes"
  | null {
  if (hasUnfamiliarNumberedCategory(priority)) {
    return null;
  }
  if (PRIORITY_1_CATEGORY.test(priority)) {
    return "Highest review priority";
  }
  if (PRIORITY_2_CATEGORY.test(priority)) {
    return "Moderate review priority";
  }
  if (WATCH_CATEGORY.test(priority)) {
    return "Monitor for changes";
  }
  if (LOWER_CATEGORY.test(priority)) {
    return "Lower review priority";
  }
  return null;
}

export function numericParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
  step = 1
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) &&
    parsed >= min &&
    parsed <= max &&
    parsed % step === 0
    ? parsed
    : fallback;
}

export function matchesEvidence(
  county: Pick<
    CountyScoreSummary,
    | "burgdorferi_status"
    | "evidence_completeness"
    | "human_status"
    | "tick_status"
  >,
  evidence: EvidenceView
) {
  if (evidence === "ecological") {
    return (
      county.tick_status !== "No records" ||
      county.burgdorferi_status === "Present"
    );
  }
  if (evidence === "human") {
    return county.human_status === "published_count_floor";
  }
  if (evidence === "complete") {
    return (
      county.evidence_completeness >= MOST_DATA_FIELDS_COMPLETENESS_PERCENT
    );
  }
  return true;
}

export function reviewReasonsFor(county: CountyDetail): CountyReviewReason[] {
  const reasons = [
    county.human_status === "published_count_floor"
      ? `The minimum rate supported by the published 2023 county data was ${county.incidence_floor_2023?.toFixed(1) ?? "unavailable"} cases per 100,000.`
      : "No county-level 2023 Lyme case count was published. This may reflect zero cases, privacy suppression, or other reporting limitations; the score treats missing data not as zero cases.",
    county.tick_status === "No records"
      ? "The published tick table has no county record; this does not establish tick absence."
      : `Ixodes evidence is classified as ${county.tick_status.toLowerCase()} in the published county table.`,
    county.burgdorferi_status === "Present"
      ? "The bacterium that causes Lyme disease has been detected in locally collected, host-seeking blacklegged ticks."
      : "The published pathogen table has no county record; this does not establish pathogen absence.",
  ];
  return reasons.map((text, index) => ({
    label: REVIEW_REASON_LABELS[index],
    text,
  }));
}

export function reasonsFor(county: CountyDetail): string[] {
  return reviewReasonsFor(county).map((reason) => reason.text);
}

export function uncertaintyCuesFor(county: CountyDetail): string[] {
  const cues: string[] = [];

  if (county.human_status === "published_count_floor") {
    if (county.case_count_floor_2023 === 0) {
      cues.push(
        "The published county-linked case count is zero for this release. That observed zero is different from an unavailable or suppressed record."
      );
    } else {
      cues.push(
        "The human surveillance value is a privacy-protected published floor, not an official complete county incidence estimate."
      );
    }
  } else {
    cues.push(
      "A county-level published Lyme case count is unavailable. This may reflect zero cases, suppression, unallocated records, or reporting and publication limits; it is not treated as zero by default."
    );
  }

  if (county.tick_status === "No records") {
    cues.push(
      "The published tick table has no county record. No record does not establish that ticks are absent."
    );
  }

  if (county.burgdorferi_status === "No records") {
    cues.push(
      "The published pathogen table has no county record. No record does not establish that the pathogen is absent."
    );
  }

  if (county.evidence_completeness < 100) {
    cues.push(
      `${county.evidence_completeness}% of the six scored inputs are marked available in this release; incomplete inputs can change what a county review can establish.`
    );
  }

  if (
    county.state_unallocated_records_2023 != null &&
    county.state_unallocated_records_2023 > 0
  ) {
    cues.push(
      `${county.state_unallocated_records_2023} published 2023 human-surveillance record${county.state_unallocated_records_2023 === 1 ? " was" : "s were"} not allocated to a county in this release.`
    );
  }

  const unavailableContext = [
    county.svi_percentile == null ? "social vulnerability" : null,
    county.uninsured_percent == null ? "insurance access" : null,
    county.rucc_2023 == null ? "rurality" : null,
  ].filter((value): value is string => value !== null);
  if (unavailableContext.length > 0) {
    cues.push(
      `Context unavailable for this county: ${unavailableContext.join(", ")}.`
    );
  }

  return cues;
}

/**
 * Suggested follow-up wording for the six review-priority colors.
 * Color order and scoring stay as released. These phrases are review cues,
 * not a diagnosis, individual risk, transmission, or outbreak status.
 */
export const SUGGESTED_FOLLOW_UP_BY_COLOR = {
  "#a9d2db": "Continue routine review",
  "#55a8a3": "Monitor the pattern",
  "#87b982": "Verify with local information",
  "#efc64a": "Conduct targeted follow-up",
  "#f49a32": "Coordinate a local assessment",
  "#e9602b": "Prioritize targeted follow-up",
} as const;

export type ReviewPriorityColor = keyof typeof SUGGESTED_FOLLOW_UP_BY_COLOR;

/**
 * Published score colors from lowest to highest band. Same values as
 * SUGGESTED_FOLLOW_UP_BY_COLOR so follow-up content can reuse the palette.
 */
export const REVIEW_SCORE_RAMP_COLORS = [
  "#a9d2db",
  "#55a8a3",
  "#87b982",
  "#efc64a",
  "#f49a32",
  "#e9602b",
] as const satisfies readonly ReviewPriorityColor[];

const DEFAULT_REVIEW_PRIORITY_COLOR: ReviewPriorityColor = "#55a8a3";

export function suggestedFollowUpForColor(color: string): string {
  const normalized = color.toLowerCase();
  if (isReviewPriorityColor(normalized)) {
    return SUGGESTED_FOLLOW_UP_BY_COLOR[normalized];
  }
  return SUGGESTED_FOLLOW_UP_BY_COLOR[DEFAULT_REVIEW_PRIORITY_COLOR];
}

function isReviewPriorityColor(color: string): color is ReviewPriorityColor {
  return Object.hasOwn(SUGGESTED_FOLLOW_UP_BY_COLOR, color);
}
