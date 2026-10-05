import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetExplorePage from "@/app/app/explore/page";
import ResetWorkspaceOverviewPage from "@/app/app/page";
import {
  RESET_APP_PATH,
  RESET_EXPLORE_PATH,
  RESET_REVIEW_PATH,
  isResetRouteActive,
} from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { DOCS_PATH } from "@/features/ux-reset/routes";

let pathname: string = RESET_APP_PATH;
const searchParams = new URLSearchParams();

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

describe("UX Reset professional workspace", () => {
  beforeEach(() => {
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    pathname = RESET_APP_PATH;
    const searchParamKeys: string[] = [];
    for (const key of searchParams.keys()) {
      searchParamKeys.push(key);
    }
    for (const key of searchParamKeys) {
      searchParams.delete(key);
    }
    vi.unstubAllGlobals();
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
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter>
          <ResetProfessionalShell>
            <ResetExplorePage />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect(
      navigation
        .querySelector('a[href^="/app/explore"]')
        ?.getAttribute("aria-current")
    ).toBe("page");
    expect(
      navigation
        .querySelector('a[href^="/app/review"]')
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

  it("opens Docs in a new tab and leaves analytical context on the workspace page", () => {
    pathname = RESET_REVIEW_PATH;
    searchParams.set("scope", "NY");
    searchParams.set("county", "36061");
    searchParams.set("sort", "score");
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const docsLink = screen.getByRole("link", {
      name: "Docs, opens in a new tab",
    });
    expect(docsLink.getAttribute("href")).toBe(DOCS_PATH);
    expect(docsLink.getAttribute("target")).toBe("_blank");
    expect(docsLink.getAttribute("rel")).toBe("noopener noreferrer");
    expect(docsLink.textContent).toContain("Docs");
  });

  it("links Privacy to the public page from the workspace footer", () => {
    pathname = RESET_APP_PATH;
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const footer = screen.getByRole("contentinfo");
    const privacy = screen.getByRole("link", { name: "Privacy" });
    expect(footer.contains(privacy)).toBeTruthy();
    expect(privacy.getAttribute("href")).toBe("/privacy");
    expect(privacy.getAttribute("target")).toBeNull();
    expect(footer.querySelector("button")?.textContent).toContain(
      "Privacy settings"
    );
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
    expect(
      screen.queryByRole("link", { name: "Geographic Explorer" })
    ).toBeNull();
    expect(
      screen.getAllByRole("link", { name: "Open legacy Atlas" }).length
    ).toBeGreaterThan(0);
  });
});
