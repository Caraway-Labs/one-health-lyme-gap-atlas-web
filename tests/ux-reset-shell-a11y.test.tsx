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

function mockMobileViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: query.includes("800px") ? matches : false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
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
    expect(
      navigation.querySelector('a[href="/"]')?.getAttribute("aria-label")
    ).toBe("Open legacy Atlas");
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
});
