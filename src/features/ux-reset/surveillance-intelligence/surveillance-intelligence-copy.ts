/**
 * Shared County Surveillance Intelligence copy for Explorer and Compare.
 * The guide is a fixed reviewed statement. Do not generate a cross-model verdict.
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
  "ecological-situation": "Ecological Situation",
  "gap-score": "Surveillance Gap Score",
  "ml-review-priority": "ML Review Priority",
  "surveillance-situation": "Surveillance Situation",
} as const satisfies Record<SurveillanceIntelligencePerspectiveId, string>;

export const SURVEILLANCE_INTELLIGENCE_GUIDE =
  "The Gap Score describes a defined discrepancy between reported human surveillance and ecological/community evidence. ML Review Priority identifies unusual evidence profiles for review. Surveillance Situation groups human, tick and pathogen reporting patterns. Ecological Situation groups tick and pathogen evidence without using human reporting. These results answer different questions and may differ.";

export const GAP_SCORE_DESCRIPTOR = "Human/ecological discordance";

export const CLASS_MEMBERSHIP_QUALIFIER =
  "Class membership is the probability of the selected class. It is not pathogen presence, disease risk, or the probability that the model is correct.";

export const PERCENTILE_QUALIFIER =
  "Percentile is a relative ranking within this model batch. It is not a disease risk probability.";

export const SUFFICIENCY_QUALIFIER =
  "Evidence sufficiency is separate from the review tier. Insufficient does not become sufficient, and low priority is not a finding of confidence.";
