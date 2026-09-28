import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public-first snapshot leads, then opens professional paths", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /UX Lab/i })).toHaveCount(0);

  await page.goto("/ux-lab/public-first");
  await expect(
    page.getByRole("heading", { name: "Sample County local snapshot" })
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
    page.getByRole("link", { name: "Open Clinical Resources" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Public Health & Surveillance" })
  ).toBeVisible();
  await expect(page.getByText(/not personal medical risk/i)).toBeVisible();

  await page.getByRole("combobox", { name: "Explore a sample place" }).click();
  await page
    .getByRole("option", { name: "River Parish, South Example" })
    .click();
  await expect(
    page.getByRole("heading", { name: "River Parish local snapshot" })
  ).toBeVisible();
  await expect(page).toHaveURL(/place=river-parish/);

  await page
    .getByRole("link", { name: "Open Public Health & Surveillance" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Public Health & Surveillance" })
  ).toBeVisible();
  await expect(page.getByText("River Parish, South Example")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Public Health & Surveillance" })
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Clinical Resources" }).click();
  await expect(
    page.getByRole("heading", { name: "Clinical Resources" })
  ).toBeVisible();
  await expect(page.getByText(/not a clinical care pathway/i)).toBeVisible();

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
