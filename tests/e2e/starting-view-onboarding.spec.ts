import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { UserProfileResponse as UserProfileResponseSchema } from "@/generated/zod/userProfileResponse.zod";
import { UserProfileWrite as UserProfileWriteSchema } from "@/generated/zod/userProfileWrite.zod";

import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

type StoredProfile = {
  job_title: string | null;
  organization: string | null;
  role: string | null;
  starting_view_version: 1 | null;
  state_code: string | null;
};

const SETTINGS_KEYS = new Set([
  "job_title",
  "organization",
  "role",
  "state_code",
]);

const legacyProfile: StoredProfile = {
  job_title: "Analyst",
  organization: "State lab",
  role: "state_level_epidemiologist",
  starting_view_version: null,
  state_code: "CO",
};

async function installOnboardingApi(
  page: Page,
  initial: StoredProfile | null,
  options: {
    committedUncertainSaves?: number;
    failMetadata?: number;
    failReads?: number;
    unauthorized?: boolean;
    uncertainSaves?: number;
  } = {}
) {
  let stored = initial;
  let failReads = options.failReads ?? 0;
  let uncertainSaves = options.uncertainSaves ?? 0;
  let committedUncertainSaves = options.committedUncertainSaves ?? 0;
  let failMetadata = options.failMetadata ?? 0;
  const unauthorized = options.unauthorized === true;
  const writes: unknown[] = [];

  await page.route("**/v1/me/profile", async (route: Route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (unauthorized) {
        await route.fulfill({ json: { detail: "Unauthorized." }, status: 401 });
        return;
      }
      if (failReads > 0) {
        failReads -= 1;
        await route.fulfill({
          json: { detail: "Profile read failed." },
          status: 503,
        });
        return;
      }
      const payload = { profile: stored };
      UserProfileResponseSchema.parse(payload);
      await route.fulfill({ json: payload, status: 200 });
      return;
    }
    if (request.method() !== "PUT") {
      await route.fulfill({ json: {}, status: 404 });
      return;
    }
    const body: unknown = request.postDataJSON();
    writes.push(body);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : null;
    const completing = record?.complete_starting_view === true;
    const allowed = completing
      ? new Set([...SETTINGS_KEYS, "complete_starting_view"])
      : SETTINGS_KEYS;
    if (
      !record ||
      Object.keys(record).some((key) => !allowed.has(key)) ||
      !UserProfileWriteSchema.safeParse(body).success
    ) {
      await route.fulfill({
        json: { detail: "Profile body does not match UserProfileWrite." },
        status: 422,
      });
      return;
    }
    const next: StoredProfile = {
      job_title: (record.job_title as string | null) ?? null,
      organization: (record.organization as string | null) ?? null,
      role: (record.role as string | null) ?? null,
      starting_view_version: completing
        ? 1
        : (stored?.starting_view_version ?? null),
      state_code: (record.state_code as string | null) ?? null,
    };
    UserProfileResponseSchema.parse({ profile: next });
    if (uncertainSaves > 0) {
      uncertainSaves -= 1;
      await route.fulfill({
        json: { detail: "Profile save was not confirmed." },
        status: 503,
      });
      return;
    }
    stored = next;
    if (committedUncertainSaves > 0) {
      committedUncertainSaves -= 1;
      await route.fulfill({
        json: { detail: "Profile save was not confirmed." },
        status: 503,
      });
      return;
    }
    await route.fulfill({ json: { profile: next }, status: 200 });
  });

  await page.route("**/v1/atlas/metadata**", async (route) => {
    if (failMetadata > 0) {
      failMetadata -= 1;
      await route.fulfill({
        json: { detail: "Metadata unavailable." },
        status: 503,
      });
      return;
    }
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

  return { writes };
}

async function expectUnselectedSetup(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Choose your starting view" })
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "United States" })
  ).not.toBeChecked();
  await expect(
    page.getByRole("radio", { name: "One state" })
  ).not.toBeChecked();
  await expect(
    page.getByRole("combobox", { exact: true, name: "State" })
  ).toHaveCount(0);
  await expect(page.getByText("One Health Atlas")).toBeVisible();
}

