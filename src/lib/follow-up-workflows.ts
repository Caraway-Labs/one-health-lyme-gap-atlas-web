import { publishedHumanFloorValue } from "@/features/ux-reset/review/published-human-case-copy";
import type { CountyDetail } from "@/generated/models";
import {
  SUGGESTED_FOLLOW_UP_BY_COLOR,
  type ReviewPriorityColor,
} from "@/lib/atlas-ui";
import {
  FOLLOW_UP_PUBLISHED_SOURCE_LABEL,
  FOLLOW_UP_RESPONSE_CONTENT,
  GAP_SCORE_UNAVAILABLE_CONTENT,
  GAP_SCORE_UNAVAILABLE_EXPLANATION,
  GAP_SCORE_UNAVAILABLE_TITLE,
  type FollowUpResponseCopy,
} from "@/lib/follow-up-response-content";

/**
 * Five public-health workstreams for Suggested Follow-up.
 * They are not scoring dimensions and they are not the six Review Rationale
 * categories. Visible headings are actions. Copy still follows the published
 * category and the county’s data state. This module does not assign score
 * cutoffs or treat a map color as a new review scale.
 */

export const FOLLOW_UP_INTERPRETATION =
  "This is a review recommendation, not a measure of individual risk or proof that Lyme disease is undercounted.";

/** Shown when no published category is assigned. Not a score-based recommendation. */
export const FOLLOW_UP_UNAVAILABLE_INTERPRETATION =
  "No review level is assigned. This is not a measure of individual risk or proof that Lyme disease is undercounted.";

export const FOLLOW_UP_VERIFICATION_NOTE =
  "These rows are data checks, not a scored recommendation or an instruction to escalate surveillance.";

export const FOLLOW_UP_COLOR_RESPONSE_NOTE = FOLLOW_UP_PUBLISHED_SOURCE_LABEL;

export const REVIEW_LEVEL_UNAVAILABLE = "Review level unavailable";

export const INSUFFICIENT_REVIEW_LEVEL_EXPLANATION =
  "Available data are not sufficient to assign a review level.";

export const FOLLOW_UP_CATEGORY_ORDER = [
  "human-disease-surveillance",
  "vector-pathogen-surveillance",
  "clinical-laboratory-reporting",
  "community-context-outreach",
  "coordination-documentation",
] as const;

export type FollowUpCategoryId = (typeof FOLLOW_UP_CATEGORY_ORDER)[number];

export type FollowUpUnavailableReason =
  | "gap-score-unavailable"
  | "insufficient-evidence"
  | "recommendation-unassigned"
  | "unsupported-jurisdiction";

export type GovernedReviewResultState =
  | "candidates_found"
  | "insufficient_evidence"
  | "none_stand_out"
  | "unsupported";

export type FollowUpReviewContext = {
  governedNextCheck?: string | null;
  reviewResultState?: GovernedReviewResultState | null;
};

export type FollowUpResource = {
  href: string;
  id: string;
  label: string;
};

export type FollowUpWorkflowRow = {
  /** One conditional action. County facts stay in `detail`. */
  action: string;
  detail: string | null;
  id: FollowUpCategoryId;
  label: string;
  partners: string;
  recommendation: string;
  resources: readonly FollowUpResource[];
  verifyQuestion: string;
};

export type FollowUpReviewLevel = {
  colorResponseNote: string | null;
  explanation: string;
  governedNextCheck: string | null;
  reason: FollowUpUnavailableReason | null;
  status: "assigned" | "unavailable";
  title: string;
};

export type CountyFollowUpWorkflow = {
  level: FollowUpReviewLevel;
  questions: FollowUpResponseCopy["questions"];
  rows: readonly FollowUpWorkflowRow[];
  verificationNote: string | null;
};

const CATEGORY_LABELS: Record<FollowUpCategoryId, string> = {
  "clinical-laboratory-reporting": "Clarify reporting, if needed",
  "community-context-outreach": "Consider prevention needs",
  "coordination-documentation": "Record the question and next step",
  "human-disease-surveillance": "Review county case information",
  "vector-pathogen-surveillance": "Review tick and pathogen records",
};

