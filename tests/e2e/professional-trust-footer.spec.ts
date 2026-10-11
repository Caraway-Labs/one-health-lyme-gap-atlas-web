import { expect, test, type Locator, type Page } from "@playwright/test";

const NAVY = "rgb(8, 42, 77)";
const FOCUS_WHITE = "rgb(255, 255, 255)";
const WHITE = "rgb(255, 255, 255)";

async function vendorStorage(page: Page) {
  return page.evaluate(() => ({
    local: localStorage.getItem("amplitude_unsent"),
    preference: localStorage.getItem("atlas.analytics-preference.v1"),
    session: sessionStorage.getItem("AMP_session"),
  }));
}

async function keyboardFocus(page: Page, control: Locator) {
  const footer = page.locator(".ux-reset-trust-footer");
  await footer.scrollIntoViewIfNeeded();
  for (let step = 0; step < 40; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("footer control was not reached by keyboard");
}

async function visibleFocusCue(control: Locator) {
  return control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(":focus-visible"),
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

const LINK_FOCUS_CUE = {
  focusVisible: true,
  outlineColor: FOCUS_WHITE,
  outlineStyle: "solid",
  outlineWidth: "2px",
} as const;

async function footerLayout(page: Page) {
  return page.locator(".ux-reset-trust-footer").evaluate((footer) => {
    const brand = footer.querySelector(".ux-reset-trust-brand");
    const links = footer.querySelector(".ux-reset-trust-links");
    if (!(brand instanceof HTMLElement) || !(links instanceof HTMLElement)) {
      throw new Error("trust footer is missing its brand or link group");
    }
    const footerBox = footer.getBoundingClientRect();
    const brandBox = brand.getBoundingClientRect();
    const linksBox = links.getBoundingClientRect();
    const brandStyle = getComputedStyle(brand);
    const linkStyle = getComputedStyle(links.querySelector("a") as HTMLElement);
    const footerStyle = getComputedStyle(footer);
    return {
      brandColor: brandStyle.color,
      brandInset: brandBox.left - footerBox.left,
      centerDelta: Math.abs(
        linksBox.left +
          linksBox.width / 2 -
          (footerBox.left + footerBox.width / 2)
      ),
      fontSize: brandStyle.fontSize,
      fontWeight: brandStyle.fontWeight,
      footerHeight: footerBox.height,
      linkColor: linkStyle.color,
      linkFontSize: linkStyle.fontSize,
      linkFontWeight: linkStyle.fontWeight,
      linksInset: linksBox.left - footerBox.left,
      overflow: footer.scrollWidth > footer.clientWidth + 1,
      stacked: linksBox.top >= brandBox.bottom - 1,
      surface: footerStyle.backgroundColor,
    };
  });
}

test("opens trust links from the professional footer", async ({
  page,
}, testInfo) => {
  await page.goto("/app/review");
  const footer = page.getByRole("contentinfo");
  const brand = footer.getByRole("link", {
    name: "One Health Atlas by Caraway Labs (opens in a new tab)",
  });
  await expect(brand).toHaveAttribute("href", "/about/caraway-labs");
  await expect(brand).toHaveAttribute("target", "_blank");
  await expect(brand).toHaveAttribute("rel", "noopener noreferrer");

  const layout = await footerLayout(page);
  expect(layout.surface).toBe(NAVY);
  expect(layout.brandColor).toBe(WHITE);
  expect(layout.linkColor).toBe(WHITE);
  expect(layout.fontSize).toBe(layout.linkFontSize);
  expect(layout.fontWeight).toBe(layout.linkFontWeight);
  expect(layout.overflow).toBe(false);
  expect(layout.brandInset).toBeLessThanOrEqual(28);
  if (testInfo.project.name === "mobile") {
    expect(layout.stacked).toBe(true);
    expect(layout.linksInset).toBeLessThanOrEqual(28);
    expect(layout.footerHeight).toBeGreaterThan(64);
  } else {
    expect(layout.stacked).toBe(false);
    expect(layout.footerHeight).toBeGreaterThanOrEqual(60);
    expect(layout.footerHeight).toBeLessThanOrEqual(64);
    expect(layout.centerDelta).toBeLessThanOrEqual(1);
  }
  await footer.screenshot({
    path: testInfo.outputPath("footer-review-layout.png"),
  });

  await keyboardFocus(page, brand);
  await expect(brand).toBeFocused();
  expect(await visibleFocusCue(brand)).toEqual(LINK_FOCUS_CUE);

  const privacy = footer.getByRole("link", { exact: true, name: "Privacy" });
  await expect(privacy).toHaveAttribute("href", "/privacy");
  await expect(privacy).not.toHaveAttribute("target", /.*/);
  await page.keyboard.press("Tab");
  await expect(privacy).toBeFocused();
  expect(await visibleFocusCue(privacy)).toEqual(LINK_FOCUS_CUE);
  await footer.screenshot({
    path: testInfo.outputPath("footer-privacy-link-focus.png"),
  });

  const responsibleUse = footer.getByRole("link", {
    name: "AI / Responsible Use",
  });
  await expect(responsibleUse).toHaveAttribute(
    "href",
    "/app/ai-responsible-use"
  );
  await page.keyboard.press("Tab");
  await expect(responsibleUse).toBeFocused();
  expect(await visibleFocusCue(responsibleUse)).toEqual(LINK_FOCUS_CUE);
  await footer.screenshot({
    path: testInfo.outputPath("footer-ai-responsible-use-focus.png"),
  });

  const settings = footer.getByRole("link", { name: "Privacy settings" });
  await expect(settings).toHaveAttribute("href", "/app/settings");
  await expect(settings).not.toHaveAttribute("target", /.*/);
  await page.keyboard.press("Tab");
  await expect(settings).toBeFocused();
  expect(await visibleFocusCue(settings)).toEqual(LINK_FOCUS_CUE);
  await footer.screenshot({
    path: testInfo.outputPath("footer-privacy-settings-focus.png"),
  });

  const popupPromise = page.waitForEvent("popup");
  await brand.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/about\/caraway-labs$/);
  await expect(popup).not.toHaveURL(/sign-in/);
  await expect(
    popup.getByRole("heading", { level: 1, name: "About Caraway Labs" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/review$/);
  await popup.close();

  await privacy.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { name: "Privacy without the fine print." })
  ).toBeVisible();

  await page.goto("/app/review");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy settings" })
    .click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("footer-privacy-settings-destination.png"),
  });
});

