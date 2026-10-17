import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetWorkspaceOverviewPage from "@/app/app/page";
import ResetComparePage from "@/app/compare/page";
import {
  RESET_APP_PATH,
  RESET_COMPARE_PATH,
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
      "Atlas Explorer",
      "Compare",
      "Ask Atlas",
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
    expect(
      [...navigation.querySelectorAll("a")].map((link) =>
        link.getAttribute("aria-label")
      )
    ).toStrictEqual([
      "Atlas Explorer",
      "Compare",
      "Ask Atlas",
      "Feed",
      "Settings",
      "Docs, opens in a new tab",
    ]);
    for (const label of labels) {
      expect(navigation.textContent).toContain(label);
    }
  });

  it("marks the active destination without matching sibling prefixes", () => {
    pathname = RESET_COMPARE_PATH;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter>
          <ResetProfessionalShell>
            <ResetComparePage />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    expect(
      navigation
        .querySelector('a[href^="/compare"]')
        ?.getAttribute("aria-current")
    ).toBe("page");
    expect(
      navigation
        .querySelector('a[href^="/explore"]')
        ?.getAttribute("aria-current")
    ).toBeNull();
    expect(
      isResetRouteActive(
        { href: RESET_APP_PATH, match: "exact" },
        RESET_COMPARE_PATH
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
    const settings = screen.getByRole("link", { name: "Privacy settings" });
    expect({
      privacyHref: privacy.getAttribute("href"),
      privacyInFooter: footer.contains(privacy),
      privacyTarget: privacy.getAttribute("target"),
      settingsHref: settings.getAttribute("href"),
      settingsInFooter: footer.contains(settings),
      settingsTarget: settings.getAttribute("target"),
    }).toStrictEqual({
      privacyHref: "/privacy",
      privacyInFooter: true,
      privacyTarget: null,
      settingsHref: "/app/settings",
      settingsInFooter: true,
      settingsTarget: null,
    });
    expect(footer.querySelector("button")).toBeNull();
  });

  it("places the trust footer after route content inside the scrolling main", () => {
    pathname = RESET_APP_PATH;
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const scroll = document.querySelector(".ux-reset-pro-scroll");
    const main = scroll?.querySelector("main.ux-reset-pro-main");
    const footer = screen.getByRole("contentinfo");
    expect({
      footerFollowsMain: main?.nextElementSibling === footer,
      footerInMain: Boolean(main?.contains(footer)),
      footerInScroll: Boolean(scroll?.contains(footer)),
      insetFooter: document
        .querySelector(".app-inset")
        ?.querySelector(":scope > footer"),
      mainFirst: scroll?.firstElementChild === main,
    }).toStrictEqual({
      footerFollowsMain: true,
      footerInMain: false,
      footerInScroll: true,
      insetFooter: null,
      mainFirst: true,
    });
  });

  it("links AI / Responsible Use from the workspace footer", () => {
    pathname = RESET_APP_PATH;
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );

    const responsibleUse = screen.getByRole("link", {
      name: "AI / Responsible Use",
    });
    expect(
      screen.getByRole("contentinfo").contains(responsibleUse)
    ).toBeTruthy();
    expect(responsibleUse.getAttribute("href")).toBe("/app/ai-responsible-use");
    expect(responsibleUse.getAttribute("target")).toBeNull();
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
      screen.queryByRole("link", { name: "Open legacy Atlas" })
    ).toBeNull();
  });

  it("does not show internal program branding or a legacy Atlas entry", () => {
    pathname = RESET_APP_PATH;
    render(
      <ResetProfessionalShell>
        <ResetWorkspaceOverviewPage />
      </ResetProfessionalShell>
    );
    expect(screen.queryByRole("link", { name: /legacy atlas/i })).toBeNull();
    expect(screen.queryByText("Legacy Atlas")).toBeNull();
    expect(screen.queryByText(/ux reset/i)).toBeNull();
    expect(document.querySelector('a[href="/overview"]')).toBeNull();
  });
});