const PARTNER_SUGGESTIONS: Record<FollowUpCategoryId, string> = {
  "clinical-laboratory-reporting":
    "Surveillance staff, clinicians, and laboratories",
  "community-context-outreach": "Health educators or community partners",
  "coordination-documentation": "Staff coordinating the review",
  "human-disease-surveillance": "State or local surveillance staff",
  "vector-pathogen-surveillance":
    "Vector-borne disease program or tick-surveillance partners",
};

const LEVEL_EXPLANATIONS: Record<
  (typeof SUGGESTED_FOLLOW_UP_BY_COLOR)[ReviewPriorityColor],
  string
> = {
  "Conduct targeted follow-up":
    FOLLOW_UP_RESPONSE_CONTENT["Conduct targeted follow-up"].explanation,
  "Continue routine review":
    FOLLOW_UP_RESPONSE_CONTENT["Continue routine review"].explanation,
  "Coordinate a local assessment":
    FOLLOW_UP_RESPONSE_CONTENT["Coordinate a local assessment"].explanation,
  "Monitor the pattern":
    FOLLOW_UP_RESPONSE_CONTENT["Monitor the pattern"].explanation,
  "Prioritize targeted follow-up":
    FOLLOW_UP_RESPONSE_CONTENT["Prioritize targeted follow-up"].explanation,
  "Verify with local information":
    FOLLOW_UP_RESPONSE_CONTENT["Verify with local information"].explanation,
};

const RESOURCES = {
  blackleggedTickGuidance: {
    href: "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
    id: "blacklegged-tick-guidance",
    label: "Blacklegged tick surveillance guidance",
  },
  caseDefinition: {
    href: "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
    id: "lyme-case-definition-2022",
    label: "Lyme surveillance case definition",
  },
  caseDefinitionChange: {
    href: "https://www.cdc.gov/mmwr/volumes/73/wr/mm7306a1.htm",
    id: "case-definition-2022-changes",
    label: "Surveillance changes associated with the 2022 case definition",
  },
  clinicalTesting: {
    href: "https://www.cdc.gov/lyme/hcp/diagnosis-testing/index.html",
    id: "clinical-testing-guidance",
    label: "Clinical testing guidance",
  },
  countyCaseData: {
    href: "https://www.cdc.gov/ticks/data-research/facts-stats/geographic-distribution-of-tickborne-disease-cases.html",
    id: "county-case-data",
    label: "County case data and residence-versus-exposure limitations",
  },
  lymeEducation: {
    href: "https://www.cdc.gov/lyme/communication-resources/index.html",
    id: "lyme-educational-materials",
    label: "Lyme educational materials",
  },
  prevention: {
    href: "https://www.cdc.gov/lyme/prevention/index.html",
    id: "lyme-prevention",
    label: "CDC Lyme disease prevention",
  },
  sviInterpretation: {
    href: "https://www.atsdr.cdc.gov/place-health/php/svi/svi-frequently-asked-questions-faqs.html",
    id: "svi-interpretation",
    label: "SVI interpretation",
  },
  tickCommunication: {
    href: "https://www.cdc.gov/ticks/communication-resources/index.html",
    id: "tick-communication-resources",
    label: "Tick communication resources",
  },
  tickRecords: {
    href: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
    id: "tick-pathogen-records",
    label: "Tick and pathogen record definitions and limitations",
  },
  westernBlackleggedTickGuidance: {
    href: "https://www.cdc.gov/ticks/resources/TickSurveillance_Ipacificus-P.pdf",
    id: "western-blacklegged-tick-guidance",
    label: "Western blacklegged tick surveillance guidance",
  },
} as const satisfies Record<string, FollowUpResource>;

export type OfficialFollowUpResource = {
  category: string;
  description: string;
  external: boolean;
  href: string;
  id: string;
  label: string;
};

/** Curated references for the Explorer resources card. Destinations stay on
 * the approved follow-up catalog; visible labels are the shorter card copy. */
