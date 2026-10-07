import { describe, expect, it } from "vitest";

import { clientFailure } from "@/components/evidence-chat/client-failure";
import { ApiResponseValidationError } from "@/lib/api-response-validation";

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
});
