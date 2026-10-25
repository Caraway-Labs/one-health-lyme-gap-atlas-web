import type { KnowledgeChatResponse } from "@/generated/models";

/**
 * Sanitized Ask Atlas outcome fixtures. Questions, ids, and citation labels are
 * synthetic. This module has no request tokens, conversation tokens, or personal data.
 */

export const REDUCED_CLAIM_ANSWER =
  "Synthetic claim: a reviewed study describes how surveillance definitions change reported Lyme disease counts.";

const REDUCED_CLAIM_PMID = "38000001";
const SINGLE_STUDY_PMID = "90000011";

export const OMITTED_LIMITED_CLAIM =
  "Synthetic claim omitted from the limited fixture.";

export const SINGLE_STUDY_ANSWER = "Synthetic single-study claim.";

export const CORPUS_GAP_HEADING =
  "The Atlas corpus does not support an answer.";

export const LIMITED_CLAIM_SCOPE =
  "This label applies to the claims in this answer. It is not a statement that the reviewed literature as a whole is limited.";

const FIXTURE_POLICY = "fixture-policy";
const FIXTURE_CONFIG = "fixture-config";
const FIXTURE_CONVERSATION = "fixture-conversation";

export type OutcomeMatrixControl = "edit" | "none" | "retry" | "retry-later";

export type OutcomeMatrixFocus = "alert" | "composer" | "retry";

export type OutcomeMatrixComposer = "cleared" | "retained";

export interface OutcomeMatrixCase {
  body?: unknown;
  composer: OutcomeMatrixComposer;
  control: OutcomeMatrixControl;
  denial?: string;
  evidenceState?: KnowledgeChatResponse["evidence_state"];
  focus: OutcomeMatrixFocus;
  forbidsCorpusGap: boolean;
  forbidsTimeout: boolean;
  heading: string;
  id: string;
  keyboard: boolean;
  question: string;
  state: string;
  status?: number;
  storyPreset?: string;
  transcriptQuestion: boolean;
  transport: "http" | "network";
}

export function matrixChatResponse(
  overrides: Partial<KnowledgeChatResponse> &
    Pick<
      KnowledgeChatResponse,
      "answer" | "evidence_state" | "request_id" | "status"
    >
): KnowledgeChatResponse {
  const { conversation_token: omittedToken, ...fields } = overrides;
  void omittedToken;
  const answered = fields.status === "answered";
  return {
    assistant_policy_version: FIXTURE_POLICY,
    citations: answered ? [singleStudyCitation()] : [],
    claims: answered
      ? [
          {
            citation_ids: ["fixture-citation"],
            claim_id: "fixture-claim",
            text: fields.answer,
          },
        ]
      : [],
    configuration_version: FIXTURE_CONFIG,
    conversation_id: FIXTURE_CONVERSATION,
    source_used: "literature_evidence",
    ...fields,
  };
}

function singleStudyCitation() {
  return {
    citation_id: "fixture-citation",
    claim_ids: ["fixture-claim"],
    passage_ids: ["fixture-passage"],
    pmid: SINGLE_STUDY_PMID,
    pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${SINGLE_STUDY_PMID}/`,
    source_label: "Synthetic literature",
    title: "Synthetic single-study paper",
  };
}

export function singleStudyResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer: SINGLE_STUDY_ANSWER,
    evidence_state: "single_study",
    request_id: "fixture-request-single-study",
    status: "answered",
  });
}

export function limitedFewerClaimsResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer: REDUCED_CLAIM_ANSWER,
    assistant_policy_version: FIXTURE_POLICY,
    citations: [
      {
        citation_id: "cit-kept",
        claim_ids: ["claim-kept"],
        passage_ids: ["passage-kept"],
        pmid: REDUCED_CLAIM_PMID,
        pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${REDUCED_CLAIM_PMID}/`,
        source_label: "Reviewed literature",
        title: "Synthetic review of Lyme disease surveillance definitions",
      },
    ],
    claims: [
      {
        citation_ids: ["cit-kept"],
        claim_id: "claim-kept",
        text: REDUCED_CLAIM_ANSWER,
      },
    ],
    configuration_version: FIXTURE_CONFIG,
    conversation_id: "conversation-reduced",
    evidence_state: "limited",
    request_id: "request-reduced",
    status: "answered",
  });
}

export function corpusGapMatrixResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer:
      "Synthetic corpus note. This fixture question has no supported claim.",
    citations: [],
    claims: [],
    evidence_state: "no_relevant_corpus_evidence",
    request_id: "fixture-request-corpus-gap",
    status: "no_evidence",
  });
}

export function safetyRefusalMatrixResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer: "Synthetic refusal note. This fixture request is not answered.",
    citations: [],
    claims: [],
    evidence_state: "not_applicable",
    request_id: "fixture-request-refusal",
    status: "safety_refusal",
  });
}

export function evidenceUnavailableMatrixResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer: "Synthetic service note. The evidence service did not complete.",
    citations: [],
    claims: [],
    evidence_state: "evidence_unavailable",
    request_id: "fixture-request-unavailable",
    status: "evidence_unavailable",
  });
}

export function capacityLimitedMatrixResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    answer: "Synthetic capacity note. The assistant is capacity limited.",
    citations: [],
    claims: [],
    evidence_state: "not_applicable",
    request_id: "fixture-request-capacity",
    status: "capacity_limited",
  });
}

export function recoverySingleStudyResponse(): KnowledgeChatResponse {
  return matrixChatResponse({
    ...singleStudyResponse(),
    request_id: "fixture-request-recovery",
  });
}

function httpCase(
  fields: Omit<OutcomeMatrixCase, "transport"> & {
    body: unknown;
    status: number;
  }
): OutcomeMatrixCase {
  return { ...fields, transport: "http" };
}

