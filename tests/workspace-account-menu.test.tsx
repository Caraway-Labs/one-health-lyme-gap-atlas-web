import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { explicitAccountLabel } from "@/features/ux-reset/account-display-label";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { SIGN_OUT_STILL_ACTIVE } from "@/features/ux-reset/profile/end-local-session";
import { savedProfileQueryRoot } from "@/features/ux-reset/profile/use-saved-profile";
import { SettingsAccountControls } from "@/features/ux-reset/settings/settings-account-controls";
import { WorkspaceAccountMenu } from "@/features/ux-reset/workspace-account-menu";
import {
  beginWorkspaceSignOut,
  resetWorkspaceSignOutStateForTests,
  workspaceDocumentUserId,
} from "@/features/ux-reset/workspace-sign-out";

type SessionUser = {
  email?: string;
  id: string;
  user_metadata?: Record<string, unknown>;
};

type Session = { access_token: string; user: SessionUser } | null;

const followWorkspaceHref = vi.hoisted(() =>
  vi.fn<(href: string, history?: string) => void>()
);

const auth = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: Session) => void>();
  return {
    configured: true,
    failReads: 0,
    listeners,
    deferredReads: [] as Promise<
      | {
          data: { session: Session | null };
          error: { message: string } | null;
        }
      | "throw"
    >[],
    pause: null as Promise<unknown> | null,
    reads: 0,
    session: null as Session,
    sessionRead: null as "throw" | { error: { message: string } } | null,
    signOut:
      vi.fn<
        (options?: {
          scope?: string;
        }) => Promise<{ error: { message: string } | null }>
      >(),
  };
});

let pathname = "/app/review";
let searchParams = new URLSearchParams("scope=CO");

vi.mock(import("next/navigation"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePathname: () => pathname,
    useRouter: () =>
      ({
        back() {},
        bfcacheId: "workspace-account-test",
        forward() {},
        prefetch() {},
        push() {},
        refresh() {},
        replace() {},
      }) as ReturnType<typeof actual.useRouter>,
    useSearchParams: () => searchParams as ReadonlyURLSearchParams,
  };
});

vi.mock(import("@/features/ux-reset/workspace-navigation"), () => ({
  followWorkspaceHref,
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => {
    if (!auth.configured) {
      throw new Error("Account sign-in is not configured.");
    }
    return {
      auth: {
        getSession: async () => {
          auth.reads += 1;
          const deferred = auth.deferredReads.shift();
          if (deferred) {
            const result = await deferred;
            if (result === "throw") {
              throw new Error("session read failed");
            }
            return result;
          }
          if (auth.pause) {
            await auth.pause;
          }
          if (auth.failReads > 0) {
            auth.failReads -= 1;
            return {
              data: { session: auth.session },
              error: { message: "read failed" },
            };
          }
          if (auth.sessionRead === "throw") {
            throw new Error("session read failed");
          }
          return {
            data: { session: auth.session },
            error: auth.sessionRead?.error ?? null,
          };
        },
        onAuthStateChange: (
          // Supabase reports auth changes through a subscription callback.
          // eslint-disable-next-line promise/prefer-await-to-callbacks -- auth subscription has no async equivalent
          callback: (event: string, session: Session) => void
        ) => {
          auth.listeners.add(callback);
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  auth.listeners.delete(callback);
                },
              },
            },
          };
        },
        signOut: (options?: { scope?: string }) => auth.signOut(options),
      },
    };
  },
}));

function pageTransition(type: "pagehide" | "pageshow", persisted: boolean) {
  window.history.pushState({}, "", "/app/review?scope=CO");
  const event = new Event(type);
  Object.defineProperty(event, "persisted", { value: persisted });
  window.dispatchEvent(event);
}

function persistedPageShow() {
  pageTransition("pageshow", true);
}

function restoredWorkspaceConcealed(): boolean {
  return document.documentElement.dataset.workspaceRestore === "concealed";
}

function restoredNoteHidden(): boolean {
  return (
    screen.getByTestId("restored-private-note").closest("[hidden]") ===
    document.querySelector(".ux-reset-pro-app")
  );
}

function scriptedSession(
  session: Session,
  error: { message: string } | null = null
) {
  return {
    data: { session },
    error,
  };
}

