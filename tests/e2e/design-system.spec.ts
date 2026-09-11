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
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).not.toContainText("Design system");

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

test("honors reduced motion on the design-system gallery", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  await expect(page.locator(".app-sidebar")).toHaveCSS(
    "transition-duration",
    "1e-05s"
  );
});
