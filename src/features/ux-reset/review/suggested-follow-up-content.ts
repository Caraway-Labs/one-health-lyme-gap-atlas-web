import type { CountyDetail } from "@/generated/models";
import { plainPriority } from "@/lib/atlas-ui";

/**
 * Suggested follow-up for the expanded Atlas Explorer county evidence view.
 *
 * Consume `selectSuggestedFollowUp` from the expanded view once Explorer UI
 * work is ready to integrate. Do not render internal identifiers. Review
 * priority stays on the published priority string (`authoritativeReviewCategory`).
 * This module does not change scoring, palette tokens, or category mappings.
 *
 * Score-color bands are the shared package `score_color` cut points pinned by
 * API commit 83ccbe76047185f6aacaff551afd8b03d88aa5cf. Priority labels are that
 * package's `priority_label` cut points. The two scales do not share edges.
 */

export const SUGGESTED_FOLLOW_UP_INTERPRETATION =
  "These suggestions support review of county-level evidence. They do not establish local transmission, underreporting, or an individual’s risk.";

export const GENERAL_REVIEW_STEPS_NOTE =
  "Use these general review steps alongside local information.";

export const TICK_INFORMATION_LIMITED_NOTE =
  "Tick surveillance information is limited. Check whether local records are available before interpreting the absence of published records.";

export const SINGLE_PERIOD_NOTE =
  "Use future updates to assess whether this pattern persists; the current evidence does not establish a trend.";

export const SCORE_BAND_RECONCILIATION =
  "Keep the published priority label on the map, legend, preview, and expanded review category. Suggested follow-up may use the six score-color bands. Do not replace a published label with the approved color-table category while those labels differ. Aligning them requires a product decision because score-color edges (20, 35, 50, 65, 75) and priority-label edges (30, 50, 70) are different scales.";

export const FOLLOW_UP_RESPONSE_IDS = [
  "continue-routine-review",
  "monitor-the-pattern",
  "verify-with-local-information",
  "prioritize-targeted-follow-up",
] as const;

export type FollowUpResponseId = (typeof FOLLOW_UP_RESPONSE_IDS)[number];

export const SCORE_BAND_IDS = [
  "map-ramp-1",
  "map-ramp-2",
  "map-ramp-3",
  "map-ramp-4",
  "map-ramp-5",
  "map-ramp-6",
] as const;

export type ScoreBandId = (typeof SCORE_BAND_IDS)[number];

export type ReviewCategoryLabel =
  | "Highest review priority"
  | "Moderate review priority"
  | "Lower review priority";

type ScoreBandDefinition = {
  approvedReviewCategory: ReviewCategoryLabel;
  color: string;
  id: ScoreBandId;
  maxExclusive: number | null;
  minInclusive: number;
  responseId: FollowUpResponseId;
  token: `--${ScoreBandId}`;
};

/**
 * Semantic bands for the existing `--map-ramp-*` tokens. Ranges document
 * `score_color`; selection uses the published color, not a recomputed score.
 */
export const SCORE_COLOR_BANDS: readonly ScoreBandDefinition[] = [
  {
    approvedReviewCategory: "Lower review priority",
    color: "#a9d2db",
    id: "map-ramp-1",
    maxExclusive: 20,
    minInclusive: 0,
    responseId: "continue-routine-review",
    token: "--map-ramp-1",
  },
  {
    approvedReviewCategory: "Lower review priority",
    color: "#55a8a3",
    id: "map-ramp-2",
    maxExclusive: 35,
    minInclusive: 20,
    responseId: "continue-routine-review",
    token: "--map-ramp-2",
  },
  {
    approvedReviewCategory: "Moderate review priority",
    color: "#87b982",
    id: "map-ramp-3",
    maxExclusive: 50,
    minInclusive: 35,
    responseId: "monitor-the-pattern",
    token: "--map-ramp-3",
  },
  {
    approvedReviewCategory: "Moderate review priority",
    color: "#efc64a",
    id: "map-ramp-4",
    maxExclusive: 65,
    minInclusive: 50,
    responseId: "verify-with-local-information",
    token: "--map-ramp-4",
  },
  {
    approvedReviewCategory: "Highest review priority",
    color: "#f49a32",
    id: "map-ramp-5",
    maxExclusive: 75,
    minInclusive: 65,
    responseId: "prioritize-targeted-follow-up",
    token: "--map-ramp-5",
  },
  {
    approvedReviewCategory: "Highest review priority",
    color: "#e9602b",
    id: "map-ramp-6",
    maxExclusive: null,
    minInclusive: 75,
    responseId: "prioritize-targeted-follow-up",
    token: "--map-ramp-6",
  },
];

