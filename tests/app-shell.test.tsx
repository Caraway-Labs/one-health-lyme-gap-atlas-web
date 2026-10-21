import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/assistant";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

import { AppShell } from "@/components/app-shell";
import { FeedbackProvider } from "@/components/feedback-dialog";

function renderShell(ui: ReactElement) {
  return render(
    <NuqsTestingAdapter>
      <FeedbackProvider>{ui}</FeedbackProvider>
    </NuqsTestingAdapter>
  );
}

describe("Atlas application shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    pathname = "/assistant";
  });

  it("renders metadata-driven primary navigation and status treatment", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Atlas Assistant" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(screen.queryByRole("link", { name: "Evidence library" })).toBeNull();
    expect(screen.getAllByText("Coming Soon")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /County review/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /variant/i })).toBeNull();
  });

  it("leaves the UX Lab out of primary navigation", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: /UX Lab/i })).toBeNull();
  });

  it("labels the enabled literature Assistant as early access on the workspace route", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(
      screen.getByRole("link", { name: "Atlas Assistant" }).textContent
    ).toContain("Early access");
    expect(screen.queryByText("Coming Soon")).toBeNull();
  });

  it("hides the Assistant nav link on explore routes when literature chat is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
    pathname = "/geographic_explorer";
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: "Atlas Assistant" })).toBeNull();
  });

  it("renders utility and footer destinations from the route metadata", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    const footer = screen.getByRole("contentinfo");
    const trust = screen.getByRole("navigation", { name: "Trust" });
    expect({
      account: screen
        .getByRole("link", { name: "Account" })
        .getAttribute("href"),
      backToAtlas: screen.queryByRole("link", { name: "Back to Atlas ↑" }),
      content: screen.getByText("Route content").textContent,
      docs: {
        href: screen.getByRole("link", { name: "Docs" }).getAttribute("href"),
        target: screen
          .getByRole("link", { name: "Docs" })
          .getAttribute("target"),
      },
      ethics: trust.querySelector('a[href="/ai-ethics"]')?.textContent,
      legacy: screen.queryByText(/Independent Caraway Labs prototype/),
      privacyInTrust: trust.contains(
        screen.getByRole("link", { name: "Privacy" })
      ),
      privacySettings: screen.getByRole("button", { name: "Privacy settings" })
        .textContent,
      trustFooter: footer.classList.contains("ux-reset-trust-footer"),
    }).toStrictEqual({
      account: "/account",
      backToAtlas: null,
      content: "Route content",
      docs: {
        href: "https://onehealthatlas.org/docs",
        target: "_blank",
      },
      ethics: "AI / Responsible Use",
      legacy: null,
      privacyInTrust: true,
      privacySettings: "Privacy settings",
      trustFooter: true,
    });
  });

  it("keeps the anonymous trust footer when Assistant is Coming Soon", () => {
    renderShell(
      <AppShell>
        <p>Coming soon route</p>
      </AppShell>
    );

    expect(screen.getAllByText("Coming Soon")).toHaveLength(1);
    expect(
      screen
        .getByRole("link", {
          name: "One Health Atlas by Caraway Labs (opens in a new tab)",
        })
        .getAttribute("href")
    ).toBe("/about/caraway-labs");
    expect(screen.queryByRole("link", { name: "Privacy settings" })).toBeNull();
  });

  it("exposes a Feedback control next to Account in the header", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(screen.getByRole("button", { name: "Feedback" })).toBeTruthy();
  });

  it("collapses the persistent sidebar while retaining accessible item status", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse navigation" })
    );

    expect(
      screen.getByRole("button", { name: "Expand navigation" })
    ).toBeTruthy();
    expect(screen.getByRole("complementary").dataset.state).toBe("collapsed");
    expect(
      screen
        .getByRole("link", { name: "Atlas Assistant — Coming Soon" })
        .getAttribute("aria-label")
    ).toBe("Atlas Assistant — Coming Soon");
    expect(
      screen
        .getByRole("link", { name: "Investigation Workspace" })
        .getAttribute("aria-label")
    ).toBe("Investigation Workspace");
  });

  it("marks Investigation Workspace active on the canonical route", () => {
    pathname = "/investigate";
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Investigation Workspace" })
        .getAttribute("href")
    ).toBe("/investigate");
    expect(
      screen
        .getByRole("link", { name: "Investigation Workspace" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Geographic Explorer" })
        .getAttribute("aria-current")
    ).toBeNull();
  });

  it("persists only the desktop presentation preference across shell sessions", async () => {
    const { unmount } = renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse navigation" })
    );

    await waitFor(() =>
      expect(window.localStorage.getItem("atlas-sidebar-open")).toBe("false")
    );
    unmount();

    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );
    await waitFor(() =>
      expect(screen.getByRole("complementary").dataset.state).toBe("collapsed")
    );
    expect(window.localStorage.getItem("atlas-sidebar-open")).toBe("false");
  });

  it("treats the mobile navigation as a keyboard-operable modal drawer", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Close navigation" })
    ).toBeTruthy();
    expect(
      document.querySelector(".app-inset")?.hasAttribute("inert")
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("temporarily compacts Geographic Explorer in focus mode without changing the route", () => {
    pathname = "/geographic_explorer";
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Focus workspace" }));

    expect(
      screen
        .getByRole("button", { name: "Exit focus" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("complementary").dataset.state).toBe("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Exit focus" }));
    expect(screen.getByRole("complementary").dataset.state).toBe("expanded");
  });
});
