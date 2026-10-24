import { describe, expect, it } from "vitest";

import {
  clientFailure,
  shouldReplaceOperationalTurn,
} from "@/components/evidence-chat/client-failure";
import type { KnowledgeChatResponse } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";
import { AskAtlasLiteratureRequestError } from "@/lib/ask-atlas-literature-adapter";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";

describe(clientFailure, () => {
  it("maps API response validation failures to a controlled client error", () => {
    expect(
      clientFailure(new ApiResponseValidationError("Evidence chat response"))
    ).toStrictEqual({
      message:
        "Evidence chat response could not be verified. Please try again later.",
      reason: "malformed",
      retry: true,
      state: "response_unverified",
      title: "Response could not be verified.",
    });
  });

  it("keeps an invalid literature request off the retry path", () => {
    expect(clientFailure(new AskAtlasLiteratureRequestError())).toStrictEqual({
      message:
        "That question could not be processed. Please revise it and try again.",
      retry: false,
      state: "request_not_processed",
      title: "Question not processed.",
    });
  });

  it("keeps a gateway timeout distinct from a service error", () => {
    expect(
      clientFailure(
        new AtlasApiError("timeout", "/v1/knowledge-graph/chat", 504, null)
      ).title
    ).toBe("Request timed out.");
    expect(
      clientFailure(
        new AtlasApiError("unavailable", "/v1/knowledge-graph/chat", 503, null)
      )
    ).toMatchObject({
      retry: true,
      title: "Service unavailable.",
    });
    expect(
      clientFailure(
        new AtlasApiError("error", "/v1/knowledge-graph/chat", 500, null)
      ).title
    ).toBe("Service error.");
    expect(
      clientFailure(
        new AtlasApiError("unavailable", "/v1/knowledge-graph/chat", 502, null)
      )
    ).toMatchObject({
      message:
        "The assistant service is unavailable. This is not a finding that the Atlas corpus lacks relevant literature.",
      retry: true,
      state: "network_failure",
      title: "Service unavailable.",
    });
  });

  it("keeps rate limiting and invalid questions on their current copy", () => {
    expect(
      clientFailure(
        new AtlasApiError("busy", "/v1/knowledge-graph/chat", 429, null)
      )
    ).toStrictEqual({
      message:
        "The assistant is busy and did not finish this request. Please try again shortly.",
      retry: true,
      state: "rate_limited",
      title: "Assistant is busy.",
    });
    expect(
      clientFailure(
        new AtlasApiError("invalid", "/v1/knowledge-graph/chat", 422, null)
      )
    ).toStrictEqual({
      message:
        "That question could not be processed. Please revise it and try again.",
      retry: false,
      state: "request_not_processed",
      title: "Question not processed.",
    });
  });
});

describe(shouldReplaceOperationalTurn, () => {
  const conversation = (
    status: KnowledgeChatResponse["status"]
  ): LocalConversation => ({
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "conversation-1",
    title: "Same question",
    turns: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "user-1",
        role: "user",
        text: "Same question",
      },
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "assistant-1",
        response: {
          answer: "Stored outcome",
          assistant_policy_version: "policy-v1",
          configuration_version: "config-v1",
          conversation_id: "conversation-1",
          evidence_state:
            status === "evidence_unavailable"
              ? "evidence_unavailable"
              : "not_applicable",
          request_id: "request-1",
          source_used: "literature_evidence",
          status,
        },
        role: "assistant",
        text: "Stored outcome",
      },
    ],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("replaces only a repeated question after an operational turn", () => {
    expect({
      answered: shouldReplaceOperationalTurn(
        conversation("answered"),
        "Same question"
      ),
      capacity: shouldReplaceOperationalTurn(
        conversation("capacity_limited"),
        "Same question"
      ),
      differentQuestion: shouldReplaceOperationalTurn(
        conversation("evidence_unavailable"),
        "A different question"
      ),
      missing: shouldReplaceOperationalTurn(undefined, "Same question"),
      noEvidence: shouldReplaceOperationalTurn(
        conversation("no_evidence"),
        "Same question"
      ),
      unavailable: shouldReplaceOperationalTurn(
        conversation("evidence_unavailable"),
        "Same question"
      ),
    }).toStrictEqual({
      answered: false,
      capacity: true,
      differentQuestion: false,
      missing: false,
      noEvidence: false,
      unavailable: true,
    });
  });
});