export const ASK_ATLAS_OUTCOME_MATRIX: readonly OutcomeMatrixCase[] = [
  httpCase({
    body: singleStudyResponse(),
    composer: "cleared",
    control: "none",
    evidenceState: "single_study",
    focus: "composer",
    forbidsCorpusGap: false,
    forbidsTimeout: true,
    heading: "Evidence: Single-study evidence",
    id: "answered-single-study",
    keyboard: false,
    question: "Fixture question 01",
    state: "answered",
    status: 200,
    storyPreset: "matrix-answered-single-study",
    transcriptQuestion: true,
  }),
  httpCase({
    body: limitedFewerClaimsResponse(),
    composer: "cleared",
    control: "none",
    evidenceState: "limited",
    focus: "composer",
    forbidsCorpusGap: false,
    forbidsTimeout: true,
    heading: "Evidence: Limited evidence",
    id: "answered-limited-fewer-claims",
    keyboard: false,
    question: "Fixture question 02",
    state: "answered",
    status: 200,
    storyPreset: "matrix-answered-limited",
    transcriptQuestion: true,
  }),
  httpCase({
    body: corpusGapMatrixResponse(),
    composer: "retained",
    control: "edit",
    focus: "composer",
    forbidsCorpusGap: false,
    forbidsTimeout: true,
    heading: CORPUS_GAP_HEADING,
    id: "no-evidence-corpus-gap",
    keyboard: true,
    question: "Fixture question 03",
    state: "no_relevant_corpus_evidence",
    status: 200,
    storyPreset: "matrix-corpus-gap",
    transcriptQuestion: true,
  }),
  httpCase({
    body: safetyRefusalMatrixResponse(),
    composer: "cleared",
    control: "edit",
    focus: "composer",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Request not answered.",
    id: "safety-refusal",
    keyboard: true,
    question: "Fixture question 04",
    state: "safety_refusal",
    status: 200,
    storyPreset: "matrix-safety-refusal",
    transcriptQuestion: true,
  }),
  httpCase({
    body: evidenceUnavailableMatrixResponse(),
    composer: "retained",
    control: "retry",
    denial: "not a finding that the Atlas corpus has no relevant literature",
    focus: "composer",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Evidence service unavailable.",
    id: "evidence-unavailable-200",
    keyboard: true,
    question: "Fixture question 05",
    state: "evidence_unavailable",
    status: 200,
    storyPreset: "matrix-evidence-unavailable",
    transcriptQuestion: true,
  }),
  httpCase({
    body: capacityLimitedMatrixResponse(),
    composer: "retained",
    control: "retry-later",
    denial: "not a finding about the literature",
    focus: "composer",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Temporarily at capacity.",
    id: "capacity-limited-200",
    keyboard: true,
    question: "Fixture question 06",
    state: "capacity_limited",
    status: 200,
    storyPreset: "matrix-capacity-limited",
    transcriptQuestion: true,
  }),
  httpCase({
    body: evidenceUnavailableMatrixResponse(),
    composer: "retained",
    control: "retry",
    denial: "not a finding that the Atlas corpus has no relevant literature",
    focus: "composer",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Evidence service unavailable.",
    id: "legacy-typed-503",
    keyboard: true,
    question: "Fixture question 07",
    state: "evidence_unavailable",
    status: 503,
    transcriptQuestion: true,
  }),
  httpCase({
    body: { detail: "fixture gateway timeout" },
    composer: "retained",
    control: "retry",
    denial: "not a finding that the Atlas corpus lacks relevant literature",
    focus: "retry",
    forbidsCorpusGap: true,
    forbidsTimeout: false,
    heading: "Request timed out.",
    id: "bare-504",
    keyboard: true,
    question: "Fixture question 08",
    state: "timeout",
    status: 504,
    storyPreset: "matrix-timeout",
    transcriptQuestion: false,
  }),
  httpCase({
    body: { detail: "fixture rate limit" },
    composer: "retained",
    control: "retry",
    focus: "retry",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Assistant is busy.",
    id: "rate-limited-429",
    keyboard: true,
    question: "Fixture question 09",
    state: "rate_limited",
    status: 429,
    storyPreset: "matrix-rate-limited",
    transcriptQuestion: false,
  }),
  httpCase({
    body: { detail: "fixture invalid capability" },
    composer: "retained",
    control: "none",
    focus: "alert",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Question not processed.",
    id: "unprocessable-422",
    keyboard: true,
    question: "Fixture question 10",
    state: "request_not_processed",
    status: 422,
    storyPreset: "matrix-unprocessable",
    transcriptQuestion: false,
  }),
  {
    composer: "retained",
    control: "retry",
    focus: "retry",
    forbidsCorpusGap: true,
    forbidsTimeout: true,
    heading: "Connection problem.",
    id: "network-failure",
    keyboard: true,
    question: "Fixture question 11",
    state: "network_failure",
    storyPreset: "matrix-network",
    transcriptQuestion: false,
    transport: "network",
  },
];

export function outcomeMatrixCase(id: string): OutcomeMatrixCase {
  const outcome = ASK_ATLAS_OUTCOME_MATRIX.find((item) => item.id === id);
  if (!outcome) {
    throw new Error(`Unknown Ask Atlas outcome fixture: ${id}`);
  }
  return outcome;
}

export function outcomeMatrixByStoryPreset(
  preset: string
): OutcomeMatrixCase | undefined {
  return ASK_ATLAS_OUTCOME_MATRIX.find((item) => item.storyPreset === preset);
}

export function isOutcomeMatrixChatBody(
  body: unknown
): body is KnowledgeChatResponse {
  if (!body || typeof body !== "object") {
    return false;
  }
  return "request_id" in body && "status" in body && "evidence_state" in body;
}
