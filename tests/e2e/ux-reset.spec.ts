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
    "/app/investigate?county=08001&scope=CO&tab=map&compare=08013"
  );

  await expect(page.locator(".app-shell")).toHaveCount(1);

  if (testInfo.project.name.includes("mobile")) {
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("inert", "");
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(sidebar.locator("a").first()).not.toBeFocused();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).not.toHaveAttribute("inert");
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveAttribute("inert", "");
  } else {
    await expect(
      page.getByRole("navigation", { name: "Professional workspace" })
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  if (!testInfo.project.name.includes("mobile")) {
    await page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Explore" })
      .click();
    const exploreUrl = new URL(page.url());
    expect(exploreUrl.pathname).toBe("/app/explore");
    expect(exploreUrl.searchParams.get("county")).toBe("08001");
    expect(exploreUrl.searchParams.get("scope")).toBe("CO");
    expect(exploreUrl.searchParams.get("compare")).toBeNull();
    expect(exploreUrl.searchParams.get("tab")).toBeNull();
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
  expect(new URL(page.url()).search).toBe("");

  await page.locator(".app-header .ux-reset-legacy-link").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".app-shell")).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("bounded context survives rendered navigation, reload, and browser history", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop-only: mobile shell requires opening the drawer before each nav click."
  );

  const expectInvestigateContext = (target: URL) => {
    expect(target.pathname).toBe("/app/investigate");
    expect(target.searchParams.get("scope")).toBe("CO");
    expect(target.searchParams.get("county")).toBe("08001");
    expect(target.searchParams.get("dataset")).toBe("alpha-2026-08-06");
    expect(target.searchParams.get("period")).toBe("2023-01-01");
    expect(target.searchParams.get("compare")).toBeNull();
  };

  const expectCompareSelection = (target: URL) => {
    expect(target.pathname).toBe("/app/compare");
    expect(target.searchParams.get("compare")).toBe("08001,08003");
  };

  await page.goto(
    "/app/review?scope=CO&county=08001&compare=08001,08003&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
  );
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Compare" })
    .click();

  let url = new URL(page.url());
  expectCompareSelection(url);
  expect(url.searchParams.get("sort")).toBeNull();

  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Investigate" })
    .click();
  expectInvestigateContext(new URL(page.url()));

  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Action" })
    .click();
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/action");
  expect(url.searchParams.get("county")).toBe("08001");

  await page.reload();
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/action");
  expect(url.searchParams.get("county")).toBe("08001");

  await page.goBack({ waitUntil: "commit" });
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/app/investigate");
  expectInvestigateContext(new URL(page.url()));

  await page.goBack({ waitUntil: "commit" });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/app/compare");
  expectCompareSelection(new URL(page.url()));

  await Promise.all([
    page.waitForURL((url) => url.pathname === "/app/investigate", {
      waitUntil: "commit",
    }),
    page.goForward({ waitUntil: "commit" }),
  ]);
  expectInvestigateContext(new URL(page.url()));
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Action" })
    .click();
  expect(new URL(page.url()).pathname).toBe("/app/action");

  await page.goto(
    "/app/review?scope=state&county=bad&period=2024&dataset=alpha"
  );
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Investigate" })
    .click();
  url = new URL(page.url());
  expect(url.pathname).toBe("/app/investigate");
  expect(url.searchParams.get("county")).toBeNull();
  expect(url.searchParams.get("scope")).toBeNull();
  expect(url.searchParams.get("period")).toBeNull();
  expect(url.searchParams.get("dataset")).toBe("alpha");
});
