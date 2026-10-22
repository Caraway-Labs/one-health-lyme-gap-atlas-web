import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { releaseViewportRuns } from "./release-phone-viewport";

const META_DESCRIPTION =
  "The public datasets behind One Health Atlas, who publishes them, how Atlas validates and releases them, and how to read the evidence responsibly.";

const LEGACY_ANCHORS = [
  "source-human",
  "source-tick",
  "source-pathogen",
  "source-context_svi",
  "source-context_rucc",
  "source-context_nlcd_2025",
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function flowItemTops(page: Page) {
  return page
    .locator("ol.public-trust-cards--flow > li")
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().top)
    );
}

async function keyboardFocus(page: Page, control: Locator) {
  for (let step = 0; step < 40; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Data Provenance filter was not reached by keyboard");
}

test("public data provenance page lists every source and stays indexable", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/data-provenance");
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(page).toHaveTitle("Data Provenance | One Health Lyme Gap Atlas");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    META_DESCRIPTION
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Where Atlas evidence comes from",
    })
  ).toHaveCount(1);
  await expect(page.locator("main.public-trust-page")).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(
    page
      .locator("footer.ux-reset-trust-footer")
      .getByRole("link", { name: "Data Provenance" })
  ).toHaveAttribute("href", "/data-provenance");
  await expect(page.locator(".ux-reset-pro-app")).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "Lyme disease surveillance" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "nClimGrid-Daily county weather" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "PubMed" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Morbidity and Mortality Weekly Report (MMWR)",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "WHO Disease Outbreak News" })
  ).toBeVisible();
  await expect(page.locator("article[id^='source-']")).toHaveCount(20);
  await expect(
    page.getByText(
      "Tick and pathogen surveillance data are provided by the CDC ArboNET Tick Module, Division of Vector-Borne Diseases."
    )
  ).toBeVisible();
  await expect(page.getByText("Not provided", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Planned", { exact: true })).toHaveCount(0);

  const tops = await flowItemTops(page);
  expect(tops).toHaveLength(5);
  expect(Math.abs((tops[0] ?? 0) - (tops[4] ?? 0))).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);

  const bulletins = page.getByRole("button", {
    name: "Public-health bulletins (10)",
  });
  await keyboardFocus(page, bulletins);
  await expect(bulletins).toBeFocused();
  const focusCue = await bulletins.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusCue.outlineWidth).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(bulletins).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Showing 10 of 20 sources")).toBeVisible();
  await expect(page.locator("article[id^='source-']")).toHaveCount(10);
  await expect(
    page.getByRole("heading", { name: "Lyme disease surveillance" })
  ).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  const literature = page.getByRole("button", {
    name: "Research literature (2)",
  });
  if (
    await literature.evaluate((element) => element === document.activeElement)
  ) {
    await page.keyboard.press("Space");
    await expect(page.getByText("Showing 2 of 20 sources")).toBeVisible();
  }

  const all = page.getByRole("button", { name: "All (20)" });
  await all.click();
  await expect(page.getByText("Showing 20 of 20 sources")).toBeVisible();
  await expect(page.locator("article[id^='source-']")).toHaveCount(20);

  await page.getByText("Compare all sources in a table").click();
  const table = page.getByRole("table", { name: "Every source Atlas uses" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveCount(6);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("legacy source anchors scroll to the matching card", async ({ page }) => {
  for (const anchor of LEGACY_ANCHORS) {
    await page.goto(`/data-provenance#${anchor}`);
    const card = page.locator(`#${anchor}`);
    await expect(card).toBeVisible();
    await expect(card).toBeInViewport();
  }
});

test("source cards stack below the desktop flow breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 768 });
  await page.goto("/data-provenance");
  const tops = await flowItemTops(page);
  expect(tops).toHaveLength(5);
  expect(tops[1] ?? 0).toBeGreaterThan(tops[0] ?? 0);
  await expectNoHorizontalOverflow(page);
});

test("keeps a phone layout for the provenance page", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 390),
    "Phone-width Data Provenance checks run on the mobile project."
  );
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/data-provenance");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Where Atlas evidence comes from",
    })
  ).toBeVisible();
  const tops = await flowItemTops(page);
  expect(tops[1] ?? 0).toBeGreaterThan(tops[0] ?? 0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-phone.png"),
  });
});
