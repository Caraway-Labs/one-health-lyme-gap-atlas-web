import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "@/lib/api-mutator";

const {
  confirmPrivacyRequest,
  createPrivacyRequest,
  downloadPrivacyExport,
  followWorkspaceHref,
  getSession,
  push,
  signOut,
} = vi.hoisted(() => ({
  confirmPrivacyRequest: vi.fn<() => Promise<unknown>>(),
  createPrivacyRequest: vi.fn<() => Promise<unknown>>(),
  downloadPrivacyExport: vi.fn<() => Promise<unknown>>(),
  followWorkspaceHref: vi.fn<(href: string) => void>(),
  getSession: vi.fn<
    () => Promise<{
      data: {
        session: {
          access_token?: string;
          user: { id: string };
        } | null;
      };
      error: { message: string } | null;
    }>
  >(),
  push: vi.fn<(href: string) => void>(),
  signOut:
    vi.fn<
      (options?: {
        scope?: string;
      }) => Promise<{ error: { message: string } | null }>
    >(),
}));

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push }),
    }) as unknown as Partial<typeof import("next/navigation")>
);
vi.mock(import("../src/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession,
      signOut,
    },
  }),
}));
vi.mock(import("../src/features/ux-reset/workspace-navigation"), () => ({
  followWorkspaceHref,
}));
vi.mock(
  import("../src/generated/atlas"),
  () =>
    ({
      confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
        confirmPrivacyRequest,
      createPrivacyRequestV1MePrivacyRequestsPost: createPrivacyRequest,
      downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
        downloadPrivacyExport,
    }) as unknown as Partial<typeof import("../src/generated/atlas")>
);

import { AccountDataRights } from "../src/components/account-data-rights";
import { SIGN_OUT_STILL_ACTIVE } from "../src/features/ux-reset/profile/end-local-session";
import {
  beginWorkspaceSignOut,
  resetWorkspaceSignOutStateForTests,
} from "../src/features/ux-reset/workspace-sign-out";
import {
  PRIVACY_REAUTH_CONTINUE_NOTICE,
  PRIVACY_REAUTH_STORAGE_KEY,
  resetPrivacyReauthResumeForTests,
} from "../src/lib/auth/privacy-reauth";

const FAILURE =
  "We could not complete that privacy request. Please try again later.";

function secondAligned(ms: number): number {
  return Math.floor(ms / 1000) * 1000;
}

