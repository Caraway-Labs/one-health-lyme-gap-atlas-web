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

let search = "next=/explore";

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
    search = "next=/explore";
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
          emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fexplore",
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
          redirectTo: "http://localhost:3000/auth/callback?next=%2Fexplore",
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

  it("resends the submitted address after the field is locked", async () => {
    const pending = Promise.withResolvers<{ error: null }>();
    signInWithOtp.mockReturnValue(pending.promise);
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "first@example.org" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Email me a sign-in link" })
    );

    const pendingField = screen.getByLabelText("Email") as HTMLInputElement;
    expect(pendingField.disabled).toBeTruthy();
    fireEvent.change(pendingField, {
      target: { value: "second@example.org" },
    });
    pending.resolve({ error: null });

    await screen.findByRole("heading", { name: "Check your email" });
    expect(signInWithOtp).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: "first@example.org" })
    );

    signInWithOtp.mockResolvedValue({ error: null });
    fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenLastCalledWith(
        expect.objectContaining({ email: "first@example.org" })
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Use a different email" })
    );
    const returnedField = screen.getByLabelText("Email") as HTMLInputElement;
    expect(returnedField.disabled).toBeFalsy();
    expect(returnedField.value).toBe("first@example.org");
  });
});

type LiveRegion = {
  ariaLive: string | null;
  associatedWithEmail: boolean;
  text: string;
};

type Announcement = {
  alerts: LiveRegion[];
  email:
    | {
        explanation: boolean;
        focused: boolean;
        hint: boolean;
        invalid: string | null;
        present: true;
      }
    | { present: false };
  statuses: LiveRegion[];
};

function readAnnouncement(): Announcement {
  const email = screen.queryByRole("textbox", { name: "Email" });
  const describedIds = (email?.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const describes = (fragment: string) =>
    describedIds.some((id) =>
      document.querySelector(`#${id}`)?.textContent?.includes(fragment)
    );
  const regions = (role: "alert" | "status"): LiveRegion[] =>
    screen.queryAllByRole(role).map((element) => {
      const id = element.getAttribute("id");
      return {
        ariaLive: element.getAttribute("aria-live"),
        associatedWithEmail: id !== null && describedIds.includes(id),
        text: element.textContent ?? "",
      };
    });
  const alerts = regions("alert");
  const statuses = regions("status");
  if (!email) return { alerts, email: { present: false }, statuses };
  return {
    alerts,
    email: {
      explanation: describes("email you a link"),
      focused: document.activeElement === email,
      hint: describes("No password needed."),
      invalid: email.getAttribute("aria-invalid"),
      present: true,
    },
    statuses,
  };
}

const validEmail = {
  explanation: true,
  focused: false,
  hint: true,
  invalid: null,
  present: true as const,
};

const absentEmail = { present: false as const };

function separateAlert(text: string): Announcement {
  return {
    alerts: [{ ariaLive: null, associatedWithEmail: false, text }],
    email: validEmail,
    statuses: [],
  };
}

async function submitAddress(address: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: address },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Email me a sign-in link" })
  );
}

async function showConfirmation() {
  signInWithOtp.mockResolvedValueOnce({ error: null });
  render(<SignInPage />);
  await submitAddress("person@example.org");
  await screen.findByRole("heading", { name: "Check your email" });
}

describe("sign-in error announcements", () => {
  afterEach(() => {
    cleanup();
    search = "next=/explore";
    signInWithOAuth.mockReset();
    signInWithOtp.mockReset();
  });

  const callbackMessage = {
    expired_or_invalid:
      "That sign-in link is no longer valid. Request a new one.",
    missing_code: "Google sign-in did not finish. Try again or use email.",
    missing_link: "That sign-in link is incomplete. Request a new one.",
  } as const;

  it.each([
    {
      expected: {
        alerts: [
          {
            ariaLive: null,
            associatedWithEmail: true,
            text: "Enter a valid email address.",
          },
        ],
        email: {
          explanation: true,
          focused: true,
          hint: true,
          invalid: "true",
          present: true as const,
        },
        statuses: [],
      },
      name: "validation error",
      prepare: () => {
        render(<SignInPage />);
        return submitAddress("not-an-email");
      },
    },
    {
      expected: separateAlert(
        "We could not send a sign-in link. Please try again."
      ),
      name: "send failure",
      prepare: async () => {
        signInWithOtp.mockResolvedValueOnce({
          error: { message: "smtp down", status: 500 },
        });
        render(<SignInPage />);
        await submitAddress("person@example.org");
        await screen.findByRole("alert");
      },
    },
    {
      expected: separateAlert(
        "We could not send another link yet. Wait and try again."
      ),
      name: "throttled send",
      prepare: async () => {
        signInWithOtp.mockResolvedValueOnce({
          error: {
            code: "over_email_send_rate_limit",
            message: "rate limit",
            status: 429,
          },
        });
        render(<SignInPage />);
        await submitAddress("person@example.org");
        await screen.findByRole("alert");
      },
    },
    {
      expected: {
        alerts: [
          {
            ariaLive: null,
            associatedWithEmail: false,
            text: "We could not send another link yet. Wait and try again.",
          },
        ],
        email: absentEmail,
        statuses: [],
      },
      name: "throttled resend",
      prepare: async () => {
        await showConfirmation();
        signInWithOtp.mockResolvedValueOnce({
          error: {
            code: "over_email_send_rate_limit",
            message: "rate limit",
            status: 429,
          },
        });
        fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
        await screen.findByRole("alert");
      },
    },
    {
      expected: separateAlert(
        "Google sign-in is unavailable. Please try again."
      ),
      name: "Google failure",
      prepare: async () => {
        signInWithOAuth.mockResolvedValueOnce({
          error: { message: "oauth down" },
        });
        render(<SignInPage />);
        fireEvent.click(
          screen.getByRole("button", { name: "Continue with Google" })
        );
        await screen.findByRole("alert");
      },
    },
    ...(["missing_code", "missing_link", "expired_or_invalid"] as const).map(
      (code) => ({
        expected: separateAlert(callbackMessage[code]),
        name: `callback ${code}`,
        prepare: () => {
          search = `error=${code}&next=/account`;
          render(<SignInPage />);
        },
      })
    ),
    {
      expected: {
        alerts: [],
        email: absentEmail,
        statuses: [
          {
            ariaLive: "polite",
            associatedWithEmail: false,
            text: "Check your email for your Atlas sign-in link.",
          },
        ],
      },
      name: "resend success",
      prepare: async () => {
        await showConfirmation();
        signInWithOtp.mockResolvedValueOnce({ error: null });
        fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
        await screen.findByRole("status");
      },
    },
  ])("$name", async ({ expected, prepare }) => {
    await prepare();
    expect(readAnnouncement()).toStrictEqual(expected);
  });
});
