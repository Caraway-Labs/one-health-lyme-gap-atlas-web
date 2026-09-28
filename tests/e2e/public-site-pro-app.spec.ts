import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("switches between the public site and the professional application", async ({
  page,
}, testInfo) => {
  await page.goto("/ux-lab/public-site-pro-app");
  await expect(
    page.getByRole("heading", {
      name: "A public site for learning and clinician resources",
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

  const publicNav = page.getByRole("navigation", { name: "Public site" });
  await expect(
    publicNav.getByRole("link", { name: "Education and local context" })
  ).toBeVisible();
  await expect(
    publicNav.getByRole("link", { name: "Clinician resources" })
  ).toBeVisible();
  await expect(
    publicNav.getByRole("link", { name: "Open Atlas for Public Health" })
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Open education topics" }).click();
  await expect(
    page.getByRole("heading", { name: "Education and local context" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sample place" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Public site" })
    .getByRole("link", { name: "Clinician resources" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clinician resources" })
  ).toBeVisible();
  await expect(page.getByText("Reporting resource links")).toBeVisible();

  await page
    .getByRole("link", { name: "Open Atlas for Public Health" })
    .click();
  await expect(page.getByText("You left the public site")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Professional application" })
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Return to public site" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A public site for learning and clinician resources",
    })
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);

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

test("professional workspace navigation stays inside the application shell", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile")
      ? { height: 900, width: 390 }
      : { height: 900, width: 1280 }
  );
  await page.goto("/ux-lab/public-site-pro-app/app");

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }

  await page.getByRole("link", { name: "Evidence review" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence review" })
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page
    .getByRole("link", { name: "Education on the public site" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Education and local context" })
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});
