import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { UserProfileResponse as UserProfileResponseSchema } from "@/generated/zod/userProfileResponse.zod";
import { UserProfileWrite as UserProfileWriteSchema } from "@/generated/zod/userProfileWrite.zod";

import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { revealProfessionalNavigationLink } from "./professional-shell-ready";
import { releaseViewportRuns } from "./release-phone-viewport";

type StoredProfile = {
  job_title: string | null;
  organization: string | null;
  role: string | null;
  starting_view_version: 1 | null;
  state_code: string | null;
};

const PROFILE_KEYS = new Set([
  "job_title",
  "organization",
  "role",
  "state_code",
]);

async function installSettingsApi(page: Page) {
  let stored: StoredProfile = {
    job_title: null,
    organization: null,
    role: null,
    starting_view_version: 1,
    state_code: null,
  };
  let failSaves = 0;
  let holdPut = false;
  let holdGets = false;
  let commitBeforeHold = false;
  let completedGets = 0;
  let releasePut: (() => void) | undefined;
  const releaseGets: Array<() => void> = [];
  const writes: unknown[] = [];

  const fulfillGet = async (route: Route) => {
    const payload = { profile: stored };
    UserProfileResponseSchema.parse(payload);
    await route.fulfill({ json: payload, status: 200 });
  };

  await page.route("**/v1/me/profile", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (holdGets) {
        await new Promise<void>((resolve) => {
          releaseGets.push(resolve);
        });
      }
      await fulfillGet(route);
      completedGets += 1;
      return;
    }
    if (request.method() !== "PUT") {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    const body: unknown = request.postDataJSON();
    writes.push(body);
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some((key) => !PROFILE_KEYS.has(key)) ||
      !UserProfileWriteSchema.safeParse(body).success
    ) {
      await route.fulfill({
        json: { detail: "Profile body does not match UserProfileWrite." },
        status: 422,
      });
      return;
    }
    if (failSaves > 0) {
      failSaves -= 1;
      await route.fulfill({
        headers: { "X-Request-ID": "settings-save-failed" },
        json: { detail: "Profile save failed." },
        status: 503,
      });
      return;
    }
    if (commitBeforeHold) {
      stored = {
        ...(body as StoredProfile),
        starting_view_version: 1,
      };
    }
    if (holdPut) {
      const held = Promise.withResolvers<boolean>();
      releasePut = () => {
        held.resolve(true);
      };
      await held.promise;
    }
    if (route.request().failure()) {
      return;
    }
    const payload = {
      profile: { ...body, starting_view_version: 1 as const },
    };
    UserProfileResponseSchema.parse(payload);
    try {
      await route.fulfill({ json: payload, status: 200 });
    } catch {
      return;
    }
    stored = {
      ...(body as StoredProfile),
      starting_view_version: 1,
    };
  });

  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: stateReviewResponseForUrl(route.request().url()),
      status: 200,
    });
  });

  return {
    failNextSaves(count: number) {
      failSaves = count;
    },
    completedProfileGets() {
      return completedGets;
    },
    holdProfileGets() {
      holdGets = true;
    },
    holdNextPut() {
      holdPut = true;
    },
    commitThenHoldNextPut() {
      commitBeforeHold = true;
      holdPut = true;
    },
    releaseHeldPut() {
      holdPut = false;
      releasePut?.();
    },
    releaseProfileGets() {
      holdGets = false;
      const pending = releaseGets.splice(0);
      for (const release of pending) {
        release();
      }
    },
    writes,
  };
}

async function chooseJurisdiction(page: Page, name: string) {
  if (name === "United States") {
    await page.getByRole("radio", { name: "United States" }).check();
    return;
  }
  await page.getByRole("radio", { name: "One state" }).check();
  await page.getByTestId("settings-jurisdiction-select").click();
  await page.getByRole("option", { name }).click();
}

