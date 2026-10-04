export function formatObservationPeriod(
  periodStart: string,
  periodEnd: string
): string {
  const start = periodStart.trim();
  const end = periodEnd.trim();
  if (!(start && end)) {
    return "Unavailable";
  }

  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (/^\d{4}$/.test(startYear) && startYear === endYear) {
    return startYear;
  }
  if (/^\d{4}$/.test(startYear) && /^\d{4}$/.test(endYear)) {
    return `${startYear}–${endYear}`;
  }
  return `${start} – ${end}`;
}

export function humanizeEvidenceType(resourceType: string): string {
  const normalized = resourceType.trim().replaceAll("_", " ");
  if (!normalized) {
    return "Unavailable";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