test.describe("Starting view onboarding", () => {
  test("shows setup for an incomplete profile and a legacy stored state", async ({
    page,
  }) => {
    await installOnboardingApi(page, null);
    await page.goto("/auth/starting-view");
    await expectUnselectedSetup(page);

    await installOnboardingApi(page, {
      ...legacyProfile,
      starting_view_version: null,
    });
    await page.goto("/auth/starting-view");
    await expectUnselectedSetup(page);
  });

  test("saves United States, opens national Atlas Explorer, and skips setup after reload", async ({
    page,
  }) => {
    const api = await installOnboardingApi(page, null);
    await page.goto(
      "/auth/continue?next=%2Fapp%2Finvestigate%3Fcounty%3D08001"
    );
    await expectUnselectedSetup(page);
    await page.getByRole("radio", { name: "United States" }).check();
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(page).toHaveURL(/\/explore(?:\?scope=ALL)?$/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("review-national-orientation")).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({
      fullPage: true,
      path: "test-results/onboarding-explorer-national.png",
    });
    expect(api.writes.at(-1)).toMatchObject({
      complete_starting_view: true,
      state_code: null,
    });
    await page.reload();
    await expect(page).toHaveURL(/\/explore/);
    await expect(
      page.getByRole("heading", { name: "Choose your starting view" })
    ).toHaveCount(0);
    await page.goto("/auth/continue");
    await expect(page).toHaveURL(/\/explore(?:\?scope=ALL)?$/, {
      timeout: 20_000,
    });
  });

  test("saves one state and reaches that Atlas Explorer view", async ({
    page,
  }) => {
    const api = await installOnboardingApi(page, legacyProfile);
    await page.goto("/auth/starting-view");
    await expectUnselectedSetup(page);
    await page.getByRole("radio", { name: "One state" }).check();
    await expect(
      page.getByRole("combobox", { exact: true, name: "State" })
    ).toBeVisible();
    await page
      .getByRole("combobox", { exact: true, name: "State" })
      .selectOption("CO");
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO",
      { timeout: 20_000 }
    );
    expect(api.writes.at(-1)).toMatchObject({
      complete_starting_view: true,
      job_title: "Analyst",
      organization: "State lab",
      role: "state_level_epidemiologist",
      state_code: "CO",
    });
    await page.reload();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO",
      { timeout: 20_000 }
    );
  });

  test("keeps a safe explicit destination for a completed account", async ({
    page,
  }) => {
    await installOnboardingApi(page, {
      job_title: null,
      organization: null,
      role: null,
      starting_view_version: 1,
      state_code: "CO",
    });
    await page.goto("/auth/continue?next=%2Fapp%2Freview%3Fscope%3DNY");
    await expect(page).toHaveURL(/\/explore\?scope=NY/);
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(
      page.getByRole("heading", { name: "Choose your starting view" })
    ).toHaveCount(0);
  });

  test("keeps a failed profile read and an uncertain save recoverable", async ({
    page,
  }) => {
    await installOnboardingApi(page, null, { failReads: 1 });
    await page.goto("/auth/continue");
    await expect(
      page.getByText("We couldn’t load your starting view.")
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "United States" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Try again" }).click();
    await expectUnselectedSetup(page);

    await installOnboardingApi(page, null, { uncertainSaves: 1 });
    await page.goto("/auth/starting-view");
    await page.getByRole("radio", { name: "United States" }).check();
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(
      page.getByText("We couldn’t save your starting view.")
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "United States" })
    ).toBeChecked();
    await expect(page).toHaveURL(/\/auth\/starting-view/);
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(page.getByTestId("review-national-orientation")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("recovers a committed uncertain save from the following read", async ({
    page,
  }) => {
    const api = await installOnboardingApi(page, legacyProfile, {
      committedUncertainSaves: 1,
    });
    await page.goto("/auth/starting-view");
    await page.getByRole("radio", { name: "One state" }).check();
    await page
      .getByRole("combobox", { exact: true, name: "State" })
      .selectOption("CO");
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(page.getByTestId("review-state-panel")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/scope=CO/);
    expect(api.writes).toHaveLength(1);
    expect(api.writes[0]).toMatchObject({
      complete_starting_view: true,
      state_code: "CO",
    });
  });

  test("retries a failed state list without losing the choice", async ({
    page,
  }) => {
    await installOnboardingApi(page, null, { failMetadata: 1 });
    await page.goto("/auth/starting-view");
    await page.getByRole("radio", { name: "One state" }).check();
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(
      page.getByText("We couldn’t load the state list.")
    ).toBeVisible();
    await expect(page.getByText("Select a state to continue.")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Try loading states again" })
      .click();
    await page
      .getByRole("combobox", { exact: true, name: "State" })
      .selectOption("CO");
    await page
      .getByRole("button", { name: "Continue to Atlas Explorer" })
      .click();
    await expect(page).toHaveURL(/scope=CO/, { timeout: 20_000 });
  });

  test("sends a rejected session to sign in", async ({ page }) => {
    await installOnboardingApi(page, null, { unauthorized: true });
    await page.goto("/auth/continue?next=%2Fapp%2Freview%3Fscope%3DNY");
    const signIn = page.getByRole("link", { name: "Sign in" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", /\/auth\/sign-in\?next=/);
    await expect(
      page.getByRole("radio", { name: "United States" })
    ).toHaveCount(0);
    await expect(page.getByText("Connecting the data.")).toHaveCount(0);
  });

  test("Settings save keeps completion and optional profile fields", async ({
    page,
  }) => {
    const api = await installOnboardingApi(page, {
      job_title: "Analyst",
      organization: "State lab",
      role: "state_level_epidemiologist",
      starting_view_version: 1,
      state_code: "CO",
    });
    await page.goto("/app/settings");
    await expect(page.getByTestId("settings-organization")).toHaveValue(
      "State lab"
    );
    await expect(page.getByTestId("settings-job-title")).toHaveValue("Analyst");
    await page.getByTestId("settings-job-title").fill("Senior analyst");
    await page.getByTestId("settings-save-profile").click();
    await expect(page.getByTestId("settings-save-notice")).toBeVisible();
    const body = api.writes.at(-1) as Record<string, unknown>;
    expect(body).toMatchObject({
      job_title: "Senior analyst",
      organization: "State lab",
      role: "state_level_epidemiologist",
      state_code: "CO",
    });
    expect(body).not.toHaveProperty("complete_starting_view");
    expect(body).not.toHaveProperty("starting_view_version");
    await page.reload();
    await expect(page.getByTestId("settings-job-title")).toHaveValue(
      "Senior analyst"
    );
    await expect(page).toHaveURL(/\/app\/settings/);
  });

  test("matches the approved starting-view layout", async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.name === "mobile" ? 390 : 1280;
    test.skip(
      !releaseViewportRuns(testInfo.project.name, width),
      "Phone layout runs on the mobile project."
    );
    await page.setViewportSize({
      height: width === 390 ? 844 : 800,
      width,
    });
    await installOnboardingApi(page, null);
    await page.goto("/auth/starting-view");
    await expectUnselectedSetup(page);
    const heading = page.getByRole("heading", {
      name: "Choose your starting view",
    });
    const headingSize = await heading.evaluate(
      (element) => getComputedStyle(element).fontSize
    );
    expect(headingSize).toBe(width <= 500 ? "26px" : "28px");
    const formWidth = await page
      .locator(".auth-entrance-form")
      .evaluate((element) => getComputedStyle(element).maxWidth);
    expect(formWidth).toBe("456px");
    const rowHeight = await page
      .locator(".auth-entrance-choice")
      .first()
      .evaluate((element) => getComputedStyle(element).minHeight);
    expect(rowHeight).toBe("64px");
    const button = page.getByRole("button", {
      name: "Continue to Atlas Explorer",
    });
    const buttonBox = await button.boundingBox();
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const buttonColor = await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    expect(buttonColor).toBe("rgb(24, 94, 94)");
    const fontFamily = await heading.evaluate(
      (element) => getComputedStyle(element).fontFamily
    );
    expect(fontFamily.toLowerCase()).toContain("frontporchherofont");

    const unselectedPath = testInfo.outputPath("unselected.png");
    await page.screenshot({ fullPage: true, path: unselectedPath });
    await page.screenshot({
      fullPage: true,
      path: "test-results/onboarding-starting-view.png",
    });
    await page.getByRole("radio", { name: "One state" }).check();
    const selected = page.locator(".auth-entrance-choice", {
      has: page.getByRole("radio", { name: "One state" }),
    });
    await expect
      .poll(() =>
        selected.evaluate(
          (element) => getComputedStyle(element).backgroundColor
        )
      )
      .toBe("rgb(232, 241, 238)");
    const selectedPath = testInfo.outputPath("one-state.png");
    await page.screenshot({ fullPage: true, path: selectedPath });

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
