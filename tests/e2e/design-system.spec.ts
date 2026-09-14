import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("keeps the design-system gallery unlinked and keyboard-reachable", async ({
  page,
}, testInfo) => {
  await page.goto("/design-system");
  await expect(
    page.getByRole("heading", { name: "Design system" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Atlas domain patterns" })
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Primary" }).focus();
  await expect(page.getByRole("button", { name: "Primary" })).toBeFocused();
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

test("honors reduced motion on the analytical shell", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/geographic_explorer");
  await expect(page.locator(".atlas-sidebar")).toHaveCSS(
    "transition-duration",
    "1e-05s"
  );
});
