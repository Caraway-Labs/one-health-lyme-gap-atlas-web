import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
  pageMetadataForResetRoute,
} from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import {
  ATLAS_EXPLORER_PATH,
  DOCS_PATH,
  LEGACY_ASSISTANT_PATH,
  LEGACY_COMPARE_PATH,
  RESET_ACTION_PATH,
  RESET_AI_RESPONSIBLE_USE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
  RESET_SETTINGS_PATH,
  UX_RESET_APP_PREFIX,
} from "@/features/ux-reset/routes";
import {
  WORKSPACE_HEADER_FALLBACK,
  WORKSPACE_HEADER_TITLES,
  workspaceHeaderTitle,
} from "@/features/ux-reset/workspace-header-title";
import { findRouteMetadata } from "@/lib/navigation";

let pathname: string = ATLAS_EXPLORER_PATH;
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

function headerLabel(): string {
  return document.querySelector(".app-header-label")?.textContent ?? "";
}

function titlesFor(paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    paths.map((path) => [path, workspaceHeaderTitle(path)])
  );
}

describe("workspace header title resolution", () => {
  it("uses the approved header text for the six destinations", () => {
    expect(WORKSPACE_HEADER_TITLES).toStrictEqual({
      "ask-atlas": "Ask Atlas",
      compare: "Compare Counties",
      "data-provenance": "Data Provenance",
      docs: "Documentation",
      explorer: "Atlas Explorer",
      feed: "Intelligence Feed",
      settings: "Settings",
    });
    expect(Object.values(WORKSPACE_HEADER_TITLES)).not.toContain(
      "Professional workspace"
    );
    expect(WORKSPACE_HEADER_FALLBACK).not.toBe("Professional workspace");
  });

  it("keeps sidebar labels and document titles independent of the header", () => {
    expect({
      access: RESET_ACCESS_NAV.map((route) => route.label),
      compareTitle: pageMetadataForResetRoute("compare").title,
      feedTitle: pageMetadataForResetRoute("feed").title,
      navigationLabel: findRouteMetadata("/app")?.label,
      overviewTitle: pageMetadataForResetRoute("overview").title,
      workspace: RESET_WORKSPACE_NAV.map((route) => route.label),
    }).toStrictEqual({
      access: ["Feed", "Data Provenance", "Settings", "Docs"],
      compareTitle: "Compare | One Health Lyme Gap Atlas",
      feedTitle: "Feed | One Health Lyme Gap Atlas",
      navigationLabel: "Professional workspace",
      overviewTitle: "Professional workspace | One Health Lyme Gap Atlas",
      workspace: ["Atlas Explorer", "Compare", "Ask Atlas"],
    });
  });

  it("resolves canonical routes, nested routes, queries, and trailing slashes", () => {
    expect(
      titlesFor([
        "/explore",
        "/explore/",
        "/explore/counties?scope=CO",
        "/compare",
        "/compare?compare=08001,08013",
        "/compare/pair",
        "/askatlas",
        "/askatlas/thread",
        "/app/feed",
        "/app/feed/item",
        "/data-provenance",
        "/data-provenance/source",
        `${RESET_SETTINGS_PATH}#account`,
        DOCS_PATH,
        `${DOCS_PATH}/professional-workspace`,
      ])
    ).toStrictEqual({
      "/app/feed": "Intelligence Feed",
      "/app/feed/item": "Intelligence Feed",
      "/app/settings#account": "Settings",
      "/askatlas": "Ask Atlas",
      "/askatlas/thread": "Ask Atlas",
      "/compare": "Compare Counties",
      "/compare/pair": "Compare Counties",
      "/compare?compare=08001,08013": "Compare Counties",
      "/data-provenance": "Data Provenance",
      "/data-provenance/source": "Data Provenance",
      "/docs": "Documentation",
      "/docs/professional-workspace": "Documentation",
      "/explore": "Atlas Explorer",
      "/explore/": "Atlas Explorer",
      "/explore/counties?scope=CO": "Atlas Explorer",
    });
  });

  it("resolves recorded aliases to the destination title", () => {
    expect(
      titlesFor([
        UX_RESET_APP_PREFIX,
        RESET_EXPLORE_PATH,
        `${RESET_EXPLORE_PATH}/nested`,
        RESET_INVESTIGATE_PATH,
        RESET_ACTION_PATH,
        RESET_REVIEW_PATH,
        `${RESET_REVIEW_PATH}/saved`,
        LEGACY_COMPARE_PATH,
        `${LEGACY_COMPARE_PATH}/extra`,
        LEGACY_ASSISTANT_PATH,
        `${LEGACY_ASSISTANT_PATH}/thread`,
        "/overview?state=CO",
        "/geographic_explorer",
        "/investigate",
      ])
    ).toStrictEqual({
      "/app": "Atlas Explorer",
      "/app/action": "Atlas Explorer",
      "/app/assistant": "Ask Atlas",
      "/app/assistant/thread": "Ask Atlas",
      "/app/compare": "Compare Counties",
      "/app/compare/extra": "Compare Counties",
      "/app/explore": "Atlas Explorer",
      "/app/explore/nested": "Atlas Explorer",
      "/app/investigate": "Atlas Explorer",
      "/app/review": "Atlas Explorer",
      "/app/review/saved": "Atlas Explorer",
      "/geographic_explorer": "Atlas Explorer",
      "/investigate": "Atlas Explorer",
      "/overview?state=CO": "Atlas Explorer",
    });
  });

  it("keeps the evidence brief on the fallback title", () => {
    const brief =
      "county=08001&scope=CO&dataset=alpha-2026&plan=evidence-brief";
    expect({
      bareAction: workspaceHeaderTitle(RESET_ACTION_PATH),
      briefArgument: workspaceHeaderTitle(RESET_ACTION_PATH, brief),
      briefInPath: workspaceHeaderTitle(`${RESET_ACTION_PATH}?${brief}`),
      otherPlan: workspaceHeaderTitle(
        RESET_ACTION_PATH,
        "county=08001&plan=brief"
      ),
      repeatedPlan: workspaceHeaderTitle(
        RESET_ACTION_PATH,
        "plan=evidence-brief&plan=brief"
      ),
      trimmedPlan: workspaceHeaderTitle(
        `${RESET_ACTION_PATH}?plan=%20evidence-brief%20`
      ),
    }).toStrictEqual({
      bareAction: "Atlas Explorer",
      briefArgument: WORKSPACE_HEADER_FALLBACK,
      briefInPath: WORKSPACE_HEADER_FALLBACK,
      otherPlan: "Atlas Explorer",
      repeatedPlan: "Atlas Explorer",
      trimmedPlan: WORKSPACE_HEADER_FALLBACK,
    });
  });

  it("uses a fallback for routes outside the six destinations", () => {
    expect(
      titlesFor([
        RESET_AI_RESPONSIBLE_USE_PATH,
        `${RESET_AI_RESPONSIBLE_USE_PATH}/detail`,
        "/",
        "/privacy",
        "/variant_1",
        "/unknown",
      ])
    ).toStrictEqual({
      "/": WORKSPACE_HEADER_FALLBACK,
      "/app/ai-responsible-use": WORKSPACE_HEADER_FALLBACK,
      "/app/ai-responsible-use/detail": WORKSPACE_HEADER_FALLBACK,
      "/privacy": WORKSPACE_HEADER_FALLBACK,
      "/unknown": WORKSPACE_HEADER_FALLBACK,
      "/variant_1": WORKSPACE_HEADER_FALLBACK,
    });
  });
});

