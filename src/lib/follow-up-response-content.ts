/**
 * Published gap-score response copy. Keys are the six phrases in
 * SUGGESTED_FOLLOW_UP_BY_COLOR. `stance` is the short conditional opener for
 * each Suggested Follow-up action. County evidence supplies the practical
 * step and any fact that is unique to that county. Questions stay in the
 * expandable section.
 */

export type FollowUpResponseCopy = {
  explanation: string;
  questions: readonly [string, string, string, string];
  stance: string;
};

const ROUTINE: FollowUpResponseCopy = {
  explanation:
    "Maintain established surveillance. Do not initiate an investigation solely because the county is scored.",
  questions: [
    "Are current surveillance processes sufficient to review this county as new data become available?",
    "Are gaps in the published human or vector evidence best documented for future review?",
    "Do available local records suggest a reason to depart from established monitoring practices?",
    "Are current prevention and communication activities appropriate for the community context already known?",
  ],
  stance: "During routine review,",
};

const MONITOR: FollowUpResponseCopy = {
  explanation:
    "Watch for meaningful changes and determine whether new evidence warrants verification.",
  questions: [
    "Are changes in human surveillance findings consistent across comparable reporting periods?",
    "Are new tick or pathogen findings supported by collection dates and locations relevant to this county?",
    "Could changes in surveillance definitions, testing, or reporting practices explain an apparent change?",
    "What new evidence would justify moving beyond routine monitoring?",
  ],
  stance: "While monitoring,",
};

const VERIFY: FollowUpResponseCopy = {
  explanation:
    "Reconcile published surveillance information with locally held evidence.",
  questions: [
    "Do locally held case records agree with the published county count or minimum case-count floor?",
    "Could travel or likely exposure locations explain differences between residence-based cases and local vector evidence?",
    "Are newer or unpublished tick and pathogen surveillance records available?",
    "Does verification identify a substantive concern, or does the published pattern have a reasonable local explanation?",
  ],
  stance: "To verify locally,",
};

const TARGETED: FollowUpResponseCopy = {
  explanation: "Investigate a specific, evidence-supported uncertainty.",
  questions: [
    "Which specific inconsistency in the published or locally verified evidence warrants targeted follow-up?",
    "Could residence-versus-exposure differences, reporting practices, or data suppression account for the apparent discrepancy?",
    "Would reviewing existing vector records or obtaining targeted new information materially change a public-health decision?",
    "What finding would justify additional action, and what finding would support returning to routine review?",
  ],
  stance: "For a specific question,",
};

const COORDINATE: FollowUpResponseCopy = {
  explanation:
    "Bring together relevant public-health programs when important questions require information from multiple sources.",
  questions: [
    "Which surveillance questions require information or expertise from more than one program?",
    "Do human case records and vector/pathogen evidence describe compatible time periods and geographic areas?",
    "Would coordinated review of existing records resolve the uncertainty before new surveillance or outreach is considered?",
    "Which findings would support a targeted response, and which would argue for continued observation?",
  ],
  stance: "With relevant programs,",
};

const PRIORITIZE: FollowUpResponseCopy = {
  explanation:
    "Consider giving greater attention to focused, locally governed review when the published response category is strongest.",
  questions: [
    "What verified evidence makes this county a stronger candidate for focused follow-up than other current program priorities?",
    "Have alternative explanations—including travel-associated exposure, surveillance limitations, and reporting practices—been considered?",
    "What specific action could reduce important uncertainty or improve a locally supported public-health response?",
    "What additional evidence, operational capacity, and local approval would be needed before proceeding?",
  ],
  stance: "For focused follow-up,",
};

export const FOLLOW_UP_RESPONSE_CONTENT = {
  "Conduct targeted follow-up": TARGETED,
  "Continue routine review": ROUTINE,
  "Coordinate a local assessment": COORDINATE,
  "Monitor the pattern": MONITOR,
  "Prioritize targeted follow-up": PRIORITIZE,
  "Verify with local information": VERIFY,
} as const satisfies Record<string, FollowUpResponseCopy>;

export const GAP_SCORE_UNAVAILABLE_TITLE = "Gap score unavailable";

export const GAP_SCORE_UNAVAILABLE_EXPLANATION =
  "Available published data do not support calculation of an Atlas gap score for this county.";

export const GAP_SCORE_UNAVAILABLE_CONTENT: FollowUpResponseCopy = {
  explanation: GAP_SCORE_UNAVAILABLE_EXPLANATION,
  questions: [
    "Why is a published Atlas gap score or follow-up category unavailable for this county?",
    "Which published evidence is missing, limited, or outside the supported scope?",
    "Are relevant state or local records available to clarify the evidence without assuming a particular response level?",
    "Should these limitations be documented for routine review rather than treated as an assigned priority?",
  ],
  stance: "While a gap score is unavailable,",
};

export const FOLLOW_UP_PUBLISHED_SOURCE_LABEL =
  "Based on published Atlas gap-score category. This is not a model-assisted surveillance priority.";

export const FOLLOW_UP_WHAT_IF_TITLE = "What-if scenario active";

export const FOLLOW_UP_WHAT_IF_NOTE =
  "Map colors may reflect hypothetical score changes. Suggested Follow-up remains based on the published Atlas gap-score category.";

export const FOLLOW_UP_QUESTIONS_INTRO =
  "Consider these questions alongside local information before deciding whether additional follow-up is warranted.";
