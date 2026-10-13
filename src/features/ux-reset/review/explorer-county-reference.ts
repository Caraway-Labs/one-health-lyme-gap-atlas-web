import {
  isLower48ReviewScope,
  stateFipsPrefix,
} from "@/features/ux-reset/review/review-state-fips";
import { type EvidenceView, matchesEvidence } from "@/lib/atlas-ui";
import { isCountyFips } from "@/lib/county-geography";

/** Published county identity plus the status fields the existing evidence filter reads. */
export type ExplorerCountyReference = {
  burgdorferiStatus: string;
  county: string;
  evidenceCompleteness: number;
  fips: string;
  humanStatus: string;
  state: string;
  stateName: string;
  tickStatus: string;
};

type ScoreReferenceCounty = {
  burgdorferi_status?: string;
  county?: string;
  evidence_completeness?: number;
  fips?: string;
  human_status?: string;
  state?: string;
  state_name?: string;
  tick_status?: string;
};

export const EXPLORER_AVAILABLE_DATA_OPTIONS = [
  { label: "All included counties", value: "all" },
  { label: "Tick or pathogen evidence available", value: "ecological" },
  { label: "Published Lyme case count available", value: "human" },
  { label: "Most data fields available", value: "complete" },
] as const satisfies readonly { label: string; value: EvidenceView }[];

export const EXPLORER_COUNTY_EXPORT_NOTE =
  "Download includes counties matching the current State, county name or FIPS search, and Available data filters. Columns are five-digit FIPS, county name, and state. Scores are not included.";

const COUNTY_OPTION_LIMIT = 8;
const CSV_NEWLINE = "\r\n";

/**
 * Five-digit county FIPS, including a leading zero. Shorter digit strings are
 * padded. Anything else is omitted rather than invented.
 */
export function csvFiveDigitFips(fips: string): string | null {
  const trimmed = fips.trim();
  if (/^\d{5}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{1,4}$/.test(trimmed)) {
    return trimmed.padStart(5, "0");
  }
  return null;
}

function csvCell(value: string): string {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function supportedStateAndFips(state: string, fips: string): boolean {
  if (!isLower48ReviewScope(state)) {
    return false;
  }
  const prefix = stateFipsPrefix(state);
  return Boolean(prefix && fips.startsWith(prefix));
}

/**
 * County reference rows from the published score list. Score, priority, and
 * color are not copied. Alaska and Hawaii are omitted.
 */
export function countyReferenceFromScoreSummaries(
  counties: readonly ScoreReferenceCounty[]
): ExplorerCountyReference[] {
  const byFips = new Map<string, ExplorerCountyReference>();
  for (const county of counties) {
    const fips = csvFiveDigitFips(county.fips ?? "");
    const state = county.state?.trim().toUpperCase() ?? "";
    if (
      !fips ||
      !isCountyFips(fips) ||
      !supportedStateAndFips(state, fips) ||
      byFips.has(fips)
    ) {
      continue;
    }
    const humanStatus = county.human_status?.trim() ?? "";
    const tickStatus = county.tick_status?.trim() ?? "";
    const burgdorferiStatus = county.burgdorferi_status?.trim() ?? "";
    const evidenceCompleteness = county.evidence_completeness;
    if (
      !humanStatus ||
      !tickStatus ||
      !burgdorferiStatus ||
      typeof evidenceCompleteness !== "number" ||
      !Number.isInteger(evidenceCompleteness)
    ) {
      continue;
    }
    byFips.set(fips, {
      burgdorferiStatus,
      county: county.county?.trim() || `County ${fips}`,
      evidenceCompleteness,
      fips,
      humanStatus,
      state,
      stateName: county.state_name?.trim() || state,
      tickStatus,
    });
  }
  return [...byFips.values()].toSorted(
    (left, right) =>
      left.state.localeCompare(right.state) ||
      left.county.localeCompare(right.county, "en") ||
      left.fips.localeCompare(right.fips)
  );
}

export function countyReferenceMatchesAvailableData(
  county: ExplorerCountyReference,
  evidence: EvidenceView
): boolean {
  return matchesEvidence(
    {
      burgdorferi_status: county.burgdorferiStatus,
      evidence_completeness: county.evidenceCompleteness,
      human_status: county.humanStatus,
      tick_status: county.tickStatus,
    },
    evidence
  );
}

export function countyReferenceMatchesQuery(
  county: Pick<ExplorerCountyReference, "county" | "fips">,
  query: string
): boolean {
  const text = query.trim().toLowerCase();
  if (text.length === 0) {
    return true;
  }
  const name = county.county.trim().toLowerCase();
  const fips = county.fips.trim();
  if (name.includes(text) || fips.includes(text)) {
    return true;
  }
  return name.length > 0 && text.includes(fips) && text.includes(name);
}

export function filterExplorerCountyReference(
  counties: readonly ExplorerCountyReference[],
  input: { evidence: EvidenceView; query: string; scope: string }
): ExplorerCountyReference[] {
  return counties.filter((county) => {
    if (input.scope !== "ALL" && county.state !== input.scope) {
      return false;
    }
    return (
      countyReferenceMatchesAvailableData(county, input.evidence) &&
      countyReferenceMatchesQuery(county, input.query)
    );
  });
}

export function explorerCountyOptionLimit(): number {
  return COUNTY_OPTION_LIMIT;
}

export function explorerCountyListCsv(
  counties: readonly Pick<
    ExplorerCountyReference,
    "county" | "fips" | "state"
  >[]
): string {
  const rows = ["fips,county,state"];
  for (const county of counties) {
    const fips = csvFiveDigitFips(county.fips);
    if (!fips) {
      continue;
    }
    rows.push(
      [csvCell(fips), csvCell(county.county), csvCell(county.state)].join(",")
    );
  }
  return `${rows.join(CSV_NEWLINE)}${CSV_NEWLINE}`;
}

export function explorerCountyListFilename(scope: string): string {
  const token = scope === "ALL" ? "all" : scope.toLowerCase();
  return `atlas-explorer-counties-${token}.csv`;
}

export function downloadExplorerCountyList(
  csv: string,
  filename: string
): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}
