import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("preserves reset deep links through sign-in when auth is configured", async ({
  page,
}) => {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  test.skip(
    !hasSupabase,
    "Deep-link preservation requires Supabase auth configuration in the test server."
  );

  await page.goto("/app/investigate?county=08001");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fapp%2Finvestigate/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Atlas" })
  ).toBeVisible();
});

test("professional workspace shell supports navigation, focus, and responsive layout", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile")
      ? { height: 900, width: 390 }
      : { height: 900, width: 1280 }
  );
  await page.goto("/app");

  await expect(page.locator(".app-shell")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Professional workspace" })
  ).toBeVisible();

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }

  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Explore" })
    .click();
  await expect(page).toHaveURL(/\/app\/explore$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Explore" })
  ).toBeVisible();

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible();

  await page.locator(".app-header .ux-reset-legacy-link").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".app-shell")).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});