export const OUT_OF_SCOPE_SCORE_COLOR = "#e4e9ea";

/**
 * Phrases from the previous six-response scheme. They are not approved copy.
 * `src/lib/atlas-ui.ts` still maps some colors to these phrases.
 */
export const RETIRED_FOLLOW_UP_PHRASES = [
  "Conduct targeted follow-up",
  "Coordinate a local assessment",
] as const;

export type OfficialResource = {
  href: string;
  id: string;
  label: string;
};

export const OFFICIAL_RESOURCES = {
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
} as const satisfies Record<string, OfficialResource>;

export type SuggestedFollowUpActivity = {
  description: string;
  id: string;
  partners: string;
  purpose: string;
  resources: readonly OfficialResource[];
  title: string;
  whyThisSuggestion: string | null;
};

export type SuggestedFollowUpSelection = {
  activities: readonly SuggestedFollowUpActivity[];
  approvedReviewCategory: ReviewCategoryLabel | null;
  authoritativePriority: string;
  authoritativeReviewCategory: string;
  bandId: ScoreBandId | null;
  categoryConflict: string | null;
  closing: string | null;
  generalFallbackNote: string | null;
  interpretationNote: string;
  introduction: string | null;
  responseId: FollowUpResponseId | null;
  responseTitle: string | null;
  singlePeriodNote: string | null;
  tickLimitedNote: string | null;
};

export type SuggestedFollowUpEvidence = {
  burgdorferiStatus: string;
  caseCountFloor2023: number | null;
  color: string;
  comparableReportingPeriods: number | null;
  humanStatus: string;
  incidenceFloor2023: number | null;
  lowIncidenceBreakpoint: number | null;
  pacificusStatus: string | null;
  priority: string;
  rucc2023: number | null;
  scapularisStatus: string | null;
  sviPercentile: number | null;
  tickStatus: string;
  uninsuredPercent: number | null;
  uninsuredPercentile: number | null;
};

type ActivityTemplate = {
  description: string;
  id: string;
  partners: string;
  purpose: string;
  resourceKeys: readonly (keyof typeof OFFICIAL_RESOURCES)[];
  title: string;
};

