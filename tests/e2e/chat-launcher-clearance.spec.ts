import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { mockApi } from "./geographic-explorer-mock";

const VIEWPORTS = [
  { width: 375, height: 812, name: "375" },
  { width: 768, height: 1024, name: "768" },
  { width: 1280, height: 900, name: "1280" },
  { width: 1600, height: 1000, name: "1600" },
] as const;

async function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function expectContentClearanceCoversDock(page: Page) {
  const metrics = await page.evaluate(() => {
    const content = document.querySelector(".app-content");
    const launcher = document.querySelector(".chat-launcher");
    if (!content || !launcher) {
      return null;
    }
    const paddingBottom = Number.parseFloat(
      getComputedStyle(content).paddingBottom
    );
    const launcherRect = launcher.getBoundingClientRect();
    const footprint = window.innerHeight - launcherRect.top;
    const minimumFootprint =
      4.5 *
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { paddingBottom, footprint, minimumFootprint };
  });
  expect(metrics, "launcher dock metrics missing").not.toBeNull();
  if (!metrics) return;
  expect(
    metrics.footprint,
    "dock footprint should meet the documented minimum"
  ).toBeGreaterThanOrEqual(metrics.minimumFootprint - 1);
  expect(
    metrics.paddingBottom,
    "app-content padding-bottom must cover the dock footprint"
  ).toBeGreaterThanOrEqual(metrics.footprint - 1);
}

async function expectNoLauncherOverlap(
  page: Page,
  target: Locator,
  label: string
) {
  const launcher = page.getByRole("button", { name: "Atlas Assistant" });
  await expect(launcher).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const [targetBox, launcherBox] = await Promise.all([
    target.boundingBox(),
    launcher.boundingBox(),
  ]);
  expect(targetBox, `${label} target missing`).not.toBeNull();
  expect(launcherBox, "launcher missing").not.toBeNull();
  if (!targetBox || !launcherBox) return;
  expect(
    await boxesOverlap(targetBox, launcherBox),
    `${label} overlaps Atlas Assistant launcher`
  ).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

for (const viewport of VIEWPORTS) {
  test(`geographic explorer keeps launcher clear at ${viewport.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/geographic_explorer?state=CA&county=06085&view=maps");
    await expect(
      page.getByRole("complementary", { name: "Selected county" })
    ).toContainText("Santa Clara, CA");

    await expectNoLauncherOverlap(
      page,
      page.getByLabel("County name or FIPS code"),
      "county search"
    );
    await expectNoLauncherOverlap(
      page,
      page.getByRole("combobox", { name: "State" }),
      "state filter"
    );
    await expectNoLauncherOverlap(
      page,
      page.getByRole("combobox", { name: "Filter counties by available data" }),
      "evidence filter"
    );
    await expectNoLauncherOverlap(
      page,
      page.getByRole("button", { name: "Add to comparison" }),
      "primary action"
    );
    const evidenceList = page
      .getByRole("complementary", { name: "Selected county" })
      .locator("dl");
    await evidenceList.evaluate((element) => {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    await expectNoLauncherOverlap(
      page,
      evidenceList,
      "selected county evidence"
    );

    const mapControl = page.locator(".maplibregl-ctrl-group").first();
    if (await mapControl.count()) {
      await expectNoLauncherOverlap(page, mapControl, "map control");
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expectContentClearanceCoversDock(page);
    const nextCounties = page.getByRole("button", { name: "Next counties" });
    if (await nextCounties.isEnabled()) {
      await expectNoLauncherOverlap(page, nextCounties, "pagination action");
    } else {
      await expectNoLauncherOverlap(
        page,
        page.getByRole("button", { name: "View comparison" }),
        "bottom primary action"
      );
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .include(".chat-launcher-dock")
      .include(".filter-bar")
      .include(".geo-selection")
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

test("county search stays usable at 375px with 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/geographic_explorer?state=CA&county=06085");
  const search = page.getByLabel("County name or FIPS code");
  await search.scrollIntoViewIfNeeded();
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill("Santa");
  await expect(page).toHaveURL(/q=Santa/);
  await expectNoLauncherOverlap(
    page,
    search,
    "county search at 200% zoom prep"
  );

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await search.scrollIntoViewIfNeeded();
  await search.focus();
  await expect(search).toBeFocused();
  await expectNoLauncherOverlap(page, search, "county search at 200% zoom");
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expectContentClearanceCoversDock(page);
});

test("homepage footer links stay clickable on mobile with the assistant dock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/overview");
  const privacy = page.getByRole("link", { name: "Privacy" });
  await privacy.scrollIntoViewIfNeeded();
  await expect(privacy).toBeVisible();
  const launcher = page.getByRole("button", { name: "Atlas Assistant" });
  const [privacyBox, launcherBox] = await Promise.all([
    privacy.boundingBox(),
    launcher.boundingBox(),
  ]);
  expect(privacyBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  if (privacyBox && launcherBox) {
    expect(await boxesOverlap(privacyBox, launcherBox)).toBe(false);
  }
  await privacy.click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("opening and closing assistant preserves geographic explorer state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/geographic_explorer?state=CA&county=06085&view=maps");
  await expect(page).toHaveURL(/state=CA/);
  await expect(page).toHaveURL(/county=06085/);
  await expect(
    page.getByRole("complementary", { name: "Selected county" })
  ).toContainText("Santa Clara, CA");

  const launcher = page.getByRole("button", { name: "Atlas Assistant" });
  await launcher.click();
  await expect(
    page.getByRole("dialog", { name: "Atlas Assistant" })
  ).toBeVisible();
  await expect(page).toHaveURL(/state=CA/);
  await expect(page).toHaveURL(/county=06085/);

  await page.getByRole("button", { name: "Close Atlas Assistant" }).click();
  await expect(
    page.getByRole("dialog", { name: "Atlas Assistant" })
  ).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await expect(
    page.getByRole("complementary", { name: "Selected county" })
  ).toContainText("Santa Clara, CA");
});
