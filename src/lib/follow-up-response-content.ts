/**
 * Published gap-score response copy. Keys are the six phrases in
 * SUGGESTED_FOLLOW_UP_BY_COLOR. County data still supplies the practical
 * check inside each row. Questions stay in their own subsection.
 */

export type FollowUpResponseCopy = {
  explanation: string;
  questions: readonly [string, string, string, string];
};

const ROUTINE: FollowUpResponseCopy = {
  explanation:
    "Continue the program’s usual review. A score by itself is not a reason to open an investigation.",
  questions: [
    "Do travel, reporting practices, or suppressed counts already explain this pattern?",
    "Are the tick and pathogen records recent enough, and local enough, for routine review?",
    "What do local partners already know that is not in this published data?",
    "What new information would justify anything beyond routine review?",
  ],
};

const MONITOR: FollowUpResponseCopy = {
  explanation:
    "Watch for changes in published data and decide whether new information needs a closer look.",
  questions: [
    "Could a change in travel, reporting practices, or suppressed counts explain the new pattern?",
    "Are newer tick and pathogen records available, and how geographically representative are they?",
    "What do local partners know about the change that is missing here?",
    "What new information would justify moving beyond monitoring?",
  ],
};

const VERIFY: FollowUpResponseCopy = {
  explanation:
    "Compare published data with records held locally before deciding whether the pattern needs a closer look.",
  questions: [
    "Could travel, reporting practices, or suppressed counts explain a difference between published and local records?",
    "How recent and geographically representative are the tick and pathogen records held locally?",
    "Which local records are missing from the published data?",
    "What local finding would change the next step?",
  ],
};

const TARGETED: FollowUpResponseCopy = {
  explanation:
    "Review the county’s data with local partners to clarify the pattern and decide whether further follow-up would help.",
  questions: [
    "Could travel, reporting practices, or suppressed counts explain the pattern?",
    "How recent and geographically representative are the tick and pathogen records?",
    "What do local partners know that is missing here?",
    "What information would change your next step?",
  ],
};

const COORDINATE: FollowUpResponseCopy = {
  explanation:
    "Compare notes across programs when the question needs more than one source. This does not assign owners or a deadline.",
  questions: [
    "Could travel, reporting practices, or suppressed counts explain the pattern before programs compare notes?",
    "Do the tick and pathogen records cover the same places and years as the case data?",
    "What does each program know that the others do not have here?",
    "What shared finding would change the next step?",
  ],
};

const PRIORITIZE: FollowUpResponseCopy = {
  explanation:
    "Consider focused local follow-up when the records support it. Staffing and timing stay with the jurisdiction.",
  questions: [
    "Have travel, reporting practices, and suppressed counts been considered before closer attention?",
    "How recent and geographically representative are the tick and pathogen records for a closer review?",
    "What do local partners know that would change how much attention this county gets?",
    "Whose decision, and what additional information, would be required before a next step?",
  ],
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
    "Which published data are missing, limited, or outside the supported scope?",
    "What can state or local records clarify without assigning a review level?",
    "Should these limits be documented for routine review rather than treated as a priority?",
  ],
};

export const FOLLOW_UP_PUBLISHED_SOURCE_LABEL =
  "Based on published Atlas gap-score category. This is not a model-assisted surveillance priority.";

export const FOLLOW_UP_WHAT_IF_TITLE = "What-if scenario active";

export const FOLLOW_UP_WHAT_IF_NOTE =
  "Map colors may reflect hypothetical score changes. Suggested follow-up remains based on the published Atlas gap-score category.";
