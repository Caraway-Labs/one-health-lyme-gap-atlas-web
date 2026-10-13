import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

const HISTORY_RELEASE_ID = "alpha-2026-08-06";

async function installDeterministicWorkspaceMocks(page: Page) {
  const metadata = {
    ...reviewScopeMetadataFixture,
    release_id: HISTORY_RELEASE_ID,
  };
  const scores = {
    ...reviewScopeScoresFixture,
    release_id: HISTORY_RELEASE_ID,
  };
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: { state_code: "CO" } } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: metadata });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scores });
  });
  await page.route("**/v1/indicators**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/indicators" }, meta: {} },
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/measures" }, meta: {} },
    });
  });
  await page.route("**/v1/geographies/**", async (route) => {
    await route.fulfill({
      json: { code: "CANONICAL_DATA_UNAVAILABLE" },
      status: 503,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/observations" }, meta: {} },
    });
  });
}

function isBenignHistoryNavigationError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("Execution context was destroyed") ||
    message.includes("net::ERR_ABORTED") ||
    message.includes("frame was detached")
  );
}

/** Next.js App Router history steps often abort Playwright navigation waits. */
async function expectHistoryNavigation(
  page: Page,
  direction: "back" | "forward",
  matches: (url: URL) => boolean
) {
  const triggerHistoryStep = async () => {
    try {
      await page.goBack({ waitUntil: "commit", timeout: 5_000 });
    } catch (error) {
      if (!isBenignHistoryNavigationError(error)) {
        throw error;
      }
    }
  };

  const triggerForwardStep = async () => {
    try {
      await page.goForward({ waitUntil: "commit", timeout: 5_000 });
    } catch (error) {
      if (!isBenignHistoryNavigationError(error)) {
        throw error;
      }
    }
  };

  if (direction === "back") {
    await triggerHistoryStep();
  } else {
    await triggerForwardStep();
  }

  await expect
    .poll(() => matches(new URL(page.url())), { timeout: 15_000 })
    .toBe(true);
  await page.waitForLoadState("domcontentloaded");
}

const WORKSPACE_DESTINATIONS = [
  {
    heading: "Explore the evidence behind every county.",
    path: "/explore",
    title: "Atlas Explorer | One Health Lyme Gap Atlas",
  },
  {
    heading: "Two counties. A clearer picture.",
    path: "/compare",
    title: "Compare | One Health Lyme Gap Atlas",
  },
  {
    heading: "Ask Atlas",
    path: "/askatlas",
    title: "Ask Atlas | One Health Lyme Gap Atlas",
  },
  {
    heading: "Settings",
    path: "/app/settings",
    title: "Settings | One Health Lyme Gap Atlas",
  },
  {
    heading: "Feed",
    path: "/app/feed",
    title: "Feed | One Health Lyme Gap Atlas",
  },
] as const;

const WORKSPACE_NAV_LABELS = [
  "Atlas Explorer",
  "Compare",
  "Ask Atlas",
  "Feed",
  "Settings",
  "Docs",
] as const;

type WorkspaceDestination = (typeof WORKSPACE_DESTINATIONS)[number];

function isMobileProject(projectName: string): boolean {
  return projectName.includes("mobile");
}

/** Open the drawer, or collapse the desktop rail, before absence checks. */
async function revealWorkspaceNavigation(
  page: Page,
  mobile: boolean
): Promise<void> {
  if (mobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "Hide navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Show navigation" })
  ).toBeVisible();
  await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
    "data-state",
    "collapsed"
  );
}

async function expectWorkspaceWithoutLegacyDiscovery(
  page: Page,
  destination: WorkspaceDestination
): Promise<void> {
  await expect(page).toHaveTitle(destination.title);
  await expect(
    page.locator("h1").filter({ hasText: destination.heading })
  ).toBeVisible();

  const navigation = page.getByRole("navigation", {
    name: "Professional workspace",
  });
  for (const label of WORKSPACE_NAV_LABELS) {
    const name = label === "Docs" ? "Docs, opens in a new tab" : label;
    await expect(
      navigation.getByRole("link", { exact: true, name })
    ).toBeVisible();
  }

  await expect(
    navigation.getByRole("heading", { name: /legacy atlas/i })
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /legacy atlas/i })).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: /legacy atlas/i })).toHaveCount(
    0
  );
  await expect(page.locator('a[href="/overview"]')).toHaveCount(0);
  await expect(page.getByText(/ux reset/i)).toHaveCount(0);

  const groups = await page
    .locator('#ux-reset-pro-navigation [data-slot="sidebar-group"]')
    .evaluateAll((sections) =>
      sections.map((section) => ({
        label: section.querySelector("h2")?.textContent?.trim() ?? "",
        links: section.querySelectorAll("a[href]").length,
      }))
    );
  expect(groups.map((group) => group.label)).toEqual(["WORKSPACE", "MORE"]);
  expect(groups.every((group) => group.links > 0)).toBe(true);
}

/** Client-side workspace links update the URL after the click returns. */
async function clickWorkspaceLink(page: Page, name: string, pathname: string) {
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toBe(pathname);
}

