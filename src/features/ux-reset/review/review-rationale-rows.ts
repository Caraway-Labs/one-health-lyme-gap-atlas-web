import {
  formatPublishedCaseCount,
  formatPublishedIncidenceRate,
  MINIMUM_REPORTED_CASES_LABEL,
  MINIMUM_REPORTED_INCIDENCE_LABEL,
  publishedHumanFloorValue,
  PUBLISHED_LYME_CASE_YEAR,
} from "@/features/ux-reset/review/published-human-case-copy";
import {
  RUCC_2023_COMPACT_CLASSIFICATIONS,
  type ReviewRationaleGroup,
} from "@/features/ux-reset/review/review-rationale";
import type { CountyDetail } from "@/generated/models";

export type ReviewRationaleCompactRow = {
  label: string;
  value: string;
  valueTone?: "neutral" | "default";
};

export type ReviewRationaleMeasureView = {
  group: ReviewRationaleGroup;
  headerHelp?: string;
  italicScientificNameInHeader?: boolean;
  label: string;
  number: number;
  rows: readonly ReviewRationaleCompactRow[];
  secondaryNote?: string;
};

const POPULATION_CONTEXT_YEAR = "2022";
const RUCC_YEAR = "2023";

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function ordinalSuffix(rank: number): "nd" | "rd" | "st" | "th" {
  const absolute = Math.abs(Math.trunc(rank));
  const hundred = absolute % 100;
  if (hundred >= 11 && hundred <= 13) {
    return "th";
  }
  const ten = absolute % 10;
  if (ten === 1) {
    return "st";
  }
  if (ten === 2) {
    return "nd";
  }
  if (ten === 3) {
    return "rd";
  }
  return "th";
}

/** CountyDetail.svi_percentile is a 0–1 fraction. */
export function formatReviewSviPercentile(fraction: number): string {
  const percentile = Math.round(fraction * 100);
  return `${percentile}${ordinalSuffix(percentile)}`;
}

