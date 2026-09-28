import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("walks the geography-first county prototype", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Geography-First/i })
  ).toHaveCount(0);

  await page.goto("/ux-lab/geography-first");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sample County" })
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
    page.getByRole("note", { name: "What this place does not mean" })
  ).toContainText("not evidence that risk is absent");
  await expect(
    page.getByRole("heading", { name: "For clinicians" })
  ).toBeVisible();
  await expect(
    page.getByText("Open methodology and missingness")
  ).toBeVisible();
  await expect(
    page.getByText("Blank fields mean the information is missing.")
  ).toBeHidden();

  await page
    .getByRole("searchbox", { name: "Find a sample place" })
    .fill("parish");
  await page.getByRole("link", { name: /Sample Parish/ }).click();
  await expect(page).toHaveURL(/place=sample-parish/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sample Parish" })
  ).toBeVisible();
  await page.getByText("Open methodology and missingness").click();
  await expect(
    page.getByText("Blank fields mean the information is missing.")
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Investigation Workspace" })
  ).toHaveAttribute("href", "/investigate");

  await page.getByRole("searchbox", { name: "Find a sample place" }).focus();
  await expect(
    page.getByRole("searchbox", { name: "Find a sample place" })
  ).toBeFocused();
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

test("unknown geography stays inside the sample set", async ({ page }) => {
  await page.goto("/ux-lab/geography-first?place=06037");
  await expect(
    page.getByRole("heading", { name: "Sample place not found" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to Sample County" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sample County" })
  ).toBeVisible();
});
