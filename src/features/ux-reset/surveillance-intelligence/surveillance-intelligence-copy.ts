/**
 * Shared County Surveillance Intelligence copy for Explorer and Compare.
 * The guide is a fixed reviewed statement. Do not generate a cross-model verdict.
 *
 * Friendly group labels and explanations are scoped to the current v1 model
 * identity. A later model version falls back to its reviewed label.
 */

export const SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER = [
  "gap-score",
  "ml-review-priority",
  "surveillance-situation",
  "ecological-situation",
] as const;

export type SurveillanceIntelligencePerspectiveId =
  (typeof SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER)[number];

export const SURVEILLANCE_INTELLIGENCE_LABELS = {
  "ecological-situation": "Tick and pathogen pattern",
  "gap-score": "Surveillance Gap Score",
  "ml-review-priority": "ML Review Priority",
  "surveillance-situation": "Combined surveillance pattern",
} as const satisfies Record<SurveillanceIntelligencePerspectiveId, string>;

export const SURVEILLANCE_INTELLIGENCE_GUIDE =
  "The Gap Score describes a defined discrepancy between reported human surveillance and ecological/community evidence. ML Review Priority identifies unusual evidence profiles for review. Combined surveillance pattern groups counties using human Lyme disease reporting, tick records, and pathogen records. Tick and pathogen pattern groups counties using tick and pathogen records, without using human Lyme disease reporting. These results answer different questions and may differ.";

export const GAP_SCORE_DESCRIPTOR = "Human/ecological discordance";

export const CLASS_MEMBERSHIP_QUALIFIER =
  "Class membership is the probability of the selected class. It is not pathogen presence, disease risk, or the probability that the model is correct.";

export const PERCENTILE_QUALIFIER =
  "Percentile is a relative ranking within this model batch. It is not a disease risk probability.";

export const SUFFICIENCY_QUALIFIER =
  "Evidence sufficiency is separate from the review tier. Insufficient does not become sufficient, and low priority is not a finding of confidence.";

export const COMBINED_SURVEILLANCE_PATTERN_DESCRIPTION =
  "This model groups counties using human Lyme disease reporting, tick records, and pathogen records.";

export const TICK_AND_PATHOGEN_PATTERN_DESCRIPTION =
  "This model groups counties using tick and pathogen records, without using human Lyme disease reporting.";

export const NO_RECORD_IS_NOT_ABSENCE =
  "No record does not mean the tick or pathogen is absent.";

export const MODEL_GROUPING_INTRO =
  "These percentages describe how the model assigns this county among its four groups.";

export const MODEL_GROUPING_INTERPRETATION =
  "These percentages describe model group membership. They do not measure disease risk, pathogen presence, data completeness, or the probability that the model is correct.";

export const UNRECOGNIZED_MODEL_VERSION_DESCRIPTION =
  "This page does not have a plain-language description for this model version. The reviewed group label is shown unchanged.";

const SITUATION_MODEL_VERSION = "v1";
const FOUR_STATE_MODEL_ID = "surveillance-situation-four-state";
const TICK_PATHOGEN_MODEL_ID = "surveillance-situation-tick-pathogen";

const V1_MODEL_DESCRIPTIONS = {
  [FOUR_STATE_MODEL_ID]: COMBINED_SURVEILLANCE_PATTERN_DESCRIPTION,
  [TICK_PATHOGEN_MODEL_ID]: TICK_AND_PATHOGEN_PATTERN_DESCRIPTION,
} as const;

type SituationGroupCopy = {
  label: string;
  meaning: string;
};

const V1_GROUP_COPY = {
  [`${FOUR_STATE_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-0`]: {
    label: "Blacklegged tick records predominate",
    meaning:
      "This group is characterized by established or reported blacklegged ticks and no western blacklegged tick record. Human Lyme disease records or pathogen records are common in this group, but are not present for every county.",
  },
  [`${FOUR_STATE_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-1`]: {
    label: "Tick and pathogen status unknown",
    meaning:
      "This group includes Alaska and Hawaii counties whose tick and pathogen status is unknown and whose human Lyme disease data have no county-linked record. Unknown status is a model group, not a missing model result.",
  },
  [`${FOUR_STATE_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-2`]: {
    label: "Western blacklegged tick records predominate",
    meaning:
      "This group is characterized by established or reported western blacklegged ticks and no blacklegged tick record.",
  },
  [`${FOUR_STATE_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-3`]: {
    label: "Pathogen not recorded",
    meaning:
      "Counties in this group have no pathogen record and no western blacklegged tick record in the data used by the model. Blacklegged tick records vary: established, reported, or no records.",
  },
  [`${TICK_PATHOGEN_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-0`]: {
    label: "Blacklegged tick records predominate",
    meaning:
      "This group is characterized by established or reported blacklegged ticks and no western blacklegged tick record. It includes counties with pathogen records and counties with no pathogen record.",
  },
  [`${TICK_PATHOGEN_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-1`]: {
    label: "Limited tick and pathogen records",
    meaning:
      "This group is characterized by no pathogen record and blacklegged ticks that are not established. Some counties in this group have reported ticks.",
  },
  [`${TICK_PATHOGEN_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-2`]: {
    label: "Established western blacklegged tick pattern",
    meaning:
      "This group is characterized by established western blacklegged ticks and no blacklegged tick record. Pathogen records vary among counties in the group.",
  },
  [`${TICK_PATHOGEN_MODEL_ID}.${SITUATION_MODEL_VERSION}.class-3`]: {
    label: "Tick and pathogen status unknown",
    meaning:
      "This group includes Alaska and Hawaii counties whose tick and pathogen status is unknown. Human Lyme disease reporting is not used by this model. Unknown status is a model group, not a missing model result.",
  },
} as const satisfies Record<string, SituationGroupCopy>;

export function situationModelDescription(
  modelId: string,
  modelVersion: string
): string | null {
  if (modelVersion !== SITUATION_MODEL_VERSION) {
    return null;
  }
  if (modelId === FOUR_STATE_MODEL_ID) {
    return V1_MODEL_DESCRIPTIONS[FOUR_STATE_MODEL_ID];
  }
  if (modelId === TICK_PATHOGEN_MODEL_ID) {
    return V1_MODEL_DESCRIPTIONS[TICK_PATHOGEN_MODEL_ID];
  }
  return null;
}

/**
 * Friendly label for one v1 class. Matching requires the model id, version,
 * and version-scoped class id together. Array position is never used.
 */
export function situationGroupCopy(
  modelId: string,
  modelVersion: string,
  classId: string
): SituationGroupCopy | null {
  if (modelVersion !== SITUATION_MODEL_VERSION) {
    return null;
  }
  const expectedPrefix = `${modelId}.${modelVersion}.`;
  if (!classId.startsWith(expectedPrefix)) {
    return null;
  }
  const copy = V1_GROUP_COPY[classId as keyof typeof V1_GROUP_COPY] ?? null;
  return copy;
}
