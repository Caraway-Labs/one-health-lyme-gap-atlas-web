import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/assistant";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
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

  it("labels the enabled literature Assistant as early access", () => {
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

  it("renders utility and footer destinations from the route metadata", () => {
    renderShell(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(
      screen.getByRole("link", { name: "Docs" }).getAttribute("href")
    ).toBe("https://carawaylabs.com/docs");
    expect(
      screen.getByRole("link", { name: "Docs" }).getAttribute("target")
    ).toBe("_blank");
    expect(
      screen.getByRole("link", { name: "Account" }).getAttribute("href")
    ).toBe("/account");
    expect(
      screen.getByRole("navigation", { name: "Footer navigation" }).innerHTML
    ).toContain("Privacy");
    expect(screen.getByText("Route content")).toBeTruthy();
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
