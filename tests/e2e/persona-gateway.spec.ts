import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("persona gateway routes audiences and switches lanes in the prototype", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Persona Gateway/i })
  ).toHaveCount(0);

  await page.goto("/ux-lab/persona-gateway");
  await expect(
    page.getByRole("heading", {
      name: "Which audience experience do you need?",
    })
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
    page.getByRole("link", { name: "You & Your Family" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Healthcare Professionals" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Public Health Professionals" })
  ).toBeVisible();

  await page.getByRole("link", { name: "You & Your Family" }).click();
  await expect(page).toHaveURL("/ux-lab/persona-gateway/public");
  await expect(page.getByText(/surveillance/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tick awareness" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Tick awareness" }).click();
  await expect(page).toHaveURL("/ux-lab/persona-gateway/public/tick-awareness");
  await expect(
    page.getByRole("heading", {
      name: "Does this match the audience you chose?",
    })
  ).toBeVisible();

  await page.getByRole("link", { name: "Healthcare Professionals" }).click();
  await expect(page).toHaveURL("/ux-lab/persona-gateway/clinician");
  await expect(page.getByRole("note")).toContainText(/specific patient/i);

  await page.getByRole("link", { name: "Public Health Professionals" }).click();
  await expect(page).toHaveURL("/ux-lab/persona-gateway/public-health");
  await expect(page.getByText("Action Center").first()).toBeVisible();
  await expect(page.getByText(/advanced professional Atlas/i)).toBeVisible();

  await page.getByRole("link", { name: "All audiences" }).click();
  await expect(page).toHaveURL("/ux-lab/persona-gateway");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page })
      .include("#ux-lab-content")
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
