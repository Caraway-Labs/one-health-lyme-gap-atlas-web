import { expect, test, type Locator, type Page } from "@playwright/test";

const NAVY = "rgb(8, 42, 77)";
const FOCUS_WHITE = "rgb(255, 255, 255)";

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

test("opens public Privacy and privacy settings from the professional footer", async ({
  page,
}) => {
  await page.goto("/app");
  const footer = page.getByRole("contentinfo");
  const privacy = footer.getByRole("link", { name: "Privacy" });
  await expect(privacy).toHaveAttribute("href", "/privacy");
  await expect(privacy).not.toHaveAttribute("target", /.*/);

  await keyboardFocus(page, privacy);
  await expect(privacy).toBeFocused();
  const linkCue = await privacy.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(":focus-visible"),
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(linkCue).toEqual({
    focusVisible: true,
    outlineColor: FOCUS_WHITE,
    outlineStyle: "solid",
    outlineWidth: "2px",
  });
  await footer.screenshot({
    path: "/opt/cursor/artifacts/footer-privacy-link-focus.png",
  });

  const settings = footer.getByRole("button", { name: "Privacy settings" });
  await page.keyboard.press("Tab");
  await expect(settings).toBeFocused();
  await expect
    .poll(() =>
      settings.evaluate((element) => {
        const style = getComputedStyle(element);
        const surface = getComputedStyle(
          element.closest("footer") as HTMLElement
        );
        return {
          backgroundColor: surface.backgroundColor,
          focusVisible: element.matches(":focus-visible"),
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      })
    )
    .toEqual({
      backgroundColor: NAVY,
      focusVisible: true,
      outlineColor: FOCUS_WHITE,
      outlineStyle: "solid",
      outlineWidth: "2px",
    });
  await footer.screenshot({
    path: "/opt/cursor/artifacts/footer-privacy-settings-focus.png",
  });

  await privacy.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { name: "Privacy without the fine print." })
  ).toBeVisible();

  await page.goto("/app");
  await page
    .getByRole("contentinfo")
    .getByRole("button", { name: "Privacy settings" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Privacy settings" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("atlas.analytics-preference.v1"))
    )
    .toContain('"decision":"denied"');
  await page.screenshot({
    path: "/opt/cursor/artifacts/footer-privacy-settings-dialog.png",
  });
});

test("stops analytics after grant on legacy Atlas, Back, and footer withdrawal", async ({
  page,
}) => {
  const amplitudeCalls: string[] = [];
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.goto("/app");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Open legacy Atlas" })
    .click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");

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
    .getByRole("button", { name: "Privacy settings" })
    .click();
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
  await page.goto("/");
  await expect
    .poll(() => vendorStorage(page))
    .toEqual({
      local: null,
      preference: expect.stringContaining('"decision":"denied"'),
      session: null,
    });
  await page.screenshot({
    path: "/opt/cursor/artifacts/footer-withdraw-after-back.png",
  });
});
