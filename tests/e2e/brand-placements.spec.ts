import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const baseline = process.env.ATLAS_BRAND_BASELINE === "1";
const asset = "/android-chrome-192x192.png";

test("About inherits shared branding without changing its content", async ({
  page,
}, testInfo) => {
  await page.goto("/about/caraway-labs");
  await expect(
    page.getByRole("heading", { level: 1, name: "About Caraway Labs" })
  ).toBeVisible();
  await checkMarks(page, ".public-brand, .footer-brand");
  await expect(
    page.getByRole("link", { name: "Return to One Health Atlas" })
  ).toHaveAttribute("href", "/");
  await page.screenshot({
    path: `docs/evidence/web-530/${baseline ? "before" : "after"}-about-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function checkMarks(page: Page, selector: string) {
  if (baseline) return;
  const slots = page.locator(selector).filter({ visible: true });
  expect(await slots.count()).toBeGreaterThan(0);
  for (const slot of await slots.all()) {
    const mark = slot.locator("img.atlas-brand-mark:visible");
    await expect(mark).toHaveCount(1);
    await mark.scrollIntoViewIfNeeded();
    await expect(mark).toHaveAttribute("src", asset);
    await expect(mark).toHaveAttribute("alt", "");
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect
      .poll(() =>
        mark.evaluate((image) => {
          const img = image as HTMLImageElement;
          return img.complete && img.naturalWidth === 192;
        })
      )
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("shared brand placements preserve public and access surfaces", async ({
  page,
}, testInfo) => {
  const phase = baseline ? "before" : "after";
  for (const [name, path, selector] of [
    ["public", "/privacy", ".public-brand, .footer-brand"],
    ["docs", "/docs", ".atlas-docs-brand, .footer-brand"],
    ["sign-in", "/auth/sign-in", ".atlas-sign-in-brand"],
  ]) {
    await page.goto(path);
    await checkMarks(page, selector);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({
      path: `docs/evidence/web-530/${phase}-${name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    if (!baseline) {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        )
      ).toBe(true);
    }
  }
});

test("professional brand placements preserve independent navigation controls", async ({
  page,
}, testInfo) => {
  const phase = baseline ? "before" : "after";
  await page.goto("/app/review");
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  const brand = page.locator(".ux-reset-pro-brand");
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAccessibleName("One Health Atlas");
  await checkMarks(page, ".ux-reset-pro-brand");
  await page.screenshot({
    path: `docs/evidence/web-530/${phase}-${mobile ? "mobile-navigation" : "expanded"}.png`,
    fullPage: true,
  });
  if (mobile) {
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true })
    ).toBeFocused();
  } else {
    await page
      .getByRole("button", { name: "Hide navigation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Show navigation", exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: `docs/evidence/web-530/${phase}-collapsed.png`,
      fullPage: true,
    });
  }
  await checkMarks(page, ".ux-reset-trust-brand");
  await page.locator(".ux-reset-trust-footer").screenshot({
    path: `docs/evidence/web-530/${phase}-trust-footer-${testInfo.project.name}.png`,
  });
});
