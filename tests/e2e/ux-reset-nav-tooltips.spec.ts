import { accessSync, constants, copyFileSync } from "node:fs";
import { join } from "node:path";

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  DATA_PROVENANCE_NAV_DESCRIPTION,
  RESET_ACCESS_NAV,
  RESET_FEEDBACK_ACTION,
  RESET_WORKSPACE_NAV,
} from "@/features/ux-reset/paths";

import { fulfillCompletedStartingView } from "./completed-starting-view";

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
});

const DESKTOP = { height: 900, width: 1440 };

const DESTINATIONS = [...RESET_WORKSPACE_NAV, ...RESET_ACCESS_NAV].map(
  (route) => ({
    accessibleName:
      route.id === "docs" ? "Docs, opens in a new tab" : route.label,
    description: route.tooltipDetail ?? "",
    title: route.tooltipTitle ?? route.label,
  })
);

async function focusByTab(page: Page, locator: Locator) {
  for (let step = 0; step < 30; step += 1) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("keyboard focus did not reach the expected control");
}

async function navigation(page: Page) {
  return page.getByRole("navigation", { name: "Professional workspace" });
}

async function expectNavTooltip(
  page: Page,
  title: string,
  description: string
) {
  const tooltip = page.locator("[data-slot='tooltip-content']").filter({
    hasText: description,
  });
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator("span").nth(0)).toHaveText(title);
  await expect(tooltip.locator("span").nth(1)).toHaveText(description);
  const box = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  if (!(box && viewport)) {
    throw new Error("tooltip box is missing");
  }
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.height).toBeGreaterThan(28);
}

async function dismissTooltip(page: Page) {
  await page.mouse.move(1100, 240);
  await expect(page.locator("[data-slot='tooltip-content']")).toHaveCount(0);
}

const OPTIONAL_ARTIFACT_DIRECTORY = "/opt/cursor/artifacts";

/** Required images go to the Playwright output dir. Artifact copies are optional. */
async function saveNavTooltipScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string
) {
  const outputPath = testInfo.outputPath(filename);
  await page.screenshot({ path: outputPath });
  try {
    accessSync(OPTIONAL_ARTIFACT_DIRECTORY, constants.W_OK);
    copyFileSync(outputPath, join(OPTIONAL_ARTIFACT_DIRECTORY, filename));
  } catch {
    // CI checkouts have no writable /opt/cursor/artifacts directory.
  }
}

test("shows approved two-line tooltips on hover and keyboard focus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Phone-width navigation checks stay on the existing mobile project."
  );
  await page.setViewportSize(DESKTOP);
  await page.goto("/explore");
  await expect(page).toHaveURL(/\/explore/);
  const nav = await navigation(page);

  for (const destination of DESTINATIONS) {
    const link = nav.getByRole("link", {
      exact: true,
      name: destination.accessibleName,
    });
    await expect(link).toHaveAttribute(
      "aria-description",
      destination.description
    );
    await link.hover();
    await expectNavTooltip(page, destination.title, destination.description);
    await expect(page).toHaveURL(/\/explore$/);
    await dismissTooltip(page);
  }

  const feedback = nav.getByRole("button", { name: "Give feedback" });
  await expect(feedback).toHaveAttribute(
    "aria-description",
    RESET_FEEDBACK_ACTION.tooltipDetail
  );
  await feedback.hover();
  await expectNavTooltip(
    page,
    RESET_FEEDBACK_ACTION.tooltipTitle,
    RESET_FEEDBACK_ACTION.tooltipDetail
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/explore$/);
  await dismissTooltip(page);

  const provenance = nav.getByRole("link", {
    exact: true,
    name: "Data Provenance",
  });
  await provenance.hover();
  await expectNavTooltip(
    page,
    "Data Provenance",
    DATA_PROVENANCE_NAV_DESCRIPTION
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-data-provenance-expanded.png"
  );
  await dismissTooltip(page);

  const explorer = nav.getByRole("link", {
    exact: true,
    name: "Atlas Explorer",
  });
  await explorer.hover();
  await expectNavTooltip(
    page,
    "Atlas Explorer",
    "Explore county-level Lyme surveillance, environmental context, and public health evidence."
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-atlas-explorer-expanded.png"
  );
  await dismissTooltip(page);

  const feed = nav.getByRole("link", { exact: true, name: "Feed" });
  await feed.hover();
  await expectNavTooltip(
    page,
    "Intelligence Feed",
    "Track new findings and updates that may inform Lyme surveillance and research."
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-intelligence-feed-expanded.png"
  );
  await page.mouse.move(1100, 240);
  await focusByTab(page, feed);
  await expect(feed).toBeFocused();
  await expectNavTooltip(
    page,
    "Intelligence Feed",
    "Track new findings and updates that may inform Lyme surveillance and research."
  );
  await expect(page).toHaveURL(/\/explore$/);
  await page.keyboard.press("Shift+Tab");
  await expect(feed).not.toBeFocused();
  await expect(
    page.locator("[data-slot='tooltip-content']").filter({
      hasText:
        "Track new findings and updates that may inform Lyme surveillance and research.",
    })
  ).toHaveCount(0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await dismissTooltip(page);

  await page.getByRole("button", { name: "Hide navigation" }).click();
  await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
    "data-state",
    "collapsed"
  );

  await provenance.hover();
  await expectNavTooltip(
    page,
    "Data Provenance",
    DATA_PROVENANCE_NAV_DESCRIPTION
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-data-provenance-collapsed.png"
  );
  await dismissTooltip(page);

  const compare = nav.getByRole("link", { exact: true, name: "Compare" });
  await compare.hover();
  await expectNavTooltip(
    page,
    "Compare",
    "Compare counties side by side to support evidence-informed public health decisions."
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-compare-collapsed.png"
  );
  await dismissTooltip(page);

  await feedback.hover();
  await expectNavTooltip(
    page,
    "Give Feedback",
    RESET_FEEDBACK_ACTION.tooltipDetail
  );
  await saveNavTooltipScreenshot(
    page,
    testInfo,
    "nav-tooltip-give-feedback-collapsed.png"
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await feedback.click();
  await expect(
    page.getByRole("dialog", { name: "Help shape One Health Atlas" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/explore$/);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
  ).toBe(true);
});

test("wraps nav tooltips inside a narrow desktop viewport at 200% zoom", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Phone-width navigation checks stay on the existing mobile project."
  );
  // 960 CSS pixels is a 1920-wide display at 200% browser zoom, still above
  // the 800px mobile navigation breakpoint.
  await page.setViewportSize({ height: 800, width: 960 });
  await page.goto("/explore");
  const feed = (await navigation(page)).getByRole("link", {
    exact: true,
    name: "Feed",
  });
  await feed.hover();
  await expectNavTooltip(
    page,
    "Intelligence Feed",
    "Track new findings and updates that may inform Lyme surveillance and research."
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await feed.hover();
  const tooltip = page.locator("[data-slot='tooltip-content']").filter({
    hasText:
      "Track new findings and updates that may inform Lyme surveillance and research.",
  });
  const fit = await tooltip.evaluate((element) => {
    const sentence = element.querySelectorAll("span")[1];
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      sentenceHeight:
        sentence instanceof HTMLElement ? sentence.offsetHeight : 0,
    };
  });
  expect(fit.clientWidth).toBeLessThanOrEqual(256 + 8);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
  expect(fit.sentenceHeight).toBeGreaterThan(24);
  await expect(page).toHaveURL(/\/explore$/);
});
