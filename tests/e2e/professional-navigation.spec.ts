import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const NAVY = "rgb(8, 42, 77)";
const TEAL = "rgb(15, 119, 130)";
const TEAL_DARK = "rgb(7, 87, 96)";
const WHITE = "rgb(255, 255, 255)";
const MUTED = "rgb(243, 247, 245)";
const INK = "rgb(21, 44, 59)";
const DESKTOP = { height: 900, width: 1440 };
const MOBILE = { height: 844, width: 390 };

type Box = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

function isMobileProject(projectName: string): boolean {
  return projectName.includes("mobile");
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

async function box(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });
}

async function navigation(page: Page) {
  return page.getByRole("navigation", { name: "Professional workspace" });
}

async function rowStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      borderLeftColor: style.borderLeftColor,
      borderRightColor: style.borderRightColor,
      borderTopColor: style.borderTopColor,
      borderTopWidth: style.borderTopWidth,
      boxShadow: style.boxShadow,
      color: style.color,
      height: element.getBoundingClientRect().height,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

async function focusByTab(page: Page, locator: Locator) {
  for (let step = 0; step < 30; step += 1) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("keyboard focus did not reach the expected control");
}

test.describe("professional navigation desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      isMobileProject(testInfo.project.name),
      "Desktop header, density, and collapse checks."
    );
  });

  for (const path of ["/explore", "/compare"] as const) {
    test(`${path} expanded header, active row, and compact density`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(path);
      const nav = await navigation(page);
      await expect(nav).toBeVisible();
      const sidebar = page.locator("#ux-reset-pro-navigation");
      await expect(sidebar).toHaveAttribute("data-state", "expanded");

      const brand = sidebar.getByRole("link", {
        exact: true,
        name: "One Health Atlas",
      });
      const hide = page.getByRole("button", { name: "Hide navigation" });
      await expect(brand).toBeVisible();
      await expect(brand).toContainText("One Health Atlas");
      await expect(page.getByText("Atlas professional workspace")).toHaveCount(
        0
      );
      await expect(hide).toBeVisible();
      await expect(
        nav.getByRole("heading", { name: "WORKSPACE" })
      ).toBeVisible();
      await expect(nav.getByRole("heading", { name: "MORE" })).toBeVisible();
      await expect(nav.getByRole("heading", { name: "ACCESS" })).toHaveCount(0);

      const brandBox = await box(brand);
      const hideBox = await box(hide);
      expect(overlaps(brandBox, hideBox)).toBe(false);
      expect(brandBox.right).toBeLessThanOrEqual(hideBox.left);
      expect(
        Math.abs(
          brandBox.top +
            brandBox.height / 2 -
            (hideBox.top + hideBox.height / 2)
        )
      ).toBeLessThan(8);
      expect(
        await brand.locator("b").evaluate((element) => element.scrollWidth)
      ).toBeLessThanOrEqual(
        await brand.locator("b").evaluate((element) => element.clientWidth + 1)
      );

      const activeName = path === "/explore" ? "Atlas Explorer" : "Compare";
      const otherName = path === "/explore" ? "Compare" : "Atlas Explorer";
      await expect(nav.getByRole("link")).toHaveCount(6);
      expect(
        await nav
          .locator("a")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("aria-label"))
          )
      ).toEqual([
        "Atlas Explorer",
        "Compare",
        "Ask Atlas",
        "Feed",
        "Settings",
        "Docs, opens in a new tab",
      ]);
      const active = nav.getByRole("link", { exact: true, name: activeName });
      const other = nav.getByRole("link", { exact: true, name: otherName });
      await expect(active).toHaveAttribute("aria-current", "page");
      const activeStyle = await rowStyle(active);
      expect(activeStyle.backgroundColor).toBe(WHITE);
      expect(activeStyle.borderTopColor).toBe(NAVY);
      expect(activeStyle.borderRightColor).toBe(NAVY);
      expect(activeStyle.borderBottomColor).toBe(NAVY);
      expect(activeStyle.borderLeftColor).toBe(NAVY);
      expect(activeStyle.color).toBe(TEAL_DARK);
      expect(activeStyle.boxShadow).toContain(TEAL);
      expect(activeStyle.boxShadow).toContain("inset");
      expect(Math.abs(activeStyle.height - 38)).toBeLessThan(0.6);

      await other.hover();
      const hovered = await rowStyle(other);
      const activeWhileHovered = await rowStyle(active);
      expect(hovered.backgroundColor).toBe(MUTED);
      expect(hovered.color).toBe(INK);
      expect(hovered.borderTopColor).not.toBe(NAVY);
      expect(activeWhileHovered.backgroundColor).toBe(WHITE);
      expect(activeWhileHovered.borderTopColor).toBe(NAVY);
      expect(activeWhileHovered.color).toBe(TEAL_DARK);

      const gaps = await nav
        .locator('[data-slot="sidebar-menu"]')
        .evaluateAll((lists) => {
          const measured: number[] = [];
          for (const list of lists) {
            const items = [...list.querySelectorAll("li")];
            for (let index = 1; index < items.length; index += 1) {
              const previous = items[index - 1]?.getBoundingClientRect();
              const current = items[index]?.getBoundingClientRect();
              if (!(previous && current)) continue;
              measured.push(current.top - previous.bottom);
            }
          }
          return measured;
        });
      expect(gaps.length).toBeGreaterThan(0);
      for (const gap of gaps) {
        expect(Math.abs(gap - gaps[0])).toBeLessThan(0.6);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThanOrEqual(8);
      }

      const groups = sidebar.locator('[data-slot="sidebar-group"]');
      await expect(groups).toHaveCount(2);
      expect(
        await groups
          .nth(1)
          .evaluate((element) => getComputedStyle(element).borderTopWidth)
      ).toBe("1px");

      const docs = nav.getByRole("link", { name: "Docs, opens in a new tab" });
      await expect(docs).toHaveAttribute("target", "_blank");
      await expect(docs).toHaveAttribute("rel", "noopener noreferrer");

      await focusByTab(page, other);
      await expect(other).toBeFocused();
      const focused = await rowStyle(other);
      expect(focused.outlineStyle).toBe("solid");
      expect(focused.outlineColor).toBe(NAVY);
      expect(focused.outlineWidth).toBe("2px");
      expect(focused.borderTopColor).not.toBe(NAVY);
      await page.keyboard.press("Shift+Tab");
      await expect(other).not.toBeFocused();

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        )
      ).toBe(true);
    });
  }

  test("collapsed header stacks the mark above show navigation and keeps tooltips", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/explore");
    await page.getByRole("button", { name: "Hide navigation" }).click();
    const sidebar = page.locator("#ux-reset-pro-navigation");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    const brand = sidebar.getByRole("link", {
      exact: true,
      name: "One Health Atlas",
    });
    const show = page.getByRole("button", { name: "Show navigation" });
    await expect(brand).toBeVisible();
    await expect(show).toBeVisible();
    const stacked = await page.evaluate(() => {
      const header = document.querySelector(
        "#ux-reset-pro-navigation [data-slot='sidebar-header']"
      );
      const brandLink = header?.querySelector(".ux-reset-pro-brand");
      const toggle = header?.querySelector(".app-sidebar-toggle");
      if (
        !(brandLink instanceof HTMLElement) ||
        !(toggle instanceof HTMLElement)
      ) {
        throw new Error("collapsed header controls are missing");
      }
      const brandRect = brandLink.getBoundingClientRect();
      const toggleRect = toggle.getBoundingClientRect();
      return {
        brandCenter: brandRect.left + brandRect.width / 2,
        overlap:
          brandRect.left < toggleRect.right &&
          brandRect.right > toggleRect.left &&
          brandRect.top < toggleRect.bottom &&
          brandRect.bottom > toggleRect.top,
        stacked: brandRect.bottom <= toggleRect.top + 0.5,
        toggleCenter: toggleRect.left + toggleRect.width / 2,
      };
    });
    expect(stacked.overlap).toBe(false);
    expect(stacked.stacked).toBe(true);
    expect(Math.abs(stacked.brandCenter - stacked.toggleCenter)).toBeLessThan(
      1
    );

    const explorer = (await navigation(page)).getByRole("link", {
      exact: true,
      name: "Atlas Explorer",
    });
    expect(Math.abs((await box(explorer)).height - 38)).toBeLessThan(0.6);
    await explorer.hover();
    await expect(
      page
        .locator("[data-slot='tooltip-content']")
        .filter({ hasText: "Atlas Explorer" })
    ).toBeVisible();
    await show.hover();
    await expect(
      page
        .locator("[data-slot='tooltip-content']")
        .filter({ hasText: "Show navigation" })
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "WORKSPACE" })).toBeHidden();
    expect(
      await sidebar
        .locator('[data-slot="sidebar-group"]')
        .nth(1)
        .evaluate((element) => getComputedStyle(element).borderTopWidth)
    ).toBe("1px");

    await page.goto("/compare");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(
      (await navigation(page)).getByRole("link", {
        exact: true,
        name: "Compare",
      })
    ).toHaveAttribute("aria-current", "page");

    await page.reload();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(
      page.getByRole("button", { name: "Show navigation" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Show navigation" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect(
      page.getByRole("button", { name: "Hide navigation" })
    ).toBeVisible();

    await page.goto("/explore");
    await page.goto("/compare");
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/explore");
    await expect(
      (await navigation(page)).getByRole("link", {
        exact: true,
        name: "Atlas Explorer",
      })
    ).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/compare");
    await expect(
      (await navigation(page)).getByRole("link", {
        exact: true,
        name: "Compare",
      })
    ).toHaveAttribute("aria-current", "page");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  test("/explore has no new navigation accessibility violations", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/explore");
    await expect(await navigation(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("professional navigation mobile", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !isMobileProject(testInfo.project.name),
      "Mobile drawer open and closed checks."
    );
  });

  for (const path of ["/explore", "/compare"] as const) {
    test(`${path} drawer stays closed, then opens without desktop collapse chrome`, async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(path);
      const sidebar = page.locator("#ux-reset-pro-navigation");
      await expect(sidebar).toHaveAttribute("inert", "");
      await expect(await navigation(page)).toBeHidden();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        )
      ).toBe(true);

      const open = page.getByRole("button", { name: "Open navigation" });
      await open.click();
      const nav = await navigation(page);
      await expect(nav).toBeVisible();
      await expect(sidebar).not.toHaveAttribute("inert", "");
      await expect(
        page.getByRole("button", { name: "Close navigation" })
      ).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Hide navigation" })
      ).toHaveCount(0);

      const brand = sidebar.getByRole("link", {
        exact: true,
        name: "One Health Atlas",
      });
      const close = page.getByRole("button", { name: "Close navigation" });
      await expect(brand).toContainText("One Health Atlas");
      await expect(
        nav.getByRole("heading", { name: "WORKSPACE" })
      ).toBeVisible();
      await expect(nav.getByRole("heading", { name: "MORE" })).toBeVisible();
      const brandBox = await box(brand);
      const closeBox = await box(close);
      expect(overlaps(brandBox, closeBox)).toBe(false);
      expect(brandBox.right).toBeLessThanOrEqual(closeBox.left);

      expect(
        await nav
          .locator("a")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("aria-label"))
          )
      ).toEqual([
        "Atlas Explorer",
        "Compare",
        "Ask Atlas",
        "Feed",
        "Settings",
        "Docs, opens in a new tab",
      ]);
      const activeName = path === "/explore" ? "Atlas Explorer" : "Compare";
      const active = nav.getByRole("link", { exact: true, name: activeName });
      await expect(active).toHaveAttribute("aria-current", "page");
      const activeStyle = await rowStyle(active);
      expect(activeStyle.backgroundColor).toBe(WHITE);
      expect(activeStyle.borderTopColor).toBe(NAVY);
      expect(activeStyle.color).toBe(TEAL_DARK);
      expect(activeStyle.height).toBeGreaterThanOrEqual(40);

      await page.keyboard.press("Shift+Tab");
      await expect(close).not.toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(sidebar).toHaveAttribute("inert", "");
      await expect(nav).toBeHidden();
      await expect(open).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        )
      ).toBe(true);
    });
  }
});