const ACTIVITIES = {
  assessTickSurveillanceCoverage: {
    description:
      "Review where, when, and how relevant ticks were collected and tested. Determine whether existing information answers the local question or whether targeted sampling would add useful evidence.",
    id: "assess-tick-surveillance-coverage",
    partners:
      "State vector-borne disease program, entomologists, and established surveillance partners.",
    purpose:
      "Identify the specific evidence question that additional surveillance would address.",
    resourceKeys: [
      "tickRecords",
      "blackleggedTickGuidance",
      "westernBlackleggedTickGuidance",
    ],
    title: "Assess tick surveillance coverage",
  },
  checkHumanSurveillanceContext: {
    description:
      "Ask the state or local surveillance team whether published figures reflect available local records, known backlogs, missing county assignments, or changes in reporting and classification.",
    id: "check-human-surveillance-context",
    partners: "State or local epidemiology and surveillance staff.",
    purpose:
      "Determine whether a data or surveillance-process issue helps explain the pattern.",
    resourceKeys: ["countyCaseData", "caseDefinition", "caseDefinitionChange"],
    title: "Check the human surveillance context",
  },
  checkLaboratoryReportingPathways: {
    description:
      "If reporting completeness is a concern, confirm that relevant test results reach surveillance systems and are recognized correctly, including standard and modified two-tier testing results.",
    id: "check-laboratory-reporting-pathways",
    partners:
      "Surveillance informatics staff and clinical or reference laboratory partners.",
    purpose:
      "Identify potential gaps in receipt or recognition of reportable laboratory results.",
    resourceKeys: ["clinicalTesting", "caseDefinition"],
    title: "Check laboratory reporting pathways",
  },
  clarifyLikelyExposureLocation: {
    description:
      "Where exposure information is available through existing workflows, consider travel and exposures outside the county of residence.",
    id: "clarify-likely-exposure-location",
    partners: "Epidemiology and case investigation staff.",
    purpose:
      "Assess whether reported resident cases support local acquisition.",
    resourceKeys: ["countyCaseData"],
    title: "Clarify likely exposure location",
  },
  considerFocusedEducationOrOutreach: {
    description:
      "If local findings identify a need, select an audience and a specific message—for example, reporting instructions for clinicians or tick-bite prevention for people using identified exposure settings.",
    id: "consider-focused-education-or-outreach",
    partners:
      "Clinician networks, health educators, and community or recreation partners.",
    purpose:
      "Turn supported findings into useful prevention or reporting activities.",
    resourceKeys: ["lymeEducation", "tickCommunication", "sviInterpretation"],
    title: "Consider focused education or outreach",
  },
  identifyCloserReviewTriggers: {
    description:
      "Note findings that would justify another look, such as new Lyme-pathogen detections in ticks, credible reports of local acquisition, or an unexplained reporting change.",
    id: "identify-closer-review-triggers",
    partners: "Epidemiology and vector surveillance staff.",
    purpose:
      "Establish a practical reason to move from monitoring to verification.",
    resourceKeys: ["tickRecords", "countyCaseData", "caseDefinitionChange"],
    title: "Identify what would prompt closer review",
  },
  keepLocalTickInformationCurrent: {
    description:
      "Incorporate new tick or pathogen findings from the state vector program or other established surveillance partners.",
    id: "keep-local-tick-information-current",
    partners:
      "State vector-borne disease program and established tick surveillance partners.",
    purpose:
      "Identify new evidence that changes the county’s ecological context.",
    resourceKeys: [
      "tickRecords",
      "blackleggedTickGuidance",
      "westernBlackleggedTickGuidance",
    ],
    title: "Keep local tick information current",
  },
  maintainPreventionAndReportingResources: {
    description:
      "Keep existing tick-bite prevention materials and jurisdiction-specific reporting instructions available to clinicians and community partners.",
    id: "maintain-prevention-and-reporting-resources",
    partners: "Health educators, clinician networks, and surveillance staff.",
    purpose: "Keep routine resources current and accessible.",
    resourceKeys: ["lymeEducation", "tickCommunication"],
    title: "Maintain prevention and reporting resources",
  },
  placeCountyInRegionalContext: {
    description:
      "Compare counties with similar ecological settings and reporting practices, including nearby counties where appropriate.",
    id: "place-county-in-regional-context",
    partners: "State or regional surveillance staff.",
    purpose:
      "Assess whether the pattern is isolated or part of a broader regional picture.",
    resourceKeys: ["countyCaseData", "tickRecords"],
    title: "Place the county in regional context",
  },
  reviewComparableReportingPeriods: {
    description:
      "Examine available counts and rates across periods with reasonably comparable surveillance methods. Consider whether a rate change reflects only a small change in case count.",
    id: "review-comparable-reporting-periods",
    partners: "Epidemiology and surveillance staff.",
    purpose: "Determine whether the apparent pattern is sustained or unstable.",
    resourceKeys: ["countyCaseData", "caseDefinition", "caseDefinitionChange"],
    title: "Review comparable reporting periods",
  },
  reviewHumanSurveillanceFindings: {
    description:
      "Review available county reports and reporting history. Where relevant and feasible, examine selected records to clarify exposure location, classification, or reporting completeness.",
    id: "review-human-surveillance-findings",
    partners: "State or local epidemiology and surveillance staff.",
    purpose:
      "Identify whether human surveillance findings support the concern or offer an explanation.",
    resourceKeys: ["countyCaseData", "caseDefinition", "caseDefinitionChange"],
    title: "Review human surveillance findings",
  },
  reviewTickEvidenceBehindFlag: {
    description:
      "Confirm the tick species, pathogen, collection dates, sampling locations, and methods where available. Ask whether newer local findings are absent from the published source.",
    id: "review-tick-evidence-behind-flag",
    partners:
      "State vector-borne disease program and established tick surveillance partners.",
    purpose:
      "Assess how directly the tick evidence informs the county’s current situation.",
    resourceKeys: [
      "tickRecords",
      "blackleggedTickGuidance",
      "westernBlackleggedTickGuidance",
    ],
    title: "Review the tick evidence behind the flag",
  },
  reviewUpdatedSurveillanceData: {
    description:
      "Check newly available county case counts and rates during your program’s usual review cycle. Note corrections, reporting delays, or changes in data completeness.",
    id: "review-updated-surveillance-data",
    partners: "Epidemiology and surveillance staff.",
    purpose: "Determine whether updated information warrants closer review.",
    resourceKeys: ["countyCaseData", "caseDefinition", "caseDefinitionChange"],
    title: "Review updated surveillance data",
  },
} as const satisfies Record<string, ActivityTemplate>;

