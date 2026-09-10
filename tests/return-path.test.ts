import { describe, expect, it } from "vitest";

import { safeReturnPath } from "../src/lib/auth/return-path";

describe("safe return path", () => {
  it("keeps an internal path and query string", () => {
    expect(safeReturnPath("/variant_6?state=CO")).toBe("/variant_6?state=CO");
  });

  it("rejects external and malformed paths", () => {
    expect(safeReturnPath("https://example.com")).toBe("/account");
    expect(safeReturnPath("//example.com")).toBe("/account");
    expect(safeReturnPath("/\\example.com")).toBe("/account");
  });
});
