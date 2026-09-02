import { describe, expect, it } from "vitest";

import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "../src/generated/zod/atlas";
import {
  ApiResponseValidationError,
  validateApiResponse,
} from "../src/lib/api-response-validation";

const response = {
  answer: "Reviewed evidence is available.",
  configuration_version: "kg-v1.0.0",
  conversation_id: "conversation-1",
  request_id: "request-1",
  status: "answered",
};

describe("API response validation", () => {
  it("accepts a valid generated KnowledgeChatResponse schema", () => {
    expect(
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        response
      )
    ).toMatchObject(response);
  });

  it("rejects a malformed payload with a controlled application error", () => {
    expect(() =>
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        { ...response, status: "unverified" }
      )
    ).toThrow(ApiResponseValidationError);
    expect(() =>
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        { ...response, status: "unverified" }
      )
    ).toThrow("Evidence chat response could not be verified.");
  });
});
