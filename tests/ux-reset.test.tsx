import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ResetExplorePage from "@/app/app/explore/page";
import ResetWorkspaceOverviewPage from "@/app/app/page";
import {
  RESET_APP_PATH,
  RESET_EXPLORE_PATH,
  RESET_REVIEW_PATH,
  isResetRouteActive,
} from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

let pathname: string = RESET_APP_PATH;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
}));

describe("UX Reset professional workspace", () => {
  afterEach(() => {
    cleanup();
    pathname = RESET_APP_PATH;
  });

  it("exposes all primary destinations in the route contract", () => {
    const labels = [
      "Workspace overview",
      "Review",
      "Explore",
      "Investigate",
      "Compare",
      "Action",
      "Assistant",
      "Feed",
      "Settings",
      "Docs",
    ];
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    for (const label of labels) {
      expect(navigation.textContent).toContain(label);
    }
  });

  it("marks the active destination without matching sibling prefixes", () => {
    pathname = RESET_EXPLORE_PATH;
    render(
      <ResetProfessionalShell>
        <ResetExplorePage />
      </ResetProfessionalShell>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect(
      navigation
        .querySelector('a[href="/app/explore"]')
        ?.getAttribute("aria-current")
    ).toBe("page");
    expect(
      navigation
        .querySelector('a[href="/app/review"]')
        ?.getAttribute("aria-current")
    ).toBeNull();
    expect(
      isResetRouteActive(
        { href: RESET_APP_PATH, match: "exact" },
        RESET_EXPLORE_PATH
      )
    ).toBeFalsy();
    expect(
      isResetRouteActive(
        { href: RESET_REVIEW_PATH, match: "prefix" },
        RESET_REVIEW_PATH
      )
    ).toBeTruthy();
  });

  it("renders outside the legacy analytical shell", () => {
    pathname = RESET_APP_PATH;
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );
    expect(document.querySelector(".ux-reset-pro-app")).toBeTruthy();
    expect(screen.getByText("Professional workspace")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Geographic Explorer" })).toBeNull();
    expect(
      screen.getAllByRole("link", { name: "Open legacy Atlas" }).length
    ).toBeGreaterThan(0);
  });
});
