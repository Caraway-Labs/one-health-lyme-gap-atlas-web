import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithOAuth:
    vi.fn<(options: unknown) => Promise<{ error: Error | null }>>(),
  signInWithOtp:
    vi.fn<(options: unknown) => Promise<{ error: Error | null }>>(),
}));
vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);
vi.mock(
  import("@/lib/supabase/client"),
  () => ({ createClient: () => ({ auth }) }) as never
);
vi.mock(import("next/navigation"), async (original) => ({
  ...(await original()),
  useSearchParams: () =>
    new URLSearchParams(
      "next=/app/review"
    ) as unknown as ReadonlyURLSearchParams,
}));

import SignInPage from "@/app/auth/sign-in/page";

function expectCanonicalMark(container: HTMLElement) {
  const marks = container.querySelectorAll(
    ".atlas-sign-in-brand img.atlas-brand-mark"
  );
  expect(marks).toHaveLength(1);
  expect(marks[0]?.getAttribute("src")).toBe("/android-chrome-192x192.png");
  expect(marks[0]?.getAttribute("alt")).toBe("");
  expect(marks[0]?.getAttribute("aria-hidden")).toBe("true");
}

describe("branded sign-in preserves provider behavior", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it("keeps the canonical mark while email confirmation and retry notices change", async () => {
    auth.signInWithOtp
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("fixture") });
    const { container } = render(<SignInPage />);
    expectCanonicalMark(container);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fixture@example.invalid" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );
    await screen.findByRole("heading", { name: "Check your email" });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "fixture@example.invalid",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Fapp%2Freview`,
      },
    });
    expectCanonicalMark(container);
    fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Please try again"
      )
    );
    expect(
      screen.getByRole("heading", { name: "Check your email" })
    ).toBeTruthy();
    expectCanonicalMark(container);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a different email" })
    );
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expectCanonicalMark(container);
  });

  it("keeps Google callback routing and actionable errors", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error("fixture") });
    const { container } = render(<SignInPage />);
    expectCanonicalMark(container);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Google sign-in is unavailable. Please try again."
      )
    );
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fapp%2Freview`,
      },
    });
    expect(
      screen
        .getByRole("button", { name: "Continue with Google" })
        .hasAttribute("disabled")
    ).toBeFalsy();
    expectCanonicalMark(container);
  });
});
