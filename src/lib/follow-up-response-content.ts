/**
 * Published gap-score response copy. Keys are the six phrases in
 * SUGGESTED_FOLLOW_UP_BY_COLOR. County evidence qualifies these sentences;
 * it does not replace them.
 */

type FollowUpRowId =
  | "clinical-laboratory-reporting"
  | "community-context-outreach"
  | "coordination-documentation"
  | "human-disease-surveillance"
  | "vector-pathogen-surveillance";

export type FollowUpResponseCopy = {
  explanation: string;
  questions: readonly [string, string, string, string];
  rows: Record<FollowUpRowId, string>;
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
  rows: {
    "clinical-laboratory-reporting":
      "Maintain awareness of existing Lyme disease reporting and laboratory surveillance procedures. Consider whether routine reporting updates warrant review; the Atlas does not establish that reporting is incomplete.",
    "community-context-outreach":
      "Continue existing prevention education and outreach activities as locally appropriate. Use social vulnerability, insurance coverage, and rurality as contextual information, not evidence of transmission or underreporting.",
    "coordination-documentation":
      "Document the published evidence, its principal limitations, and any information to revisit during routine program review. No additional coordination or escalation is implied by this response.",
    "human-disease-surveillance":
      "Continue routine review of Lyme disease surveillance data through established program processes. Note limitations in published county counts, including reporting period and residence-based assignment, without assuming additional case investigation is needed.",
    "vector-pathogen-surveillance":
      "Review new tick and pathogen surveillance information as part of established program activities. Record gaps in published coverage without interpreting missing records as absence or initiating sampling solely because data are unavailable.",
  },
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
  rows: {
    "clinical-laboratory-reporting":
      "Monitor whether changes in laboratory reporting, testing volume, or case-ascertainment practices could affect surveillance patterns. Investigate a reporting pathway only if local information identifies a specific concern.",
    "community-context-outreach":
      "Review whether existing prevention messages and outreach coverage remain appropriate as surveillance information changes. Use local knowledge to identify communication needs rather than assuming outreach gaps from county-level indicators.",
    "coordination-documentation":
      "Record the findings or changes that would warrant closer review, and identify which routine surveillance sources should be revisited. Keep monitoring proportional to program capacity and established practice.",
    "human-disease-surveillance":
      "Watch for changes in published Lyme disease reports and locally available surveillance summaries. Compare similar reporting periods and account for case-definition and reporting-method changes before interpreting an apparent trend.",
    "vector-pathogen-surveillance":
      "Track newly available tick presence and pathogen detection records, including collection dates and geographic coverage where known. Consider whether emerging findings change the current interpretation of the county's evidence.",
  },
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
  rows: {
    "clinical-laboratory-reporting":
      "Review existing clinical and laboratory reporting information when local case ascertainment remains unclear. Determine whether reporting practices or case-classification methods explain differences without assuming reporting failure.",
    "community-context-outreach":
      "Use locally held information to interpret healthcare access, rurality, and social vulnerability before deciding whether changes to prevention outreach are justified. County-level context alone does not establish an outreach deficiency.",
    "coordination-documentation":
      "Identify unresolved evidence questions and the state or local program partners who may hold relevant information. Record what has been verified and what remains uncertain before deciding whether further action is needed.",
    "human-disease-surveillance":
      "Compare published county Lyme disease case information with state or local surveillance records. Where available, examine residence, likely exposure location, unallocated reports, reporting completeness, and differences in reporting periods.",
    "vector-pathogen-surveillance":
      "Consult local vector surveillance records to clarify tick presence, pathogen findings, collection coverage, and whether newer information exists outside published datasets. Distinguish missing records from documented negative findings.",
  },
};

