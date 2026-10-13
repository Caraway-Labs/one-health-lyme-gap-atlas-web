import { describe, expect, it } from "vitest";

import { clientFailure } from "@/components/evidence-chat/client-failure";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";
import { AskAtlasLiteratureRequestError } from "@/lib/ask-atlas-literature-adapter";

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
  });
});
