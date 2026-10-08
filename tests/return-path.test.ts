import { describe, expect, it } from "vitest";

import {
  accountFreeContinueHref,
  safeReturnPath,
} from "../src/lib/auth/return-path";

describe("safe return path", () => {
  it("keeps an internal path and query string", () => {
    expect(safeReturnPath("/variant_6?state=CO")).toBe("/variant_6?state=CO");
  });

  it("sends an account-free exit away from a protected workspace path", () => {
    expect({
      overview: accountFreeContinueHref("/overview?county=08001&state=CO"),
      review: accountFreeContinueHref("/app/review"),
      reviewQuery: accountFreeContinueHref("/app/review?scope=CO"),
    }).toStrictEqual({
      overview: "/overview?county=08001&state=CO",
      review: "/overview",
      reviewQuery: "/overview",
    });
  });

  it("rejects external and malformed paths", () => {
    expect(safeReturnPath("https://example.com")).toBe("/account");
    expect(safeReturnPath("//example.com")).toBe("/account");
    expect(safeReturnPath("/\\example.com")).toBe("/account");
  });
});