function publishedStatusLabel(raw: string): string {
  const trimmed = raw.trim().replaceAll("_", " ");
  if (!trimmed) {
    return "Unavailable";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function blankStatus(status: string | null): boolean {
  return status === null || status.trim() === "";
}

function humanCountyRecordValue(detail: CountyDetail): string {
  const status = detail.human_status.trim().toLowerCase();
  if (status === "suppressed") {
    return "Suppressed";
  }
  if (status === "missing") {
    return "Missing";
  }
  if (status === "no_county_linked_record") {
    return "Unavailable";
  }
  if (status === "published_count_floor") {
    return "Unavailable";
  }
  return "Unavailable";
}

function lymeDiseaseRows(detail: CountyDetail): ReviewRationaleCompactRow[] {
  const count = publishedHumanFloorValue(
    detail.human_status,
    detail.case_count_floor_2023
  );
  const rate = publishedHumanFloorValue(
    detail.human_status,
    detail.incidence_floor_2023
  );
  const rows: ReviewRationaleCompactRow[] = [];
  if (count !== null) {
    rows.push({
      label: MINIMUM_REPORTED_CASES_LABEL,
      value: `At least ${formatPublishedCaseCount(count)}`,
    });
  }
  if (rate !== null) {
    rows.push({
      label: MINIMUM_REPORTED_INCIDENCE_LABEL,
      value: `At least ${formatPublishedIncidenceRate(rate)} per 100,000`,
    });
  }
  if (count === null && rate === null) {
    rows.push({
      label: "County record",
      value: humanCountyRecordValue(detail),
      valueTone: "neutral",
    });
  }
  rows.push({ label: "Year", value: PUBLISHED_LYME_CASE_YEAR });
  return rows;
}

function tickStatusRow(
  label: string,
  status: string | null
): ReviewRationaleCompactRow {
  const blank = blankStatus(status);
  return {
    label,
    value: blank ? "Unavailable" : publishedStatusLabel(status ?? ""),
    valueTone: blank ? "neutral" : "default",
  };
}

function tickPresenceRows(detail: CountyDetail): ReviewRationaleCompactRow[] {
  const rows = [
    tickStatusRow("Ixodes scapularis", detail.scapularis_status),
    tickStatusRow("Ixodes pacificus", detail.pacificus_status),
  ];
  // Species fields can be unpublished while tick_status still carries the
  // county aggregate. Keep both species rows, and add that aggregate only
  // when neither species has its own published status.
  if (
    blankStatus(detail.scapularis_status) &&
    blankStatus(detail.pacificus_status) &&
    !blankStatus(detail.tick_status)
  ) {
    rows.push(tickStatusRow("County record", detail.tick_status));
  }
  return rows;
}

function pathogenDetectionRows(
  detail: CountyDetail
): ReviewRationaleCompactRow[] {
  const raw = detail.burgdorferi_status.trim();
  const lower = raw.toLowerCase();
  let value: string;
  if (!raw || lower === "missing" || lower === "unavailable") {
    value = "Unavailable";
  } else if (lower === "no_county_linked_record") {
    value = "Unavailable";
  } else {
    value = publishedStatusLabel(raw);
  }
  return [
    {
      label: "County detection record",
      value,
      valueTone: value === "Unavailable" ? "neutral" : "default",
    },
  ];
}

function socialVulnerabilityRows(
  detail: CountyDetail
): ReviewRationaleCompactRow[] {
  const rows: ReviewRationaleCompactRow[] = [];
  if (finite(detail.svi_percentile)) {
    rows.push({
      label: "Percentile",
      value: formatReviewSviPercentile(detail.svi_percentile),
    });
  } else {
    rows.push({
      label: "Percentile",
      value: "Unavailable",
      valueTone: "neutral",
    });
  }
  rows.push({ label: "Year", value: POPULATION_CONTEXT_YEAR });
  return rows;
}

function uninsuredRows(detail: CountyDetail): ReviewRationaleCompactRow[] {
  const rows: ReviewRationaleCompactRow[] = [];
  if (finite(detail.uninsured_percent)) {
    const percent = detail.uninsured_percent.toLocaleString("en-US", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    rows.push({ label: "Uninsured", value: `${percent}%` });
    rows.push({ label: "Year", value: POPULATION_CONTEXT_YEAR });
    return rows;
  }
  rows.push({
    label: "Uninsured",
    value: "Unavailable",
    valueTone: "neutral",
  });
  if (finite(detail.uninsured_percentile)) {
    rows.push({
      label: "Percentile",
      value: formatReviewSviPercentile(detail.uninsured_percentile),
    });
  }
  return rows;
}

function ruralityRows(detail: CountyDetail): ReviewRationaleCompactRow[] {
  if (!finite(detail.rucc_2023)) {
    return [
      {
        label: "Classification",
        value: "Unavailable",
        valueTone: "neutral",
      },
      { label: "RUCC", value: "Unavailable", valueTone: "neutral" },
      { label: "Year", value: RUCC_YEAR },
    ];
  }
  const code = detail.rucc_2023;
  const compact = RUCC_2023_COMPACT_CLASSIFICATIONS[code];
  return [
    {
      label: "Classification",
      value: compact?.title ?? "Unavailable",
      valueTone: compact ? "default" : "neutral",
    },
    { label: "RUCC", value: String(code) },
    { label: "Year", value: RUCC_YEAR },
  ];
}

function ruralitySecondaryNote(detail: CountyDetail): string | undefined {
  if (!finite(detail.rucc_2023)) {
    return undefined;
  }
  return RUCC_2023_COMPACT_CLASSIFICATIONS[detail.rucc_2023]?.detail;
}

export function reviewRationaleMeasures(
  detail: CountyDetail
): ReviewRationaleMeasureView[] {
  return [
    {
      group: "surveillance",
      label: "Reported Lyme disease",
      number: 1,
      rows: lymeDiseaseRows(detail),
    },
    {
      group: "surveillance",
      label: "Tick presence",
      number: 2,
      rows: tickPresenceRows(detail),
    },
    {
      group: "surveillance",
      italicScientificNameInHeader: true,
      label: "Borrelia burgdorferi detection",
      number: 3,
      rows: pathogenDetectionRows(detail),
    },
    {
      group: "community",
      label: "Social vulnerability",
      number: 4,
      rows: socialVulnerabilityRows(detail),
    },
    {
      group: "community",
      label: "Uninsured population",
      number: 5,
      rows: uninsuredRows(detail),
    },
    {
      group: "community",
      label: "Rurality",
      number: 6,
      rows: ruralityRows(detail),
      secondaryNote: ruralitySecondaryNote(detail),
    },
  ];
}
