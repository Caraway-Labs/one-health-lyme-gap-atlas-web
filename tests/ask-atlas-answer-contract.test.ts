import { describe, expect, it } from "vitest";

import type { KnowledgeChatResponse } from "@/generated/models";
import {
  acceptAskAtlasPayload,
  classifyKnowledgeChatResponse,
  LITERATURE_SOURCE_LABEL,
} from "@/lib/ask-atlas-answer-contract";

function literatureResponse(
  overrides: Partial<KnowledgeChatResponse> = {}
): KnowledgeChatResponse {
  return {
    answer: "Reviewed studies describe exposure.",
    assistant_policy_version: "policy-v1",
    citations: [
      {
        citation_id: "c1",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        title: "Source paper",
      },
    ],
    claims: [
      {
        citation_ids: ["c1"],
        claim_id: "claim-1",
        text: "Reviewed studies describe exposure.",
      },
    ],
    configuration_version: "config-v1",
    conversation_id: "conversation-1",
    evidence_state: "limited",
    request_id: "request-1",
    source_used: "literature_evidence",
    status: "answered",
    ...overrides,
  };
}

describe("Ask Atlas answer contract", () => {
  it("accepts a literature answer and keeps only the reported source label", () => {
    const raw = literatureResponse();
    const citation = raw.citations?.[0];
    if (citation) {
      citation.source_label = "Reported corpus";
    }
    const accepted = acceptAskAtlasPayload(raw);
    expect(accepted.ok).toBeTruthy();
    if (!accepted.ok) {
      return;
    }
    const decision = classifyKnowledgeChatResponse(accepted.response);
    expect(decision.kind).toBe("grounded");
    if (decision.kind !== "grounded") {
      return;
    }
    expect({
      label: decision.sourceLabel,
      reported: decision.citations[0]?.source_label,
      source: decision.sourceUsed,
      token: accepted.response.conversation_token,
    }).toStrictEqual({
      label: LITERATURE_SOURCE_LABEL,
      reported: "Reported corpus",
      source: "literature_evidence",
      token: undefined,
    });
  });

  it("does not invent a citation source label when the response omitted one", () => {
    const accepted = acceptAskAtlasPayload(literatureResponse());
    expect(accepted.ok).toBeTruthy();
    if (!accepted.ok) {
      return;
    }
    expect(accepted.response.citations?.[0]?.source_label).toBeUndefined();
  });

  it("keeps scientific insufficient evidence distinct from a service failure", () => {
    const compared = acceptAskAtlasPayload(
      literatureResponse({ evidence_state: "insufficient_to_compare" })
    );
    const gap = acceptAskAtlasPayload(
      literatureResponse({
        answer: "No passages matched this question.",
        citations: [],
        claims: [],
        evidence_state: "no_relevant_corpus_evidence",
        status: "no_evidence",
      })
    );
    const unavailable = acceptAskAtlasPayload(
      literatureResponse({
        answer: "Evidence is temporarily unavailable.",
        citations: [],
        claims: [],
        evidence_state: "evidence_unavailable",
        status: "evidence_unavailable",
      })
    );
    expect(compared.ok && gap.ok && unavailable.ok).toBeTruthy();
    if (!(compared.ok && gap.ok && unavailable.ok)) {
      return;
    }
    expect({
      compared: classifyKnowledgeChatResponse(compared.response).kind,
      gap: classifyKnowledgeChatResponse(gap.response).kind,
      unavailable: classifyKnowledgeChatResponse(unavailable.response).kind,
    }).toStrictEqual({
      compared: "grounded",
      gap: "corpus_gap",
      unavailable: "service_unavailable",
    });
  });

  it("accepts a safety refusal without turning it into evidence", () => {
    const accepted = acceptAskAtlasPayload(
      literatureResponse({
        answer: "I cannot give individual medical advice.",
        citations: [],
        claims: [],
        evidence_state: "not_applicable",
        status: "safety_refusal",
      })
    );
    expect(accepted.ok).toBeTruthy();
    if (!accepted.ok) {
      return;
    }
    expect(classifyKnowledgeChatResponse(accepted.response).kind).toBe(
      "safety_refusal"
    );
  });

  it("fails closed when an answered response has no citation", () => {
    const accepted = acceptAskAtlasPayload(
      literatureResponse({ citations: [], claims: [] })
    );
    expect(accepted).toStrictEqual({
      ok: false,
      reason: "missing_citation",
    });
  });

  it("fails closed when a claim cites a source the response did not return", () => {
    const accepted = acceptAskAtlasPayload(
      literatureResponse({
        claims: [
          {
            citation_ids: ["missing"],
            claim_id: "claim-1",
            text: "Reviewed studies describe exposure.",
          },
        ],
      })
    );
    expect(accepted).toStrictEqual({
      ok: false,
      reason: "missing_citation",
    });
  });

  it("fails closed when citation identity does not match the claims", () => {
    const mismatched = literatureResponse();
    if (mismatched.citations?.[0]) {
      mismatched.citations[0].claim_ids = ["other-claim"];
    }
    expect(acceptAskAtlasPayload(mismatched)).toStrictEqual({
      ok: false,
      reason: "mismatched_source",
    });
  });

  it("fails closed when the answer is not the claim text", () => {
    expect(
      acceptAskAtlasPayload(
        literatureResponse({ answer: "An uncited conclusion." })
      )
    ).toStrictEqual({ ok: false, reason: "partial" });
    const joined = acceptAskAtlasPayload(
      literatureResponse({
        answer: "First finding.\n\nSecond finding.",
        citations: [
          {
            citation_id: "c1",
            claim_ids: ["claim-1", "claim-2"],
            passage_ids: ["passage-1"],
            pmid: "12345",
            pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
            title: "Source paper",
          },
        ],
        claims: [
          {
            citation_ids: ["c1"],
            claim_id: "claim-1",
            text: "First finding.",
          },
          {
            citation_ids: ["c1"],
            claim_id: "claim-2",
            text: "Second finding.",
          },
        ],
      })
    );
    expect(joined.ok).toBeTruthy();
  });

  it("fails closed for a partial or malformed payload", () => {
    expect(
      acceptAskAtlasPayload({
        answer: "Partial",
        source_used: "literature_evidence",
        status: "answered",
      })
    ).toStrictEqual({ ok: false, reason: "not_chat_response" });
    expect(
      acceptAskAtlasPayload(
        literatureResponse({
          answer: "   ",
        })
      )
    ).toStrictEqual({ ok: false, reason: "partial" });
  });

  it("does not accept deferred live comparison states", () => {
    for (const state of ["aligned", "partially_aligned", "discordant"]) {
      expect(
        acceptAskAtlasPayload(
          literatureResponse({
            evidence_state: state as "limited",
          })
        )
      ).toStrictEqual({ ok: false, reason: "unsupported_comparison" });
      expect(
        acceptAskAtlasPayload({
          ...literatureResponse(),
          cross_source_state: state,
        })
      ).toStrictEqual({ ok: false, reason: "unsupported_comparison" });
    }
  });

  it("does not treat Structured or Both as a shipped literature answer", () => {
    expect(
      acceptAskAtlasPayload({
        ...literatureResponse(),
        source_used: "structured_atlas",
      })
    ).toStrictEqual({ ok: false, reason: "unsupported_source" });
    expect(
      acceptAskAtlasPayload({
        ...literatureResponse(),
        requested_source_mode: "Both",
        source_used: "both",
      })
    ).toStrictEqual({ ok: false, reason: "unsupported_source" });
    expect(
      acceptAskAtlasPayload({
        ...literatureResponse(),
        actual_sources_used: ["literature_evidence", "structured_atlas"],
      })
    ).toStrictEqual({ ok: false, reason: "unsupported_source" });
  });

  it("does not copy a confidence field onto the accepted response", () => {
    const accepted = acceptAskAtlasPayload({
      ...literatureResponse(),
      confidence: 0.92,
    });
    expect(accepted.ok).toBeTruthy();
    if (!accepted.ok) {
      return;
    }
    expect(accepted.response).not.toHaveProperty("confidence");
  });
});
