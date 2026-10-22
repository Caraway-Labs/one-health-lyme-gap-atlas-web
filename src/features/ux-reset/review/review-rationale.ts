import { publishedLymeCasePresentation } from "@/features/ux-reset/review/published-human-case-copy";
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

/** Concise Explorer county-card labels derived from `RUCC_2023_LABELS`. */
export const RUCC_2023_COMPACT_CLASSIFICATIONS: Record<
  number,
  { detail: string; title: string }
> = {
  1: {
    detail: "Metro population: 1 million or more",
    title: "Large metro",
  },
  2: {
    detail: "Metro population: 250,000 to 1 million",
    title: "Medium metro",
  },
  3: {
    detail: "Metro population: fewer than 250,000",
    title: "Small metro",
  },
  4: {
    detail: "Urban population of 20,000 or more, adjacent to a metro area",
    title: "Urban, metro adjacent",
  },
  5: {
    detail: "Urban population of 20,000 or more, not adjacent to a metro area",
    title: "Urban, not metro adjacent",
  },
  6: {
    detail: "Urban population of 2,500 to 19,999, adjacent to a metro area",
    title: "Small urban, metro adjacent",
  },
  7: {
    detail: "Urban population of 2,500 to 19,999, not adjacent to a metro area",
    title: "Small urban, not metro adjacent",
  },
  8: {
    detail:
      "Completely rural or urban population below 2,500, adjacent to a metro area",
    title: "Rural, metro adjacent",
  },
  9: {
    detail:
      "Completely rural or urban population below 2,500, not adjacent to a metro area",
    title: "Rural, not metro adjacent",
  },
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

function humanSentence(detail: CountyDetail): string {
  return publishedLymeCasePresentation(detail).text;
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
      label: "Reported Lyme disease",
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
      label: "Uninsured population",
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
