import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

test("three lanes stay peers and move between shared topics", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator('a[href="/ux-lab/three-lanes"]')).toHaveCount(0);

  await page.goto("/ux-lab/three-lanes");
  await expect(
    page.getByRole("heading", { name: "One Atlas, three peer lanes" })
  ).toBeVisible();
  await expectNoAxeViolations(page, testInfo);
  await expect(
    page.getByRole("region", { name: "Prototype status" })
  ).toContainText("Atlas UX Prototype — Product research only");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page.getByText(/choose an audience/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { exact: true, name: "Learn" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Clinical Resources" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      exact: true,
      name: "Public Health & Intelligence",
    })
  ).toBeVisible();

  await page.getByRole("link", { exact: true, name: "Learn" }).click();
  await expect(page).toHaveURL("/ux-lab/three-lanes/learn");
  await expect(page.getByText(/surveillance/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tick awareness" })
  ).toBeVisible();

  await page.getByRole("link", { exact: true, name: "Tick awareness" }).click();
  await expect(page).toHaveURL("/ux-lab/three-lanes/learn/tick-awareness");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expectNoAxeViolations(page, testInfo);

  await page
    .getByRole("link", { name: "Clinical Resources: Tick awareness handout" })
    .click();
  await expect(page).toHaveURL(
    "/ux-lab/three-lanes/clinical/tick-awareness-handout"
  );
  await expect(page.getByText("Source", { exact: true })).toBeVisible();
  await expect(page.getByText("Freshness", { exact: true })).toBeVisible();
  await expect(page.getByText(/specific patient/i)).toBeVisible();
  await expectNoAxeViolations(page, testInfo);

  await page
    .getByRole("link", { exact: true, name: "Public Health & Intelligence" })
    .click();
  await expect(page).toHaveURL("/ux-lab/three-lanes/intelligence");
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoAxeViolations(page, testInfo);
  await expect(page.getByText("Action Center").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Live investigation workspace" })
  ).toHaveAttribute("href", "/investigate");

  await page.getByRole("link", { name: "Shared outreach" }).click();
  await expect(page).toHaveURL(
    "/ux-lab/three-lanes/intelligence/shared-outreach"
  );
  await expect(
    page.getByRole("link", { name: "Learn: Tick awareness" })
  ).toBeVisible();

  await page.getByRole("link", { exact: true, name: "One Atlas" }).click();
  await expect(page).toHaveURL("/ux-lab/three-lanes");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  await expectNoAxeViolations(page, testInfo);
});

async function expectNoAxeViolations(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name.includes("mobile")) {
    return;
  }
  const results = await new AxeBuilder({ page })
    .include("#ux-lab-content")
    .analyze();
  expect(results.violations).toEqual([]);
}
