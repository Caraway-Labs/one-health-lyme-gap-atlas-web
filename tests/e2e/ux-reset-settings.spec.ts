import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { UserProfileResponse as UserProfileResponseSchema } from "@/generated/zod/userProfileResponse.zod";
import { UserProfileWrite as UserProfileWriteSchema } from "@/generated/zod/userProfileWrite.zod";

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

type StoredProfile = {
  job_title: string | null;
  organization: string | null;
  role: string | null;
  state_code: string | null;
} | null;

const PROFILE_KEYS = new Set([
  "job_title",
  "organization",
  "role",
  "state_code",
]);

async function installSettingsApi(page: Page) {
  let stored: StoredProfile = null;
  let failSaves = 0;
  let holdPut = false;
  let commitBeforeHold = false;
  let releasePut: (() => void) | undefined;
  const writes: unknown[] = [];

  const fulfillGet = async (route: Route) => {
    const payload = { profile: stored };
    UserProfileResponseSchema.parse(payload);
    await route.fulfill({ json: payload, status: 200 });
  };

  await page.route("**/v1/me/profile", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await fulfillGet(route);
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
      stored = body as Exclude<StoredProfile, null>;
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
    const payload = { profile: body };
    UserProfileResponseSchema.parse(payload);
    try {
      await route.fulfill({ json: payload, status: 200 });
    } catch {
      return;
    }
    stored = body as Exclude<StoredProfile, null>;
  });

  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });

  return {
    failNextSaves(count: number) {
      failSaves = count;
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
    writes,
  };
}

async function chooseJurisdiction(page: Page, name: string) {
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
      page.locator("[data-default-jurisdiction='unselected']")
    ).toBeVisible();
    await expect(page.getByTestId("settings-organization")).toHaveValue("");
    await expect(page.getByTestId("settings-job-title")).toHaveValue("");

    await chooseJurisdiction(page, "United States");
    await page.getByTestId("settings-save-profile").click();
    await expect(page.getByTestId("settings-save-notice")).toContainText(
      "United States"
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
    const reviewLink = page.getByRole("link", { name: "Review" });
    if (!(await reviewLink.isVisible())) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await expect(reviewLink).toBeVisible();
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

    await page.goto("/app/review");
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

    await page.goto("/app/review?scope=NY");
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
      "Saving profile"
    );
    await page.reload();
    await expect(
      page.locator("[data-default-jurisdiction='unselected']")
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
    const jurisdiction = page.getByTestId("settings-jurisdiction-select");
    await jurisdiction.focus();
    await page.keyboard.press("ArrowDown");
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

  test("has no serious accessibility violations on the settings form", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop axe check");
    await installSettingsApi(page);
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByTestId("settings-profile-form")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