export const OFFICIAL_FOLLOW_UP_RESOURCES = [
  {
    category: "Lyme disease surveillance",
    description: "Reporting criteria for Lyme disease.",
    external: true,
    href: RESOURCES.caseDefinition.href,
    id: RESOURCES.caseDefinition.id,
    label: "Lyme surveillance case definition",
  },
  {
    category: "Lyme disease surveillance",
    description: "How residence and exposure affect county counts.",
    external: true,
    href: RESOURCES.countyCaseData.href,
    id: RESOURCES.countyCaseData.id,
    label: "County case data and limitations",
  },
  {
    category: "Tick and vector surveillance",
    description: "How to interpret published records.",
    external: true,
    href: RESOURCES.tickRecords.href,
    id: RESOURCES.tickRecords.id,
    label: "Tick and pathogen record definitions",
  },
  {
    category: "Tick and vector surveillance",
    description: "CDC guidance for surveillance and interpretation.",
    external: true,
    href: RESOURCES.blackleggedTickGuidance.href,
    id: RESOURCES.blackleggedTickGuidance.id,
    label: "Blacklegged tick surveillance guidance",
  },
  {
    category: "Clinical testing and reporting",
    description: "CDC guidance on laboratory diagnosis.",
    external: true,
    href: RESOURCES.clinicalTesting.href,
    id: RESOURCES.clinicalTesting.id,
    label: "Clinical testing guidance",
  },
] as const satisfies readonly OfficialFollowUpResource[];

const DOCUMENTED_TICK = new Set(["established", "reported"]);
const NEGATIVE_PATHOGEN = new Set([
  "negative",
  "no detection",
  "not detected",
  "tested negative",
]);

type ApprovedResponseTitle =
  (typeof SUGGESTED_FOLLOW_UP_BY_COLOR)[ReviewPriorityColor];

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function approvedResponse(color: string): ApprovedResponseTitle | null {
  const normalizedColor = color.trim().toLowerCase();
  if (!Object.hasOwn(SUGGESTED_FOLLOW_UP_BY_COLOR, normalizedColor)) {
    return null;
  }
  return SUGGESTED_FOLLOW_UP_BY_COLOR[normalizedColor as ReviewPriorityColor];
}

function publishedGapScoreMissing(county: CountyDetail): boolean {
  return county.color.trim().length === 0;
}

function responseCopy(level: FollowUpReviewLevel): FollowUpResponseCopy | null {
  if (level.status === "assigned") {
    return FOLLOW_UP_RESPONSE_CONTENT[level.title as ApprovedResponseTitle];
  }
  if (level.reason === "gap-score-unavailable") {
    return GAP_SCORE_UNAVAILABLE_CONTENT;
  }
  return null;
}

function documentedTick(county: CountyDetail): boolean {
  return [
    county.tick_status,
    county.scapularis_status,
    county.pacificus_status,
  ].some((value) => DOCUMENTED_TICK.has(normalized(value)));
}

function tickRecordMissing(county: CountyDetail): boolean {
  if (documentedTick(county)) {
    return false;
  }
  return [
    county.tick_status,
    county.scapularis_status,
    county.pacificus_status,
  ].every((value) => {
    const status = normalized(value);
    return status === "" || status === "no records";
  });
}

function humanPublished(county: CountyDetail): boolean {
  return (
    county.human_status === "published_count_floor" &&
    finite(county.case_count_floor_2023)
  );
}

function pathogenKind(
  county: CountyDetail
): "missing" | "negative" | "other" | "present" {
  const status = normalized(county.burgdorferi_status);
  if (status === "present") {
    return "present";
  }
  if (NEGATIVE_PATHOGEN.has(status)) {
    return "negative";
  }
  if (
    status === "" ||
    status === "missing" ||
    status === "no records" ||
    status === "suppressed" ||
    status === "unavailable" ||
    status === "unknown"
  ) {
    return "missing";
  }
  return "other";
}

function unallocatedSentence(county: CountyDetail): string | null {
  const count = county.state_unallocated_records_2023;
  if (!finite(count) || count <= 0) {
    return null;
  }
  const noun = count === 1 ? "record was" : "records were";
  return `${count.toLocaleString("en-US")} published 2023 human-surveillance ${noun} not allocated to a county in this release. Check whether any belong in this county before interpreting the county figure.`;
}

