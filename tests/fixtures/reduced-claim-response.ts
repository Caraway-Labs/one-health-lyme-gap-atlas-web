import type { KnowledgeChatResponse } from "@/generated/models";

/**
 * Sanitized shape of a reduced-claim answer (API #305): one kept claim,
 * `evidence_state: limited`, and citations only for that claim.
 */
export const REDUCED_CLAIM_ANSWER =
  "Synthetic claim: a reviewed study describes how surveillance definitions change reported Lyme disease counts.";

const REDUCED_CLAIM_PMID = "38000001";

export function reducedClaimResponse(): KnowledgeChatResponse {
  return {
    answer: REDUCED_CLAIM_ANSWER,
    assistant_policy_version: "policy-v1",
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
    configuration_version: "config-v1",
    conversation_id: "conversation-reduced",
    evidence_state: "limited",
    request_id: "request-reduced",
    source_used: "literature_evidence",
    status: "answered",
  };
}

/** A citation whose claim is not in the returned claims. */
export function orphanCitationResponse(): KnowledgeChatResponse {
  const response = reducedClaimResponse();
  return {
    ...response,
    citations: [
      ...(response.citations ?? []),
      {
        citation_id: "cit-orphan",
        claim_ids: ["claim-not-returned"],
        passage_ids: ["passage-not-returned"],
        pmid: "38000002",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/38000002/",
        title: "Synthetic paper with no matching claim",
      },
    ],
  };
}
