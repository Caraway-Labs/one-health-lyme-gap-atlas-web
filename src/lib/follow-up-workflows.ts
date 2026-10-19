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
 * categories. Copy is chosen from published county evidence. This module does
 * not assign score cutoffs or treat a map color as a new review scale.
 */

export const FOLLOW_UP_INTERPRETATION =
  "Atlas supports professional review, not individual risk measurement, proof of underreporting, or a mandate for investigation.";

/** The same limitation applies when a review level is unassigned. */
export const FOLLOW_UP_UNAVAILABLE_INTERPRETATION = FOLLOW_UP_INTERPRETATION;

const UNASSIGNED_STANCE = "Without an assigned review level,";

export const FOLLOW_UP_VERIFICATION_NOTE =
  "These rows are evidence-verification considerations, not a scored recommendation or an instruction to escalate surveillance.";

export const FOLLOW_UP_COLOR_RESPONSE_NOTE = FOLLOW_UP_PUBLISHED_SOURCE_LABEL;

export const REVIEW_LEVEL_UNAVAILABLE = "Review level unavailable";

export const INSUFFICIENT_REVIEW_LEVEL_EXPLANATION =
  "Available evidence is insufficient to assign a review level.";

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
  "clinical-laboratory-reporting": "Clinical and laboratory reporting",
  "community-context-outreach": "Community context and outreach",
  "coordination-documentation": "Coordination and documentation",
  "human-disease-surveillance": "Human disease surveillance",
  "vector-pathogen-surveillance": "Vector and pathogen surveillance",
};

const PARTNER_SUGGESTIONS: Record<FollowUpCategoryId, string> = {
  "clinical-laboratory-reporting": "Clinical and laboratory reporting partners",
  "community-context-outreach":
    "Health educators or community partners, if local review finds an outreach need",
  "coordination-documentation": "The program’s existing documentation workflow",
  "human-disease-surveillance":
    "State or local epidemiology and surveillance staff",
  "vector-pathogen-surveillance":
    "State vector-borne disease program, entomology, or established tick-surveillance partners",
};

const LEVEL_EXPLANATIONS: Record<
  (typeof SUGGESTED_FOLLOW_UP_BY_COLOR)[ReviewPriorityColor],
  string