type FollowUpCopy = {
  action: string;
  detail: string | null;
  verifyQuestion: string;
};

type FollowUpIntensity =
  | "coordinate"
  | "monitor"
  | "prioritize"
  | "routine"
  | "targeted"
  | "unassigned"
  | "verify";

function joinDetail(parts: (string | null)[]): string | null {
  const text = parts.filter((part) => part && part.length > 0).join(" ");
  return text.length > 0 ? text : null;
}

function intensityFor(level: FollowUpReviewLevel): FollowUpIntensity {
  switch (level.title) {
    case "Continue routine review": {
      return "routine";
    }
    case "Monitor the pattern": {
      return "monitor";
    }
    case "Verify with local information": {
      return "verify";
    }
    case "Conduct targeted follow-up": {
      return "targeted";
    }
    case "Coordinate a local assessment": {
      return "coordinate";
    }
    case "Prioritize targeted follow-up": {
      return "prioritize";
    }
    default: {
      return "unassigned";
    }
  }
}

function byIntensity(
  level: FollowUpReviewLevel,
  copy: Record<FollowUpIntensity, string>
): string {
  return copy[intensityFor(level)];
}

function humanRecommendation(
  county: CountyDetail,
  level: FollowUpReviewLevel
): FollowUpCopy {
  const unallocated = unallocatedSentence(county);
  const reportedCases = publishedHumanFloorValue(
    county.human_status,
    county.case_count_floor_2023
  );
  if (reportedCases === 0) {
    return {
      action: byIntensity(level, {
        coordinate:
          "Compare the published observed zero with the programs that hold case records.",
        monitor:
          "Check whether the published observed zero still matches local records.",
        prioritize:
          "Review the published observed zero before any broader response.",
        routine:
          "Check the published observed zero against local records during routine review.",
        targeted:
          "Check the published observed zero against local records, including residence and likely exposure.",
        unassigned: "Check the published observed zero against local records.",
        verify:
          "Compare the published observed zero with local surveillance records.",
      }),
      detail: joinDetail([
        "An observed zero is not a missing record and does not show that transmission is absent.",
        unallocated,
      ]),
      verifyQuestion:
        "Do local records agree with this published observed zero, including travel-associated exposure where those notes already exist?",
    };
  }
  if (reportedCases !== null) {
    return {
      action: byIntensity(level, {
        coordinate: "Compare case records across the programs that hold them.",
        monitor:
          "Check whether a change in the published count is supported by local records.",
        prioritize:
          "Review case information before any broader response, including missing or suppressed counts.",
        routine:
          "Check the published count against local records during routine review.",
        targeted:
          "Check whether local records clarify missing or suppressed counts.",
        unassigned: "Check the published count against local records.",
        verify:
          "Compare the published minimum reported cases with local surveillance records.",
      }),
      detail: joinDetail([
        intensityFor(level) === "targeted"
          ? "Review residence and likely exposure location."
          : "Include residence and likely exposure location.",
        intensityFor(level) === "unassigned"
          ? "No review level is assigned."
          : null,
        unallocated,
      ]),
      verifyQuestion:
        "Do local records, including residence and likely exposure, agree with the published count?",
    };
  }
  return {
    action: byIntensity(level, {
      coordinate:
        "Ask the programs that hold case records whether missing or suppressed counts can be clarified.",
      monitor:
        "While watching for change, check whether local records clarify missing or suppressed counts.",
      prioritize:
        "Review missing or suppressed counts before any broader response.",
      routine:
        "At the next routine review, check whether local records clarify missing or suppressed counts.",
      targeted:
        "Check whether local records clarify missing or suppressed counts.",
      unassigned:
        "Check whether local records clarify missing or suppressed counts.",
      verify:
        "Check local surveillance records for a count that is not in the published data.",
    }),
    detail: joinDetail([
      "A missing published count is not a finding of zero cases. Include suppressed or unallocated reports.",
      intensityFor(level) === "targeted"
        ? "Review residence and likely exposure location."
        : null,
      intensityFor(level) === "unassigned"
        ? "No review level is assigned."
        : null,
      unallocated,
    ]),
    verifyQuestion:
      "Are additional county case records available locally, including suppressed or unallocated reports?",
  };
}

