import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("preserves reset deep links through sign-in when auth is configured", async ({
  page,
}) => {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  test.skip(
    !hasSupabase,
    "Browser login was not executed: Supabase is not configured on the Playwright web server."
  );

  await page.goto("/app/investigate?county=08001&scope=state&tab=map");
  await expect(page).toHaveURL(
    /\/auth\/sign-in\?next=%2Fapp%2Finvestigate%3Fcounty%3D08001%26scope%3Dstate%26tab%3Dmap/
  );
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
  await page.goto(
    "/app/investigate?county=08001&scope=state&tab=map&compare=08013"
  );

  await expect(page.locator(".app-shell")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Professional workspace" })
  ).toBeVisible();

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  if (testInfo.project.name.includes("mobile")) {
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("inert", "");
    await page.keyboard.press("Tab");
    await expect(sidebar.locator("a").first()).not.toBeFocused();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).not.toHaveAttribute("inert");
    await expect(
      page.getByRole("button", { name: "Close navigation" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveAttribute("inert", "");
  } else {
    await page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Explore" })
      .click();
    const exploreUrl = new URL(page.url());
    expect(exploreUrl.pathname).toBe("/app/explore");
    expect(exploreUrl.searchParams.get("county")).toBe("08001");
    expect(exploreUrl.searchParams.get("scope")).toBe("state");
    expect(exploreUrl.searchParams.get("compare")).toBe("08013");
    expect(exploreUrl.searchParams.get("tab")).toBeNull();
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore" })
    ).toBeVisible();
  }

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
