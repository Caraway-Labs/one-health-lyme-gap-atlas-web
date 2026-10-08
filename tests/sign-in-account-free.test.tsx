import { render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams(
      "next=/app/review"
    ) as unknown as ReadonlyURLSearchParams,
}));

import SignInPage from "@/app/auth/sign-in/page";

describe("sign-in account-free exit", () => {
  it("opens Overview when the requested return path is the professional workspace", () => {
    render(<SignInPage />);

    expect(
      screen
        .getByRole("link", { name: "Continue without an account" })
        .getAttribute("href")
    ).toBe("/overview");
  });
});
