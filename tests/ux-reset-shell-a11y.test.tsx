import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetWorkspaceOverviewPage from "@/app/app/page";
import { RESET_APP_PATH } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

let pathname = RESET_APP_PATH;
let searchParams = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => searchParams as ReadonlyURLSearchParams,
}));

function createResponsiveMatchMedia(initialMobile: boolean) {
  let isMobile = initialMobile;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        dispatchEvent: () => true,
        get matches() {
          return query.includes("800px") ? isMobile : false;
        },
        media: query,
        onchange: null,
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
      }) as unknown as MediaQueryList
  );
  return {
    setMobile(next: boolean) {
      isMobile = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function mockMobileViewport(matches: boolean) {
  createResponsiveMatchMedia(matches);
}

describe("UX Reset shell accessibility", () => {
  beforeEach(() => {
    pathname = RESET_APP_PATH;
    searchParams = new URLSearchParams();
    mockMobileViewport(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps accessible names on collapsed sidebar links", () => {
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse navigation" })
    );
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect(
      navigation
        .querySelector('a[href="/app/review"]')
        ?.getAttribute("aria-label")
    ).toBe("Review");
    expect(navigation.querySelector('a[href="/overview"]')).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open legacy Atlas" })
    ).toBeNull();
  });

  it("marks the mobile drawer inert while closed so links are not tabbable", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeTruthy();
    });

    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(sidebar?.contains(document.activeElement)).toBeFalsy();
  });

  it("traps focus in the open mobile drawer and restores focus on close", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);

    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeFalsy();
    });
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Close navigation"
      );
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(sidebar?.hasAttribute("inert")).toBeTruthy();
    });
    expect(document.activeElement).toBe(openButton);
  });

  it("reclaims Close navigation when focus drops to the body after opening", async () => {
    mockMobileViewport(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    openButton.focus();
    fireEvent.click(openButton);
    const closeButton = screen.getByRole("button", {
      name: "Close navigation",
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    closeButton.blur();
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        document
          .querySelector("#ux-reset-pro-navigation")
          ?.hasAttribute("inert")
      ).toBeTruthy();
    });
    expect(document.activeElement).toBe(openButton);
  });

  it("clears mobile modal state when the viewport grows past the drawer breakpoint", async () => {
    const viewport = createResponsiveMatchMedia(true);
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const sidebar = document.querySelector("#ux-reset-pro-navigation");
    const inset = document.querySelector(".app-inset");
    await waitFor(() => {
      expect(sidebar?.getAttribute("role")).toBe("dialog");
      expect(inset?.hasAttribute("inert")).toBeTruthy();
    });

    viewport.setMobile(false);
    await waitFor(() => {
      expect(sidebar?.getAttribute("role")).toBeNull();
      expect(inset?.hasAttribute("inert")).toBeFalsy();
      expect(sidebar?.hasAttribute("aria-modal")).toBeFalsy();
    });
  });
});
