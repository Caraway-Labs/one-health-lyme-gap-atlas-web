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
 * Approved two-line labels for the six published score colors, in
 * `REVIEW_SCORE_RAMP_COLORS` order. The words name the existing color.
 * They do not add score cutoffs or a second tier scale.
 */
export const RESPONSE_TIER_PRESENTATION = [
  {
    detail: "Continue routine surveillance",
    title: "Lower review priority",
  },
  {
    detail: "Monitor trends over time",
    title: "Elevated review priority",
  },
  {
    detail: "Verify with local information",
    title: "Elevated review priority",
  },
  {
    detail: "Conduct targeted follow-up",
    title: "Moderate review priority",
  },
  {
    detail: "Coordinate a local assessment",
    title: "Moderate review priority",
  },
  {
    detail: "Prioritize local investigation",
    title: "Highest review priority",
  },
] as const;

const RESPONSE_TIER_RAMPS = [
  "map-ramp-1",
  "map-ramp-2",
  "map-ramp-3",
  "map-ramp-4",
  "map-ramp-5",
  "map-ramp-6",
] as const;

type ResponseTierRamp = (typeof RESPONSE_TIER_RAMPS)[number];
export type ResponseTierPresentation =
  (typeof RESPONSE_TIER_PRESENTATION)[number];

export type AssignedResponseTier = {
  action: (typeof SUGGESTED_FOLLOW_UP_BY_COLOR)[ReviewPriorityColor];
  detail: string;
  label: string;
  ramp: ResponseTierRamp;
  status: "assigned";
  title: string;
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

export function responseTierPresentationForColor(
  color: string
): ResponseTierPresentation | null {
  const index = (REVIEW_SCORE_RAMP_COLORS as readonly string[]).indexOf(
    color.trim().toLowerCase()
  );
  if (index === -1) {
    return null;
  }
  return RESPONSE_TIER_PRESENTATION[index] ?? null;
}

/**
 * The Action Center response for this county, plus the approved two-line
 * label when that response is one of the six published colors. A missing or
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
  const presentation = RESPONSE_TIER_PRESENTATION[index];
  const ramp = RESPONSE_TIER_RAMPS[index];
  if (!(presentation && ramp)) {
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
    detail: presentation.detail,
    label: `${presentation.title} ${presentation.detail}`,
    ramp,
    status: "assigned",
    title: presentation.title,
  };
}