function vectorAction(level: FollowUpReviewLevel): string {
  return byIntensity(level, {
    coordinate:
      "Compare collection dates, locations, and testing methods across the programs that hold them.",
    monitor:
      "Check whether newer tick or pathogen records change the pattern you are watching.",
    prioritize:
      "Review collection dates, locations, testing methods, and whether newer local records should change the response.",
    routine:
      "Check whether newer local tick or pathogen records should be noted at the next routine review.",
    targeted:
      "Check collection dates, locations, and testing methods, and whether newer local records are available.",
    unassigned:
      "Check published tick and pathogen data against any local records.",
    verify:
      "Check collection dates, locations, and testing methods against local records.",
  });
}

function vectorRecommendation(
  county: CountyDetail,
  level: FollowUpReviewLevel
): FollowUpCopy {
  const tickDocumented = documentedTick(county);
  const tickMissing = tickRecordMissing(county);
  const pathogen = pathogenKind(county);
  const action = vectorAction(level);
  const noted = (detail: string): string =>
    joinDetail([
      detail,
      intensityFor(level) === "unassigned"
        ? "No review level is assigned."
        : null,
    ]) ?? detail;
  if (tickDocumented && pathogen === "present") {
    return {
      action,
      detail: noted(
        "Published records include tick presence and a Borrelia burgdorferi detection. That detection is not a human transmission estimate."
      ),
      verifyQuestion:
        "How recent and local are these tick and pathogen records, and are newer local records available?",
    };
  }
  if (tickDocumented && pathogen === "negative") {
    return {
      action,
      detail: noted(
        "A tick presence record is published. The pathogen result is a documented negative finding, not a missing record. Confirm what was tested before reading it as countywide."
      ),
      verifyQuestion:
        "What ticks were tested, and does the documented negative finding cover the collections relevant to this county?",
    };
  }
  if (tickDocumented && pathogen === "missing") {
    return {
      action,
      detail: noted(
        "A tick presence record is published, and no county-level pathogen result is published. Missing results are not documented negative findings."
      ),
      verifyQuestion:
        "Was pathogen testing done, and do unpublished results exist? A missing result is not a negative test.",
    };
  }
  if (tickDocumented) {
    return {
      action,
      detail: noted(
        `The published Borrelia burgdorferi status is ${county.burgdorferi_status}. Do not read that status as absence.`
      ),
      verifyQuestion:
        "How should this published pathogen status be read alongside the tick record and any newer local collections?",
    };
  }
  if (tickMissing && pathogen === "present") {
    return {
      action,
      detail: noted(
        "A pathogen detection is published without a tick-presence classification. Do not infer countywide tick distribution from that detection alone."
      ),
      verifyQuestion:
        "Which collection does the pathogen detection come from, and is a tick-presence classification available locally?",
    };
  }
  if (tickMissing && pathogen === "negative") {
    return {
      action,
      detail: noted(
        "No tick-presence classification is published. The pathogen result is a documented negative finding, not a missing record."
      ),
      verifyQuestion:
        "What was tested, and do unpublished tick records exist outside this source?",
    };
  }
  if (tickMissing && pathogen === "other") {
    return {
      action,
      detail: noted(
        `No tick-presence classification is published. The Borrelia burgdorferi status is ${county.burgdorferi_status}, which is not absence.`
      ),
      verifyQuestion:
        "Do local records explain this pathogen status and whether tick surveillance exists outside the published source?",
    };
  }
  if (tickMissing) {
    return {
      action,
      detail: noted(
        "No published tick or pathogen record is available outside the current source. Do not treat the gap as absence, and do not start field collection only because the published record is missing."
      ),
      verifyQuestion:
        "Do tick or pathogen records exist outside the current source?",
    };
  }
  return {
    action,
    detail: noted(
      `The published tick status is ${county.tick_status}. This is not a finding of tick absence.`
    ),
    verifyQuestion:
      "Do local vector records confirm or update this published tick status?",
  };
}

