import { expect, test, type Locator, type Page } from "@playwright/test";

import { UserProfileResponse as UserProfileResponseSchema } from "@/generated/zod/userProfileResponse.zod";

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

const PREFERENCE_KEY = "atlas.analytics-preference.v1";

const NOT_DECIDED = "Optional analytics are off until you make a choice.";
const DENIED = "Optional analytics are off for this browser.";
const ALLOWED =
  "Optional analytics are allowed for this browser until this preference expires or you change it.";
const DO_NOT_TRACK =
  "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off.";
const SEEDED_GRANT_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
const AMPLITUDE_QUIET_MS = 10_000;

function seededGrant(now: number): string {
  return JSON.stringify({
    decidedAt: new Date(now).toISOString(),
    decision: "granted",
    expiresAt: new Date(now + SEEDED_GRANT_LIFETIME_MS).toISOString(),
    version: 1,
  });
}

async function storedDecision(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const preference = JSON.parse(raw) as { decision?: unknown };
    return typeof preference.decision === "string" ? preference.decision : null;
  }, PREFERENCE_KEY);
}

async function installWorkspaceReads(page: Page): Promise<void> {
  await page.route("**/v1/me/profile", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ json: {}, status: 404 });
      return;
    }
    const payload = { profile: null };
    UserProfileResponseSchema.parse(payload);
    await route.fulfill({ json: payload, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });
}

async function nationalExploreReady(page: Page): Promise<boolean> {
  const url = new URL(page.url());
  const renderedScope = await page
    .getByTestId("review-scope-results")
    .getAttribute("data-rendered-scope");
  return (
    url.pathname === "/explore" &&
    url.searchParams.get("scope") === "ALL" &&
    renderedScope === "ALL"
  );
}

async function openSettingsFromFooter(page: Page): Promise<Locator> {
  await installWorkspaceReads(page);
  await page.goto("/explore");
  await expect.poll(() => nationalExploreReady(page)).toBe(true);
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy settings" })
    .click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const privacy = page.getByTestId("settings-privacy-preferences");
  await expect(privacy).toBeVisible();
  return privacy;
}

test("opens the live About page from the workspace footer", async ({
  page,
}, testInfo) => {
  await page.goto("/explore");
  const brand = page.getByRole("contentinfo").getByRole("link", {
    name: "One Health Atlas by Caraway Labs (opens in a new tab)",
  });
  await expect(brand).toHaveAttribute("href", "/about/caraway-labs");
  await expect(brand).toHaveAttribute("target", "_blank");
  await expect(brand).toHaveAttribute("rel", "noopener noreferrer");

  const popupPromise = page.waitForEvent("popup");
  await brand.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/about\/caraway-labs$/);
  await expect(popup).not.toHaveURL(/sign-in/);
  await expect(
    popup.getByRole("heading", { level: 1, name: "About Caraway Labs" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/explore$/);
  await popup.screenshot({
    path: testInfo.outputPath("footer-about-page.png"),
  });
  await popup.close();
});

test("persists deny, allow, and withdraw from the footer Settings link", async ({
  page,
}, testInfo) => {
  const privacy = await openSettingsFromFooter(page);
  await expect(privacy.getByRole("status")).toHaveText(NOT_DECIDED);
  expect(await storedDecision(page)).toBeNull();
  await privacy.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("footer-settings-destination.png"),
  });

  await privacy
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await expect(privacy.getByRole("status")).toHaveText(DENIED);
  expect(await storedDecision(page)).toBe("denied");
  await page.reload();
  await expect(privacy.getByRole("status")).toHaveText(DENIED);
  expect(await storedDecision(page)).toBe("denied");
  await privacy.screenshot({
    path: testInfo.outputPath("consent-denied-persisted.png"),
  });

  await privacy
    .getByRole("button", { name: "Allow optional analytics" })
    .click();
  await expect(privacy.getByRole("status")).toHaveText(ALLOWED);
  expect(await storedDecision(page)).toBe("granted");
  await page.reload();
  await expect(privacy.getByRole("status")).toHaveText(ALLOWED);
  expect(await storedDecision(page)).toBe("granted");
  await privacy.screenshot({
    path: testInfo.outputPath("consent-allowed-persisted.png"),
  });

  await privacy
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await expect(privacy.getByRole("status")).toHaveText(DENIED);
  expect(await storedDecision(page)).toBe("denied");
  await page.reload();
  await expect(privacy.getByRole("status")).toHaveText(DENIED);
  expect(await storedDecision(page)).toBe("denied");
  await privacy.screenshot({
    path: testInfo.outputPath("consent-withdrawn-persisted.png"),
  });
});

test("honors Do Not Track on Settings opened from the footer", async ({
  page,
}, testInfo) => {
  const amplitudeCalls: string[] = [];
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.abort();
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });
  });
  await page.addInitScript(
    ({ key, preference }) => {
      localStorage.setItem(key, preference);
    },
    { key: PREFERENCE_KEY, preference: seededGrant(Date.now()) }
  );

  // `/` mounts AnalyticsClient. Workspace shell "none" routes, including
  // Settings, do not, so a Settings-only check would miss a startup that
  // ignored Do Not Track for an existing grant.
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Privacy settings" })
  ).toBeVisible();
  expect(amplitudeCalls).toEqual([]);
  let amplitudeRequested = false;
  try {
    await page.waitForRequest(/amplitude/i, { timeout: AMPLITUDE_QUIET_MS });
    amplitudeRequested = true;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") {
      throw error;
    }
  }
  expect(amplitudeRequested).toBe(false);
  expect(amplitudeCalls).toEqual([]);

  const privacy = await openSettingsFromFooter(page);
  const allow = privacy.getByRole("button", {
    name: "Allow optional analytics",
  });
  await expect(allow).toBeDisabled();
  await expect(privacy.getByRole("status")).toHaveText(DO_NOT_TRACK);
  await allow.click({ force: true });
  expect(await storedDecision(page)).toBe("granted");
  await page.reload();
  await expect(privacy.getByRole("status")).toHaveText(DO_NOT_TRACK);
  await expect(allow).toBeDisabled();
  expect(await storedDecision(page)).toBe("granted");
  await privacy.screenshot({
    path: testInfo.outputPath("consent-do-not-track.png"),
  });
});

test("reaches Settings consent controls from the footer on a phone viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 390),
    "Phone-width footer checks run on the mobile project."
  );
  await page.setViewportSize({ height: 844, width: 390 });
  const privacy = await openSettingsFromFooter(page);
  await expect(
    privacy.getByRole("button", { name: "Allow optional analytics" })
  ).toBeVisible();
  await expect(
    privacy.getByRole("button", { name: "Keep optional analytics off" })
  ).toBeVisible();
  const box = await privacy.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  expect(
    await privacy.evaluate(
      (section) => section.scrollWidth <= section.clientWidth + 1
    )
  ).toBeTruthy();
  await privacy.screenshot({
    path: testInfo.outputPath("footer-settings-phone.png"),
  });
});