function notify(session: Session) {
  auth.session = session;
  for (const listener of auth.listeners) {
    listener(session ? "SIGNED_IN" : "SIGNED_OUT", session);
  }
}

function userSession(
  metadata?: Record<string, unknown>,
  email = "patron-9f3a@example.com"
): Session {
  return {
    access_token: "token-user-a",
    user: { email, id: "user-a", user_metadata: metadata },
  };
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

function renderMenu(options?: {
  defaultOpen?: boolean;
  note?: string;
  shell?: boolean;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const menu = options?.shell ? (
    <ResetProfessionalShell>
      {options.note ? (
        <p data-testid="restored-private-note">{options.note}</p>
      ) : (
        <p>Review</p>
      )}
    </ResetProfessionalShell>
  ) : (
    <SidebarProvider
      defaultOpen={options?.defaultOpen ?? true}
      storageKey="workspace-account-test"
    >
      <WorkspaceAccountMenu />
    </SidebarProvider>
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
  return { client, ...render(menu, { wrapper }) };
}

describe("explicit account label", () => {
  it("uses a provider name and skips email-shaped values", () => {
    expect(
      explicitAccountLabel({
        user_metadata: { full_name: "  Ada Lovelace  ", name: "ignored" },
      })
    ).toBe("Ada Lovelace");
    expect(
      explicitAccountLabel({
        user_metadata: { full_name: "patron-9f3a@example.com", name: "Ada" },
      })
    ).toBe("Ada");
    expect(
      explicitAccountLabel({
        user_metadata: { name: "patron-9f3a@example.com" },
      })
    ).toBeNull();
    expect(
      explicitAccountLabel({ user_metadata: { full_name: "  " } })
    ).toBeNull();
    expect(explicitAccountLabel(null)).toBeNull();
  });
});

describe("workspace account menu", () => {
  beforeEach(() => {
    pathname = "/app/review";
    searchParams = new URLSearchParams("scope=CO");
    auth.configured = true;
    auth.deferredReads = [];
    auth.failReads = 0;
    auth.listeners.clear();
    auth.pause = null;
    auth.reads = 0;
    auth.session = userSession({ full_name: "Ada Lovelace" });
    auth.sessionRead = null;
    auth.signOut.mockReset();
    auth.signOut.mockResolvedValue({ error: null });
    followWorkspaceHref.mockReset();
    resetWorkspaceSignOutStateForTests();
    localStorage.clear();
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows a checking status and no sign-out while the session is loading", async () => {
    const gate = Promise.withResolvers<boolean>();
    auth.pause = gate.promise;
    renderMenu();
    expect(
      screen.getByRole("status", { name: "Checking session" })
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByText("patron-9f3a@example.com")).toBeNull();
    gate.resolve(true);
    await expect(
      screen.findByRole("button", { name: "Ada Lovelace" })
    ).resolves.toBeTruthy();
  });

  it("opens a compact sign-out menu for a named account and keeps email off the screen", async () => {
    renderMenu();
    const trigger = await screen.findByRole("button", { name: "Ada Lovelace" });
    expect(trigger.querySelector(".lucide-user-round")).toBeTruthy();
    expect(document.querySelector(".lucide-log-out")).toBeNull();
    fireEvent.click(trigger);
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    expect({
      door: item.querySelector(".lucide-door-open"),
      email: document.body.textContent?.includes("patron-9f3a@example.com"),
      label: item.textContent,
      logOut: document.querySelector(".lucide-log-out"),
    }).toStrictEqual({
      door: expect.any(Element),
      email: false,
      label: expect.stringContaining("Sign out"),
      logOut: null,
    });
  });

  it("labels a signed-in account without a displayable name as Account", async () => {
    auth.session = userSession({ name: "patron-9f3a@example.com" });
    renderMenu();
    await expect(
      screen.findByRole("button", { name: "Account" })
    ).resolves.toBeTruthy();
    expect(document.body.textContent).not.toContain("patron-9f3a");
    expect(document.body.textContent).not.toContain("@example.com");
  });

  it("shows Sign in and no Sign out when auth is not configured", () => {
    auth.configured = false;
    renderMenu();
    const signIn = screen.getByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe(
      "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO"
    );
    expect(signIn.querySelector(".lucide-user-round")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("sends a signed-out session on a professional route to sign-in", async () => {
    auth.session = null;
    renderMenu();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
  });

  it("keeps an accessible account name when the sidebar is collapsed", async () => {
    renderMenu({ defaultOpen: false });
    const trigger = await screen.findByRole("button", { name: "Ada Lovelace" });
    expect(trigger.querySelector(".sidebar-item-label")?.textContent).toBe(
      "Ada Lovelace"
    );
    expect(trigger.querySelector(".lucide-user-round")).toBeTruthy();
  });

  it("signs out once, clears the saved profile cache, and leaves for the public home", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: null };
    });
    const { client } = renderMenu();
    client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
      organization: "CDPHE",
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(
      client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    ).toStrictEqual([]);
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("ignores a repeat sign-out click while the first request is pending", async () => {
    const gate = Promise.withResolvers<{ error: null }>();
    auth.signOut.mockReturnValue(gate.promise);
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    fireEvent.click(item);
    fireEvent.click(item);
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(
      (
        (await screen.findByRole("button", {
          name: "Signing out",
        })) as HTMLButtonElement
      ).disabled
    ).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    gate.resolve({ error: null });
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
  });

  it("keeps the session and offers Sign out again when sign-out fails", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("workspace-sign-out-notice")).textContent
    ).toBe(SIGN_OUT_STILL_ACTIVE);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    await expect(
      screen.findByRole("menuitem", { name: "Sign out" })
    ).resolves.toBeTruthy();
  });

  it("keeps the session when sign-out fails and the follow-up read errors", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    auth.sessionRead = { error: { message: "read failed" } };
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("workspace-sign-out-notice")).textContent
    ).toBe(SIGN_OUT_STILL_ACTIVE);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    await expect(
      screen.findByRole("menuitem", { name: "Sign out" })
    ).resolves.toBeTruthy();
  });

  it("keeps the session when a configured client cannot read it after sign-out fails", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    auth.sessionRead = "throw";
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("workspace-sign-out-notice")).textContent
    ).toBe(SIGN_OUT_STILL_ACTIVE);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    await expect(
      screen.findByRole("menuitem", { name: "Sign out" })
    ).resolves.toBeTruthy();
  });

  it("leaves after a sign-out error once the local session is gone", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: { message: "remote failed" } };
    });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
  });

  it("redirects when the session expires without claiming sign-out succeeded", async () => {
    renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    notify(null);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(followWorkspaceHref).not.toHaveBeenCalledWith("/");
  });

  it("denies a cached professional page when the restored session is signed out", async () => {
    renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    followWorkspaceHref.mockClear();
    auth.session = null;
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    followWorkspaceHref.mockClear();
    window.dispatchEvent(new Event("pageshow"));
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("keeps an authenticated page when the session read returns an error", async () => {
    auth.sessionRead = { error: { message: "read failed" } };
    renderMenu();
    await screen.findByRole("link", { name: "Sign in" });
    await waitFor(() => {
      expect(auth.reads).toBeGreaterThanOrEqual(2);
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("reloads a restored page when the read fails and this page has not logged out", async () => {
    renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBeforeRestore = auth.reads;
    auth.sessionRead = { error: { message: "read failed" } };
    persistedPageShow();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("sends a restored page to sign-in after logout when the read throws", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: null };
    });
    const { client } = renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    followWorkspaceHref.mockClear();
    client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
      organization: "CDPHE",
    });
    auth.sessionRead = "throw";
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(
      client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    ).toStrictEqual([]);
  });

  it("keeps a restored page when a session is confirmed after logout", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: null };
    });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    followWorkspaceHref.mockClear();
    auth.session = userSession({ full_name: "Ada Lovelace" });
    const readsBeforeRestore = auth.reads;
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(restoredWorkspaceConcealed()).toBeFalsy();
    });
    expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("keeps a Settings sign-out on the public home", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: null };
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <SidebarProvider defaultOpen storageKey="workspace-account-test">
            <WorkspaceAccountMenu />
            <SettingsAccountControls />
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    await screen.findByRole("button", { name: "Ada Lovelace" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("sends a restored page to sign-in after Settings sign-out when the read throws", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      return { error: null };
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <SidebarProvider defaultOpen storageKey="workspace-account-test">
            <WorkspaceAccountMenu />
            <SettingsAccountControls />
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    await screen.findByRole("button", { name: "Ada Lovelace" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    followWorkspaceHref.mockClear();
    client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
      organization: "CDPHE",
    });
    auth.sessionRead = "throw";
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(
      client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    ).toStrictEqual([]);
  });

  it("redirects when the session expires after a failed sign-out", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    renderMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("workspace-sign-out-notice")).textContent
    ).toBe(SIGN_OUT_STILL_ACTIVE);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    notify(null);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(followWorkspaceHref).not.toHaveBeenCalledWith("/");
  });

  it("reloads a restored page when a different account is signed in", async () => {
    const { client } = renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
      organization: "CDPHE",
    });
    followWorkspaceHref.mockClear();
    auth.session = {
      access_token: "token-user-b",
      user: {
        email: "other@example.com",
        id: "user-b",
        user_metadata: { full_name: "Grace Hopper" },
      },
    };
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
    expect(
      client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    ).toStrictEqual([]);
  });

  it("reloads when the signed-in account changes on this page", async () => {
    const { client } = renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
      organization: "CDPHE",
    });
    followWorkspaceHref.mockClear();
    notify({
      access_token: "token-user-b",
      user: {
        email: "other@example.com",
        id: "user-b",
        user_metadata: { full_name: "Grace Hopper" },
      },
    });
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(
      client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    ).toStrictEqual([]);
  });

  it("keeps a restored page for the same signed-in account", async () => {
    renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBeforeRestore = auth.reads;
    persistedPageShow();
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    await waitFor(() => {
      expect(restoredWorkspaceConcealed()).toBeFalsy();
    });
    expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("hides a restored private note before the account read finishes", async () => {
    const gate = Promise.withResolvers<boolean>();
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    auth.pause = gate.promise;
    persistedPageShow();
    const shell = document.querySelector(".ux-reset-pro-app");
    const note = screen.getByTestId("restored-private-note");
    expect(shell).toBeInstanceOf(HTMLElement);
    if (!(shell instanceof HTMLElement)) {
      throw new Error("Professional shell is missing.");
    }
    expect({
      concealed: restoredWorkspaceConcealed(),
      cover: screen.getByTestId("workspace-restore-cover").textContent,
      noteHidden: note.closest("[hidden]") === shell,
      shellHidden: shell.hidden,
    }).toStrictEqual({
      concealed: true,
      cover: "Checking session",
      noteHidden: true,
      shellHidden: true,
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    gate.resolve(true);
    await waitFor(() => {
      expect(restoredWorkspaceConcealed()).toBeFalsy();
    });
    expect(note.closest("[hidden]")).toBeNull();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("keeps a restored private note hidden when the account read stalls", async () => {
    const gate = Promise.withResolvers<boolean>();
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    auth.pause = gate.promise;
    persistedPageShow();
    await Promise.resolve();
    const note = screen.getByTestId("restored-private-note");
    expect(note.closest("[hidden]")).toBe(
      document.querySelector(".ux-reset-pro-app")
    );
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
    gate.resolve(true);
    await waitFor(() => {
      expect(restoredWorkspaceConcealed()).toBeFalsy();
    });
  });

  it("keeps a restored private note hidden when the account read throws", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    auth.sessionRead = "throw";
    const readsBeforeRestore = auth.reads;
    persistedPageShow();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    expect(
      screen.getByTestId("restored-private-note").closest("[hidden]")
    ).toBe(document.querySelector(".ux-reset-pro-app"));
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("keeps a restored private note hidden when the account read returns an error", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    auth.sessionRead = { error: { message: "read failed" } };
    const readsBeforeRestore = auth.reads;
    persistedPageShow();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    expect(
      screen.getByTestId("restored-private-note").closest("[hidden]")
    ).toBe(document.querySelector(".ux-reset-pro-app"));
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("keeps a restored private note hidden when the account client is unconfigured", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    auth.configured = false;
    persistedPageShow();
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect(
      screen.getByTestId("restored-private-note").closest("[hidden]")
    ).toBe(document.querySelector(".ux-reset-pro-app"));
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(followWorkspaceHref).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-in"),
      "replace"
    );
  });

  it("conceals the workspace when the page enters the back-forward cache", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBeforeHide = auth.reads;
    pageTransition("pagehide", true);
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(
      screen.getByTestId("restored-private-note").closest("[hidden]")
    ).toBe(document.querySelector(".ux-reset-pro-app"));
    expect(auth.reads).toBe(readsBeforeHide);
    pageTransition("pagehide", false);
    expect(restoredWorkspaceConcealed()).toBeTruthy();
  });

  it("does not conceal a professional page on a fresh pageshow", async () => {
    renderMenu({ shell: true });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    pageTransition("pageshow", false);
    expect(restoredWorkspaceConcealed()).toBeFalsy();
    expect(followWorkspaceHref).not.toHaveBeenCalled();
  });

  it("conceals the shell before reloading for another account", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    followWorkspaceHref.mockClear();
    let concealedBeforeReplace = false;
    followWorkspaceHref.mockImplementation(() => {
      concealedBeforeReplace =
        restoredWorkspaceConcealed() && restoredNoteHidden();
    });
    notify({
      access_token: "token-user-b",
      user: {
        email: "other@example.com",
        id: "user-b",
        user_metadata: { full_name: "Grace Hopper" },
      },
    });
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect({
      concealedBeforeReplace,
      noteHidden: restoredNoteHidden(),
      stillConcealed: restoredWorkspaceConcealed(),
    }).toStrictEqual({
      concealedBeforeReplace: true,
      noteHidden: true,
      stillConcealed: true,
    });
  });

  it("reloads a restored page that has no recorded account", async () => {
    const gate = Promise.withResolvers<boolean>();
    auth.pause = gate.promise;
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await waitFor(() => {
      expect(auth.reads).toBeGreaterThan(0);
    });
    persistedPageShow();
    expect({
      concealed: restoredWorkspaceConcealed(),
      navigated: followWorkspaceHref.mock.calls,
      noteHidden: restoredNoteHidden(),
      recordedAccount: workspaceDocumentUserId(),
    }).toStrictEqual({
      concealed: true,
      navigated: [],
      noteHidden: true,
      recordedAccount: null,
    });
    gate.resolve(true);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
    expect({
      cover: screen.getByTestId("workspace-restore-cover").textContent,
      noteHidden: restoredNoteHidden(),
      signIn: followWorkspaceHref.mock.calls.some((call) =>
        String(call[0]).includes("/auth/sign-in")
      ),
      stillConcealed: restoredWorkspaceConcealed(),
    }).toStrictEqual({
      cover: "Checking session",
      noteHidden: true,
      signIn: false,
      stillConcealed: true,
    });
  });

  it("does not let a late fresh read reveal a page concealed by restore", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBefore = auth.reads;
    const fresh = Promise.withResolvers<ReturnType<typeof scriptedSession>>();
    const restore = Promise.withResolvers<ReturnType<typeof scriptedSession>>();
    auth.deferredReads = [fresh.promise, restore.promise];
    notify(null);
    await waitFor(() => {
      expect(auth.reads).toBe(readsBefore + 1);
    });
    persistedPageShow();
    expect({
      noteHidden: restoredNoteHidden(),
      reads: auth.reads,
      stillConcealed: restoredWorkspaceConcealed(),
    }).toStrictEqual({
      noteHidden: true,
      reads: readsBefore + 2,
      stillConcealed: true,
    });
    restore.resolve(scriptedSession(null, { message: "read failed" }));
    await act(async () => {
      await restore.promise;
    });
    fresh.resolve(scriptedSession(userSession({ full_name: "Ada Lovelace" })));
    await act(async () => {
      await fresh.promise;
    });
    expect({
      noteHidden: restoredNoteHidden(),
      stillConcealed: restoredWorkspaceConcealed(),
    }).toStrictEqual({
      noteHidden: true,
      stillConcealed: true,
    });
  });

  it("stays concealed when sign-out arrives during a restore check", async () => {
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBefore = auth.reads;
    const restore = Promise.withResolvers<ReturnType<typeof scriptedSession>>();
    const fresh = Promise.withResolvers<ReturnType<typeof scriptedSession>>();
    auth.deferredReads = [restore.promise, fresh.promise];
    persistedPageShow();
    notify(null);
    await waitFor(() => {
      expect(auth.reads).toBe(readsBefore + 2);
    });
    expect({
      noteHidden: restoredNoteHidden(),
      readsAfterShow: auth.reads,
    }).toStrictEqual({
      noteHidden: true,
      readsAfterShow: readsBefore + 2,
    });
    restore.resolve(
      scriptedSession(userSession({ full_name: "Ada Lovelace" }))
    );
    await act(async () => {
      await restore.promise;
    });
    fresh.resolve(scriptedSession(null, { message: "read failed" }));
    await act(async () => {
      await fresh.promise;
    });
    expect({
      noteHidden: restoredNoteHidden(),
      signIn: followWorkspaceHref.mock.calls.some((call) =>
        String(call[0]).includes("/auth/sign-in")
      ),
      stillConcealed: restoredWorkspaceConcealed(),
    }).toStrictEqual({
      noteHidden: true,
      signIn: false,
      stillConcealed: true,
    });
  });

  it("redirects when a failed sign-out leaves the session absent", async () => {
    auth.signOut.mockImplementation(async () => {
      notify(null);
      auth.failReads = 1;
      return { error: { message: "remote failed" } };
    });
    renderMenu({
      note: "Draft note for account A",
      shell: true,
    });
    await screen.findByRole("button", { name: "Ada Lovelace" });
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(
      (await screen.findByTestId("workspace-sign-out-notice")).textContent
    ).toBe(SIGN_OUT_STILL_ACTIVE);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
    expect(followWorkspaceHref).not.toHaveBeenCalledWith("/");
    expect(restoredWorkspaceConcealed()).toBeTruthy();
    expect(
      screen.getByTestId("restored-private-note").closest("[hidden]")
    ).toBe(document.querySelector(".ux-reset-pro-app"));
  });

  it("disables Settings and the sidebar while either sign-out is pending", async () => {
    const gate = Promise.withResolvers<{ error: null }>();
    auth.signOut.mockReturnValue(gate.promise);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <SidebarProvider defaultOpen storageKey="workspace-account-test">
            <WorkspaceAccountMenu />
            <SettingsAccountControls />
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    await screen.findByRole("button", { name: "Ada Lovelace" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const signingOut = await screen.findAllByRole("button", {
      name: "Signing out",
    });
    expect(signingOut).toHaveLength(2);
    for (const button of signingOut) {
      expect((button as HTMLButtonElement).disabled).toBeTruthy();
    }
    fireEvent.click(signingOut[0]);
    fireEvent.click(signingOut[1]);
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(beginWorkspaceSignOut()).toBeNull();
    gate.resolve({ error: null });
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
  });

  it("places the account control in the sidebar footer, outside primary navigation", () => {
    auth.configured = false;
    renderMenu({ shell: true });
    const footer = document.querySelector("[data-slot='sidebar-footer']");
    const content = document.querySelector("[data-slot='sidebar-content']");
    const navigation = document.querySelector("#ux-reset-pro-navigation nav");
    expect({
      footerInContent: Boolean(content?.contains(footer ?? null)),
      footerInNavigation: Boolean(navigation?.contains(footer ?? null)),
      footerInSidebar: Boolean(
        document.querySelector("#ux-reset-pro-navigation")?.contains(footer)
      ),
      hasFooter: Boolean(footer),
      settingsInNavigation: screen
        .getByRole("link", { name: "Settings" })
        .closest("nav"),
      signIn: screen.getByRole("link", { name: "Sign in" }).textContent,
      signOut: screen.queryByRole("menuitem", { name: "Sign out" }),
    }).toStrictEqual({
      footerInContent: false,
      footerInNavigation: false,
      footerInSidebar: true,
      hasFooter: true,
      settingsInNavigation: navigation,
      signIn: expect.stringContaining("Sign in"),
      signOut: null,
    });
  });

  it("closes the account menu on Escape before the mobile drawer", async () => {
    stubMatchMedia(true);
    auth.configured = true;
    renderMenu({ shell: true });
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    if (!(sidebar instanceof HTMLElement)) {
      throw new Error("Professional navigation is missing.");
    }
    expect(sidebar.dataset.mobileOpen).toBe("true");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ada Lovelace" })
    );
    await expect(
      screen.findByRole("menuitem", { name: "Sign out" })
    ).resolves.toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
    });
    expect(sidebar.dataset.mobileOpen).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(sidebar.dataset.mobileOpen).toBe("false");
    });
  });
});