function clinicalRecommendation(
  county: CountyDetail,
  level: FollowUpReviewLevel
): FollowUpCopy {
  const action = byIntensity(level, {
    coordinate:
      "If programs disagree about case identification or reporting, discuss that question together.",
    monitor:
      "If a change raises a question about case identification or reporting, discuss it with reporting partners.",
    prioritize:
      "If case review raises a reporting question that would change the response, take it to reporting partners first.",
    routine:
      "If routine review raises a reporting question, note it for the usual reporting contacts.",
    targeted:
      "If case review raises questions about case identification or reporting, discuss them with reporting partners.",
    unassigned:
      "If local records raise a reporting question, discuss it without treating the county as an assigned priority.",
    verify:
      "If local case records raise a question about identification or reporting, check it with reporting partners.",
  });
  if (!humanPublished(county)) {
    return {
      action,
      detail:
        "This is not a finding that laboratories failed to report. A missing case count is not proof of a reporting failure.",
      verifyQuestion:
        "Can local clinical or laboratory reporting clarify whether county case data are incomplete?",
    };
  }
  if (pathogenKind(county) === "present") {
    return {
      action,
      detail:
        "These records are not a test result for any individual patient, and they do not show that reporting failed.",
      verifyQuestion:
        "Do current reporting pathways account for the human and laboratory information this program already holds?",
    };
  }
  return {
    action,
    detail: "This is not a finding that reporting failed.",
    verifyQuestion:
      "Is there a local reporting question to review, or do current pathways match the surveillance record?",
  };
}

function communityAvailability(county: CountyDetail): {
  insurance: boolean;
  rural: boolean;
  vulnerability: boolean;
} {
  return {
    insurance:
      finite(county.uninsured_percent) || finite(county.uninsured_percentile),
    rural: finite(county.rucc_2023),
    vulnerability: finite(county.svi_percentile),
  };
}

function communityRecommendation(
  county: CountyDetail,
  level: FollowUpReviewLevel
): FollowUpCopy {
  const context = communityAvailability(county);
  const available = [
    context.vulnerability,
    context.insurance,
    context.rural,
  ].filter(Boolean).length;
  if (available === 0) {
    return {
      action: byIntensity(level, {
        coordinate:
          "Ask programs what community context they already use before adding outreach.",
        monitor:
          "Note that published community context is unavailable while you watch for other changes.",
        prioritize:
          "Do not treat missing community context as a reason for closer prevention follow-up.",
        routine:
          "During routine review, note that published community context is unavailable.",
        targeted:
          "Use local knowledge where published community context is missing, before deciding on prevention outreach.",
        unassigned:
          "Check what local context exists. No review level is assigned.",
        verify:
          "Check whether community context exists outside the published data.",
      }),
      detail:
        "No published social vulnerability, insurance coverage, or rural–urban classification is available.",
      verifyQuestion:
        "What local context is available before deciding whether any outreach is warranted?",
    };
  }
  const action = byIntensity(level, {
    coordinate:
      "Compare local knowledge across programs before adding prevention outreach.",
    monitor:
      "Check whether a change in community context means current prevention information no longer fits.",
    prioritize:
      "Use community context to judge whether prevention information reaches the communities that need it, before adding outreach.",
    routine:
      "During usual prevention work, check whether current information already reaches the communities these measures describe.",
    targeted:
      "Use local knowledge and community context to assess whether prevention information reaches intended communities.",
    unassigned:
      "Use the available community context before deciding whether outreach fits.",
    verify:
      "Use the published community measures, plus local knowledge, to check whether prevention information reaches intended communities.",
  });
  if (available === 3) {
    return {
      action,
      detail:
        "Social vulnerability, insurance coverage, and rural–urban classification are available as context. These measures do not show transmission or underreporting.",
      verifyQuestion:
        "Does current prevention information already reach the communities this context describes?",
    };
  }
  return {
    action,
    detail:
      "Published community context is incomplete. These measures do not show transmission or underreporting.",
    verifyQuestion:
      "Which community-context measures are still missing, and do the available ones justify any change to outreach?",
  };
}