type ResponseTemplate = {
  activityKeys: readonly (keyof typeof ACTIVITIES)[];
  closing: string | null;
  id: FollowUpResponseId;
  introduction: string;
  title: string;
};

const RESPONSES = {
  "continue-routine-review": {
    activityKeys: [
      "reviewUpdatedSurveillanceData",
      "keepLocalTickInformationCurrent",
      "maintainPreventionAndReportingResources",
    ],
    closing: null,
    id: "continue-routine-review",
    introduction:
      "Continue reviewing this county through existing surveillance activities. Revisit the evidence as updated case reports, tick surveillance findings, or local information become available.",
    title: "Continue routine review",
  },
  "monitor-the-pattern": {
    activityKeys: [
      "reviewComparableReportingPeriods",
      "placeCountyInRegionalContext",
      "identifyCloserReviewTriggers",
    ],
    closing: null,
    id: "monitor-the-pattern",
    introduction:
      "Watch whether the pattern persists or changes as new information becomes available. Review it alongside comparable counties and known changes in surveillance practices.",
    title: "Monitor the pattern",
  },
  "prioritize-targeted-follow-up": {
    activityKeys: [
      "reviewHumanSurveillanceFindings",
      "assessTickSurveillanceCoverage",
      "checkLaboratoryReportingPathways",
      "considerFocusedEducationOrOutreach",
    ],
    closing: "Choose a focused next step with local partners.",
    id: "prioritize-targeted-follow-up",
    introduction:
      "Bring the evidence driving this county’s review priority to relevant surveillance partners. Identify the most important unresolved question and choose a focused next step based on local findings and available capacity.",
    title: "Prioritize targeted follow-up",
  },
  "verify-with-local-information": {
    activityKeys: [
      "checkHumanSurveillanceContext",
      "clarifyLikelyExposureLocation",
      "reviewTickEvidenceBehindFlag",
    ],
    closing:
      "Document whether local information explains the pattern, identifies a data gap, or supports more focused follow-up.",
    id: "verify-with-local-information",
    introduction:
      "Compare the evidence driving this county’s review priority with local surveillance knowledge. Focus on whether data coverage, exposure location, or reporting practices help explain the pattern.",
    title: "Verify with local information",
  },
} as const satisfies Record<FollowUpResponseId, ResponseTemplate>;

