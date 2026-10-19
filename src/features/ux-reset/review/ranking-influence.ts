import { publishedGapScore } from "@/features/ux-reset/review/explorer-ranked-counties";
import type { CountyDetail } from "@/generated/models";

/**
 * Qualitative explanation of the published ranking.
 * Production `/v1/counties/{fips}` and `/v1/atlas/scores` return intermediate
 * signals. Those signals do not add up to `score.score`, and the contract has
 * no contribution field. This module does not recompute the score.
 */
export const RANKING_INFLUENCE_SUMMARY = "What influenced this ranking?";

export const RANKING_METHODOLOGY_HREF =
  "/docs/releases-and-methodology#how-county-scoring-works";

export const RANKING_METHODOLOGY_LABEL = "How county scoring works";

export const RANKING_INFLUENCE_EVIDENCE_DISTINCTION =
  "The numbered items above are the published surveillance and community record. They describe what was observed. They do not show how much each field changed this county’s gap score.";

export const RANKING_INFLUENCE_PUBLISHED_SCORE =
  "The score on this card is the published Atlas gap score for the active release. It is a follow-up priority, not a disease-risk estimate. The tier beside it suggests a follow-up level from that published score. It is separate from Tier 1 surveillance priority. Scenario controls can show an adjusted score for exploration. That adjusted score does not replace the published score, and it does not add a domain breakdown.";

export const RANKING_INFLUENCE_RANK_SCOPE =
  "The county list orders published scores inside the Explorer scope on this page. A selected state orders counties in that state. With no state selected, Explorer shows a shortlist of lower-48 and District of Columbia counties. That shortlist is not a complete national rank, and this card does not assign a rank number.";

export const RANKING_INFLUENCE_NO_BREAKDOWN =
  "No score breakdown is available. The governed county record does not include contributions that add up to the displayed score. Percents, bars, and weights are not shown.";

export type RankingInfluenceCounty = Pick<
  CountyDetail,
  | "burgdorferi_status"
  | "human_status"
  | "in_contiguous_tick_scope"
  | "rucc_2023"
  | "score"
  | "svi_percentile"
  | "tick_status"
  | "uninsured_percent"
  | "uninsured_percentile"
>;

export type RankingInfluenceCopy = {
  community: string;
  human: string;
  pathogen: string;
  scopeNote: string | null;
  tick: string;
};

const DOCUMENTED_TICK = new Set(["established", "reported"]);

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function documentedTick(status: string): boolean {
  return DOCUMENTED_TICK.has(normalized(status));
}

function pathogenPresent(status: string): boolean {
  return normalized(status) === "present";
}

function ecologicalEvidencePublished(detail: RankingInfluenceCounty): boolean {
  return (
    documentedTick(detail.tick_status) ||
    pathogenPresent(detail.burgdorferi_status)
  );
}

function publishedScore(detail: RankingInfluenceCounty): number | null {
  if (!detail.in_contiguous_tick_scope) {
    return null;
  }
  return publishedGapScore(detail.score.score);
}

function humanNote(
  detail: RankingInfluenceCounty,
  score: number | null
): string {
  const status = normalized(detail.human_status);
  if (status === "suppressed") {
    return "The 2023 county Lyme case count is suppressed. Suppression is not zero cases, and no contribution is shown for it.";
  }
  if (status === "missing") {
    return "The 2023 county Lyme case count is missing. A missing count is not zero cases, and no contribution is shown for it.";
  }
  if (status === "no_county_linked_record") {
    return "No county-linked 2023 Lyme case record is available for the score. A missing record is not zero cases and is not a low-incidence finding.";
  }
  if (status === "published_count_floor") {
    if (score === 0 && ecologicalEvidencePublished(detail)) {
      return "A published case-count floor is a human input. The published gap score is zero while tick or pathogen evidence is still on the record. That zero is not a finding of no ecological hazard, and no domain split is shown.";
    }
    return "A published case-count floor is a human input to the score. The floor is a minimum, and this section does not show how many points it added.";
  }
  return "No county-level 2023 Lyme case count is available for the score. That is not zero cases, and no contribution is shown.";
}

function tickNote(detail: RankingInfluenceCounty): string {
  if (documentedTick(detail.tick_status)) {
    return "Published tick surveillance is an ecological input. A published status is not a measure of tick abundance, and no share of the score is shown.";
  }
  const status = normalized(detail.tick_status);
  if (status === "no records") {
    return "The published tick table has no county record. That is not low ecological hazard, and it is not shown as a zero contribution.";
  }
  if (status === "unknown") {
    return `The published tick status is ${detail.tick_status.trim()}. Unknown is not a missing county record, and it is not a finding of tick absence. No contribution is shown.`;
  }
  return "The published tick status is not a finding of tick absence, and no contribution is shown.";
}

function pathogenNote(detail: RankingInfluenceCounty): string {
  if (pathogenPresent(detail.burgdorferi_status)) {
    return "A published Borrelia burgdorferi detection is an ecological input. Detection is not a human infection estimate, and no share of the score is shown.";
  }
  const status = normalized(detail.burgdorferi_status);
  if (status === "no records") {
    return "No county-level Borrelia burgdorferi detection record is available for the score. That is not a finding that the pathogen is absent, and it is not shown as a zero contribution.";
  }
  if (status === "unknown") {
    return `The published Borrelia burgdorferi status is ${detail.burgdorferi_status.trim()}. Unknown is not a missing detection record, and it is not a finding that the pathogen is absent. No contribution is shown.`;
  }
  return "The published pathogen status is not a finding of pathogen absence, and no contribution is shown.";
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  const last = labels.at(-1) ?? "";
  return `${labels.slice(0, -1).join(", ")}, and ${last}`;
}

function communityNote(detail: RankingInfluenceCounty): string {
  const missing = [
    finite(detail.svi_percentile) ? null : "social vulnerability percentile",
    finite(detail.uninsured_percentile) ? null : "uninsured percentile",
    finite(detail.rucc_2023) ? null : "rural-urban class",
  ].filter((label): label is string => label !== null);
  const percentileNote = finite(detail.uninsured_percent)
    ? "The evidence list may show a percentage uninsured. The published method uses the uninsured percentile when that percentile is present. These values are community context, not proof of underreporting, and no points are shown."
    : "These values are community context, not proof of underreporting, and no points are shown.";
  if (missing.length === 0) {
    return `Social vulnerability, the uninsured percentile, and the rural-urban class are published for this county. ${percentileNote}`;
  }
  return `This county has no published ${joinLabels(missing)}. Unpublished community context is not proof of underreporting, and no estimated value is shown. ${percentileNote}`;
}

export function rankingInfluenceFor(
  detail: RankingInfluenceCounty
): RankingInfluenceCopy {
  const score = publishedScore(detail);
  return {
    community: communityNote(detail),
    human: humanNote(detail, score),
    pathogen: pathogenNote(detail),
    scopeNote: detail.in_contiguous_tick_scope
      ? null
      : "This county is outside the contiguous tick scope, so the Atlas gap score on this card is unavailable. Unavailable is not a low score and is not a rank.",
    tick: tickNote(detail),
  };
}
