import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const CONCEPT_ROUTES = [
  "/ux-lab/persona-gateway",
  "/ux-lab/public-first",
  "/ux-lab/three-lanes",
  "/ux-lab/geography-first",
  "/ux-lab/public-site-pro-app",
  "/ux-lab/people-first-hub",
] as const;

test("loads the UX Lab outside production navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /UX Lab/i })).toHaveCount(0);

  await page.goto("/ux-lab");
  await expect(
    page.getByRole("heading", { name: "Atlas UX Lab" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Prototype status" })
  ).toContainText("Atlas UX Prototype — Product research only");
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i
  );
  await expect(
    page.getByRole("heading", { name: "Persona Gateway" })
  ).toBeVisible();
  await expect(page.getByText("Sample County")).toBeVisible();

  await page.getByRole("link", { name: "UX Lab index" }).focus();
  await expect(page.getByRole("link", { name: "UX Lab index" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Production Atlas" })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  await expect(
    page.getByRole("heading", { name: "Comparison guide" })
  ).toBeVisible();
  await expect(page.getByText("What this variant is testing.")).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "Open People-First Atlas Hub" })
  ).toBeVisible();
  await expect(page.getByText("Second-round research concept")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prototype limits" })
  ).toBeVisible();

  for (const route of CONCEPT_ROUTES) {
    await page.goto(route);
    await expect(
      page.getByRole("region", { name: "Prototype status" })
    ).toContainText("Atlas UX Prototype — Product research only");
    await expect(
      page.getByRole("complementary", { name: "What this variant is testing" })
    ).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    if (!testInfo.project.name.includes("mobile")) {
      const conceptResults = await new AxeBuilder({ page }).analyze();
      expect(conceptResults.violations).toEqual([]);
    }
  }

  if (!testInfo.project.name.includes("mobile")) {
    await page.goto("/ux-lab");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});
