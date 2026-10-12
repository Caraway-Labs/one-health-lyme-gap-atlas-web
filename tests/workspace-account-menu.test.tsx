import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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
import { resetWorkspaceSignOutStateForTests } from "@/features/ux-reset/workspace-sign-out";

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
    listeners,
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

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn<() => void>() }),
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

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
          if (auth.pause) {
            await auth.pause;
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

function persistedPageShow() {
  window.history.pushState({}, "", "/app/review?scope=CO");
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  window.dispatchEvent(event);
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

function renderMenu(options?: { defaultOpen?: boolean; shell?: boolean }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const menu = options?.shell ? (
    <ResetProfessionalShell>
      <p>Review</p>
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
    window.history.pushState({}, "", "/app/review?scope=CO");
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
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

  it("keeps a restored page when the read fails and this page has not logged out", async () => {
    renderMenu();
    await screen.findByRole("button", { name: "Ada Lovelace" });
    const readsBeforeRestore = auth.reads;
    auth.sessionRead = { error: { message: "read failed" } };
    persistedPageShow();
    await waitFor(() => {
      expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();
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
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
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
    await waitFor(() => {
      expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    });
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
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO",
        "replace"
      );
    });
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
    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith(
        "/app/review?scope=CO",
        "replace"
      );
    });
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
    await waitFor(() => {
      expect(auth.reads).toBeGreaterThan(readsBeforeRestore);
    });
    expect(followWorkspaceHref).not.toHaveBeenCalled();
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
