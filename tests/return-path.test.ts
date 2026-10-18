import { describe, expect, it } from "vitest";

import {
  accountFreeContinueHref,
  safeReturnPath,
} from "../src/lib/auth/return-path";

describe("safe return path", () => {
  it("keeps an internal path and query string", () => {
    expect(safeReturnPath("/investigate?state=CO")).toBe(
      "/investigate?state=CO"
    );
  });

  it("sends an account-free exit away from a protected workspace path", () => {
    expect({
      bareQuery: accountFreeContinueHref("?county=08001"),
      overview: accountFreeContinueHref("/overview?county=08001&state=CO"),
      review: accountFreeContinueHref("/app/review"),
      reviewQuery: accountFreeContinueHref("/app/review?scope=CO"),
      explore: accountFreeContinueHref("/explore?scope=CO"),
      compare: accountFreeContinueHref("/compare?compare=08001,08013"),
      askAtlas: accountFreeContinueHref("/askatlas?conversation=abc"),
    }).toStrictEqual({
      bareQuery: "?county=08001",
      overview: "/overview?county=08001&state=CO",
      review: "/explore",
      reviewQuery: "/explore",
      explore: "/explore",
      compare: "/explore",
      askAtlas: "/explore",
    });
  });

  it("rejects external and malformed paths", () => {
    expect(safeReturnPath("https://example.com")).toBe("/account");
    expect(safeReturnPath("//example.com")).toBe("/account");
    expect(safeReturnPath("/\\example.com")).toBe("/account");
  });
});