const TARGETED: FollowUpResponseCopy = {
  explanation: "Investigate a specific, evidence-supported uncertainty.",
  questions: [
    "Which specific inconsistency in the published or locally verified evidence warrants targeted follow-up?",
    "Could residence-versus-exposure differences, reporting practices, or data suppression account for the apparent discrepancy?",
    "Would reviewing existing vector records or obtaining targeted new information materially change a public-health decision?",
    "What finding would justify additional action, and what finding would support returning to routine review?",
  ],
  rows: {
    "clinical-laboratory-reporting":
      "Where local evidence identifies a case-ascertainment question, conduct a focused review of relevant clinical or laboratory reporting pathways. Consider case-definition requirements and reporting practices without presuming reporting failure.",
    "community-context-outreach":
      "Assess whether the verified surveillance concern has a practical prevention or communication implication. Consider existing local education activities and community access needs before recommending targeted outreach.",
    "coordination-documentation":
      "Define a focused question, identify the existing program or partner best positioned to address it, and document what information would resolve the uncertainty. Local program staff determine whether, when, and how follow-up proceeds.",
    "human-disease-surveillance":
      "Identify the particular discrepancy or limitation in published human surveillance evidence that warrants closer review. Compare relevant local case records, classification practices, and available exposure information to determine whether the apparent gap has an identifiable explanation.",
    "vector-pathogen-surveillance":
      "Examine the specific tick or pathogen surveillance question raised by the available evidence. Review collection methods, timing, geographic coverage, and existing test results before considering whether targeted additional surveillance would meaningfully reduce uncertainty.",
  },
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
  rows: {
    "clinical-laboratory-reporting":
      "Where relevant, involve surveillance and laboratory-reporting partners to clarify reporting workflows, testing information, and case-ascertainment practices. Keep surveillance case definitions distinct from clinical diagnosis and treatment guidance.",
    "community-context-outreach":
      "Include public-health education or community partners when the local assessment identifies a communication or access concern. Use community context to tailor possible responses, not to infer disease burden or assign blame for reporting gaps.",
    "coordination-documentation":
      "Consider a coordinated review among relevant epidemiology, vector surveillance, laboratory, and prevention partners. Agree locally on key questions, available evidence, and criteria for any subsequent action; Atlas does not assign tasks or deadlines.",
    "human-disease-surveillance":
      "Bring together available human disease surveillance information from appropriate state or local programs to examine the reported pattern. Review relevant case counts, case-classification differences, geographic assignment, and unresolved reporting limitations.",
    "vector-pathogen-surveillance":
      "Coordinate with vector surveillance or entomology partners to assess tick distribution, pathogen findings, sampling coverage, and available local records. Identify whether existing information is sufficient or whether focused surveillance would inform the assessment.",
  },
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
  rows: {
    "clinical-laboratory-reporting":
      "Where local findings indicate a meaningful case-ascertainment or reporting concern, consider focused discussion with relevant surveillance, clinical, or laboratory-reporting partners. Any education or workflow review should respond to an identified need, not an assumption of reporting failure.",
    "community-context-outreach":
      "Consider whether locally verified evidence supports focused prevention education or outreach in particular communities or settings. Use local knowledge of communication needs and healthcare access; the Atlas response category alone does not justify a public warning.",
    "coordination-documentation":
      "Consider prioritizing a defined, coordinated follow-up question using existing jurisdictional decision processes. Document supporting evidence, remaining uncertainties, possible actions, and local criteria for proceeding or stepping back.",
    "human-disease-surveillance":
      "Consider prioritizing focused review of locally available Lyme disease surveillance information. Reconcile consequential published limitations, relevant case and exposure information, and applicable reporting practices to determine whether further public-health action is warranted.",
    "vector-pathogen-surveillance":
      "Consider prioritizing review with vector surveillance partners of relevant tick and pathogen findings, including species, collection coverage, timing, and methods. Determine whether existing data are sufficient or whether narrowly targeted surveillance would inform a concrete decision.",
  },
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
  rows: {
    "clinical-laboratory-reporting":
      "Review reporting information only if locally held surveillance records suggest a specific question. An unavailable Atlas gap score does not establish a clinical or laboratory reporting problem.",
    "community-context-outreach":
      "Identify which community-context measures are available and which are missing. Do not infer a prevention or outreach need from an unavailable gap score.",
    "coordination-documentation":
      "Document why the gap score or follow-up category is unavailable and what information might clarify that state. Do not assign priority, urgency, responsibility, or a deadline.",
    "human-disease-surveillance":
      "Identify what published human surveillance information is available and what is missing. Consult state or local records where appropriate before interpreting an unavailable county count as zero cases.",
    "vector-pathogen-surveillance":
      "Check whether tick and pathogen records exist outside the current published source. Distinguish unavailable records from documented negative findings, and do not initiate field collection solely because a record is absent.",
  },
};

export const FOLLOW_UP_PUBLISHED_SOURCE_LABEL =
  "Based on published Atlas gap-score category. This is not a model-assisted surveillance priority.";

export const FOLLOW_UP_WHAT_IF_TITLE = "What-if scenario active";

export const FOLLOW_UP_WHAT_IF_NOTE =
  "Map colors may reflect hypothetical score changes. Suggested Follow-up remains based on the published Atlas gap-score category.";

export const FOLLOW_UP_QUESTIONS_INTRO =
  "Consider these questions alongside local information before deciding whether additional follow-up is warranted.";
