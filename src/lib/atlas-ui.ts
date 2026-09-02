import type { CountyDetail, CountyScoreSummary } from "@/generated/models";

export const EVIDENCE_VIEWS = new Set([
  "all",
  "ecological",
  "human",
  "complete",
]);

export type EvidenceView = "all" | "ecological" | "human" | "complete";

export interface ScoreSettings {
  ecological_share: number;
  low_incidence_breakpoint: number;
  missing_human_weakness: number;
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
  county: CountyScoreSummary,
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
    return county.evidence_completeness >= 5;
  }
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

export interface FollowUpPlan {
  level: string;
  timeframe: string;
  summary: string;
  actions: { owner: string; task: string }[];
}

const FOLLOW_UP_LEVELS: Record<string, Omit<FollowUpPlan, "actions">> = {
  "#55a8a3": {
    level: "Verify county records",
    summary:
      "Confirm that the published case and tick records accurately reflect what local and state programs have available.",
    timeframe: "Complete within 90 days",
  },
  "#87b982": {
    level: "Review local conditions",
    summary:
      "Compare the county with nearby counties and decide whether reporting, provider outreach, or tick monitoring needs attention.",
    timeframe: "Complete within 60–90 days",
  },
  "#a9d2db": {
    level: "Maintain annual awareness",
    summary:
      "Keep a documented baseline and repeat the dashboard review when new surveillance data are released.",
    timeframe: "Review annually",
  },
  "#e9602b": {
    level: "Prioritize prompt review",
    summary:
      "Start a structured review with named owners, deadlines, and measures of progress across human and tick surveillance.",
    timeframe: "Contact partners within 2 weeks",
  },
  "#efc64a": {
    level: "Conduct targeted follow-up",
    summary:
      "Ask local surveillance, clinical, laboratory, and vector partners to examine the specific signals that raised the county's ranking.",
    timeframe: "Begin within 60 days",
  },
  "#f49a32": {
    level: "Coordinate a local assessment",
    summary:
      "Convene county and state partners, document the surveillance gaps, and assign a short-term field or outreach plan.",
    timeframe: "Begin within 30 days",
  },
};

export function followUpPlanFor(county: CountyDetail): FollowUpPlan {
  const level =
    FOLLOW_UP_LEVELS[county.color.toLowerCase()] ?? FOLLOW_UP_LEVELS["#55a8a3"];
  const actions: FollowUpPlan["actions"] = [];

  actions.push(
    {
      owner: "County epidemiology or surveillance staff",
      task:
        county.human_status === "published_count_floor"
          ? "Review recent case reports and compare the county rate with prior years and neighboring counties."
          : "Ask the state program whether county records were absent, suppressed, unallocated, or not reported; document the answer without treating missing data as zero cases.",
    },
    {
      owner: "State vector-borne disease program",
      task:
        county.tick_status === "No records"
          ? "Check for unpublished or newer tick records and decide whether targeted tick identification or standardized field collection is feasible."
          : "Review when, where, and how the county's tick evidence was collected and whether updated sampling is needed.",
    },
    {
      owner: "Clinical and laboratory liaison",
      task:
        county.burgdorferi_status === "Present"
          ? "Confirm reporting pathways with local laboratories and share current diagnostic and reporting guidance with clinicians."
          : "Confirm whether pathogen testing has been performed locally; record no testing separately from testing with no detections.",
    }
  );

  if (county.uninsured_percent != null && county.uninsured_percent >= 10) {
    actions.push({
      owner: "Community health or access partner",
      task: "Identify practical barriers to evaluation, testing, and reporting, and include accessible prevention outreach in the follow-up plan.",
    });
  }

  return { ...level, actions };
}