> = {
  "Conduct targeted follow-up":
    "Consider a focused local check of the evidence questions below. Staffing and timing remain local program decisions.",
  "Continue routine review":
    "Maintain established surveillance review and revisit this county as new published data become available.",
  "Coordinate a local assessment":
    "Consider whether local partners should compare notes on the questions below. This does not assign owners or a deadline.",
  "Monitor the pattern":
    "Watch for changes in published findings and review additional information as it becomes available.",
  "Prioritize targeted follow-up":
    "Consider coordinated follow-up if local findings justify it. This is not an instruction to launch an investigation.",
  "Verify with local information":
    "Compare published observations with locally held records before deciding whether the pattern needs a closer look.",
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

/** Curated references for the Explorer resources card. URLs come from the
 * approved follow-up catalog or existing Atlas documentation routes. */
export const OFFICIAL_FOLLOW_UP_RESOURCES = [
  {
    category: "Lyme disease surveillance",
    description:
      "National surveillance case definition used for public-health reporting.",
    external: true,
    href: RESOURCES.caseDefinition.href,
    id: RESOURCES.caseDefinition.id,
    label: RESOURCES.caseDefinition.label,
  },
  {
    category: "Lyme disease surveillance",
    description:
      "How published county case counts relate to residence and exposure.",
    external: true,
    href: RESOURCES.countyCaseData.href,
    id: RESOURCES.countyCaseData.id,
    label: RESOURCES.countyCaseData.label,
  },
  {
    category: "Tick and vector surveillance",
    description:
      "Definitions and limitations for published tick and pathogen records.",
    external: true,
    href: RESOURCES.tickRecords.href,
    id: RESOURCES.tickRecords.id,
    label: RESOURCES.tickRecords.label,
  },
  {
    category: "Tick and vector surveillance",
    description:
      "CDC guidance for blacklegged tick surveillance and interpretation.",
    external: true,
    href: RESOURCES.blackleggedTickGuidance.href,
    id: RESOURCES.blackleggedTickGuidance.id,
    label: RESOURCES.blackleggedTickGuidance.label,
  },
  {
    category: "Clinical testing and reporting",
    description:
      "CDC guidance on laboratory testing used in Lyme disease diagnosis.",
    external: true,
    href: RESOURCES.clinicalTesting.href,
    id: RESOURCES.clinicalTesting.id,
    label: RESOURCES.clinicalTesting.label,
  },
  {
    category: "Prevention and outreach",
    description:
      "CDC prevention information for public-health education and outreach.",
    external: true,
    href: RESOURCES.prevention.href,
    id: RESOURCES.prevention.id,
    label: RESOURCES.prevention.label,
  },
  {
    category: "Atlas data and methodology",
    description:
      "Published sources, measures, and the limits of the evidence Atlas shows.",
    external: false,
    href: "/docs/sources-and-canonical-evidence",
    id: "atlas-sources",
    label: "Sources and canonical evidence",
  },
  {
    category: "Atlas data and methodology",
    description: "How published releases and scores are produced.",
    external: false,
    href: "/docs/releases-and-methodology",
    id: "atlas-methodology",
    label: "Releases and methodology",
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

function joinDetail(parts: (string | null)[]): string | null {
  const text = parts.filter((part) => part && part.length > 0).join(" ");
  return text.length > 0 ? text : null;
}

function humanRecommendation(county: CountyDetail): FollowUpCopy {
  const unallocated = unallocatedSentence(county);
  if (humanPublished(county)) {
    const observedZero = county.case_count_floor_2023 === 0;
    if (observedZero) {
      return {
        action:
          "Compare the published observed zero with local surveillance records.",
        detail: joinDetail([
          "An observed zero is not a missing record and does not establish that transmission is absent.",
          unallocated,
        ]),
        verifyQuestion:
          "Do local records agree with this published observed zero, including travel-associated exposure where those notes already exist?",
      };
    }
    return {
      action:
        "Compare the published county case-count floor with state or local surveillance records.",
      detail: joinDetail([
        "Include reporting completeness and residence-versus-exposure differences where investigation notes already exist.",
        unallocated,
      ]),
      verifyQuestion:
        "Do local surveillance records, including exposure location where it was collected, agree with this published county floor?",
    };
  }
  return {
    action:
      "Check whether additional county case information is available through local surveillance records.",
    detail: joinDetail([
      "Include suppressed or unallocated reports. A missing published count is not a finding of zero cases.",
      unallocated,
    ]),
    verifyQuestion:
      "Are additional county case records available locally, including suppressed or unallocated reports?",
  };
}

function vectorRecommendation(county: CountyDetail): FollowUpCopy {
  const tickDocumented = documentedTick(county);
  const tickMissing = tickRecordMissing(county);
  const pathogen = pathogenKind(county);
  if (tickDocumented && pathogen === "present") {
    return {
      action:
        "Examine the published tick presence and Borrelia burgdorferi detection with a vector-surveillance partner.",
      detail:
        "Include the time and geographic coverage of collections where local records include that detail. Detection is not a human transmission estimate.",
      verifyQuestion:
        "What time period and geography do the published tick and pathogen records cover, and are newer local records available?",
    };
  }
  if (tickDocumented && pathogen === "negative") {
    return {
      action:
        "Confirm the test methods and coverage of this documented negative pathogen finding with a vector-surveillance partner.",
      detail:
        "A tick presence record is published. The pathogen record is a documented negative finding rather than a missing record. Do not treat that negative as countywide without confirming coverage.",
      verifyQuestion:
        "What ticks were tested, and does the documented negative finding cover the collections relevant to this county?",
    };
  }
  if (tickDocumented && pathogen === "missing") {
    return {
      action: "Determine whether pathogen testing exists outside this source.",
      detail:
        "A tick presence record is published, and no county-level Borrelia burgdorferi detection record is published. Missing records are not documented negative findings.",
      verifyQuestion:
        "Was pathogen testing done, and do unpublished results exist? Absence of a published record is not a negative test.",
    };
  }
  if (tickDocumented) {
    return {
      action:
        "Examine this published pathogen status with the tick record and local vector partners.",
      detail: `The published Borrelia burgdorferi status is ${county.burgdorferi_status}. This status is not treated as absence.`,
      verifyQuestion:
        "How should this published pathogen status be read alongside the tick record and any newer local collections?",
    };
  }
  if (tickMissing && pathogen === "present") {
    return {
      action:
        "Examine the published Borrelia burgdorferi detection with a vector-surveillance partner.",
      detail:
        "No documented tick-presence classification is in this record. Do not infer countywide tick distribution from that detection alone.",
      verifyQuestion:
        "Which collection does the pathogen detection come from, and is a tick-presence classification available locally?",
    };
  }
  if (tickMissing && pathogen === "negative") {
    return {
      action:
        "Confirm what was tested before treating this documented negative finding as countywide.",
      detail:
        "No published tick-presence classification is available. The pathogen record is a documented negative finding rather than a missing record.",
      verifyQuestion:
        "What was tested, and do unpublished tick records exist outside this source?",
    };
  }
  if (tickMissing && pathogen === "other") {
    return {
      action:
        "Examine this pathogen status and any local tick surveillance with a vector-surveillance partner.",
      detail: `No documented tick-presence classification is published. The Borrelia burgdorferi status is ${county.burgdorferi_status}, which is not treated as absence.`,
      verifyQuestion:
        "Do local records explain this pathogen status and whether tick surveillance exists outside the published source?",
    };
  }
  if (tickMissing) {
    return {
      action:
        "Determine whether tick or pathogen records exist outside the current source.",
      detail:
        "No published tick or matching pathogen record is available for this county. Do not treat the gap as absence, and do not start field collection only because the published record is missing.",
      verifyQuestion:
        "Do tick or pathogen records exist outside the currently published source?",
    };
  }
  return {
    action:
      "Check whether newer local records change how this published tick status should be read.",
    detail: `The published tick status is ${county.tick_status}. This is not a finding of tick absence.`,
    verifyQuestion:
      "Do local vector records confirm or update this published tick status?",
  };
}

function clinicalRecommendation(county: CountyDetail): FollowUpCopy {
  if (!humanPublished(county)) {
    return {
      action:
        "Check local laboratory and clinical reporting pathways only if surveillance records raise a case-ascertainment question.",
      detail: "This is not a finding that laboratories failed to report.",
      verifyQuestion:
        "Can local clinical or laboratory reporting information clarify whether county case data are incomplete?",
    };
  }
  if (pathogenKind(county) === "present") {
    return {
      action:
        "Check whether clinical and laboratory reporting pathways can be compared with the published human and pathogen records.",
      detail:
        "This county evidence does not indicate a test for any individual patient.",
      verifyQuestion:
        "Do current reporting pathways account for the human and laboratory information this program already holds?",
    };
  }
  return {
    action:
      "Check whether current reporting pathways match the human surveillance information already available locally.",
    detail: "This county record does not show that reporting failed.",
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

function communityRecommendation(county: CountyDetail): FollowUpCopy {
  const context = communityAvailability(county);
  const available = [
    context.vulnerability,
    context.insurance,
    context.rural,
  ].filter(Boolean).length;
  if (available === 3) {
    return {
      action:
        "Consider whether existing prevention education reaches the communities these measures describe before adding outreach.",
      detail:
        "Social vulnerability, health insurance coverage, and rural–urban classification are available as context. They are not evidence of transmission or underreporting.",
      verifyQuestion:
        "Does existing prevention education already reach the communities this context describes, or is more local information needed first?",
    };
  }
  if (available === 0) {
    return {
      action:
        "Identify that local information gap before deciding whether outreach is appropriate.",
      detail:
        "No published social vulnerability, insurance coverage, or rural–urban classification is available.",
      verifyQuestion:
        "What local context is available before deciding whether any outreach is warranted?",
    };
  }
  return {
    action:
      "Check the community-context measures that are available, and the ones that are missing, before deciding whether outreach is appropriate.",
    detail:
      "Community context is incomplete in the published record. These measures are not evidence of transmission or underreporting.",
    verifyQuestion:
      "Which community-context measures are still missing, and do the available ones justify any change to outreach?",
  };
}

function coordinationRecommendation(level: FollowUpReviewLevel): FollowUpCopy {
  if (level.status === "unavailable") {
    return {
      action:
        "Document which evidence is missing and which local or state partner might hold it.",
      detail:
        "These notes support local verification. Atlas does not assign an owner, a deadline, or an escalation.",
      verifyQuestion:
        "Which missing evidence should be written down, and which local or state partner might hold it?",
    };
  }
  return {
    action:
      "Document the outstanding evidence questions and the surveillance or vector-program partners who might verify them.",
    detail: "Atlas does not assign that work or a completion date.",
    verifyQuestion:
      "What is the main surveillance question to record, and who might hold the records that would answer it?",
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

function stanceFor(level: FollowUpReviewLevel): string {
  return responseCopy(level)?.stance ?? UNASSIGNED_STANCE;
}

function withStance(level: FollowUpReviewLevel, action: string): string {
  const body = action.charAt(0).toLowerCase() + action.slice(1);
  return `${stanceFor(level)} ${body}`;
}

function row(
  id: FollowUpCategoryId,
  county: CountyDetail,
  level: FollowUpReviewLevel,
  copy: FollowUpCopy
): FollowUpWorkflowRow {
  const action = withStance(level, copy.action);
  return {
    action,
    detail: copy.detail,
    id,
    label: CATEGORY_LABELS[id],
    partners: PARTNER_SUGGESTIONS[id],
    recommendation: [action, copy.detail].filter(Boolean).join(" "),
    resources: resourcesFor(id, county),
    verifyQuestion: copy.verifyQuestion,
  };
}

const GOVERNANCE_UNAVAILABLE_QUESTIONS = [
  "Why is a follow-up category not assigned for this county?",
  "Which published evidence is missing, limited, or outside the supported scope?",
  "Are relevant state or local records available to clarify the evidence without assuming a particular response level?",
  "Should these limitations be documented for routine review rather than treated as an assigned priority?",
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
  const human = humanRecommendation(county);
  const vector = vectorRecommendation(county);
  const clinical = clinicalRecommendation(county);
  const community = communityRecommendation(county);
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
