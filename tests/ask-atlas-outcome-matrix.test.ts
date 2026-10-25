import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { clientFailure } from "@/components/evidence-chat/client-failure";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  acceptAskAtlasPayload,
  classifyKnowledgeChatResponse,
} from "@/lib/ask-atlas-answer-contract";

import {
  ASK_ATLAS_OUTCOME_MATRIX,
  isOutcomeMatrixChatBody,
  matrixChatResponse,
} from "./fixtures/ask-atlas-outcome-matrix";

const FIXTURE_SOURCE = readFileSync(
  "tests/fixtures/ask-atlas-outcome-matrix.ts",
  "utf-8"
);

describe("Ask Atlas outcome matrix fixtures", () => {
  it("keeps the shared module free of real prompts, tokens, and personal data", () => {
    const questions = ASK_ATLAS_OUTCOME_MATRIX.map((item) => item.question);
    const serialized = JSON.stringify(ASK_ATLAS_OUTCOME_MATRIX);
    expect({
      bearer: /bearer/i.test(FIXTURE_SOURCE),
      conversationToken: /conversation_token\s*[:=]\s*["'`]/.test(
        FIXTURE_SOURCE
      ),
      email: /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(FIXTURE_SOURCE),
      jwt: /\beyJ/.test(FIXTURE_SOURCE),
      payloadMarker: /conversation_token|bearer|@/.test(serialized),
      stripsTokenField: FIXTURE_SOURCE.includes("conversation_token"),
      questions,
      secretKey: FIXTURE_SOURCE.includes("sk-"),
      uniqueQuestions: new Set(questions).size,
      uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(
        FIXTURE_SOURCE
      ),
    }).toStrictEqual({
      bearer: false,
      conversationToken: false,
      email: false,
      jwt: false,
      payloadMarker: false,
      questions: [
        "Fixture question 01",
        "Fixture question 02",
        "Fixture question 03",
        "Fixture question 04",
        "Fixture question 05",
        "Fixture question 06",
        "Fixture question 07",
        "Fixture question 08",
        "Fixture question 09",
        "Fixture question 10",
        "Fixture question 11",
      ],
      secretKey: false,
      stripsTokenField: true,
      uniqueQuestions: questions.length,
      uuid: false,
    });
  });

  it("drops a conversation token passed into the shared builder", () => {
    const response = matrixChatResponse({
      answer: "Synthetic answer",
      conversation_token: "dropped-value",
      evidence_state: "single_study",
      request_id: "fixture-request-strip",
      status: "answered",
    });
    expect(response).not.toHaveProperty("conversation_token");
    expect(JSON.stringify(response)).not.toContain("dropped-value");
  });

  it("classifies every typed fixture and matches transport failures to client copy", () => {
    const classified = ASK_ATLAS_OUTCOME_MATRIX.flatMap((outcome) => {
      if (!isOutcomeMatrixChatBody(outcome.body)) {
        return [];
      }
      const accepted = acceptAskAtlasPayload(outcome.body);
      return [
        {
          id: outcome.id,
          kind: accepted.ok
            ? classifyKnowledgeChatResponse(accepted.response).kind
            : accepted.reason,
        },
      ];
    });
    expect({
      classified,
      network: clientFailure(new TypeError("Failed to fetch")),
      rateLimited: clientFailure(
        new AtlasApiError("busy", "/v1/knowledge-graph/chat", 429, null)
      ),
      timeout: clientFailure(
        new AtlasApiError("timeout", "/v1/knowledge-graph/chat", 504, null)
      ),
      unprocessable: clientFailure(
        new AtlasApiError("invalid", "/v1/knowledge-graph/chat", 422, null)
      ),
    }).toMatchObject({
      classified: [
        { id: "answered-single-study", kind: "grounded" },
        { id: "answered-limited-fewer-claims", kind: "grounded" },
        { id: "no-evidence-corpus-gap", kind: "corpus_gap" },
        { id: "safety-refusal", kind: "safety_refusal" },
        { id: "evidence-unavailable-200", kind: "service_unavailable" },
        { id: "capacity-limited-200", kind: "capacity_limited" },
        { id: "legacy-typed-503", kind: "service_unavailable" },
      ],
      network: {
        retry: true,
        state: "network_failure",
        title: "Connection problem.",
      },
      rateLimited: {
        retry: true,
        state: "rate_limited",
        title: "Assistant is busy.",
      },
      timeout: { retry: true, state: "timeout", title: "Request timed out." },
      unprocessable: {
        retry: false,
        state: "request_not_processed",
        title: "Question not processed.",
      },
    });
  });
});
