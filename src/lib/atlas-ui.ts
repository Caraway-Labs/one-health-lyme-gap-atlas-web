import type { CountyDetail, CountyScoreSummary } from "@/generated/models";

export const EVIDENCE_VIEWS = new Set(["all", "ecological", "human", "complete"]);

export type EvidenceView = "all" | "ecological" | "human" | "complete";

export type ScoreSettings = {
  ecological_share: number;
  low_incidence_breakpoint: number;
  missing_human_weakness: number;
};

export function plainPriority(priority: string) {
  if (priority.includes("Priority 1")) return "Highest review priority";
  if (priority.includes("Priority 2")) return "Moderate review priority";
  if (priority.toLowerCase().includes("watch")) return "Monitor for changes";
  return "Lower review priority";
}

export function numericParam(value: string | null, fallback: number, min: number, max: number, step = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max && parsed % step === 0
    ? parsed
    : fallback;
}

export function matchesEvidence(county: CountyScoreSummary, evidence: EvidenceView) {
  if (evidence === "ecological") return county.tick_status !== "No records" || county.burgdorferi_status === "Present";
  if (evidence === "human") return county.human_status === "published_count_floor";
  if (evidence === "complete") return county.evidence_completeness >= 5;
  return true;
}

export function reasonsFor(county: CountyDetail): string[] {
  return [
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
}