const HUMAN_ACTIVITY: Record<FollowUpResponseId, keyof typeof ACTIVITIES> = {
  "continue-routine-review": "reviewUpdatedSurveillanceData",
  "monitor-the-pattern": "reviewComparableReportingPeriods",
  "prioritize-targeted-follow-up": "reviewHumanSurveillanceFindings",
  "verify-with-local-information": "checkHumanSurveillanceContext",
};

const TICK_ACTIVITY: Record<FollowUpResponseId, keyof typeof ACTIVITIES> = {
  "continue-routine-review": "keepLocalTickInformationCurrent",
  "monitor-the-pattern": "identifyCloserReviewTriggers",
  "prioritize-targeted-follow-up": "assessTickSurveillanceCoverage",
  "verify-with-local-information": "reviewTickEvidenceBehindFlag",
};

const DOCUMENTED_TICK_STATUSES = new Set(["established", "reported"]);

export const SUPPORTED_EVIDENCE_RULES = [
  "documented-pathogen-with-low-incidence",
  "tick-documented-without-pathogen-record",
  "missing-published-human-cases",
  "displayed-access-context",
] as const;

export const UNSUPPORTED_EVIDENCE_RULES = [
  {
    id: "old-or-geographically-limited-tick-records",
    requirement:
      "Collection date, sampling extent, or representativeness metadata. County detail does not include those fields, and this module does not invent an age cutoff.",
  },
  {
    id: "apparent-change-in-reported-cases",
    requirement:
      "A comparable within-county time series. The published county record used here has a 2023 floor only, so no county-specific trend explanation is emitted.",
  },
] as const;

export function evidenceFromCounty(
  county: CountyDetail,
  lowIncidenceBreakpoint: number | null,
  comparableReportingPeriods: number | null = null
): SuggestedFollowUpEvidence {
  return {
    burgdorferiStatus: county.burgdorferi_status,
    caseCountFloor2023: county.case_count_floor_2023,
    color: county.color,
    comparableReportingPeriods,
    humanStatus: county.human_status,
    incidenceFloor2023: county.incidence_floor_2023,
    lowIncidenceBreakpoint,
    pacificusStatus: county.pacificus_status,
    priority: county.priority,
    rucc2023: county.rucc_2023,
    scapularisStatus: county.scapularis_status,
    sviPercentile: county.svi_percentile,
    tickStatus: county.tick_status,
    uninsuredPercent: county.uninsured_percent,
    uninsuredPercentile: county.uninsured_percentile,
  };
}

export function scoreBandForColor(color: string): ScoreBandDefinition | null {
  const normalized = color.trim().toLowerCase();
  return SCORE_COLOR_BANDS.find((band) => band.color === normalized) ?? null;
}

