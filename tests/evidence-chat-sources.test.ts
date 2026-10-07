import { describe, expect, it } from "vitest";

import type { KnowledgeChatResponse } from "@/generated/models";
import {
  orderedAnswerCitations,
  safePubMedUrl,
} from "@/lib/evidence-chat-sources";

function answeredResponse(
  overrides: Partial<KnowledgeChatResponse> = {}
): KnowledgeChatResponse {
  return {
    request_id: "request-1",
    conversation_id: "conversation-1",
    configuration_version: "config-v1",
    assistant_policy_version: "policy-v1",
    status: "answered",
    evidence_state: "limited",
    source_used: "literature_evidence",
    answer: "First claim\n\nSecond claim",
    citations: [
      {
        citation_id: "c2",
        pmid: "22222",
        title: "Second paper",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/22222/",
        claim_ids: ["claim-2"],
        passage_ids: ["passage-2"],
      },
      {
        citation_id: "c1",
        pmid: "11111",
        title: "First paper",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/11111/",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
      },
    ],
    claims: [
      {
        claim_id: "claim-1",
        text: "First claim",
        citation_ids: ["c1"],
      },
      {
        claim_id: "claim-2",
        text: "Second claim",
        citation_ids: ["c2"],
      },
    ],
    ...overrides,
  };
}

describe(safePubMedUrl, () => {
  it("accepts only canonical https PubMed URLs for the cited PMID", () => {
    expect(
      safePubMedUrl("https://pubmed.ncbi.nlm.nih.gov/12345/", "12345")
    ).toBe("https://pubmed.ncbi.nlm.nih.gov/12345/");
    expect(safePubMedUrl("https://example.com/12345/", "12345")).toBeNull();
  });
});

describe(orderedAnswerCitations, () => {
  it("orders citations by claim citation_ids", () => {
    const ordered = orderedAnswerCitations(answeredResponse());
    expect(ordered.map((citation) => citation.citation_id)).toStrictEqual([
      "c1",
      "c2",
    ]);
  });

  it("returns no citations when a response includes an unreferenced source", () => {
    const response = answeredResponse({
      citations: [
        ...(answeredResponse().citations ?? []),
        {
          citation_id: "c3",
          pmid: "33333",
          title: "Extra paper",
          pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/33333/",
          claim_ids: ["claim-3"],
          passage_ids: ["passage-3"],
        },
      ],
    });
    expect(orderedAnswerCitations(response)).toStrictEqual([]);
  });
});
