import { expect, test, type Page } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
});

const HEADER = ".ux-reset-pro-app .app-header";
const HEADER_LABEL = ".app-header-label";

const CANONICAL_DESTINATIONS = [
  {
    heading: "Explore county Lyme data",
    path: "/explore",
    title: "Atlas Explorer",
  },
  {
    heading: "Two counties. A clearer picture.",
    path: "/compare",
    title: "Compare Counties",
  },
  {
    heading: "Ask Atlas",
    path: "/askatlas",
    title: "Ask Atlas",
  },
  {
    heading: "Feed",
    path: "/app/feed",
    title: "Intelligence Feed",
  },
  {
    heading: "Data Provenance",
    path: "/data-provenance",
    title: "Data Provenance",
  },
  {
    heading: "Settings",
    path: "/app/settings",
    title: "Settings",
  },
] as const;

const SIDEBAR_TRANSITIONS = [
  { name: "Compare", pathname: "/compare", title: "Compare Counties" },
  { name: "Ask Atlas", pathname: "/askatlas", title: "Ask Atlas" },
  { name: "Feed", pathname: "/app/feed", title: "Intelligence Feed" },
  {
    name: "Data Provenance",
    pathname: "/data-provenance",
    title: "Data Provenance",
  },
  { name: "Settings", pathname: "/app/settings", title: "Settings" },
  { name: "Atlas Explorer", pathname: "/explore", title: "Atlas Explorer" },
] as const;

async function expectHeaderTitle(page: Page, title: string) {
  const label = page.locator(HEADER_LABEL);
  await expect(label).toHaveText(title);
  await expect(label).toBeVisible();
  const wrapped = await label.evaluate((element) => {
    const style = getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    return element.getBoundingClientRect().height > lineHeight + 1;
  });
  expect(wrapped).toBe(false);
}

async function clickWorkspaceLink(page: Page, name: string, pathname: string) {
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toBe(pathname);
}

