import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockApi } from "./geographic-explorer-mock";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

async function openPrimaryNavigation(page: import("@playwright/test").Page) {
  const mobileTrigger = page.getByRole("button", { name: "Open navigation" });
  if (await mobileTrigger.isVisible()) {
    await mobileTrigger.click();
  }
}

function expectAnalyticalHandoffHref(
  href: string | null,
  pathname: string,
  params: Record<string, string>
) {
  expect(href).toBeTruthy();
  const url = new URL(href!, "http://localhost");
  expect(url.pathname).toBe(pathname);
  for (const [key, value] of Object.entries(params)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

test("preserves county and dataset across Overview, Geographic Explorer, and Investigation Workspace", async ({
  page,
}, testInfo) => {
  const release = "alpha-explorer";
  const county = "06085";
  await page.goto(`/?dataset=${release}&county=${county}`);
  await openPrimaryNavigation(page);

  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const geographicExplorer = navigation.getByRole("link", {
    name: "Geographic Explorer",
  });
  expectAnalyticalHandoffHref(
    await geographicExplorer.getAttribute("href"),
    "/geographic_explorer",
    { county, dataset: release }
  );
  await geographicExplorer.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/geographic_explorer\\?.*county=${county}.*dataset=${release}|/geographic_explorer\\?.*dataset=${release}.*county=${county}`
    )
  );
  await expect(
    page.getByRole("complementary", { name: "Selected county" })
  ).toContainText("FIPS 06085");

  await openPrimaryNavigation(page);
  const investigation = navigation.getByRole("link", {
    name: "Investigation Workspace",
  });
  expectAnalyticalHandoffHref(
    await investigation.getAttribute("href"),
    "/investigate",
    { county, dataset: release }
  );
  await investigation.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/investigate\\?.*county=${county}.*dataset=${release}|/investigate\\?.*dataset=${release}.*county=${county}`
    )
  );

  await openPrimaryNavigation(page);
  const overview = navigation.getByRole("link", { name: "Atlas overview" });
  expectAnalyticalHandoffHref(await overview.getAttribute("href"), "/", {
    county,
    dataset: release,
  });
  await overview.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/\\?.*county=${county}.*dataset=${release}|/\\?.*dataset=${release}.*county=${county}`
    )
  );

  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(
      `/\\?.*county=${county}.*dataset=${release}|/\\?.*dataset=${release}.*county=${county}`
    )
  );

  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 375, height: 812 });
    await openPrimaryNavigation(page);
    expectAnalyticalHandoffHref(
      await geographicExplorer.getAttribute("href"),
      "/geographic_explorer",
      { county, dataset: release }
    );
  }
});

test("does not carry Geographic Explorer view state onto Overview navigation links", async ({
  page,
}) => {
  await page.goto(
    "/geographic_explorer?view=compare&selected=06085%2C06037&county=06085"
  );
  await openPrimaryNavigation(page);
  const overview = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Atlas overview" });
  expectAnalyticalHandoffHref(await overview.getAttribute("href"), "/", {
    county: "06085",
  });
});

test("shows an explicit unavailable-county state instead of switching FIPS silently", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?county=99999");
  await expect(
    page.getByRole("complementary", { name: "Selected county" })
  ).toContainText("County unavailable in this release");
  await expect(page).toHaveURL(/county=99999/);
  const accessibilityScanResults = await new AxeBuilder({ page })
    .include('[aria-label="Selected county"]')
    .analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
