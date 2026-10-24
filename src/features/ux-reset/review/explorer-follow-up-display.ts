import type { CountyDetail } from "@/generated/models";
import { SUGGESTED_FOLLOW_UP_BY_COLOR } from "@/lib/atlas-ui";
import {
  type CountyFollowUpWorkflow,
  type FollowUpCategoryId,
  stateUnallocatedContext,
} from "@/lib/follow-up-workflows";

const PARTNERS_BY_CATEGORY: Record<FollowUpCategoryId, string> = {
  "clinical-laboratory-reporting":
    "Surveillance staff, clinicians, and laboratories",
  "community-context-outreach": "Health educators or community partners",
  "coordination-documentation": "Staff coordinating the review",
  "human-disease-surveillance": "State or local surveillance staff",
  "vector-pathogen-surveillance":
    "Vector-borne disease program or tick-surveillance partners",
};

type ExplorerActionCopy = {
  explanation: string;
  heading: string;
};

const TARGETED_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Check whether local records clarify missing or suppressed counts. Review residence and likely exposure location.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Check collection dates, locations, testing, and whether newer local records are available.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "If case review raises questions about case identification or reporting, discuss them with reporting partners.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Use community context and local knowledge to assess whether prevention information reaches intended communities.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Document what remains unclear, who can help, and what information would change the next step.",
    heading: "Record the question and next step",
  },
];

const ROUTINE_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Check published case information during routine review. A missing count is not zero cases.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Note the dates and places of published tick and pathogen records. Detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Raise a reporting question only when routine review of local records finds one.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Check whether current prevention information fits known community context. Community context alone does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record any gap to revisit when newer data arrive. This does not assign an investigation.",
    heading: "Record the question and next step",
  },
];

const MONITOR_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Compare newer county case information with earlier reporting periods. Missing or suppressed counts are not zero.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Check whether newer tick or pathogen records include dates and locations. Detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Ask whether changes in definitions, testing, or reporting could explain an apparent change.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Decide whether prevention needs have changed. Community context alone does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record what change would move review beyond routine monitoring.",
    heading: "Record the question and next step",
  },
];

const VERIFY_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Compare published case information with locally held records, including residence and likely exposure. A missing count is not zero cases.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Check how recent and local the tick and pathogen records are. Detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Discuss case identification or reporting only when local records raise that question.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Use community context as context for prevention. It does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record whether local records explain the pattern or a question remains.",
    heading: "Record the question and next step",
  },
];

const COORDINATE_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Compare human case records across the programs that hold them. Missing or suppressed counts are not zero.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Check whether tick and pathogen records cover the same time and place as the human records. Detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Bring reporting questions to surveillance, clinical, and laboratory partners when one program cannot answer them.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Decide whether prevention information is a shared question. Community context alone does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record which program can help and what information would change the next step.",
    heading: "Record the question and next step",
  },
];

const PRIORITIZE_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Review county case information before treating this county as a stronger candidate for follow-up. A missing count is not zero cases.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Review the coverage of tick and pathogen records. Detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Clarify reporting if case review still leaves a case-identification question.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Consider prevention needs with local knowledge. Community context alone does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record the question, who can help, and what information would change the next step. This does not assign the work.",
    heading: "Record the question and next step",
  },
];

const NO_SCORE_ACTIONS: readonly ExplorerActionCopy[] = [
  {
    explanation:
      "Check which published case data are missing. Missing data are not zero cases, and this is not a low or high review priority.",
    heading: "Review county case information",
  },
  {
    explanation:
      "Check whether tick or pathogen records are missing. A missing record is not absence, and detection is not an estimate of human transmission.",
    heading: "Review tick and pathogen records",
  },
  {
    explanation:
      "Do not treat missing data as a reporting failure. Discuss reporting only if local records raise that question.",
    heading: "Clarify reporting, if needed",
  },
  {
    explanation:
      "Community context, when it is available, does not establish underreporting or transmission.",
    heading: "Consider prevention needs",
  },
  {
    explanation:
      "Record what is missing, who might hold it, and what information would change the next step.",
    heading: "Record the question and next step",
  },
];

const ACTIONS_BY_TITLE: Record<string, readonly ExplorerActionCopy[]> = {
  "Conduct targeted follow-up": TARGETED_ACTIONS,
  "Continue routine review": ROUTINE_ACTIONS,
  "Coordinate a local assessment": COORDINATE_ACTIONS,
  "Gap score unavailable": NO_SCORE_ACTIONS,
  "Monitor the pattern": MONITOR_ACTIONS,
  "Prioritize targeted follow-up": PRIORITIZE_ACTIONS,
  "Review level unavailable": NO_SCORE_ACTIONS,
  "Verify with local information": VERIFY_ACTIONS,
};

export type ExplorerFollowUpRow = {
  explanation: string;
  heading: string;
  id: string;
  whoCanHelp: string;
};

export function explorerFollowUpAccent(color: string): string | null {
  const normalized = color.trim().toLowerCase();
  if (Object.hasOwn(SUGGESTED_FOLLOW_UP_BY_COLOR, normalized)) {
    return normalized;
  }
  return null;
}

export function explorerFollowUpRows(
  workflow: CountyFollowUpWorkflow,
  county: CountyDetail
): ExplorerFollowUpRow[] {
  const actions = ACTIONS_BY_TITLE[workflow.level.title] ?? NO_SCORE_ACTIONS;
  const unallocated = stateUnallocatedContext(county);
  return actions.map((action, index) => ({
    explanation:
      index === 0 && unallocated
        ? `${action.explanation} ${unallocated}`
        : action.explanation,
    heading: workflow.rows[index]?.label ?? action.heading,
    id: workflow.rows[index]?.id ?? `follow-up-${index + 1}`,
    whoCanHelp:
      PARTNERS_BY_CATEGORY[
        workflow.rows[index]?.id ?? "coordination-documentation"
      ],
  }));
}
