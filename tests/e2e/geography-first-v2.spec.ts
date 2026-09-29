import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("walks the geography-first v2 local entry prototype", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Geography-First v2/i })
  ).toHaveCount(0);

  await page.goto("/ux-lab/geography-first-v2");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ridge Sample County" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Prototype status" })
  ).toContainText("Atlas UX Prototype — Product research only");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "What Atlas can and cannot say here" })
  ).toBeVisible();
  await expect(
    page.getByText("Fewer records are not proof of absence")
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Living with Lyme / ongoing concerns" })
  ).toBeVisible();
  await expect(page.getByText(/^Limitation\./i).first()).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search a sample place" })
    .fill("meadow");
  await page.getByRole("link", { name: /Meadow Sample Town/ }).click();
  await expect(page).toHaveURL(/place=meadow-sample-town/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Meadow Sample Town" })
  ).toBeVisible();

  await page.getByRole("searchbox", { name: "Search a sample place" }).focus();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("unknown geography stays inside the v2 sample set", async ({ page }) => {
  await page.goto("/ux-lab/geography-first-v2?place=06037");
  await expect(
    page.getByRole("heading", { name: "Sample place not found" })
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to Ridge Sample County" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ridge Sample County" })
  ).toBeVisible();
});
