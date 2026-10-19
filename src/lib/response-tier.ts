import type { CountyDetail } from "@/generated/models";
import {
  REVIEW_SCORE_RAMP_COLORS,
  SUGGESTED_FOLLOW_UP_BY_COLOR,
  type ReviewPriorityColor,
} from "@/lib/atlas-ui";
import {
  buildCountyFollowUp,
  type FollowUpReviewContext,
  type FollowUpUnavailableReason,
} from "@/lib/follow-up-workflows";

/**
 * Short labels for the six Action Center responses, in
 * `REVIEW_SCORE_RAMP_COLORS` order. That array is the shared color map
 * `SUGGESTED_FOLLOW_UP_BY_COLOR` already uses. These words do not add
 * score cutoffs.
 */
const RESPONSE_TIER_WORDS = [
  "Lower",
  "Monitor",
  "Monitor",
  "Moderate",
  "Moderate",
  "Highest",
] as const;

const RESPONSE_TIER_RAMPS = [
  "map-ramp-1",
  "map-ramp-2",
  "map-ramp-3",
  "map-ramp-4",
  "map-ramp-5",
  "map-ramp-6",
] as const;

export const RESPONSE_TIER_HELP =
  "This tier suggests a level of public-health follow-up. It is not a confirmed Lyme disease risk category.";

export const RESPONSE_TIER_UNAVAILABLE_HELP =
  "No response tier is available for this county. Unavailable is not a confirmed Lyme disease risk category.";

type ResponseTierWord = (typeof RESPONSE_TIER_WORDS)[number];
type ResponseTierRamp = (typeof RESPONSE_TIER_RAMPS)[number];

export type AssignedResponseTier = {
  action: (typeof SUGGESTED_FOLLOW_UP_BY_COLOR)[ReviewPriorityColor];
  label: string;
  ramp: ResponseTierRamp;
  status: "assigned";
  tier: ResponseTierWord;
};

export type UnavailableResponseTier = {
  label: string;
  reason: FollowUpUnavailableReason | null;
  status: "unavailable";
};

export type ResponseTierView = AssignedResponseTier | UnavailableResponseTier;

function isReviewPriorityColor(color: string): color is ReviewPriorityColor {
  return Object.hasOwn(SUGGESTED_FOLLOW_UP_BY_COLOR, color);
}

/**
 * The Action Center response for this county, plus the approved short label
 * when that response is one of the six published colors. A missing or
 * unapproved color stays unavailable and does not borrow another tier.
 */
export function responseTierForCounty(
  detail: CountyDetail,
  context: FollowUpReviewContext = {}
): ResponseTierView {
  const level = buildCountyFollowUp(detail, context).level;
  if (level.status !== "assigned") {
    return {
      label: level.title,
      reason: level.reason,
      status: "unavailable",
    };
  }
  const color = detail.color.trim().toLowerCase();
  if (!isReviewPriorityColor(color)) {
    return {
      label: level.title,
      reason: level.reason,
      status: "unavailable",
    };
  }
  const index = REVIEW_SCORE_RAMP_COLORS.indexOf(color);
  const tier = RESPONSE_TIER_WORDS[index];
  const ramp = RESPONSE_TIER_RAMPS[index];
  if (!(tier && ramp)) {
    return {
      label: level.title,
      reason: level.reason,
      status: "unavailable",
    };
  }
  const action = SUGGESTED_FOLLOW_UP_BY_COLOR[color];
  if (action !== level.title) {
    return {
      label: level.title,
      reason: "recommendation-unassigned",
      status: "unavailable",
    };
  }
  return {
    action,
    label: `${tier} · ${action}`,
    ramp,
    status: "assigned",
    tier,
  };
}