export function selectSuggestedFollowUp(
  evidence: SuggestedFollowUpEvidence
): SuggestedFollowUpSelection {
  const band = scoreBandForColor(evidence.color);
  const authoritativeReviewCategory = plainPriority(evidence.priority);
  const approvedReviewCategory = band?.approvedReviewCategory ?? null;
  const categoryConflict =
    band && approvedReviewCategory !== authoritativeReviewCategory
      ? `${band.id} (${band.color}) is approved as “${approvedReviewCategory},” while the published priority “${evidence.priority}” displays as “${authoritativeReviewCategory}.” ${SCORE_BAND_RECONCILIATION}`
      : null;
  if (!band) {
    return {
      activities: [],
      approvedReviewCategory: null,
      authoritativePriority: evidence.priority,
      authoritativeReviewCategory,
      bandId: null,
      categoryConflict: null,
      closing: null,
      generalFallbackNote: null,
      interpretationNote: SUGGESTED_FOLLOW_UP_INTERPRETATION,
      introduction: null,
      responseId: null,
      responseTitle: null,
      singlePeriodNote: null,
      tickLimitedNote: null,
    };
  }

  const response = RESPONSES[band.responseId];
  const whyByActivity = new Map<keyof typeof ACTIVITIES, string[]>();
  const extraActivities: (keyof typeof ACTIVITIES)[] = [];
  applyEvidenceRules(evidence, response.id, whyByActivity, extraActivities);

  const orderedKeys = [
    ...response.activityKeys.filter((key) => whyByActivity.has(key)),
    ...extraActivities.filter((key) => whyByActivity.has(key)),
    ...response.activityKeys.filter((key) => !whyByActivity.has(key)),
  ];
  const seen = new Set<string>();
  const activities: SuggestedFollowUpActivity[] = [];
  for (const key of orderedKeys) {
    const template = ACTIVITIES[key];
    if (seen.has(template.id)) {
      continue;
    }
    seen.add(template.id);
    const reasons = whyByActivity.get(key) ?? [];
    activities.push({
      description: template.description,
      id: template.id,
      partners: template.partners,
      purpose: template.purpose,
      resources: resourcesFor(template, evidence),
      title: template.title,
      whyThisSuggestion: reasons.length > 0 ? reasons.join(" ") : null,
    });
  }

  const tailored = activities.some(
    (activity) => activity.whyThisSuggestion !== null
  );
  return {
    activities,
    approvedReviewCategory,
    authoritativePriority: evidence.priority,
    authoritativeReviewCategory,
    bandId: band.id,
    categoryConflict,
    closing: response.closing,
    generalFallbackNote: tailored ? null : GENERAL_REVIEW_STEPS_NOTE,
    interpretationNote: SUGGESTED_FOLLOW_UP_INTERPRETATION,
    introduction: response.introduction,
    responseId: response.id,
    responseTitle: response.title,
    singlePeriodNote: singlePeriodNote(evidence, response.id),
    tickLimitedNote: tickLimitedNote(evidence, response.id),
  };
}

function applyEvidenceRules(
  evidence: SuggestedFollowUpEvidence,
  responseId: FollowUpResponseId,
  whyByActivity: Map<keyof typeof ACTIVITIES, string[]>,
  extraActivities: (keyof typeof ACTIVITIES)[]
): void {
  if (pathogenWithLowIncidence(evidence)) {
    addWhy(whyByActivity, TICK_ACTIVITY[responseId], pathogenTickWhy(evidence));
    addWhy(
      whyByActivity,
      HUMAN_ACTIVITY[responseId],
      pathogenHumanWhy(evidence)
    );
    addWhy(
      whyByActivity,
      "clarifyLikelyExposureLocation",
      "Question for local verification: where existing workflows already capture exposure, consider travel and exposures outside the county of residence. Reported residence is not an observed exposure location."
    );
    if (!responseHasActivity(responseId, "clarifyLikelyExposureLocation")) {
      extraActivities.push("clarifyLikelyExposureLocation");
    }
  } else if (tickWithoutPathogenRecord(evidence)) {
    addWhy(
      whyByActivity,
      TICK_ACTIVITY[responseId],
      tickWithoutPathogenWhy(evidence)
    );
  }

  if (missingPublishedHumanCases(evidence)) {
    addWhy(
      whyByActivity,
      HUMAN_ACTIVITY[responseId],
      missingHumanWhy(evidence)
    );
  }

  if (displayedAccessContext(evidence)) {
    addWhy(
      whyByActivity,
      "considerFocusedEducationOrOutreach",
      accessContextWhy(evidence)
    );
    if (
      !responseHasActivity(responseId, "considerFocusedEducationOrOutreach")
    ) {
      extraActivities.push("considerFocusedEducationOrOutreach");
    }
  }
}

