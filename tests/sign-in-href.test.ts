import { describe, expect, it } from "vitest";

import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

describe("sign-in href", () => {
  it("encodes the intended reset return path", () => {
    expect(signInHrefForReturnPath("/app/explore?state=CO")).toBe(
      "/auth/sign-in?next=%2Fapp%2Fexplore%3Fstate%3DCO"
    );
  });

  it("falls back safely for malformed return paths", () => {
    expect(signInHrefForReturnPath("https://example.com")).toBe(
      "/auth/sign-in?next=%2Faccount"
    );
  });
});
