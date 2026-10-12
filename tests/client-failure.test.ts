import { describe, expect, it } from "vitest";

import { clientFailure } from "@/components/evidence-chat/client-failure";
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
});