test.describe("workspace header titles", () => {
  test("follows sidebar navigation, history, and sidebar collapse", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/explore?scope=CO");
    await expect(page.locator("h1").first()).toHaveText(
      "Explore county Lyme data"
    );
    await expectHeaderTitle(page, "Atlas Explorer");
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
      "aria-label",
      "Professional workspace"
    );
    const expandedHeader = await page.locator(HEADER).boundingBox();
    await page.screenshot({
      path: testInfo.outputPath("workspace-header-expanded.png"),
    });

    await page.getByRole("button", { name: "Hide navigation" }).click();
    await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
      "data-state",
      "collapsed"
    );
    await expectHeaderTitle(page, "Atlas Explorer");
    const collapsedHeader = await page.locator(HEADER).boundingBox();
    expect(collapsedHeader?.height).toBe(expandedHeader?.height);
    await page.screenshot({
      path: testInfo.outputPath("workspace-header-collapsed.png"),
    });
    await page.getByRole("button", { name: "Show navigation" }).click();

    for (const destination of SIDEBAR_TRANSITIONS) {
      await clickWorkspaceLink(page, destination.name, destination.pathname);
      await expectHeaderTitle(page, destination.title);
    }

    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/app/settings");
    await expectHeaderTitle(page, "Settings");

    await page.goForward();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/explore");
    await expectHeaderTitle(page, "Atlas Explorer");

    await page.reload();
    await expectHeaderTitle(page, "Atlas Explorer");
    await expect(page.locator("h1").first()).toHaveText(
      "Explore county Lyme data"
    );
  });

  for (const destination of CANONICAL_DESTINATIONS) {
    test(`deep link ${destination.path} shows ${destination.title}`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width: 1280 });
      await page.goto(destination.path);
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(destination.path);
      await expectHeaderTitle(page, destination.title);
      await expect(
        page.getByRole("heading", { level: 1, name: destination.heading })
      ).toBeVisible();
      await expect(page.locator(HEADER_LABEL)).not.toHaveText(
        "Professional workspace"
      );
    });
  }

  test("deep links through aliases keep the destination title", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    const aliases = [
      { path: "/app/compare?compare=08001,08013", title: "Compare Counties" },
      { path: "/app/assistant", title: "Ask Atlas" },
      { path: "/app/review?scope=CO", title: "Atlas Explorer" },
      { path: "/app/explore?county=08001", title: "Atlas Explorer" },
      { path: "/app", title: "Atlas Explorer" },
    ] as const;

    for (const alias of aliases) {
      await page.goto(alias.path);
      await expectHeaderTitle(page, alias.title);
      await expect(page.locator(HEADER_LABEL)).not.toHaveText(
        "Professional workspace"
      );
    }
  });

  test("uses the fallback title for the evidence brief and updates after leaving it", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&plan=evidence-brief"
    );
    await expect(page).toHaveURL(/\/app\/action/);
    await expect(page).toHaveURL(/plan=evidence-brief/);
    await expectHeaderTitle(page, "One Health Atlas");
    await expect(page.getByTestId("action-evidence-brief")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();

    await page.getByTestId("action-return").click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/explore");
    await expect(page).not.toHaveURL(/plan=evidence-brief/);
    await expectHeaderTitle(page, "Atlas Explorer");
  });

  test("leaves public and documentation chrome unchanged", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/");
    await expect(page.locator(".front-porch-brand")).toContainText(
      "One Health Atlas"
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Connect the data. See the bigger picture.",
      })
    ).toBeVisible();
    await expect(page.locator(".ux-reset-pro-app")).toHaveCount(0);
    await expect(page.locator(".app-header-label")).toHaveCount(0);

    await page.goto("/privacy");
    await expect(page.locator(".public-header .public-brand")).toContainText(
      "One Health Lyme Gap Atlas"
    );
    await expect(page.locator(".app-header-label")).toHaveCount(0);

    await page.goto("/docs");
    await expect(
      page.getByRole("link", { name: "One Health Atlas documentation" }).first()
    ).toBeVisible();
    await expect(page.locator(".ux-reset-pro-app")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Start with One Health Atlas",
      })
    ).toBeVisible();
  });

  test("explore header shows the title without an Ask Atlas link", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/explore");
    const header = page.locator(HEADER);
    await expectHeaderTitle(page, "Atlas Explorer");
    await expect(header.getByRole("link", { name: "Ask Atlas" })).toHaveCount(
      0
    );
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
    await expect(header).toHaveText("Atlas Explorer");

    const navigation = page.getByRole("navigation", {
      name: "Professional workspace",
    });
    const compare = navigation.getByRole("link", {
      exact: true,
      name: "Compare",
    });
    const ask = navigation.getByRole("link", {
      exact: true,
      name: "Ask Atlas",
    });
    await expect(ask).toBeVisible();
    await expect(ask).toHaveAttribute("aria-label", "Ask Atlas");
    await expect(ask).not.toHaveAttribute("aria-current", "page");
    await compare.focus();
    await page.keyboard.press("Tab");
    await expect(ask).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/askatlas");
    await expectHeaderTitle(page, "Ask Atlas");
    await expect(header.getByRole("link", { name: "Ask Atlas" })).toHaveCount(
      0
    );
    await expect(ask).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "Hide navigation" }).click();
    await expect(ask).toHaveAttribute("aria-label", "Ask Atlas");
    await ask.focus();
    await expect(ask).toBeFocused();
  });

  test("phone navigation keeps Ask Atlas in the drawer and out of the header", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width workspace header checks run on the mobile project."
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/explore");
    const header = page.locator(HEADER);
    await expectHeaderTitle(page, "Atlas Explorer");
    await expect(header.getByRole("link", { name: "Ask Atlas" })).toHaveCount(
      0
    );
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("inert", "");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toHaveAttribute("role", "dialog");
    const ask = sidebar.getByRole("link", { exact: true, name: "Ask Atlas" });
    await expect(ask).toBeVisible();
    await expect(ask).toHaveAttribute("aria-label", "Ask Atlas");
    await ask.focus();
    await expect(ask).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/askatlas");
    await expectHeaderTitle(page, "Ask Atlas");
    await expect(ask).toHaveAttribute("aria-current", "page");
  });

  test("keeps the header title on a phone viewport", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width workspace header checks run on the mobile project."
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/compare");
    await expectHeaderTitle(page, "Compare Counties");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Two counties. A clearer picture.",
      })
    ).toBeVisible();
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute(
      "aria-label",
      "Professional workspace"
    );
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toHaveAttribute("role", "dialog");
    await expect(sidebar).toHaveAttribute(
      "aria-label",
      "Professional workspace"
    );
    await expect(page.locator(HEADER_LABEL)).toHaveText("Compare Counties");
    await page.screenshot({
      path: testInfo.outputPath("workspace-header-phone.png"),
    });
  });
});
