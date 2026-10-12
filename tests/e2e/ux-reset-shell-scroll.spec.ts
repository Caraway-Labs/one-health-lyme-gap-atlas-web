import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

const DESKTOP = { height: 900, width: 1440 };
const MOBILE = { height: 844, width: 390 };
const TABLET = { height: 900, width: 768 };

type ChromeBox = {
  bottom: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

function isMobileProject(projectName: string): boolean {
  return projectName.includes("mobile");
}

async function installArizonaReview(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({
      json: {
        ...reviewScopeMetadataFixture,
        states: [
          ...reviewScopeMetadataFixture.states,
          { code: "AZ", name: "Arizona" },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "AZ";
    await route.fulfill({
      json: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Maricopa",
            fips: "04013",
            reasonText:
              "Maricopa is included because the review method returned it.",
          }),
        ],
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "04019",
            detail: "Environmental context stays a data gap for Pima County.",
          },
        ],
        resultState: "candidates_found",
        state,
      }),
      status: 200,
    });
  });
}

async function box(locator: Locator): Promise<ChromeBox> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    };
  });
}

async function mainScrollTop(page: Page): Promise<number> {
  return page
    .locator("main.ux-reset-pro-main")
    .evaluate((element) => element.scrollTop);
}

async function expectRouteContentReachable(page: Page): Promise<void> {
  await expect(
    page.locator(".app-inset[data-chrome-overflow='true']")
  ).toBeAttached();
  const heading = page.locator("main.ux-reset-pro-main h1").first();
  await heading.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  const probe = await heading.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      documentTop: document.scrollingElement?.scrollTop ?? 0,
      visible: box.height > 8 && box.bottom > 1 && box.top < window.innerHeight,
    };
  });
  expect(probe).toEqual({ documentTop: 0, visible: true });
}

async function expectTrustFooterReachable(page: Page): Promise<void> {
  const footerLink = page.getByRole("link", { name: "Privacy", exact: true });
  await footerLink.evaluate((element) => {
    element.scrollIntoView({ block: "nearest" });
  });
  const visible = await footerLink.evaluate((element) => {
    const linkBox = element.getBoundingClientRect();
    return {
      documentTop: document.scrollingElement?.scrollTop ?? 0,
      fullyVisible:
        linkBox.top >= -1 && linkBox.bottom <= window.innerHeight + 1,
    };
  });
  expect(visible).toEqual({ documentTop: 0, fullyVisible: true });
}

async function storedMainOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("atlas-main-scroll-offsets");
    if (!raw) {
      return 0;
    }
    const entries = JSON.parse(raw) as [string, number][];
    return entries.at(-1)?.[1] ?? 0;
  });
}

async function expectChromeParked(
  page: Page,
  sidebar: ChromeBox,
  header: ChromeBox
) {
  const nextSidebar = await box(page.locator("#ux-reset-pro-navigation"));
  const nextHeader = await box(page.locator(".ux-reset-pro-app .app-header"));
  expect(nextSidebar.top).toBe(sidebar.top);
  expect(nextSidebar.left).toBe(sidebar.left);
  expect(nextSidebar.height).toBe(sidebar.height);
  expect(nextHeader.top).toBe(header.top);
  expect(nextHeader.left).toBe(header.left);
  expect(nextHeader.height).toBe(header.height);
  const documentScroll = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    return {
      clientHeight: scrolling?.clientHeight ?? 0,
      scrollHeight: scrolling?.scrollHeight ?? 0,
      scrollTop: scrolling?.scrollTop ?? 0,
    };
  });
  expect(documentScroll.scrollTop).toBe(0);
  expect(documentScroll.scrollHeight).toBeLessThanOrEqual(
    documentScroll.clientHeight + 1
  );
}