describe("workspace header in the professional shell", () => {
  beforeEach(() => {
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    pathname = ATLAS_EXPLORER_PATH;
    const searchParamKeys: string[] = [];
    for (const key of searchParams.keys()) {
      searchParamKeys.push(key);
    }
    for (const key of searchParamKeys) {
      searchParams.delete(key);
    }
    vi.unstubAllGlobals();
  });

  it("renders the route title and leaves the navigation landmark name unchanged", () => {
    pathname = "/compare";
    render(
      <ResetProfessionalShell>
        <h1>Two counties. A clearer picture.</h1>
      </ResetProfessionalShell>
    );

    expect({
      header: headerLabel(),
      heading: screen.getByRole("heading", {
        name: "Two counties. A clearer picture.",
      }).textContent,
      navigation: screen
        .getByRole("navigation", {
          name: "Professional workspace",
        })
        .getAttribute("aria-label"),
      shell: document
        .querySelector("#ux-reset-pro-navigation")
        ?.getAttribute("aria-label"),
      staticLabel: screen.queryByText("Professional workspace"),
    }).toStrictEqual({
      header: "Compare Counties",
      heading: "Two counties. A clearer picture.",
      navigation: "Professional workspace",
      shell: "Professional workspace",
      staticLabel: null,
    });
  });

  it("updates the visible title when the pathname changes", () => {
    pathname = "/explore";
    const view = render(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    const titles = [headerLabel()];

    pathname = "/askatlas";
    view.rerender(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    titles.push(headerLabel());

    pathname = RESET_FEED_PATH;
    view.rerender(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    titles.push(headerLabel());

    pathname = RESET_AI_RESPONSIBLE_USE_PATH;
    view.rerender(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    titles.push(headerLabel());

    expect(titles).toStrictEqual([
      "Atlas Explorer",
      "Ask Atlas",
      "Intelligence Feed",
      WORKSPACE_HEADER_FALLBACK,
    ]);
    expect(
      screen.getByRole("navigation", { name: "Professional workspace" })
    ).toBeTruthy();
  });

  it("updates the visible title when the evidence-brief query changes", () => {
    pathname = RESET_ACTION_PATH;
    searchParams.set("county", "08001");
    searchParams.set("plan", "evidence-brief");
    const view = render(
      <ResetProfessionalShell>
        <p>Evidence brief</p>
      </ResetProfessionalShell>
    );
    const titles = [headerLabel()];

    searchParams.set("plan", "brief");
    view.rerender(
      <ResetProfessionalShell>
        <p>Evidence brief</p>
      </ResetProfessionalShell>
    );
    titles.push(headerLabel());

    searchParams.set("plan", " evidence-brief ");
    view.rerender(
      <ResetProfessionalShell>
        <p>Evidence brief</p>
      </ResetProfessionalShell>
    );
    titles.push(headerLabel());

    expect(titles).toStrictEqual([
      WORKSPACE_HEADER_FALLBACK,
      "Atlas Explorer",
      WORKSPACE_HEADER_FALLBACK,
    ]);
    expect(
      screen.getByRole("navigation", { name: "Professional workspace" })
    ).toBeTruthy();
  });

  it("omits Ask Atlas from the header while the sidebar item stays available", () => {
    pathname = "/explore";
    const view = render(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );

    const headerAsk = () => {
      const header = document.querySelector(".app-header");
      return {
        children: header?.querySelectorAll(":scope > *").length ?? 0,
        label: header?.querySelector(".app-header-label")?.textContent ?? "",
        launcher: header?.querySelector("[data-testid='ask-atlas-launcher']"),
        link: header?.querySelector("a"),
      };
    };
    const sidebarAsk = () => {
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      return navigation.querySelector('a[aria-label="Ask Atlas"]');
    };

    expect(headerAsk()).toStrictEqual({
      children: 2,
      label: "Atlas Explorer",
      launcher: null,
      link: null,
    });
    const expanded = sidebarAsk();
    if (expanded instanceof HTMLElement) {
      expanded.focus();
    }
    expect({
      current: expanded?.getAttribute("aria-current") ?? null,
      focused: document.activeElement === expanded,
      href: expanded?.getAttribute("href") ?? "",
    }).toStrictEqual({
      current: null,
      focused: true,
      href: expect.stringContaining("/askatlas"),
    });

    fireEvent.click(screen.getByRole("button", { name: "Hide navigation" }));
    const collapsed = sidebarAsk();
    if (collapsed instanceof HTMLElement) {
      collapsed.focus();
    }
    expect({
      current: collapsed?.getAttribute("aria-current") ?? null,
      focused: document.activeElement === collapsed,
      href: collapsed?.getAttribute("href") ?? "",
      label: collapsed?.getAttribute("aria-label"),
    }).toStrictEqual({
      current: null,
      focused: true,
      href: expect.stringContaining("/askatlas"),
      label: "Ask Atlas",
    });

    pathname = "/compare";
    view.rerender(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    expect({
      current: sidebarAsk()?.getAttribute("aria-current") ?? null,
      header: headerAsk(),
    }).toStrictEqual({
      current: null,
      header: {
        children: 2,
        label: "Compare Counties",
        launcher: null,
        link: null,
      },
    });

    pathname = "/askatlas";
    view.rerender(
      <ResetProfessionalShell>
        <p>Workspace page</p>
      </ResetProfessionalShell>
    );
    expect({
      current: sidebarAsk()?.getAttribute("aria-current"),
      header: headerAsk(),
    }).toStrictEqual({
      current: "page",
      header: {
        children: 2,
        label: "Ask Atlas",
        launcher: null,
        link: null,
      },
    });
  });
});
