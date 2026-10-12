import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";

const STORY_CHAT_REQUEST = "story-chat-request";
const STORY_CHAT_CONVERSATION = "story-chat-conversation";

export const STORY_CHAT_QUESTION =
  "What do peer-reviewed studies report about Lyme disease surveillance and reporting practices?";

export const STORY_CHAT_CREATED_AT = "2026-10-06T04:57:46.000Z";

function citation(
  citationId: string,
  pmid: string,
  title: string,
  pubmedUrl: string
): KnowledgeCitation {
  return {
    citation_id: citationId,
    claim_ids: [`claim-${citationId}`],
    passage_ids: [`passage-${citationId}`],
    pmid,
    pubmed_url: pubmedUrl,
    title,
  };
}

function groundedAnswer(
  evidenceState: KnowledgeChatResponse["evidence_state"],
  items: KnowledgeCitation[],
  texts: string[]
): KnowledgeChatResponse {
  return {
    answer: texts.join("\n\n"),
    assistant_policy_version: "story-policy",
    citations: items,
    claims: items.map((item, index) => ({
      citation_ids: [item.citation_id],
      claim_id: `claim-${item.citation_id}`,
      text: texts[index] ?? "",
    })),
    configuration_version: "story-config",
    conversation_id: STORY_CHAT_CONVERSATION,
    evidence_state: evidenceState,
    request_id: STORY_CHAT_REQUEST,
    source_used: "literature_evidence",
    status: "answered",
  };
}

const ONE_TEXT =
  "Synthetic claim: reviewed studies describe Lyme surveillance reporting. This is not a county finding.";

export function oneCitationResponse(): KnowledgeChatResponse {
  return groundedAnswer(
    "consistent",
    [
      citation(
        "c1",
        "10000001",
        "Synthetic surveillance reporting review",
        "https://pubmed.ncbi.nlm.nih.gov/10000001/"
      ),
    ],
    [ONE_TEXT]
  );
}

export function manyCitationsResponse(): KnowledgeChatResponse {
  return groundedAnswer(
    "mixed",
    [
      citation(
        "c1",
        "10000001",
        "Synthetic surveillance reporting review",
        "https://pubmed.ncbi.nlm.nih.gov/10000001/"
      ),
      citation(
        "c2",
        "10000002",
        "Synthetic tick-vector host review",
        "https://pubmed.ncbi.nlm.nih.gov/10000002/"
      ),
    ],
    [
      ONE_TEXT,
      "Synthetic claim: a second paper describes tick vectors and reservoir hosts.",
    ]
  );
}

export function limitedCitationResponse(): KnowledgeChatResponse {
  return groundedAnswer(
    "limited",
    [
      citation(
        "c1",
        "10000001",
        "Synthetic surveillance reporting review",
        "https://pubmed.ncbi.nlm.nih.gov/10000001/"
      ),
    ],
    [ONE_TEXT]
  );
}

export function longCitationResponse(): KnowledgeChatResponse {
  return groundedAnswer(
    "single_study",
    [
      citation(
        "c-long",
        "10000003",
        "Synthetic long citation title for a reviewed paper about surveillance reporting practices, laboratory confirmation, and study limits in the lower 48 states and the District of Columbia.",
        "https://pubmed.ncbi.nlm.nih.gov/10000003/"
      ),
    ],
    [
      "Synthetic claim: one study describes surveillance reporting. The long title stays on the citation.",
    ]
  );
}

export function unsafeCitationResponse(): KnowledgeChatResponse {
  return groundedAnswer(
    "consistent",
    [
      citation(
        "c-unsafe",
        "10000004",
        "Synthetic citation with an unapproved URL",
        "https://example.com/not-pubmed"
      ),
    ],
    [
      "Synthetic claim: this citation keeps its title as text because the URL is not a PubMed link.",
    ]
  );
}

export function corpusGapResponse(): KnowledgeChatResponse {
  return {
    answer:
      "Synthetic corpus note. Atlas does not currently have relevant reviewed literature for this question.",
    assistant_policy_version: "story-policy",
    citations: [],
    claims: [],
    configuration_version: "story-config",
    conversation_id: STORY_CHAT_CONVERSATION,
    evidence_state: "no_relevant_corpus_evidence",
    request_id: STORY_CHAT_REQUEST,
    source_used: "literature_evidence",
    status: "no_evidence",
  };
}

export function serviceUnavailableResponse(): KnowledgeChatResponse {
  return {
    answer: "Synthetic service note. The evidence service did not complete.",
    assistant_policy_version: "story-policy",
    citations: [],
    claims: [],
    configuration_version: "story-config",
    conversation_id: STORY_CHAT_CONVERSATION,
    evidence_state: "evidence_unavailable",
    request_id: STORY_CHAT_REQUEST,
    source_used: "literature_evidence",
    status: "evidence_unavailable",
  };
}

export function capacityResponse(): KnowledgeChatResponse {
  return {
    answer: "Synthetic capacity note. The assistant is capacity limited.",
    assistant_policy_version: "story-policy",
    citations: [],
    claims: [],
    configuration_version: "story-config",
    conversation_id: STORY_CHAT_CONVERSATION,
    evidence_state: "not_applicable",
    request_id: STORY_CHAT_REQUEST,
    source_used: "literature_evidence",
    status: "capacity_limited",
  };
}

export function refusalResponse(): KnowledgeChatResponse {
  return {
    answer:
      "Synthetic refusal note. Atlas Assistant cannot answer this request.",
    assistant_policy_version: "story-policy",
    citations: [],
    claims: [],
    configuration_version: "story-config",
    conversation_id: STORY_CHAT_CONVERSATION,
    evidence_state: "not_applicable",
    request_id: STORY_CHAT_REQUEST,
    source_used: "literature_evidence",
    status: "safety_refusal",
  };
}

export function answeredQuietResponse(): KnowledgeChatResponse {
  return oneCitationResponse();
}
