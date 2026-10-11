import { describe, expect, it } from "vitest";

import {
  emailConfirmRedirect,
  googleCallbackRedirect,
  signInCallbackErrorMessage,
  signInDeliveryErrorMessage,
} from "@/lib/auth/sign-in-recovery";

describe("sign-in recovery", () => {
  it("keeps the existing callback destinations", () => {
    expect(
      emailConfirmRedirect("https://onehealthatlas.org", "/app/review")
    ).toBe("https://onehealthatlas.org/auth/confirm?next=%2Fapp%2Freview");
    expect(
      googleCallbackRedirect("https://onehealthatlas.org", "/account")
    ).toBe("https://onehealthatlas.org/auth/callback?next=%2Faccount");
  });

  it("maps provider throttling without inventing a countdown", () => {
    expect(
      signInDeliveryErrorMessage({
        code: "over_email_send_rate_limit",
        message:
          "For security purposes, you can only request this after 60 seconds.",
        status: 429,
      })
    ).toBe("We could not send another link yet. Wait and try again.");
    expect(
      signInDeliveryErrorMessage({ message: "smtp down", status: 500 })
    ).toBe("We could not send a sign-in link. Please try again.");
  });

  it("maps the existing callback error codes", () => {
    expect(signInCallbackErrorMessage("missing_code")).toMatch(
      /Google sign-in/
    );
    expect(signInCallbackErrorMessage("missing_link")).toMatch(/incomplete/);
    expect(signInCallbackErrorMessage("expired_or_invalid")).toMatch(
      /no longer valid/
    );
    expect(signInCallbackErrorMessage(null)).toBeNull();
  });
});