test.describe("professional shell scroll containment", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      isMobileProject(testInfo.project.name),
      "Desktop shell scroll checks."
    );
  });

  test("scrolls Arizona review inside main and keeps the shell parked", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await installArizonaReview(page);
    await page.goto("/app/review?scope=AZ");
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Review" })
    ).toHaveAttribute("aria-current", "page");

    const sidebar = page.locator("#ux-reset-pro-navigation");
    const header = page.locator(".ux-reset-pro-app .app-header");
    const main = page.locator("main.ux-reset-pro-main");
    const sidebarBox = await box(sidebar);
    const headerBox = await box(header);
    expect(sidebarBox.top).toBe(0);
    expect(headerBox.top).toBe(0);
    await expect(
      header.getByRole("button", { name: "Ask Atlas" })
    ).toBeVisible();
    expect(await mainScrollTop(page)).toBe(0);
    expect(
      await main.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    expect(
      await page.locator(".ux-reset-review-gap-list").evaluate((element) => {
        return getComputedStyle(element).overflowY;
      })
    ).toBe("auto");

    const mainBox = await box(main);
    await page.mouse.move(mainBox.left + mainBox.width / 2, mainBox.top + 80);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(400);
    await expectChromeParked(page, sidebarBox, headerBox);
    expect(
      await page
        .locator("main h1")
        .evaluate((element) => element.getBoundingClientRect().top)
    ).toBeLessThan(headerBox.bottom);

    const afterWheel = await mainScrollTop(page);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => mainScrollTop(page))
      .toBeGreaterThan(afterWheel + 200);
    await expectChromeParked(page, sidebarBox, headerBox);

    const beforeSpace = await mainScrollTop(page);
    const mainPane = await page
      .locator("main.ux-reset-pro-main")
      .evaluate((element) => element.clientHeight);
    await page.getByRole("button", { name: "Hide navigation" }).focus();
    await page.keyboard.press(" ");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(Math.abs((await mainScrollTop(page)) - beforeSpace)).toBeLessThan(
      mainPane / 4
    );
    const collapsed = await box(sidebar);
    expect(collapsed.top).toBe(0);
    expect(collapsed.width).toBeLessThan(sidebarBox.width);
    await expect(
      page.getByRole("link", { exact: true, name: "Review" })
    ).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "Show navigation" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    const results = await new AxeBuilder({ page })
      .exclude(".maplibregl-canvas")
      .exclude(".maplibregl-map")
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("starts the next route at the top and restores review on back", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await installArizonaReview(page);
    await page.goto("/app/review?scope=AZ");
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 640;
    });
    await expect.poll(() => mainScrollTop(page)).toBe(640);

    await page.getByRole("link", { exact: true, name: "Settings" }).click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect.poll(() => mainScrollTop(page)).toBe(0);
    await expect(page.locator(".ux-reset-pro-app .app-header")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/review\?scope=AZ/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(500);
    expect(
      await page.locator("#ux-reset-pro-navigation").evaluate((element) => {
        return Math.round(element.getBoundingClientRect().top);
      })
    ).toBe(0);
  });

  test("opens a hashed settings field inside the main pane", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 360, width: 1280 });
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.goto("/app/settings#settings-job-title");
    const field = page.getByTestId("settings-job-title");
    await expect(field).toBeAttached();
    await expect
      .poll(() =>
        field.evaluate((element) => {
          const main = element.closest("main");
          if (!main) {
            return null;
          }
          const fieldBox = element.getBoundingClientRect();
          const mainBox = main.getBoundingClientRect();
          const header = document.querySelector(
            ".ux-reset-pro-app .app-header"
          );
          return {
            fieldBottom: Math.round(fieldBox.bottom),
            fieldTop: Math.round(fieldBox.top),
            headerTop: header
              ? Math.round(header.getBoundingClientRect().top)
              : null,
            insideMain:
              fieldBox.top >= mainBox.top - 1 &&
              fieldBox.bottom <= mainBox.bottom + 1,
            mainBottom: Math.round(mainBox.bottom),
            mainTop: Math.round(mainBox.top),
            scrollTop: Math.round(main.scrollTop),
          };
        })
      )
      .toEqual(
        expect.objectContaining({
          headerTop: 0,
          insideMain: true,
        })
      );
  });

  test("scrolls overflowing navigation without moving the header", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 420, width: 1280 });
    await page.goto("/app/feed");
    const content = page.locator(
      "#ux-reset-pro-navigation [data-slot='sidebar-content']"
    );
    await expect
      .poll(async () =>
        content.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true);
    const docs = page.getByRole("link", { name: "Docs, opens in a new tab" });
    await docs.evaluate((element) => {
      element.scrollIntoView({ block: "nearest" });
    });
    const visible = await docs.evaluate((element) => {
      const scroller = element.closest("[data-slot='sidebar-content']");
      const header = document.querySelector(".ux-reset-pro-app .app-header");
      if (!(scroller instanceof HTMLElement) || !header) {
        return null;
      }
      const linkBox = element.getBoundingClientRect();
      const scrollerBox = scroller.getBoundingClientRect();
      return {
        headerTop: Math.round(header.getBoundingClientRect().top),
        linkInside:
          linkBox.top >= scrollerBox.top - 1 &&
          linkBox.bottom <= scrollerBox.bottom + 1,
        scrollerMoved: scroller.scrollTop > 0,
      };
    });
    expect(visible).toEqual({
      headerTop: 0,
      linkInside: true,
      scrollerMoved: true,
    });
    await page
      .locator("#ux-reset-pro-navigation")
      .getByRole("link", { exact: true, name: "Settings" })
      .focus();
    await page.keyboard.press("Tab");
    const docsLink = page.getByRole("link", {
      name: "Docs, opens in a new tab",
    });
    await expect(docsLink).toBeFocused();
    expect(
      await docsLink.evaluate((element) => {
        const scroller = element.closest("[data-slot='sidebar-content']");
        if (!(scroller instanceof HTMLElement)) {
          return false;
        }
        const style = getComputedStyle(element);
        const outline = Number.parseFloat(style.outlineWidth) || 0;
        const offset = Number.parseFloat(style.outlineOffset) || 0;
        const extra = outline + Math.max(offset, 0);
        const linkBox = element.getBoundingClientRect();
        const bounds = scroller.getBoundingClientRect();
        return (
          linkBox.top - extra >= bounds.top - 1 &&
          linkBox.bottom + extra <= bounds.bottom + 1
        );
      })
    ).toBe(true);
  });

  test("reaches the trust footer when the chrome exceeds the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 80, width: 1280 });
    await page.goto("/app/settings");
    await expectRouteContentReachable(page);
    await expectTrustFooterReachable(page);
  });

  test("keeps other professional routes in the shared shell", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    for (const path of [
      "/app/explore",
      "/app/investigate",
      "/app/compare",
      "/app/action",
      "/app/assistant",
      "/app/feed",
      "/app/settings",
    ]) {
      await page.goto(path);
      const main = page.locator(".ux-reset-pro-app main.ux-reset-pro-main");
      await expect(main).toBeVisible();
      const metrics = await page.evaluate(() => {
        const scrolling = document.scrollingElement;
        const shell = document.querySelector(".ux-reset-pro-app");
        const sidebar = document.querySelector("#ux-reset-pro-navigation");
        const header = document.querySelector(".ux-reset-pro-app .app-header");
        const main = shell?.querySelector("main.ux-reset-pro-main") ?? null;
        if (
          !(
            scrolling &&
            shell instanceof HTMLElement &&
            sidebar &&
            header &&
            main
          )
        ) {
          return null;
        }
        return {
          documentScrollTop: scrolling.scrollTop,
          documentWider: scrolling.scrollWidth > window.innerWidth + 1,
          headerTop: Math.round(header.getBoundingClientRect().top),
          mainOverflow: getComputedStyle(main).overflowY,
          shellHeight: Math.round(shell.getBoundingClientRect().height),
          shellOverflow: getComputedStyle(shell).overflowY,
          sidebarTop: Math.round(sidebar.getBoundingClientRect().top),
          viewport: window.innerHeight,
        };
      });
      expect(metrics?.shellOverflow).toBe("hidden");
      expect(metrics?.mainOverflow).toBe("auto");
      expect(metrics?.documentScrollTop).toBe(0);
      expect(metrics?.documentWider).toBe(false);
      expect(metrics?.sidebarTop).toBe(0);
      expect(metrics?.headerTop).toBe(0);
      expect(metrics?.shellHeight).toBe(metrics?.viewport);
    }
  });

  test("leaves the public front porch on the document scroller", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await expect(page.locator(".ux-reset-pro-app")).toHaveCount(0);
    const scroll = await page.evaluate(() => {
      const scrolling = document.scrollingElement;
      return {
        clientHeight: scrolling?.clientHeight ?? 0,
        scrollHeight: scrolling?.scrollHeight ?? 0,
      };
    });
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  });

  test("starts a pushed query at the top and restores the previous entry", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await installArizonaReview(page);
    await page.goto("/app/review?scope=AZ");
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 640;
    });
    await expect.poll(() => mainScrollTop(page)).toBe(640);
    // The scope trigger sits above a scrolled main pane. A real pointer click
    // scrolls that trigger into view and would store the new offset. Dispatch
    // the same select events without moving main.
    await page.evaluate(() => {
      const trigger = document.querySelector(
        "[data-testid='review-scope-select']"
      );
      if (!(trigger instanceof HTMLElement)) {
        throw new Error("missing review scope select");
      }
      trigger.focus({ preventScroll: true });
      trigger.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          cancelable: true,
          view: window,
        })
      );
    });
    await expect(
      page.getByRole("option", { name: "New York (NY)" })
    ).toBeAttached();
    await page.evaluate(() => {
      const main = document.querySelector("main.ux-reset-pro-main");
      if (main instanceof HTMLElement) {
        main.scrollTop = 640;
      }
      const option = [...document.querySelectorAll("[role='option']")].find(
        (node) => node.textContent?.includes("New York (NY)")
      );
      if (!(option instanceof HTMLElement)) {
        throw new Error("missing New York option");
      }
      option.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          cancelable: true,
          pointerType: "mouse",
        })
      );
      option.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          button: 0,
          cancelable: true,
          detail: 1,
          view: window,
        })
      );
    });
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect.poll(() => mainScrollTop(page)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/scope=AZ/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(500);
  });

  test("keeps separate scroll offsets for two entries of the same review URL", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await installArizonaReview(page);
    await page.goto("/app/review?scope=AZ");
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 180;
    });
    await expect.poll(() => mainScrollTop(page)).toBe(180);
    await page.evaluate(() => {
      window.history.pushState(window.history.state, "", window.location.href);
    });
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 420;
    });
    await expect.poll(() => mainScrollTop(page)).toBe(420);
    await expect.poll(() => storedMainOffset(page)).toBe(420);
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(350);

    await page.goBack();
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(100);
    await expect.poll(() => mainScrollTop(page)).toBeLessThan(250);
    await expect.poll(() => storedMainOffset(page)).toBeGreaterThan(100);
    await page.locator("main.ux-reset-pro-main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(100);
    await page.goForward();
    await expect.poll(() => mainScrollTop(page)).toBeGreaterThan(350);
  });

  test("starts the next route at the top after a hash-only history change", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 360, width: 1280 });
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.goto("/app/settings#settings-job-title");
    const field = page.getByTestId("settings-job-title");
    await expect(field).toBeAttached();
    await page.evaluate(() => {
      window.history.pushState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#settings-job-title`
      );
    });
    await expect
      .poll(() =>
        field.evaluate((element) => {
          const main = element.closest("main");
          if (!main) {
            return false;
          }
          const fieldBox = element.getBoundingClientRect();
          const mainBox = main.getBoundingClientRect();
          return (
            fieldBox.top >= mainBox.top - 1 &&
            fieldBox.bottom <= mainBox.bottom + 1
          );
        })
      )
      .toBe(true);
    await page.getByRole("link", { exact: true, name: "Review" }).click();
    await expect(page).toHaveURL(/\/app\/review/);
    await expect.poll(() => mainScrollTop(page)).toBe(0);
  });

  test("restores the pre-fragment offset after a native anchor click", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.goto("/app/settings");
    const main = page.locator("main.ux-reset-pro-main");
    await expect(page.getByTestId("settings-job-title")).toBeVisible();
    const leaving = await main.evaluate((element) => {
      const target = document.createElement("div");
      target.id = "fragment-target";
      target.textContent = "Fragment target";
      element.prepend(target);
      const anchor = document.createElement("a");
      anchor.href = "#fragment-target";
      anchor.textContent = "Fragment target";
      anchor.dataset.testid = "fragment-leave";
      element.prepend(anchor);
      const spacer = document.createElement("div");
      spacer.style.height = "1800px";
      element.append(spacer);
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(leaving).toBeGreaterThan(400);
    await expect.poll(() => mainScrollTop(page)).toBe(leaving);
    await expect.poll(() => storedMainOffset(page)).toBe(leaving);
    await page.evaluate(() => {
      document
        .querySelector<HTMLAnchorElement>("[data-testid='fragment-leave']")
        ?.click();
    });
    await expect(page).toHaveURL(/#fragment-target/);
    await expect.poll(() => mainScrollTop(page)).toBeLessThan(80);
    await page.goBack();
    await expect(page).not.toHaveURL(/#fragment-target/);
    await expect.poll(() => mainScrollTop(page)).toBe(leaving);
  });

  test("returns document scroll restoration after leaving the professional shell", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/app/settings");
    await expect
      .poll(() => page.evaluate(() => history.scrollRestoration))
      .toBe("manual");
    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect
      .poll(() => page.evaluate(() => history.scrollRestoration))
      .toBe("auto");
    const scrolled = await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "2400px";
      document.body.append(spacer);
      const scroller = document.scrollingElement;
      if (!scroller) {
        return 0;
      }
      scroller.scrollTop = 640;
      return scroller.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(400);
    await page
      .getByRole("link", { name: "One Health Lyme Gap Atlas home" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect
      .poll(() =>
        page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
      )
      .toBeGreaterThan(400);
  });

  test("prints the professional shell without clipping the route", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/app/settings");
    await page.emulateMedia({ media: "print" });
    const overflow = await page
      .locator(".ux-reset-pro-app")
      .evaluate((element) => {
        return getComputedStyle(element).overflowY;
      });
    const mainOverflow = await page
      .locator("main.ux-reset-pro-main")
      .evaluate((element) => {
        return getComputedStyle(element).overflowY;
      });
    expect(overflow).toBe("visible");
    expect(mainOverflow).toBe("visible");
  });
});

test.describe("professional shell scroll containment mobile", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !isMobileProject(testInfo.project.name),
      "Compact drawer scroll checks."
    );
  });

  test("reaches the trust footer on a short phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 80, width: MOBILE.width });
    await page.goto("/app/settings");
    await expectRouteContentReachable(page);
    await expectTrustFooterReachable(page);
  });

  for (const viewport of [MOBILE, TABLET]) {
    test(`keeps the ${viewport.width}px drawer off the document scroller`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await installArizonaReview(page);
      await page.goto("/app/review?scope=AZ");
      await expect(page.getByTestId("review-state-panel")).toBeVisible();
      const sidebar = page.locator("#ux-reset-pro-navigation");
      await expect(sidebar).toHaveAttribute("inert", "");
      const placement = await sidebar.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          position: style.position,
          width: Math.round(element.getBoundingClientRect().width),
        };
      });
      expect(placement.position).toBe("fixed");
      expect(placement.width).toBeLessThan(viewport.width);

      const header = page.locator(".ux-reset-pro-app .app-header");
      const headerBefore = await box(header);
      expect(headerBefore.top).toBe(0);
      await page.locator("main.ux-reset-pro-main").evaluate((element) => {
        element.scrollTop = 480;
      });
      await expect.poll(() => mainScrollTop(page)).toBe(480);
      expect((await box(header)).top).toBe(0);
      expect(
        await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
      ).toBe(0);

      const open = page.getByRole("button", { name: "Open navigation" });
      await open.click();
      await expect(sidebar).toHaveAttribute("role", "dialog");
      await expect(
        page.getByRole("button", { name: "Close navigation" })
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(sidebar).toHaveAttribute("inert", "");
      await expect(open).toBeFocused();
      expect(await mainScrollTop(page)).toBe(480);
      await page.keyboard.press("Tab");
      const askAtlas = page.getByTestId("ask-atlas-launcher");
      await expect(askAtlas).toBeFocused();
      await page.waitForTimeout(400);
      await expect(askAtlas).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(open).toBeFocused();
      await page.waitForTimeout(400);
      await expect(open).toBeFocused();
      expect((await box(header)).top).toBe(0);
    });
  }
});