function coordinationRecommendation(level: FollowUpReviewLevel): FollowUpCopy {
  if (level.status === "unavailable") {
    return {
      action:
        "Document what remains unclear, who might hold the missing data, and what information would change the next step.",
      detail: "No owner, deadline, or review level is assigned.",
      verifyQuestion:
        "Which missing data should be written down, and who might hold them?",
    };
  }
  return {
    action: byIntensity(level, {
      coordinate:
        "Record the shared question, who holds the missing piece, and what finding would change the next step.",
      monitor:
        "Note what changed, who can clarify it, and what information would move this beyond monitoring.",
      prioritize:
        "Record the question that justifies closer attention, who can help, and what information would change the next step.",
      routine:
        "Note what remains unclear and what new information would justify a later look.",
      targeted:
        "Document what remains unclear, who can help, and what information would change the next step.",
      unassigned: "Document what remains unclear and who might help.",
      verify:
        "Document what local records confirm, what is still unclear, and what finding would change the next step.",
    }),
    detail:
      level.title === "Prioritize targeted follow-up" ||
      level.title === "Coordinate a local assessment"
        ? "No owner or deadline is assigned."
        : null,
    verifyQuestion:
      "What is still unclear, who can help, and what information would change the next step?",
  };
}

function speciesResources(county: CountyDetail): FollowUpResource[] {
  const scapularis = DOCUMENTED_TICK.has(normalized(county.scapularis_status));
  const pacificus = DOCUMENTED_TICK.has(normalized(county.pacificus_status));
  const resources: FollowUpResource[] = [RESOURCES.tickRecords];
  if (!pacificus || scapularis) {
    resources.push(RESOURCES.blackleggedTickGuidance);
  }
  if (!scapularis || pacificus) {
    resources.push(RESOURCES.westernBlackleggedTickGuidance);
  }
  return resources;
}

