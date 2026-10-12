import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP = { height: 900, width: 1280 };
const MOBILE = { height: 844, width: 390 };
const SHORT = { height: 420, width: 1280 };

function isMobileProject(projectName: string): boolean {
  return projectName.includes("mobile");
}

async function footerBox(page: Page, footer: Locator) {
  return footer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const sidebar = element.closest("#ux-reset-pro-navigation");
    const content = sidebar?.querySelector("[data-slot='sidebar-content']");
    return {
      bottom: rect.bottom,
      contentScrolls: content
        ? content.scrollHeight > content.clientHeight + 1
        : false,
      height: rect.height,
      insideSidebar: Boolean(sidebar?.contains(element)),
      insideNavigation: Boolean(element.closest("nav")),
      top: rect.top,
      viewport: window.innerHeight,
    };
  });
}

test.describe("workspace account footer desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      isMobileProject(testInfo.project.name),
      "Desktop account footer checks."
    );
  });

  test("shows Sign in and no Sign out for a guest, including when collapsed", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/app/review?scope=CO");
    const footer = page.locator("[data-slot='sidebar-footer']");
    await expect(footer).toBeVisible();
    const signIn = footer.getByRole("link", { name: "Sign in" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute(
      "href",
      "/auth/sign-in?next=%2Fapp%2Freview%3Fscope%3DCO"
    );
    await expect(footer.locator(".lucide-user-round")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(
      0
    );
    expect(await footerBox(page, footer)).toMatchObject({
      insideNavigation: false,
      insideSidebar: true,
    });

    await page.getByRole("button", { name: "Hide navigation" }).click();
    await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
      "data-state",
      "collapsed"
    );
    await expect(signIn).toHaveAttribute("aria-label", "Sign in");
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await signIn.hover();
    await expect(
      page
        .locator("[data-slot='tooltip-content']")
        .filter({ hasText: "Sign in" })
    ).toBeVisible();
    await signIn.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fapp%2Freview/);
  });

  test("keeps the account footer in view while navigation content scrolls", async ({
    page,
  }) => {
    await page.setViewportSize(SHORT);
    await page.goto("/app/feed");
    const footer = page.locator("[data-slot='sidebar-footer']");
    const content = page.locator(
      "#ux-reset-pro-navigation [data-slot='sidebar-content']"
    );
    await expect(footer.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect
      .poll(async () =>
        content.evaluate(
          (element) => element.scrollHeight > element.clientHeight + 1
        )
      )
      .toBe(true);
    const before = await footerBox(page, footer);
    expect(before.top).toBeGreaterThanOrEqual(0);
    expect(before.bottom).toBeLessThanOrEqual(before.viewport + 1);
    await content.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const after = await footerBox(page, footer);
    expect(after.bottom).toBeLessThanOrEqual(after.viewport + 1);
    expect(Math.round(after.top)).toBe(Math.round(before.top));
    await expect(footer.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(
      0
    );
  });

  test("leaves the public front porch without a workspace sign-out control", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await expect(page.locator("[data-slot='sidebar-footer']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(
      0
    );
  });
});

test.describe("workspace account footer mobile", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !isMobileProject(testInfo.project.name),
      "Mobile drawer account footer checks."
    );
  });

  test("keeps Sign in reachable in the drawer and still closes on Escape", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/app/settings");
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("inert", "");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toHaveAttribute("role", "dialog");
    const signIn = sidebar.getByRole("link", { name: "Sign in" });
    await expect(signIn).toBeVisible();
    const target = await signIn.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(
      0
    );
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveAttribute("inert", "");
    await expect(
      page.getByRole("button", { name: "Open navigation" })
    ).toBeFocused();
  });
});
