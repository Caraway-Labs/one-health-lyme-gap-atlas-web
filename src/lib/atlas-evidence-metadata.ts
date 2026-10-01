import type { AtlasMetadata } from "@/generated/models";
import type { SourceMetadata } from "@/generated/models/sourceMetadata";

const RELEASE_ASSEMBLY_DATE =
  /^(?:governed|alpha)-(?<assemblyDate>\d{4}-\d{2}-\d{2})\b/;

function extractYearTokens(vintage: string): number[] {
  const shortRange = vintage.match(/(?<startYear>\d{4})\s*[–-]\s*(?<endYear>\d{2,4})/);
  if (shortRange?.groups) {
    const startYear = Number.parseInt(shortRange.groups.startYear, 10);
    let endYear = Number.parseInt(shortRange.groups.endYear, 10);
    if (endYear < 100) {
      endYear = Math.floor(startYear / 100) * 100 + endYear;
    }
    return [startYear, endYear];
  }
  const matches = vintage.match(/\d{4}/g);
  return matches ? matches.map((year) => Number.parseInt(year, 10)) : [];
}

export function formatAtlasTimestamp(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "Unavailable";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatUtcCalendarDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "Unavailable";
  }
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function describeReleaseAssembly(releaseId: string): string {
  if (!releaseId.trim()) {
    return "Governed county release";
  }
  const match = RELEASE_ASSEMBLY_DATE.exec(releaseId);
  if (!match?.groups?.assemblyDate) {
    return "Governed county release";
  }
  const assemblyDate = formatUtcCalendarDate(match.groups.assemblyDate);
  if (assemblyDate === "Unavailable") {
    return "Governed county release";
  }
  return `Governed county release assembled ${assemblyDate}`;
}

export function describeMethodologyVersion(version: string): string {
  if (!version.trim()) {
    return "Unavailable";
  }
  if (version.startsWith("semantic-")) {
    return "Semantic scoring methodology";
  }
  if (version.startsWith("alpha-")) {
    return "Deterministic scoring methodology";
  }
  return "County scoring methodology";
}

export function summarizeSourceVintages(
  sources: readonly SourceMetadata[]
): string {
  if (sources.length === 0) {
    return "Unavailable";
  }
  const years = sources.flatMap((source) => extractYearTokens(source.vintage));
  if (years.length === 0) {
    return sources.map((source) => source.vintage).join(", ");
  }
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  if (minYear === maxYear) {
    return String(minYear);
  }
  if (Math.floor(minYear / 100) === Math.floor(maxYear / 100)) {
    return `${minYear}–${String(maxYear).slice(2)}`;
  }
  return `${minYear}–${maxYear}`;
}

export function formatEvidenceScope(scope: string): string {
  return scope.trim() ? scope : "Unavailable";
}

export function formatEvidenceSnapshotSummary(metadata: AtlasMetadata): string {
  const release = describeReleaseAssembly(metadata.release_id);
  const periods = summarizeSourceVintages(metadata.sources);
  const methodology = describeMethodologyVersion(metadata.methodology_version);
  const scope = formatEvidenceScope(metadata.scope);
  return `${release}. Evidence scope: ${scope}. Source periods ${periods}. ${methodology}.`;
}
