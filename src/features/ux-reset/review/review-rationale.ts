import type { CountyDetail } from "@/generated/models";

export type ReviewRationaleGroup = "surveillance" | "community";

export interface ReviewRationaleItem {
  group: ReviewRationaleGroup;
  label: string;
  number: number;
  text: string;
}

export const RUCC_2023_LABELS: Record<number, string> = {
  1: "metro area of 1 million or more",
  2: "metro area of 250,000 to 1 million",
  3: "metro area of fewer than 250,000",
  4: "urban population of 20,000 or more, adjacent to a metro area",
  5: "urban population of 20,000 or more, not adjacent to a metro area",
  6: "urban population of 2,500 to 19,999, adjacent to a metro area",
  7: "urban population of 2,500 to 19,999, not adjacent to a metro area",
  8: "completely rural or less than 2,500 urban population, adjacent to a metro area",
  9: "completely rural or less than 2,500 urban population, not adjacent to a metro area",
};

const DOCUMENTED_TICK = new Set(["established", "reported"]);

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function percentLabel(value: number): string {
  const shown = value >= 0 && value <= 1 ? value * 100 : value;
  return shown.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function tickSentence(detail: CountyDetail): string {
  const species = [
    detail.scapularis_status &&
    DOCUMENTED_TICK.has(detail.scapularis_status.trim().toLowerCase())
      ? `Ixodes scapularis is ${detail.scapularis_status.toLowerCase()}`
      : null,
    detail.pacificus_status &&
    DOCUMENTED_TICK.has(detail.pacificus_status.trim().toLowerCase())
      ? `Ixodes pacificus is ${detail.pacificus_status.toLowerCase()}`
      : null,
  ].filter((value): value is string => value !== null);
  const statuses = [
    detail.tick_status,
    detail.scapularis_status,
    detail.pacificus_status,
  ];
  const documented = statuses.some(
    (value) => value !== null && DOCUMENTED_TICK.has(value.trim().toLowerCase())
  );
  if (documented) {
    const speciesNote = species.length > 0 ? ` ${species.join("; ")}.` : "";
    return `Published tick surveillance classifies this county as ${detail.tick_status.toLowerCase()}.${speciesNote}`;
  }
  const missing = statuses.every(
    (value) =>
      value === null ||
      value.trim() === "" ||
      value.trim().toLowerCase() === "no records"
  );
  if (missing) {
    return "The published tick table has no county record.";
  }
  return `The published tick status is ${detail.tick_status}.`;
}

function pathogenSentence(detail: CountyDetail): string {
  const status = detail.burgdorferi_status.trim().toLowerCase();
  if (status === "present") {
    return "Borrelia burgdorferi was detected in tested ticks in the published surveillance data.";
  }
  if (status === "no records" || status === "" || status === "unknown") {
    return "No county-level B. burgdorferi detection record is available.";
  }
  return `The published B. burgdorferi status is ${detail.burgdorferi_status}.`;
}

function publishedFloorCount(detail: CountyDetail): number | null {
  if (
    detail.human_status !== "published_count_floor" ||
    !finite(detail.case_count_floor_2023) ||
    detail.case_count_floor_2023 < 0
  ) {
    return null;
  }
  return detail.case_count_floor_2023;
}

function publishedFloorRate(detail: CountyDetail): string | null {
  if (
    detail.human_status !== "published_count_floor" ||
    !finite(detail.incidence_floor_2023)
  ) {
    return null;
  }
  return detail.incidence_floor_2023.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function humanSentence(detail: CountyDetail): string {
  const status = detail.human_status.trim().toLowerCase();
  if (status === "suppressed") {
    return "The 2023 county Lyme case count is suppressed.";
  }
  if (status === "missing") {
    return "The 2023 county Lyme case count is missing.";
  }
  if (status === "no_county_linked_record") {
    return "No county-linked 2023 Lyme case record is available.";
  }
  const count = publishedFloorCount(detail);
  const rate = publishedFloorRate(detail);
  if (count === null && rate === null) {
    if (status === "published_count_floor") {
      return "A 2023 case-count floor was published, but the count and rate are unavailable.";
    }
    return "No county-level 2023 Lyme case count is available.";
  }
  const parts: string[] = [];
  if (count !== null) {
    parts.push(
      `The published 2023 case-count floor is ${count.toLocaleString("en-US")}.`
    );
  }
  if (rate !== null) {
    parts.push(`The published 2023 minimum rate is ${rate} cases per 100,000.`);
  }
  return parts.join(" ");
}

function sviSentence(detail: CountyDetail): string {
  if (!finite(detail.svi_percentile)) {
    return "No county-level 2022 social vulnerability percentile was published.";
  }
  return `The 2022 social vulnerability percentile is ${percentLabel(detail.svi_percentile)}.`;
}

function insuranceSentence(detail: CountyDetail): string {
  if (finite(detail.uninsured_percent)) {
    const percent = detail.uninsured_percent.toLocaleString("en-US", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    return `The published percentage uninsured is ${percent}%.`;
  }
  if (finite(detail.uninsured_percentile)) {
    return `The published uninsured percentile is ${percentLabel(detail.uninsured_percentile)}. The percentage uninsured was not returned, so no percent is shown.`;
  }
  return "No county-level health insurance coverage value was published.";
}

function ruralSentence(detail: CountyDetail): string {
  if (!finite(detail.rucc_2023)) {
    return "No 2023 rural-urban classification was published for this county.";
  }
  const code = detail.rucc_2023;
  const label = RUCC_2023_LABELS[code];
  const named = label
    ? `USDA Rural-Urban Continuum Code ${code} (2023): ${label}.`
    : `USDA Rural-Urban Continuum Code ${code} (2023) has no approved plain-language label in Atlas.`;
  return `${named} Code 1 is the most metropolitan and 9 is the most rural.`;
}

export function reviewRationaleFor(
  detail: CountyDetail
): ReviewRationaleItem[] {
  return [
    {
      group: "surveillance",
      label: "Published Lyme case data",
      number: 1,
      text: humanSentence(detail),
    },
    {
      group: "surveillance",
      label: "Tick presence",
      number: 2,
      text: tickSentence(detail),
    },
    {
      group: "surveillance",
      label: "Borrelia burgdorferi detection",
      number: 3,
      text: pathogenSentence(detail),
    },
    {
      group: "community",
      label: "Social vulnerability",
      number: 4,
      text: sviSentence(detail),
    },
    {
      group: "community",
      label: "Health insurance coverage",
      number: 5,
      text: insuranceSentence(detail),
    },
    {
      group: "community",
      label: "Rurality",
      number: 6,
      text: ruralSentence(detail),
    },
  ];
}
