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
      retry: true,
      state: "network_failure",
      title: "Response could not be verified.",
    });
  });
});