function resourcesFor(
  id: FollowUpCategoryId,
  county: CountyDetail
): readonly FollowUpResource[] {
  switch (id) {
    case "human-disease-surveillance": {
      return [
        RESOURCES.countyCaseData,
        RESOURCES.caseDefinition,
        RESOURCES.caseDefinitionChange,
      ];
    }
    case "vector-pathogen-surveillance": {
      return speciesResources(county);
    }
    case "clinical-laboratory-reporting": {
      return [RESOURCES.clinicalTesting, RESOURCES.caseDefinition];
    }
    case "community-context-outreach": {
      const resources: FollowUpResource[] = [
        RESOURCES.prevention,
        RESOURCES.lymeEducation,
        RESOURCES.tickCommunication,
      ];
      if (finite(county.svi_percentile)) {
        resources.push(RESOURCES.sviInterpretation);
      }
      return resources;
    }
    case "coordination-documentation": {
      return [];
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function reviewLevel(
  county: CountyDetail,
  context: FollowUpReviewContext
): FollowUpReviewLevel {
  const nextCheck = context.governedNextCheck?.trim() || null;
  const response = approvedResponse(county.color);
  if (!county.in_contiguous_tick_scope) {
    return {
      colorResponseNote: response
        ? `Published Atlas gap-score category: ${response}. ${FOLLOW_UP_COLOR_RESPONSE_NOTE}`
        : null,
      explanation:
        "This county is outside the contiguous tick scope of the current release, so a review level is not assigned.",
      governedNextCheck: nextCheck,
      reason: "unsupported-jurisdiction",
      status: "unavailable",
      title: REVIEW_LEVEL_UNAVAILABLE,
    };
  }
  if (context.reviewResultState === "insufficient_evidence") {
    return {
      colorResponseNote: response
        ? `Published Atlas gap-score category: ${response}. ${FOLLOW_UP_COLOR_RESPONSE_NOTE}`
        : null,
      explanation: INSUFFICIENT_REVIEW_LEVEL_EXPLANATION,
      governedNextCheck: nextCheck,
      reason: "insufficient-evidence",
      status: "unavailable",
      title: REVIEW_LEVEL_UNAVAILABLE,
    };
  }
  if (response) {
    return {
      colorResponseNote: FOLLOW_UP_COLOR_RESPONSE_NOTE,
      explanation: LEVEL_EXPLANATIONS[response],
      governedNextCheck: nextCheck,
      reason: null,
      status: "assigned",
      title: response,
    };
  }
  if (publishedGapScoreMissing(county)) {
    return {
      colorResponseNote: null,
      explanation: GAP_SCORE_UNAVAILABLE_EXPLANATION,
      governedNextCheck: nextCheck,
      reason: "gap-score-unavailable",
      status: "unavailable",
      title: GAP_SCORE_UNAVAILABLE_TITLE,
    };
  }
  if (context.reviewResultState === "unsupported") {
    return {
      colorResponseNote: null,
      explanation:
        "This jurisdiction is unsupported in the current review release, so a review level is not assigned.",
      governedNextCheck: nextCheck,
      reason: "unsupported-jurisdiction",
      status: "unavailable",
      title: REVIEW_LEVEL_UNAVAILABLE,
    };
  }
  return {
    colorResponseNote: null,
    explanation:
      "The published score color is not an approved Action Center response, so a review level is not assigned.",
    governedNextCheck: nextCheck,
    reason: "recommendation-unassigned",
    status: "unavailable",
    title: REVIEW_LEVEL_UNAVAILABLE,
  };
}

function row(
  id: FollowUpCategoryId,
  county: CountyDetail,
  level: FollowUpReviewLevel,
  copy: FollowUpCopy
): FollowUpWorkflowRow {
  return {
    action: copy.action,
    detail: copy.detail,
    id,
    label: CATEGORY_LABELS[id],
    partners: PARTNER_SUGGESTIONS[id],
    recommendation: [copy.action, copy.detail].filter(Boolean).join(" "),
    resources: resourcesFor(id, county),
    verifyQuestion: copy.verifyQuestion,
  };
}

const GOVERNANCE_UNAVAILABLE_QUESTIONS = [
  "Why is a follow-up category not assigned for this county?",
  "Which published data are missing, limited, or outside the supported scope?",
  "Are state or local records available to clarify the data without assuming a response level?",
  "Should these limits be documented for routine review rather than treated as an assigned priority?",
] as const satisfies FollowUpResponseCopy["questions"];

function questionsFor(
  level: FollowUpReviewLevel
): FollowUpResponseCopy["questions"] {
  return responseCopy(level)?.questions ?? GOVERNANCE_UNAVAILABLE_QUESTIONS;
}

export function buildCountyFollowUp(
  county: CountyDetail,
  context: FollowUpReviewContext = {}
): CountyFollowUpWorkflow {
  const level = reviewLevel(county, context);
  const human = humanRecommendation(county, level);
  const vector = vectorRecommendation(county, level);
  const clinical = clinicalRecommendation(county, level);
  const community = communityRecommendation(county, level);
  const coordination = coordinationRecommendation(level);
  const copy = responseCopy(level);
  return {
    level: copy
      ? {
          ...level,
          explanation: copy.explanation,
        }
      : level,
    questions: questionsFor(level),
    rows: [
      row("human-disease-surveillance", county, level, human),
      row("vector-pathogen-surveillance", county, level, vector),
      row("clinical-laboratory-reporting", county, level, clinical),
      row("community-context-outreach", county, level, community),
      row("coordination-documentation", county, level, coordination),
    ],
    verificationNote:
      level.status === "unavailable" ? FOLLOW_UP_VERIFICATION_NOTE : null,
  };
}

export interface FollowUpPlan {
  actions: { owner: string; task: string }[];
  level: string;
  reviewAvailable: boolean;
  summary: string;
  unavailableReason: FollowUpUnavailableReason | null;
}

/** Adapter for callers that still read the older plan shape. No deadlines. */
export function followUpPlanFor(county: CountyDetail): FollowUpPlan {
  const workflow = buildCountyFollowUp(county);
  return {
    actions: workflow.rows.map((entry) => ({
      owner: entry.label,
      task: entry.recommendation,
    })),
    level: workflow.level.title,
    reviewAvailable: workflow.level.status === "assigned",
    summary: workflow.level.explanation,
    unavailableReason: workflow.level.reason,
  };
}
