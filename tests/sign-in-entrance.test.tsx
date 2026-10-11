import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithOAuth, signInWithOtp } = vi.hoisted(() => ({
  signInWithOAuth:
    vi.fn<
      () => Promise<{ error: { message: string; status?: number } | null }>
    >(),
  signInWithOtp: vi.fn<
    () => Promise<{
      error: { code?: string; message: string; status?: number } | null;
    }>
  >(),
}));

let search = "next=/app/review";

vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams(search) as unknown as ReadonlyURLSearchParams,
}));

vi.mock(import("../src/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: { signInWithOAuth, signInWithOtp },
  }),
}));

import SignInPage from "@/app/auth/sign-in/page";

describe("email-first sign-in entrance", () => {
  afterEach(() => {
    cleanup();
    search = "next=/app/review";
    signInWithOAuth.mockReset();
    signInWithOtp.mockReset();
  });

  it("shows the approved request copy and Google mark", () => {
    render(<SignInPage />);

    expect(
      screen.getByRole("heading", { name: "Sign in or create an account" })
    ).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe(
      "you@example.org"
    );
    expect(
      screen
        .getByRole("button", { name: "Continue with Google" })
        .querySelector("img")
        ?.getAttribute("alt")
    ).toBe("");
    expect(
      screen.queryByRole("link", { name: "Continue without an account" })
    ).toBeNull();
  });

  it("links privacy and help to the approved public routes", () => {
    render(<SignInPage />);

    expect(
      screen.getByRole("link", { name: "Privacy" }).getAttribute("href")
    ).toBe("/privacy");
    expect(
      screen.getByRole("link", { name: "Help" }).getAttribute("href")
    ).toBe("https://onehealthatlas.org/docs");
  });

  it("keeps the current email and Google callback destinations", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.org" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "person@example.org",
        options: {
          emailRedirectTo:
            "http://localhost:3000/auth/confirm?next=%2Fapp%2Freview",
        },
      });
    });
    expect(
      screen.getByRole("heading", { name: "Check your email" })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Use a different email" })
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "person@example.org"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        options: {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fapp%2Freview",
        },
        provider: "google",
      });
    });
  });

  it("stays on the request form when sending fails and on confirmation when resend is throttled", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "smtp down", status: 500 },
    });
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.org" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "We could not send a sign-in link. Please try again."
    );
    expect(
      screen.queryByRole("heading", { name: "Check your email" })
    ).toBeNull();

    signInWithOtp.mockResolvedValueOnce({ error: null });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );
    await expect(
      screen.findByRole("heading", { name: "Check your email" })
    ).resolves.toBeTruthy();

    signInWithOtp.mockResolvedValueOnce({
      error: {
        code: "over_email_send_rate_limit",
        message: "rate limit",
        status: 429,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "We could not send another link yet. Wait and try again."
    );
    expect(
      screen.getByRole("heading", { name: "Check your email" })
    ).toBeTruthy();
  });

  it("shows an expired callback without leaving the email form", () => {
    search = "error=expired_or_invalid&next=/account";
    render(<SignInPage />);
    expect(screen.getByRole("alert").textContent).toContain(
      "That sign-in link is no longer valid. Request a new one."
    );
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});
