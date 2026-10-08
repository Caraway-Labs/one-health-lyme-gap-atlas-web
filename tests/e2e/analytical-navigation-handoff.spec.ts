import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { expectAnalyticalHandoffHref } from "./analytical-handoff-assertions";
import { mockApi } from "./geographic-explorer-mock";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

async function openPrimaryNavigation(page: Page) {
  const mobileTrigger = page.getByRole("button", { name: "Open navigation" });
  if (await mobileTrigger.isVisible()) {
    await mobileTrigger.click();
  }
}

test("preserves county and dataset across Overview, Geographic Explorer, and Investigation Workspace", async ({
  page,
}, testInfo) => {
  const release = "alpha-explorer";
  const county = "06085";
  await page.goto(`/overview?dataset=${release}&county=${county}`);
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
  expectAnalyticalHandoffHref(
    await overview.getAttribute("href"),
    "/overview",
    {
      county,
      dataset: release,
    }
  );
  await overview.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/overview\\?.*county=${county}.*dataset=${release}|/overview\\?.*dataset=${release}.*county=${county}`
    )
  );

  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(
      `/overview\\?.*county=${county}.*dataset=${release}|/overview\\?.*dataset=${release}.*county=${county}`
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
  expectAnalyticalHandoffHref(
    await overview.getAttribute("href"),
    "/overview",
    {
      county: "06085",
    }
  );
});

async function expectAdamsReviewSelection(page: Page) {
  await expect(page.locator("button.active[data-fips='08001']")).toContainText(
    "Adams, CO"
  );
  await expect(page.getByRole("combobox", { name: "State" })).toContainText(
    "CO"
  );
  await expect(
    page.getByLabel("Weight given to tick and pathogen evidence")
  ).toHaveValue("70");
  await expect(page.locator("button.active[data-fips='06037']")).toHaveCount(0);
}

test("keeps Overview county and score settings when returning to the Atlas section", async ({
  page,
}) => {
  await page.goto("/overview?county=08001&state=CO&eco=70");
  await expectAdamsReviewSelection(page);
  const backToAtlas = page.getByRole("link", { name: "Back to Atlas ↑" });
  await expect(backToAtlas).toHaveAttribute("href", "#atlas");
  await backToAtlas.click();
  const url = new URL(page.url());
  expect({
    county: url.searchParams.get("county"),
    eco: url.searchParams.get("eco"),
    hash: url.hash,
    pathname: url.pathname,
    state: url.searchParams.get("state"),
  }).toEqual({
    county: "08001",
    eco: "70",
    hash: "#atlas",
    pathname: "/overview",
    state: "CO",
  });
  await expectAdamsReviewSelection(page);
});

test("returns from Geographic Explorer to Overview with the selected county", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?county=08001&state=CO&eco=70");
  const backToAtlas = page.getByRole("link", { name: "Back to Atlas ↑" });
  await expect(backToAtlas).toHaveAttribute(
    "href",
    "/overview?county=08001&eco=70&state=CO#atlas"
  );
  await backToAtlas.click();
  await expect(page).toHaveURL(/\/overview\?/);
  const url = new URL(page.url());
  expect({
    county: url.searchParams.get("county"),
    eco: url.searchParams.get("eco"),
    pathname: url.pathname,
  }).toEqual({
    county: "08001",
    eco: "70",
    pathname: "/overview",
  });
  await expectAdamsReviewSelection(page);
});

test("opens a legacy analytical root URL on Overview with its county and filters", async ({
  page,
}) => {
  await page.goto("/?county=08001&state=CO&dataset=alpha-explorer&eco=70");
  await expect(page).toHaveURL(/\/overview\?/);
  const url = new URL(page.url());
  expect({
    county: url.searchParams.get("county"),
    dataset: url.searchParams.get("dataset"),
    eco: url.searchParams.get("eco"),
    pathname: url.pathname,
    state: url.searchParams.get("state"),
  }).toEqual({
    county: "08001",
    dataset: "alpha-explorer",
    eco: "70",
    pathname: "/overview",
    state: "CO",
  });
  await expectAdamsReviewSelection(page);
  await expect(
    page.getByRole("heading", {
      name: "The data is telling more than one story.",
    })
  ).toHaveCount(0);
});

test("sends a legacy root section fragment to the same Overview section", async ({
  page,
}) => {
  await page.goto("/#atlas");
  await expect(page).toHaveURL(/\/overview#atlas$/);
  await expect(page.locator("#atlas")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "The data is telling more than one story.",
    })
  ).toHaveCount(0);

  await page.goto("/#methods");
  await expect(page).toHaveURL(/\/overview#methods$/);
  await expect(page.locator("#methods")).toBeVisible();

  await page.goto("/#front-porch-story");
  await expect(page).toHaveURL(/\/#front-porch-story$/);
  await expect(
    page.getByRole("heading", {
      name: "The data is telling more than one story.",
    })
  ).toBeVisible();
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
