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
    page.getByRole("heading", { name: "Sign in to Atlas" })
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
    await clickWorkspaceLink(page, "Explore", "/app/explore");
    const exploreUrl = new URL(page.url());
    expect(exploreUrl.pathname).toBe("/app/explore");
    expect(exploreUrl.searchParams.get("county")).toBe("08001");
    expect(exploreUrl.searchParams.get("scope")).toBe("CO");
    expect(exploreUrl.searchParams.get("compare")).toBeNull();
    expect(exploreUrl.searchParams.get("tab")).toBeNull();
  }

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await clickWorkspaceLink(page, "Settings", "/app/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");

  await page.locator(".app-header .ux-reset-legacy-link").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".app-shell")).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("bounded context survives rendered navigation, reload, and browser history", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop-only: mobile shell requires opening the drawer before each nav click."
  );
  await installDeterministicWorkspaceMocks(page);

  const expectInvestigateContext = (target: URL) => {
    expect(target.pathname).toBe("/app/investigate");
    expect(target.searchParams.get("scope")).toBe("CO");
    expect(target.searchParams.get("county")).toBe("08001");
    expect(target.searchParams.get("dataset")).toBe("alpha-2026-08-06");
    expect(target.searchParams.get("period")).toBe("2023-01-01");
    expect(target.searchParams.get("compare")).toBe("08001,08003");
  };

  const expectCompareSelection = (target: URL) => {
    expect(target.pathname).toBe("/app/compare");
    expect(target.searchParams.get("compare")).toBe("08001,08003");
  };

  await page.goto(
    "/app/review?scope=CO&county=08001&compare=08001,08003&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
  );
  await clickWorkspaceLink(page, "Compare", "/app/compare");

  let url = new URL(page.url());
  expectCompareSelection(url);
  expect(url.searchParams.get("sort")).toBeNull();

  await clickWorkspaceLink(page, "Investigate", "/app/investigate");
  expectInvestigateContext(new URL(page.url()));

  await clickWorkspaceLink(page, "Action", "/app/action");
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/action");
  expect(url.searchParams.get("county")).toBe("08001");

  await page.reload();
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/action");
  expect(url.searchParams.get("county")).toBe("08001");

  // Rapid reload→Back: do not wait for metadata. Hydration can still replace
  // this history entry with /app/action if the router listener is not ready.
  await expectHistoryNavigation(
    page,
    "back",
    (target) => target.pathname === "/app/investigate"
  );
  expectInvestigateContext(new URL(page.url()));

  await expectHistoryNavigation(
    page,
    "back",
    (target) => target.pathname === "/app/compare"
  );
  expectCompareSelection(new URL(page.url()));

  await expectHistoryNavigation(
    page,
    "forward",
    (target) => target.pathname === "/app/investigate"
  );
  expectInvestigateContext(new URL(page.url()));
  await clickWorkspaceLink(page, "Action", "/app/action");
  expect(new URL(page.url()).pathname).toBe("/app/action");

  await page.goto(
    "/app/review?scope=state&county=bad&period=2024&dataset=alpha"
  );
  await clickWorkspaceLink(page, "Investigate", "/app/investigate");
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/investigate");
  expect(url.searchParams.get("county")).toBeNull();
  expect(url.searchParams.get("scope")).toBe("ALL");
  expect(url.searchParams.get("period")).toBeNull();
  expect(url.searchParams.get("dataset")).toBe("alpha");
});

test("settled Action reload stays on Investigate after Back", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop-only: mobile shell requires opening the drawer before each nav click."
  );
  await installDeterministicWorkspaceMocks(page);

  await page.goto(
    "/app/review?scope=CO&county=08001&compare=08001,08003&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
  );
  await clickWorkspaceLink(page, "Compare", "/app/compare");
  await clickWorkspaceLink(page, "Investigate", "/app/investigate");
  await clickWorkspaceLink(page, "Action", "/app/action");
  await page.reload();
  await expect(page.getByTestId("action-county-identity")).toHaveText(
    "FIPS 08001 · Colorado (CO)."
  );
  await expect(page.getByText("Loading release metadata…")).toHaveCount(0);

  await expectHistoryNavigation(
    page,
    "back",
    (target) => target.pathname === "/app/investigate"
  );
  const url = new URL(page.url());
  expect(url.pathname).toBe("/app/investigate");
  expect(url.searchParams.get("scope")).toBe("CO");
  expect(url.searchParams.get("county")).toBe("08001");
  expect(url.searchParams.get("dataset")).toBe("alpha-2026-08-06");
  expect(url.searchParams.get("period")).toBe("2023-01-01");
  expect(url.searchParams.get("compare")).toBe("08001,08003");
});