test("preserves a legacy analytics grant across the workspace footer", async ({
  page,
}, testInfo) => {
  const amplitudeCalls: string[] = [];
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.goto("/app");
  await page.goto("/overview");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/overview");

  await page.getByRole("button", { name: "Privacy settings" }).click();
  await page
    .getByRole("dialog", { name: "Privacy settings" })
    .getByRole("button", { name: "Allow optional analytics" })
    .click();
  await expect
    .poll(() => amplitudeCalls.length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    sessionStorage.setItem("AMP_session", "vendor-session");
    localStorage.setItem("amplitude_unsent", "vendor-local");
  });

  try {
    await page.goBack({ timeout: 5_000, waitUntil: "commit" });
  } catch (error) {
    const message = String(error);
    if (
      !message.includes("Execution context was destroyed") &&
      !message.includes("net::ERR_ABORTED") &&
      !message.includes("frame was detached")
    ) {
      throw error;
    }
  }
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toBe("/app");
  await page.waitForLoadState("domcontentloaded");

  await expect
    .poll(() => vendorStorage(page))
    .toEqual({
      local: "vendor-local",
      preference: expect.stringContaining('"decision":"granted"'),
      session: "vendor-session",
    });

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy settings" })
    .click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => vendorStorage(page))
    .toEqual({
      local: "vendor-local",
      preference: expect.stringContaining('"decision":"granted"'),
      session: "vendor-session",
    });

  await page.goto("/");
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await page
    .getByRole("dialog", { name: "Privacy settings" })
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();

  await expect
    .poll(() => vendorStorage(page))
    .toEqual({
      local: null,
      preference: expect.stringContaining('"decision":"denied"'),
      session: null,
    });
  await page.screenshot({
    path: testInfo.outputPath("footer-withdraw-after-back.png"),
  });
});
