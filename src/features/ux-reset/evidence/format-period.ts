import { formatUtcCalendarDate } from "@/lib/atlas-evidence-metadata";

const ISO_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

function parseIsoDate(
  isoDate: string
): { year: string; month: string; day: string } | null {
  const match = ISO_DATE.exec(isoDate.trim());
  if (!match?.groups) {
    return null;
  }
  const { day, month, year } = match.groups;
  if (!(day && month && year)) {
    return null;
  }
  return { day, month, year };
}

function isFullCalendarYearInterval(
  periodStart: string,
  periodEnd: string
): boolean {
  const start = parseIsoDate(periodStart);
  const end = parseIsoDate(periodEnd);
  if (!(start && end)) {
    return false;
  }
  return (
    start.year === end.year &&
    start.month === "01" &&
    start.day === "01" &&
    end.month === "12" &&
    end.day === "31"
  );
}

function formatGrainSuffix(temporalGrain: string | null | undefined): string {
  const grain = temporalGrain?.trim();
  if (!grain) {
    return "";
  }
  if (grain.toLowerCase() === "annual") {
    return "";
  }
  return ` (${grain.replaceAll("_", " ")})`;
}

export function formatObservationPeriod(
  periodStart: string,
  periodEnd: string,
  temporalGrain?: string | null
): string {
  const start = periodStart.trim();
  const end = periodEnd.trim();
  if (!(start && end)) {
    return "Unavailable";
  }

  if (isFullCalendarYearInterval(start, end)) {
    const year = parseIsoDate(start)?.year;
    return year ?? "Unavailable";
  }

  const grainSuffix = formatGrainSuffix(temporalGrain);
  const startParts = parseIsoDate(start);
  const endParts = parseIsoDate(end);

  if (startParts && endParts && start === end) {
    const formatted = formatUtcCalendarDate(start);
    return formatted === "Unavailable" ? start : `${formatted}${grainSuffix}`;
  }

  if (startParts && endParts) {
    const formattedStart = formatUtcCalendarDate(start);
    const formattedEnd = formatUtcCalendarDate(end);
    if (formattedStart !== "Unavailable" && formattedEnd !== "Unavailable") {
      return `${formattedStart} – ${formattedEnd}${grainSuffix}`;
    }
  }

  return `${start} – ${end}${grainSuffix}`;
}

/** Formats governed `Measure.measure_type` for display (not API resource identity). */
export function formatGovernedMeasureType(measureType: string): string {
  const normalized = measureType.trim().replaceAll("_", " ");
  if (!normalized) {
    return "Unavailable";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
