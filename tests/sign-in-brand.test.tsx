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

describe("branded sign-in preserves provider behavior", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it("keeps the canonical mark while email confirmation and retry notices change", async () => {
    auth.signInWithOtp
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("fixture") });
    const { container } = render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "fixture@example.invalid" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "a link is on its way"
      )
    );
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "fixture@example.invalid",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Fapp%2Freview`,
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Please try again"
      )
    );
    expect(
      container.querySelector(".atlas-sign-in-brand img")?.getAttribute("src")
    ).toBe("/android-chrome-192x192.png");
  });

  it("keeps Google callback routing and actionable errors", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error("fixture") });
    render(<SignInPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
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
  });
});