function responseHasActivity(
  responseId: FollowUpResponseId,
  key: keyof typeof ACTIVITIES
): boolean {
  const keys: readonly (keyof typeof ACTIVITIES)[] =
    RESPONSES[responseId].activityKeys;
  return keys.includes(key);
}

function addWhy(
  whyByActivity: Map<keyof typeof ACTIVITIES, string[]>,
  key: keyof typeof ACTIVITIES,
  text: string
): void {
  const existing = whyByActivity.get(key) ?? [];
  if (!existing.includes(text)) {
    existing.push(text);
  }
  whyByActivity.set(key, existing);
}

function pathogenWithLowIncidence(
  evidence: SuggestedFollowUpEvidence
): boolean {
  return (
    evidence.burgdorferiStatus === "Present" &&
    evidence.humanStatus === "published_count_floor" &&
    evidence.incidenceFloor2023 !== null &&
    evidence.lowIncidenceBreakpoint !== null &&
    evidence.incidenceFloor2023 < evidence.lowIncidenceBreakpoint
  );
}

function pathogenTickWhy(evidence: SuggestedFollowUpEvidence): string {
  const observedZero =
    evidence.caseCountFloor2023 === 0
      ? " The published case-count floor is zero, which is an observed zero and is distinct from a missing record."
      : "";
  return `Observed finding: the published Lyme-pathogen status is Present, and the published incidence floor is below the active low-incidence breakpoint.${observedZero} Missing information: collection timing and sampling location are not in this county record. Question for local verification: confirm the tick record’s timing and location before treating it as current countywide evidence.`;
}

function pathogenHumanWhy(evidence: SuggestedFollowUpEvidence): string {
  const observedCount =
    evidence.caseCountFloor2023 === 0
      ? "Observed finding: the published case-count floor is zero."
      : "Observed finding: a published incidence floor is available.";
  return `${observedCount} It is below the active low-incidence breakpoint, alongside a documented Lyme-pathogen record. Question for local verification: review the human reporting context and available exposure information. This does not establish local transmission.`;
}

function tickWithoutPathogenRecord(
  evidence: SuggestedFollowUpEvidence
): boolean {
  return (
    documentedTick(evidence) &&
    (evidence.burgdorferiStatus === "No records" ||
      evidence.burgdorferiStatus === "Unknown")
  );
}

function tickWithoutPathogenWhy(evidence: SuggestedFollowUpEvidence): string {
  const pathogenState =
    evidence.burgdorferiStatus === "Unknown"
      ? "Unknown, which is distinct from No records and from a completed test with no detection"
      : "No records. No pathogen record does not establish that testing found no detections";
  return `Observed finding: a relevant tick status is published for this county. Missing information: the published Lyme-pathogen status is ${pathogenState}. Question for local verification: check whether pathogen testing occurred and what it covered. Vector presence is distinct from documented Lyme-pathogen presence.`;
}

function missingPublishedHumanCases(
  evidence: SuggestedFollowUpEvidence
): boolean {
  return evidence.humanStatus !== "published_count_floor";
}

function missingHumanWhy(evidence: SuggestedFollowUpEvidence): string {
  const assumption = missingHumanAssumptionApplies(evidence)
    ? " The published scoring formula uses the missing-human assumption when a county-linked incidence floor is unavailable. That assumption is not an observed case count."
    : "";
  return `Missing information: no published county-linked case count is available. A missing record is distinct from zero reported cases. Question for local verification: check source completeness, county assignment, and local records.${assumption}`;
}

function missingHumanAssumptionApplies(
  evidence: SuggestedFollowUpEvidence
): boolean {
  return (
    evidence.humanStatus !== "published_count_floor" ||
    evidence.incidenceFloor2023 === null
  );
}

