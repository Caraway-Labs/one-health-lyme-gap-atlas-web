import { readFileSync } from "node:fs";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ATLAS_EXPLORER_PATH, RESET_APP_PATH } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

let pathname: string = RESET_APP_PATH;
const searchParams = new URLSearchParams();
const SIDEBAR_PREFERENCE_KEY = "ux-reset-pro-sidebar";

function stubDesktopMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

function navigation() {
  return screen.getByRole("navigation", { name: "Professional workspace" });
}

function sidebar() {
  const element = document.querySelector("#ux-reset-pro-navigation");
  if (!(element instanceof HTMLElement)) {
    throw new Error("Professional navigation sidebar is missing.");
  }
  return element;
}

describe("professional workspace navigation", () => {
  beforeEach(() => {
    pathname = RESET_APP_PATH;
    localStorage.clear();
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("names the product One Health Atlas and groups destinations as WORKSPACE and MORE", () => {
    render(
      <ResetProfessionalShell>
        <p>Overview</p>
      </ResetProfessionalShell>
    );

    const labels = [
      ...navigation().querySelectorAll('[data-slot="sidebar-group-label"]'),
    ].map((label) => label.textContent);
    expect({
      accessHeading: screen.queryByRole("heading", { name: "ACCESS" }),
      brand: screen.getByRole("link", { name: /^One Health Atlas$/ })
        .textContent,
      hideNavigation: screen.getByRole("button", { name: "Hide navigation" })
        .textContent,
      labels,
      retiredBrand: screen.queryByText("Atlas professional workspace"),
    }).toStrictEqual({
      accessHeading: null,
      brand: expect.stringContaining("One Health Atlas"),
      hideNavigation: "",
      labels: ["WORKSPACE", "MORE"],
      retiredBrand: null,
    });
  });

  it("keeps the brand and visibility control as separate header controls in both states", () => {
    render(
      <ResetProfessionalShell>
        <p>Overview</p>
      </ResetProfessionalShell>
    );

    const header = sidebar().querySelector('[data-slot="sidebar-header"]');
    const brand = header?.querySelector(".ux-reset-pro-brand");
    const toggle = header?.querySelector(".app-sidebar-toggle");
    expect(brand?.nextElementSibling).toBe(toggle);

    fireEvent.click(screen.getByRole("button", { name: "Hide navigation" }));
    expect({
      brand: Boolean(
        sidebar().querySelector(
          '[data-slot="sidebar-header"] .ux-reset-pro-brand'
        )
      ),
      showNavigation: screen.getByRole("button", { name: "Show navigation" })
        .tagName,
      state: sidebar().dataset.state,
      toggle: Boolean(
        sidebar().querySelector(
          '[data-slot="sidebar-header"] .app-sidebar-toggle'
        )
      ),
    }).toStrictEqual({
      brand: true,
      showNavigation: "BUTTON",
      state: "collapsed",
      toggle: true,
    });
  });

  it("persists the collapsed preference across a remount", async () => {
    const view = render(
      <ResetProfessionalShell>
        <p>Overview</p>
      </ResetProfessionalShell>
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide navigation" }));
    expect(localStorage.getItem(SIDEBAR_PREFERENCE_KEY)).toBe("false");

    view.unmount();
    render(
      <ResetProfessionalShell>
        <p>Overview</p>
      </ResetProfessionalShell>
    );
    await waitFor(() => {
      expect(sidebar().dataset.state).toBe("collapsed");
    });
    expect(
      screen.getByRole("button", { name: "Show navigation" })
    ).toBeTruthy();
  });

  it("marks only the active route and keeps Docs as an external tab", () => {
    pathname = ATLAS_EXPLORER_PATH;
    render(
      <ResetProfessionalShell>
        <p>Review</p>
      </ResetProfessionalShell>
    );

    const explorer = screen.getByRole("link", { name: /^Atlas Explorer$/ });
    const compare = screen.getByRole("link", { name: /^Compare$/ });
    const docs = screen.getByRole("link", { name: "Docs, opens in a new tab" });
    expect({
      compareActive: compare.dataset.active ?? null,
      compareCurrent: compare.getAttribute("aria-current") ?? null,
      docsRel: docs.getAttribute("rel"),
      docsTarget: docs.getAttribute("target"),
      explorerActive: explorer.dataset.active ?? null,
      explorerCurrent: explorer.getAttribute("aria-current") ?? null,
    }).toStrictEqual({
      compareActive: null,
      compareCurrent: null,
      docsRel: "noopener noreferrer",
      docsTarget: "_blank",
      explorerActive: "true",
      explorerCurrent: "page",
    });
  });

  it("scopes the approved active, hover, focus, and compact row selectors to the professional shell", () => {
    const css = readFileSync(
      "src/features/ux-reset/ux-reset.css",
      "utf-8"
    ).replaceAll(/\s+/g, " ");
    const required = [
      '[data-slot="sidebar-menu-button"]:hover:not([data-active="true"])',
      "background: var(--white);",
      "border-color: var(--navy);",
      "box-shadow: inset 3px 0 0 var(--teal);",
      "color: var(--teal-dark);",
      "outline: 2px solid var(--navy);",
      "height: 38px;",
      '[data-state="collapsed"] [data-slot="sidebar-header"] { flex-direction: column;',
      "border-top: 1px solid var(--border);",
    ];
    expect(required.filter((snippet) => !css.includes(snippet))).toStrictEqual(
      []
    );
    expect(css.includes("#092F51") || css.includes("#006978")).toBeFalsy();
  });

  it("offers Give feedback with the message-square-plus icon above account", () => {
    render(
      <ResetProfessionalShell>
        <p>Overview</p>
      </ResetProfessionalShell>
    );

    const feedback = screen.getByRole("button", { name: "Give feedback" });
    const docs = screen.getByRole("link", { name: "Docs, opens in a new tab" });
    const account = screen.getByTestId("workspace-account-menu");
    expect({
      afterDocs:
        docs.compareDocumentPosition(feedback) ===
        Node.DOCUMENT_POSITION_FOLLOWING,
      beforeAccount:
        feedback.compareDocumentPosition(account) ===
        Node.DOCUMENT_POSITION_FOLLOWING,
      icon: feedback.querySelector("svg")?.getAttribute("class"),
      sharedButton: feedback.className.includes("group/button"),
      slot: feedback.dataset.slot ?? null,
    }).toStrictEqual({
      afterDocs: true,
      beforeAccount: true,
      icon: expect.stringContaining("message-square-plus"),
      sharedButton: true,
      slot: "sidebar-menu-button",
    });

    fireEvent.click(screen.getByRole("button", { name: "Hide navigation" }));
    expect(screen.getByRole("button", { name: "Give feedback" })).toBeTruthy();
  });
});