test("preserves reset deep links through sign-in when auth is configured", async ({
  page,
}) => {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  test.skip(
    !hasSupabase,
    "Browser login was not executed: Supabase is not configured on the Playwright web server."
  );

  await page.goto("/app/investigate?county=08001&scope=state&tab=map");
  await expect(page).toHaveURL(
    /\/auth\/sign-in\?next=%2Fapp%2Finvestigate%3Fcounty%3D08001%26scope%3Dstate%26tab%3Dmap/
  );
  await expect(
    page.getByRole("heading", { name: "Sign in or create an account" })
  ).toBeVisible();
});

test("professional workspace shell supports navigation, focus, and responsive layout", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile")
      ? { height: 900, width: 390 }
      : { height: 900, width: 1280 }
  );
  await page.goto(
    "/app/investigate?county=08001&scope=CO&tab=map&compare=08013"
  );

  await expect(page.locator(".app-shell")).toHaveCount(1);

  if (testInfo.project.name.includes("mobile")) {
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("inert", "");
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(sidebar.locator("a").first()).not.toBeFocused();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).not.toHaveAttribute("inert");
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveAttribute("inert", "");
  } else {
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  if (!testInfo.project.name.includes("mobile")) {
    await clickWorkspaceLink(page, "Compare", "/compare");
    const compareUrl = new URL(page.url());
    expect(compareUrl.pathname).toBe("/compare");
    expect(compareUrl.searchParams.get("county")).toBe("08001");
    expect(compareUrl.searchParams.get("scope")).toBe("CO");
    expect(compareUrl.searchParams.get("tab")).toBeNull();
  }

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await clickWorkspaceLink(page, "Settings", "/app/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator(".app-shell")).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test.describe("professional workspace omits legacy discovery and UX Reset labels", () => {
  for (const destination of WORKSPACE_DESTINATIONS) {
    test(`${destination.path} keeps its title and navigation without a legacy entry`, async ({
      page,
    }, testInfo) => {
      const mobile = isMobileProject(testInfo.project.name);
      await page.setViewportSize(
        mobile ? { height: 900, width: 390 } : { height: 900, width: 1280 }
      );
      await page.goto(destination.path);
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(destination.path);
      await expect(
        page.getByRole("heading", { level: 1, name: destination.heading })
      ).toBeVisible();
      await revealWorkspaceNavigation(page, mobile);
      await expectWorkspaceWithoutLegacyDiscovery(page, destination);
    });
  }
});

test("bounded context survives rendered navigation, reload, and browser history", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop-only: mobile shell requires opening the drawer before each nav click."
  );
  await installDeterministicWorkspaceMocks(page);

  const expectExplorerContext = (target: URL) => {
    expect(target.pathname).toBe("/explore");
    expect(target.searchParams.get("scope")).toBe("CO");
    expect(target.searchParams.get("county")).toBe("08001");
    expect(target.searchParams.get("dataset")).toBe("alpha-2026-08-06");
    expect(target.searchParams.get("period")).toBe("2023-01-01");
    expect(target.searchParams.get("compare")).toBe("08001,08003");
  };

  const expectCompareSelection = (target: URL) => {
    expect(target.pathname).toBe("/compare");
    expect(target.searchParams.get("compare")).toBe("08001,08003");
  };

  await page.goto(
    "/explore?scope=CO&county=08001&compare=08001,08003&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
  );
  await clickWorkspaceLink(page, "Compare", "/compare");

  let url = new URL(page.url());
  expectCompareSelection(url);
  expect(url.searchParams.get("sort")).toBeNull();

  await clickWorkspaceLink(page, "Atlas Explorer", "/explore");
  expectExplorerContext(new URL(page.url()));

  await page.reload();
  url = new URL(page.url());
  expectExplorerContext(url);

  await expectHistoryNavigation(
    page,
    "back",
    (target) => target.pathname === "/compare"
  );
  expectCompareSelection(new URL(page.url()));

  await expectHistoryNavigation(
    page,
    "forward",
    (target) => target.pathname === "/explore"
  );
  expectExplorerContext(new URL(page.url()));

  await page.goto("/explore?scope=state&county=bad&period=2024&dataset=alpha");
  await clickWorkspaceLink(page, "Compare", "/compare");
  url = new URL(page.url());
  expect(url.pathname).toBe("/compare");
  expect(url.searchParams.get("county")).toBeNull();
  expect(url.searchParams.get("scope")).toBe("ALL");
  expect(url.searchParams.get("period")).toBeNull();
  expect(url.searchParams.get("dataset")).toBe("alpha");
});

test("an Action bookmark stays on suggested follow-up after reload", async ({
  page,
}) => {
  await installDeterministicWorkspaceMocks(page);
  await page.goto(
    "/app/action?county=08001&scope=CO&dataset=alpha-2026-08-06&period=2023-01-01"
  );
  await expect(page).toHaveURL(/\/explore/);
  await expect(page).toHaveURL(/mode=follow-up/);
  await expect(page).toHaveURL(/county=08001/);
  await page.reload();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/explore");
  expect(url.searchParams.get("mode")).toBe("follow-up");
  expect(url.searchParams.get("county")).toBe("08001");
  expect(url.searchParams.get("scope")).toBe("CO");
  await expect(page.getByRole("heading", { name: "Action" })).toHaveCount(0);
});