test.describe("Settings profile and default jurisdiction", () => {
  test("saves a national default with empty optional fields and reloads it", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(page.getByTestId("settings-organization")).toHaveValue("");
    await expect(page.getByTestId("settings-job-title")).toHaveValue("");

    await chooseJurisdiction(page, "United States");
    await page.getByTestId("settings-save-profile").click();
    await expect(page.getByTestId("settings-save-notice")).toContainText(
      "Starting view saved. It will apply the next time you open Atlas Explorer without a specific view."
    );
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(
      page.locator("[data-jurisdiction-completion='complete']")
    ).toBeVisible();
    expect(api.writes.at(-1)).toEqual({
      job_title: null,
      organization: null,
      role: null,
      state_code: null,
    });

    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(page.getByTestId("settings-organization")).toHaveValue("");
    await expect(page.getByTestId("settings-job-title")).toHaveValue("");
    await expect(page.locator("#settings-role")).toContainText(
      "Prefer not to say"
    );
    const reviewLink = page.getByRole("link", { name: "Atlas Explorer" });
    await revealProfessionalNavigationLink(page, reviewLink);
  });

  test("saves a state default, starts a new Review there, and still opens other states", async ({
    page,
  }, testInfo) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "Colorado (CO)");
    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
    expect(api.writes.at(-1)).toMatchObject({
      job_title: null,
      organization: null,
      role: null,
      state_code: "CO",
    });

    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();

    await page.goto("/explore");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
    await expect(page).toHaveURL(/scope=CO/);
    await page.getByTestId("review-scope-select").click();
    await expect(
      page.getByRole("option", { name: "New York (NY)" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "United States" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/explore?scope=NY");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(
      page.getByRole("button", { name: /Albany, NY/ })
    ).toBeVisible();

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Settings" })
      .click();
    await chooseJurisdiction(page, "United States");
    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(
      page.getByRole("button", { name: /Albany, NY/ })
    ).toBeVisible();
  });

  test("keeps an explicit county URL when the saved state profile arrives late", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "New York (NY)");
    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='NY']")
    ).toBeVisible();

    const reviewUrl =
      "/explore?county=08001&dataset=alpha-2026&period=2023-01-01";
    const getsBeforeReview = api.completedProfileGets();
    api.holdProfileGets();
    await page.goto(reviewUrl);
    await expect(page.getByText("Connecting the data.")).toBeVisible();
    await expect(page.getByTestId("review-scope-select")).toHaveCount(0);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).not.toHaveURL(/scope=NY/);

    api.releaseProfileGets();
    await expect
      .poll(() => api.completedProfileGets())
      .toBeGreaterThan(getsBeforeReview);
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "ALL"
    );
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).not.toHaveURL(/scope=NY/);

    await page.reload();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "ALL"
    );
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).not.toHaveURL(/scope=NY/);
  });

  test("keeps edits after a failed save and confirms them on retry", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "United States");
    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();

    api.failNextSaves(1);
    await chooseJurisdiction(page, "Colorado (CO)");
    await page.getByTestId("settings-save-profile").click();
    await expect(page.getByTestId("settings-save-notice")).toContainText(
      "could not confirm that save"
    );
    await expect(page.getByTestId("settings-save-notice")).not.toContainText(
      "saved default is unchanged"
    );
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(
      page.getByTestId("settings-jurisdiction-select")
    ).toContainText("Colorado");

    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
  });

  test("does not announce a save that is still in flight after refresh", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    api.holdNextPut();
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "Colorado (CO)");
    await page.getByTestId("settings-save-profile").click();
    await expect(page.getByTestId("settings-save-profile")).toContainText(
      "Saving…"
    );
    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(page.getByTestId("settings-save-notice")).toHaveCount(0);
    api.releaseHeldPut();
  });

  test("keeps a committed save that loses its response across refresh", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    api.commitThenHoldNextPut();
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "Colorado (CO)");
    await page.getByTestId("settings-save-profile").click();
    await expect.poll(() => api.writes.length).toBe(1);
    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
    await expect(page.getByTestId("settings-save-notice")).toHaveCount(0);
    api.releaseHeldPut();
  });

  test("opens the saved profile from a direct settings URL", async ({
    page,
  }) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    await chooseJurisdiction(page, "New York (NY)");
    await page.getByTestId("settings-save-profile").click();
    await expect(
      page.locator("[data-default-jurisdiction='NY']")
    ).toBeVisible();
    expect(api.writes.length).toBeGreaterThan(0);
    await page.goto("/app/settings");
    await expect(
      page.locator("[data-default-jurisdiction='NY']")
    ).toBeVisible();
    await expect(
      page.getByTestId("settings-jurisdiction-select")
    ).toContainText("New York");
  });

  test("saves a state default from the keyboard", async ({ page }) => {
    await installSettingsApi(page);
    await page.goto("/app/settings");
    const oneState = page.getByRole("radio", { name: "One state" });
    await oneState.focus();
    await page.keyboard.press("Space");
    const jurisdiction = page.getByTestId("settings-jurisdiction-select");
    await jurisdiction.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(jurisdiction).toContainText("Colorado");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("settings-save-profile")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
  });

  test("allows, withdraws, and reloads optional analytics without changing the profile", async ({
    page,
  }, testInfo) => {
    const api = await installSettingsApi(page);
    await page.goto("/app/settings");
    const privacy = page.getByTestId("settings-privacy-preferences");
    await expect(privacy).toBeVisible();
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    await expect(
      privacy.getByRole("heading", { name: "Privacy settings" })
    ).toBeVisible();
    await expect(privacy).toContainText("six months");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await privacy
      .getByRole("button", { name: "Allow optional analytics" })
      .click();
    await expect(privacy.getByRole("status")).toContainText(
      "Optional analytics are allowed"
    );
    await page.reload();
    await expect(privacy.getByRole("status")).toContainText(
      "Optional analytics are allowed"
    );
    expect(api.writes).toEqual([]);

    await privacy
      .getByRole("button", { name: "Keep optional analytics off" })
      .click();
    await expect(privacy.getByRole("status")).toHaveText(
      "Optional analytics are off for this browser."
    );
    await page.reload();
    await expect(privacy.getByRole("status")).toHaveText(
      "Optional analytics are off for this browser."
    );
    await expect(
      page.locator("[data-default-jurisdiction='ALL']")
    ).toBeVisible();
    expect(api.writes).toEqual([]);
    await privacy.screenshot({
      path: testInfo.outputPath("settings-optional-analytics-withdrawn.png"),
    });
  });

  test("keeps optional analytics off when Do Not Track is enabled", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        configurable: true,
        get: () => "1",
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "atlas.analytics-preference.v1",
        JSON.stringify({
          decidedAt: "2026-01-01T00:00:00.000Z",
          decision: "granted",
          expiresAt: "2027-04-01T00:00:00.000Z",
          version: 1,
        })
      );
    });
    await installSettingsApi(page);
    await page.goto("/app/settings");
    const privacy = page.getByTestId("settings-privacy-preferences");
    const allow = privacy.getByRole("button", {
      name: "Allow optional analytics",
    });
    await expect(allow).toBeDisabled();
    await expect(privacy.getByRole("status")).toHaveText(
      "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off."
    );
    await allow.click({ force: true });
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("atlas.analytics-preference.v1")
        )
      )
      .toContain('"decision":"granted"');
    await privacy
      .getByRole("button", { name: "Keep optional analytics off" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("atlas.analytics-preference.v1")
        )
      )
      .toContain('"decision":"denied"');
    await expect(privacy.getByRole("status")).toHaveText(
      "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off."
    );
  });

  test("keeps optional analytics usable on a phone viewport", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Settings checks run on the mobile project."
    );
    await installSettingsApi(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/app/settings");
    const privacy = page.getByTestId("settings-privacy-preferences");
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
      path: testInfo.outputPath("settings-optional-analytics-phone.png"),
    });
  });

  test("has no serious accessibility violations on the settings form", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop axe check");
    await installSettingsApi(page);
    await page.goto("/app/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" })
    ).toBeVisible();
    await expect(page.getByTestId("settings-profile-form")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