function displayedAccessContext(evidence: SuggestedFollowUpEvidence): boolean {
  return (
    evidence.sviPercentile !== null ||
    evidence.uninsuredPercent !== null ||
    evidence.uninsuredPercentile !== null ||
    evidence.rucc2023 !== null
  );
}

function formulaInputLabel(value: number | null, label: string): string | null {
  if (value === null) {
    return null;
  }
  return label;
}

function accessContextWhy(evidence: SuggestedFollowUpEvidence): string {
  const formulaInputs = [
    formulaInputLabel(
      evidence.sviPercentile,
      "social vulnerability percentile"
    ),
    formulaInputLabel(evidence.uninsuredPercentile, "uninsured percentile"),
    formulaInputLabel(evidence.rucc2023, "rurality code"),
  ].filter((value): value is string => value !== null);
  const formula =
    formulaInputs.length > 0
      ? ` The published scoring formula includes the displayed ${formulaInputs.join(", ")} in the community term.`
      : " The displayed uninsured percent is not the percentile input in the published scoring formula, so this module does not treat it as a score contribution.";
  return `Observed finding: this county record displays access or community context.${formula} Question for local verification: ask local partners whether that context reflects a barrier to care or information, and consider accessible outreach where a need is identified. Atlas does not treat the indicator as proof of underdiagnosis.`;
}

function documentedTick(evidence: SuggestedFollowUpEvidence): boolean {
  return [
    evidence.tickStatus,
    evidence.scapularisStatus,
    evidence.pacificusStatus,
  ]
    .filter((value): value is string => value !== null)
    .some((value) => DOCUMENTED_TICK_STATUSES.has(value.trim().toLowerCase()));
}

function tickRecordIsMissing(evidence: SuggestedFollowUpEvidence): boolean {
  if (documentedTick(evidence)) {
    return false;
  }
  const statuses = [
    evidence.tickStatus,
    evidence.scapularisStatus,
    evidence.pacificusStatus,
  ];
  return statuses.every(
    (value) =>
      value === null ||
      value.trim().toLowerCase() === "no records" ||
      value.trim() === ""
  );
}

function tickLimitedNote(
  evidence: SuggestedFollowUpEvidence,
  responseId: FollowUpResponseId
): string | null {
  if (
    responseId !== "continue-routine-review" ||
    !tickRecordIsMissing(evidence)
  ) {
    return null;
  }
  return TICK_INFORMATION_LIMITED_NOTE;
}

function singlePeriodNote(
  evidence: SuggestedFollowUpEvidence,
  responseId: FollowUpResponseId
): string | null {
  if (responseId !== "monitor-the-pattern") {
    return null;
  }
  if (
    evidence.comparableReportingPeriods !== null &&
    evidence.comparableReportingPeriods >= 2
  ) {
    return null;
  }
  return SINGLE_PERIOD_NOTE;
}

function resourcesFor(
  template: ActivityTemplate,
  evidence: SuggestedFollowUpEvidence
): readonly OfficialResource[] {
  const species = documentedSpecies(evidence);
  return template.resourceKeys
    .filter((key) => {
      if (key === "blackleggedTickGuidance") {
        return species.pacificusOnly === false;
      }
      if (key === "westernBlackleggedTickGuidance") {
        return species.scapularisOnly === false;
      }
      return true;
    })
    .map((key) => OFFICIAL_RESOURCES[key]);
}

function documentedSpecies(evidence: SuggestedFollowUpEvidence): {
  pacificusOnly: boolean;
  scapularisOnly: boolean;
} {
  const scapularis = isDocumentedSpecies(evidence.scapularisStatus);
  const pacificus = isDocumentedSpecies(evidence.pacificusStatus);
  return {
    pacificusOnly: pacificus && !scapularis,
    scapularisOnly: scapularis && !pacificus,
  };
}

function isDocumentedSpecies(status: string | null): boolean {
  return (
    status !== null && DOCUMENTED_TICK_STATUSES.has(status.trim().toLowerCase())
  );
}
