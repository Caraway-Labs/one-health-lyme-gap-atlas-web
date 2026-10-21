import {
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
  createPrivacyRequest: vi.fn<() => Promise<unknown>>(),
  confirmPrivacyRequest: vi.fn<() => Promise<unknown>>(),
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
      createPrivacyRequestV1MePrivacyRequestsPost: createPrivacyRequest,
      confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
        confirmPrivacyRequest,
      downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
        downloadPrivacyExport,
    }) as unknown as Partial<typeof import("../src/generated/atlas")>
);

import { AccountDataRights } from "../src/components/account-data-rights";
import { SIGN_OUT_STILL_ACTIVE } from "../src/features/ux-reset/profile/end-local-session";
import {
  beginWorkspaceSignOut,
  resetWorkspaceSignOutStateForTests,
  workspaceSignOutPending,
  workspaceSignOutSuppressesExpiryRedirect,
} from "../src/features/ux-reset/workspace-sign-out";
import {
  PRIVACY_REAUTH_CONTINUE_NOTICE,
  PRIVACY_REAUTH_STORAGE_KEY,
  resetPrivacyReauthResumeForTests,
} from "../src/lib/auth/privacy-reauth";

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

function bearer(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function seedSatisfiedChallenge(
  action: "export" | "deletion",
  now = Date.now()
) {
  const previousIssuedAtMs = secondAligned(now - 60_000);
  const issuedAtMs = secondAligned(now - 5000);
  localStorage.setItem(
    PRIVACY_REAUTH_STORAGE_KEY,
    JSON.stringify({
      action,
      challengedAtMs: now - 10_000,
      nonce: "11111111-1111-4111-8111-111111111111",
      previousIssuedAtMs,
      subjectId: "user-a",
    })
  );
  getSession.mockResolvedValue(sessionWithToken(issuedAtMs));
  return accessTokenIssuedAt(issuedAtMs);
}

describe("account data rights", () => {
  beforeEach(() => {
    resetPrivacyReauthResumeForTests();
    localStorage.clear();
    resetWorkspaceSignOutStateForTests();
    followWorkspaceHref.mockReset();
    getSession.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    createPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        request_id: "req-export-1",
        confirmation_nonce: "nonce-abcdefghijklmnopqrstuvwxyz",
        state: "requested",
      },
    });
    confirmPrivacyRequest.mockResolvedValue({
      status: 200,
      data: {
        request_id: "req-export-1",
        state: "completed",
        download_available: true,
      },
    });
    downloadPrivacyExport.mockResolvedValue({
      status: 200,
      data: {
        schema_version: "atlas-user-data-export/v1",
        omissions: [{ processor: "analytics", reason: "not_linked" }],
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
    resetPrivacyReauthResumeForTests();
    cleanup();
    document.querySelector(".ux-reset-pro-app")?.remove();
    document.querySelector(".account-session-shell")?.remove();
    resetWorkspaceSignOutStateForTests();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("names stores, timing, omissions, and the support path before export", () => {
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    const dialog = screen.getByRole("dialog", { name: "Export my data?" });
    expect(dialog.textContent).toMatch(
      /Saved views, saved investigations, and an artifact library are not stored[\s\S]*Unlinked Amplitude sessions[\s\S]*Feedback export includes only this account[\s\S]*30 days[\s\S]*Public Atlas datasets are unaffected[\s\S]*support status and a request reference/
    );
  });

  it("asks for a new sign-in before a still-fresh session can export", async () => {
    const issuedAtMs = secondAligned(Date.now() - 60_000);
    getSession.mockResolvedValue(sessionWithToken(issuedAtMs));

    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Export my data" }).at(-1)!
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(screen.getByRole("status").textContent).toContain(
      PRIVACY_REAUTH_CONTINUE_NOTICE
    );
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toContain(
      `"previousIssuedAtMs":${issuedAtMs}`
    );
  });

  it("downloads the completed export after a newer sign-in", async () => {
    const objectUrl = vi.fn<() => string>(() => "blob:export");
    const revoke = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", {
      createObjectURL: objectUrl,
      revokeObjectURL: revoke,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const token = seedSatisfiedChallenge("export");

    render(<AccountDataRights />);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "Your data export downloaded."
      );
    });
    expect({
      confirm: confirmPrivacyRequest.mock.calls,
      create: createPrivacyRequest.mock.calls,
      download: downloadPrivacyExport.mock.calls,
      remainingChallenge: localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY),
      signOut: signOut.mock.calls,
      urls: objectUrl.mock.calls.length,
    }).toStrictEqual({
      confirm: [
        [
          "req-export-1",
          { nonce: "nonce-abcdefghijklmnopqrstuvwxyz" },
          bearer(token),
        ],
      ],
      create: [[{ action: "export" }, bearer(token)]],
      download: [["req-export-1", bearer(token)]],
      remainingChallenge: null,
      signOut: [],
      urls: 1,
    });
  });

  it("closes the confirmation dialog with Escape without starting a request", () => {
    render(<AccountDataRights />);
    fireEvent.click(screen.getByRole("button", { name: "Remove all data" }));
    expect(
      screen.getByRole("dialog", { name: "Remove all data?" }).textContent
    ).toMatch(/cannot be undone/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it("recovers from a failed request with a live status and request reference", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError(
        "rate limited",
        "/v1/me/privacy-requests",
        429,
        "req-log-9"
      )
    );
    seedSatisfiedChallenge("export");

    render(<AccountDataRights />);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "We could not complete that privacy request."
      );
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Reference: req-log-9."
    );
  });

  it("sends a stale session back to sign-in instead of deleting", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );
    seedSatisfiedChallenge("deletion");

    render(<AccountDataRights />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Faccount");
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("does not resume removal for the same access token", async () => {
    const issuedAtMs = secondAligned(Date.now() - 5000);
    localStorage.setItem(
      PRIVACY_REAUTH_STORAGE_KEY,
      JSON.stringify({
        action: "deletion",
        challengedAtMs: Date.now() - 10_000,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: issuedAtMs,
        subjectId: "user-a",
      })
    );
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

  it("does not replace an in-flight home navigation when removal is unauthorized", async () => {
    beginWorkspaceSignOut();
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );
    seedSatisfiedChallenge("deletion");

    render(<AccountDataRights returnPath="/app/settings" />);

    await waitFor(() => {
      expect(createPrivacyRequest).toHaveBeenCalledOnce();
    });
    expect({
      home: followWorkspaceHref.mock.calls,
      signIn: push.mock.calls,
      signOutCalls: signOut.mock.calls.length,
    }).toStrictEqual({
      home: [],
      signIn: [],
      signOutCalls: 0,
    });
  });

  it("removes account data through the shared sign-out before leaving for home", async () => {
    const shell = document.createElement("div");
    shell.className = "ux-reset-pro-app";
    shell.textContent = "Settings account";
    const accountShell = document.createElement("main");
    accountShell.className = "account-session-shell";
    accountShell.textContent = "CDPHE";
    document.body.append(shell, accountShell);
    let concealedBeforeHome = false;
    followWorkspaceHref.mockImplementation(() => {
      concealedBeforeHome =
        document.documentElement.dataset.workspaceRestore === "concealed" &&
        shell.hidden &&
        accountShell.hidden &&
        accountShell.inert;
    });

    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights returnPath="/app/settings" />);

    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    expect({
      concealedBeforeHome,
      scope: signOut.mock.calls,
      signIn: push.mock.calls,
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      concealedBeforeHome: true,
      scope: [[{ scope: "local" }]],
      signIn: [],
      suppressing: true,
    });
  });

  it("keeps Settings visible when removal sign-out does not end the session", async () => {
    signOut.mockResolvedValue({ error: { message: "remote failed" } });
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });

    seedSatisfiedChallenge("deletion");
    render(<AccountDataRights returnPath="/app/settings" />);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        SIGN_OUT_STILL_ACTIVE
      );
    });
    expect({
      home: followWorkspaceHref.mock.calls,
      pending: workspaceSignOutPending(),
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      home: [],
      pending: false,
      suppressing: false,
    });
  });

  it("returns a Settings privacy failure to Settings", async () => {
    createPrivacyRequest.mockRejectedValueOnce(
      new AtlasApiError("stale", "/v1/me/privacy-requests", 401, null)
    );
    seedSatisfiedChallenge("deletion");

    render(<AccountDataRights returnPath="/app/settings" />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/sign-in?next=%2Fapp%2Fsettings");
    });
  });

  it("keeps the current session when sign-out fails before removal", async () => {
    const issuedAtMs = secondAligned(Date.now() - 60_000);
    getSession.mockResolvedValue(sessionWithToken(issuedAtMs));
    signOut.mockResolvedValue({ error: { message: "remote failed" } });

    render(<AccountDataRights returnPath="/app/settings" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove all data" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove all data" }).at(-1)!
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        SIGN_OUT_STILL_ACTIVE
      );
    });
    expect(createPrivacyRequest).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
  });
});