function accessTokenIssuedAt(issuedAtMs: number): string {
  const payload = btoa(JSON.stringify({ iat: Math.floor(issuedAtMs / 1000) }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

function sessionWithToken(issuedAtMs: number) {
  return {
    data: {
      session: {
        access_token: accessTokenIssuedAt(issuedAtMs),
        user: { id: "user-a" },
      },
    },
    error: null,
  };
}

function seedChallenge(options: {
  action: "export" | "deletion";
  challengedAtMs: number;
  nonce?: string;
  previousIssuedAtMs: number;
}) {
  localStorage.setItem(
    PRIVACY_REAUTH_STORAGE_KEY,
    JSON.stringify({
      action: options.action,
      challengedAtMs: options.challengedAtMs,
      nonce: options.nonce ?? "11111111-1111-4111-8111-111111111111",
      previousIssuedAtMs: options.previousIssuedAtMs,
    })
  );
}

function seedSatisfiedChallenge(
  action: "export" | "deletion",
  now = Date.now()
) {
  const previousIssuedAtMs = secondAligned(now - 60_000);
  seedChallenge({
    action,
    challengedAtMs: now - 10_000,
    previousIssuedAtMs,
  });
  getSession.mockResolvedValue(sessionWithToken(secondAligned(now - 5000)));
}

function deferredSession() {
  const pending =
    Promise.withResolvers<Awaited<ReturnType<typeof getSession>>>();
  getSession.mockReturnValue(pending.promise);
  return pending;
}

async function confirm(name: "Export my data" | "Remove all data") {
  fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
  await waitFor(() => {
    expect(getSession).toHaveBeenCalledWith();
  });
}

describe("privacy reauth flow", () => {
  beforeEach(() => {
    resetPrivacyReauthResumeForTests();
    localStorage.clear();
    resetWorkspaceSignOutStateForTests();
    followWorkspaceHref.mockReset();
    getSession.mockReset();
    push.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    createPrivacyRequest.mockReset();
    confirmPrivacyRequest.mockReset();
    downloadPrivacyExport.mockReset();
    createPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        confirmation_nonce: "nonce-abcdefghijklmnopqrstuvwxyz",
        request_id: "req-export-1",
        state: "requested",
      },
    });
    confirmPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        download_available: true,
        request_id: "req-export-1",
        state: "completed",
      },
    });
    downloadPrivacyExport.mockResolvedValue({
      status: 200,
      data: { schema_version: "atlas-user-data-export/v1" },
    });
  });

  afterEach(() => {
    localStorage.clear();
    resetPrivacyReauthResumeForTests();
    cleanup();
    resetWorkspaceSignOutStateForTests();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks for a new sign-in before export and keeps a missing session on that path", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "signed out" },
    });

    render(<AccountDataRights />);
    await confirm("Export my data");

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    });
    expect({
      created: createPrivacyRequest.mock.calls.length,
      notice: screen.getByRole("status").textContent,
      previousIssuedAtMs: JSON.parse(
        localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY) ?? "{}"
      ).previousIssuedAtMs,
      signedOut: signOut.mock.calls.length,
    }).toStrictEqual({
      created: 0,
      notice: PRIVACY_REAUTH_CONTINUE_NOTICE,
      previousIssuedAtMs: 0,
      signedOut: 0,
    });
  });

  it("signs out a current session, including one with no access token", async () => {
    getSession
      .mockResolvedValueOnce({
        data: { session: { user: { id: "user-a" } } },
        error: null,
      })
      .mockResolvedValueOnce(
        sessionWithToken(secondAligned(Date.now() - 60_000))
      );

    render(<AccountDataRights />);
    await confirm("Remove all data");
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    });
    expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toContain(
      "deletion"
    );

    cleanup();
    localStorage.clear();
    render(<AccountDataRights returnPath="/app/settings" />);
    await confirm("Export my data");
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Fapp%2Fsettings");
    });
  });

  it("keeps the account controls up when storage cannot record the challenge", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException(
          "Failed to read the 'localStorage' property from 'Window'",
          "SecurityError"
        );
      },
    });
    try {
      getSession.mockResolvedValue(
        sessionWithToken(secondAligned(Date.now() - 60_000))
      );
      render(<AccountDataRights />);
      fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
      fireEvent.click(
        screen.getAllByRole("button", { name: "Export my data" }).at(-1)!
      );
      await waitFor(() => {
        expect(screen.getByRole("status").textContent).toContain(FAILURE);
      });
      expect(
        screen.getByRole("button", { name: "Export my data" }).tagName
      ).toBe("BUTTON");
      expect(createPrivacyRequest).not.toHaveBeenCalled();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "localStorage", descriptor);
      }
    }
  });

  it("leaves the confirmation open while the fresh sign-in is still being prepared", async () => {
    const pending = deferredSession();
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Export my data" }).at(-1)!
    );
    await expect(
      screen.findByRole("button", { name: "Working…" })
    ).resolves.toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("dialog", { name: "Export my data?" })
    ).toBeTruthy();
    await act(async () => {
      pending.resolve({ data: { session: null }, error: null });
    });
  });

  it("closes the confirmation without a request before sign-in starts", () => {
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Remove all data" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it("clears an expired challenge and ignores a sign-in that is not newer", async () => {
    const now = Date.now();
    seedChallenge({
      action: "export",
      challengedAtMs: now - 16 * 60 * 1000,
      previousIssuedAtMs: secondAligned(now - 120_000),
    });
    getSession.mockResolvedValue(sessionWithToken(secondAligned(now - 5000)));

    render(<AccountDataRights />);
    await waitFor(() => {
      expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();

    cleanup();
    resetPrivacyReauthResumeForTests();
    getSession.mockClear();
    const issuedAtMs = secondAligned(Date.now() - 5000);
    seedChallenge({
      action: "deletion",
      challengedAtMs: Date.now() - 10_000,
      previousIssuedAtMs: issuedAtMs,
    });
    getSession.mockResolvedValue(sessionWithToken(issuedAtMs));
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(getSession).toHaveBeenCalledWith();
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toContain(
      "deletion"
    );
  });

  it("does not resume after unmount or while another challenge is in flight", async () => {
    const pending = deferredSession();
    const now = Date.now();
    const issuedAtMs = secondAligned(now - 5000);
    seedChallenge({
      action: "export",
      challengedAtMs: now - 10_000,
      previousIssuedAtMs: secondAligned(now - 60_000),
    });
    const first = render(<AccountDataRights />);
    await waitFor(() => {
      expect(getSession).toHaveBeenCalledOnce();
    });
    first.unmount();
    await act(async () => {
      pending.resolve(sessionWithToken(issuedAtMs));
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();

    cleanup();
    resetPrivacyReauthResumeForTests();
    getSession.mockReset();
    const second = deferredSession();
    seedChallenge({
      action: "export",
      challengedAtMs: now - 10_000,
      nonce: "11111111-1111-4111-8111-111111111111",
      previousIssuedAtMs: secondAligned(now - 60_000),
    });
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(getSession).toHaveBeenCalledOnce();
    });
    seedChallenge({
      action: "deletion",
      challengedAtMs: now - 10_000,
      nonce: "22222222-2222-4222-8222-222222222222",
      previousIssuedAtMs: secondAligned(now - 60_000),
    });
    render(<AccountDataRights />);
    seedChallenge({
      action: "export",
      challengedAtMs: now - 10_000,
      nonce: "11111111-1111-4111-8111-111111111111",
      previousIssuedAtMs: secondAligned(now - 60_000),
    });
    await act(async () => {
      second.resolve(sessionWithToken(issuedAtMs));
    });
    await waitFor(() => {
      expect(createPrivacyRequest).toHaveBeenCalledOnce();
    });
    expect(createPrivacyRequest.mock.calls).toStrictEqual([
      [{ action: "export" }],
    ]);
  });

  it("downloads an export only after the stored challenge is still claimable", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn<() => string>(() => "blob:export"),
      revokeObjectURL: vi.fn<(url: string) => void>(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "Your data export downloaded."
      );
    });
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();

    cleanup();
    resetPrivacyReauthResumeForTests();
    createPrivacyRequest.mockClear();
    const now = Date.now();
    seedChallenge({
      action: "export",
      challengedAtMs: now - 10_000,
      previousIssuedAtMs: secondAligned(now - 60_000),
    });
    getSession.mockImplementation(async () => {
      localStorage.removeItem(PRIVACY_REAUTH_STORAGE_KEY);
      return sessionWithToken(secondAligned(now - 5000));
    });
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(getSession).toHaveBeenCalledWith();
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it("reports support, failed responses, and a reference when the resumed request fails", async () => {
    confirmPrivacyRequest.mockResolvedValueOnce({
      status: 200,
      data: {
        download_available: false,
        request_id: "req-export-1",
        state: "needs_support",
      },
    });
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "This request needs support."
      );
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Reference: req-export-1."
    );

    cleanup();
    resetPrivacyReauthResumeForTests();
    createPrivacyRequest.mockClear();
    createPrivacyRequest.mockResolvedValueOnce({ status: 503, data: {} });
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(FAILURE);
    });
    expect(screen.getByRole("status").textContent).not.toContain("Reference:");

    cleanup();
    resetPrivacyReauthResumeForTests();
    confirmPrivacyRequest.mockResolvedValueOnce({ status: 409, data: {} });
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(FAILURE);
    });

    cleanup();
    resetPrivacyReauthResumeForTests();
    downloadPrivacyExport.mockResolvedValueOnce({ status: 404, data: {} });
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(FAILURE);
    });

    cleanup();
    resetPrivacyReauthResumeForTests();
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("limited", "/v1/me/privacy-requests", 429, "req-log-9")
    );
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "Reference: req-log-9."
      );
    });

    cleanup();
    resetPrivacyReauthResumeForTests();
    createPrivacyRequest.mockRejectedValueOnce(new Error("offline"));
    seedSatisfiedChallenge("export");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(FAILURE);
    });
  });

  it("sends an unauthorized resumed request to sign-in unless sign-out already owns navigation", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights returnPath="/app/settings" />);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Fapp%2Fsettings");
    });

    cleanup();
    resetPrivacyReauthResumeForTests();
    resetWorkspaceSignOutStateForTests();
    createPrivacyRequest.mockClear();
    push.mockClear();
    beginWorkspaceSignOut();
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(createPrivacyRequest).toHaveBeenCalledOnce();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves for home after removal and stays when sign-out does not finish", async () => {
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });

    cleanup();
    resetPrivacyReauthResumeForTests();
    resetWorkspaceSignOutStateForTests();
    createPrivacyRequest.mockClear();
    followWorkspaceHref.mockClear();
    signOut.mockResolvedValue({ error: { message: "remote failed" } });
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        SIGN_OUT_STILL_ACTIVE
      );
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();

    cleanup();
    resetPrivacyReauthResumeForTests();
    resetWorkspaceSignOutStateForTests();
    createPrivacyRequest.mockClear();
    followWorkspaceHref.mockClear();
    signOut.mockResolvedValue({ error: null });
    beginWorkspaceSignOut();
    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights />);
    await waitFor(() => {
      expect(createPrivacyRequest).toHaveBeenCalledOnce();
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("keeps the current session when sign-out fails before removal", async () => {
    getSession.mockResolvedValue(
      sessionWithToken(secondAligned(Date.now() - 60_000))
    );
    signOut.mockResolvedValue({ error: { message: "remote failed" } });
    render(<AccountDataRights />);
    await confirm("Remove all data");
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        SIGN_OUT_STILL_ACTIVE
      );
    });
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a failure when the sign-in challenge cannot be prepared", async () => {
    vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("uuid unavailable");
    });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AccountDataRights />);
    await confirm("Export my data");
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(FAILURE);
    });
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("treats a failed session read as no current session", async () => {
    getSession.mockRejectedValueOnce(new Error("storage blocked"));
    render(<AccountDataRights />);
    await confirm("Export my data");
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY) ?? "{}")
        .previousIssuedAtMs
    ).toBe(0);
  });
});
