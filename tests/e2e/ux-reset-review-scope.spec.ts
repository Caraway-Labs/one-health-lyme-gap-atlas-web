import { expect, test } from "@playwright/test";

import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/atlas/scores**", (route) => {
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      "alpha-2026";
    return route.fulfill({
      json: { ...reviewScopeScoresFixture, release_id: releaseId },
      status: 200,
    });
  });
});

async function installReviewApiMocks(
  page: import("@playwright/test").Page,
  options: {
    profileMethods?: string[];
    profileState?: string | null;
    scoreDelayMs?: number;
  } = {}
) {
  const profileState =
    options.profileState === undefined ? "CO" : options.profileState;
  const scoreDelayMs = options.scoreDelayMs ?? 0;

  await page.route("**/v1/me/profile", async (route) => {
    options.profileMethods?.push(route.request().method());
    await route.fulfill({
      json: {
        profile: {
          starting_view_version: 1,
          state_code: profileState,
        },
      },
      status: 200,
    });
  });

  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });

  await page.route("**/v1/atlas/scores**", async (route) => {
    if (scoreDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, scoreDelayMs));
    }
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });

  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: stateReviewResponseForUrl(route.request().url()),
      status: 200,
    });
  });
  await installReviewGeometry(page);
}

function reviewNavigationGeometry() {
  const box = (
    fips: string,
    west: number,
    south: number,
    east: number,
    north: number
  ) => ({
    geometry: {
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  });
  return {
    features: [
      box("08001", -109.1, 36.9, -102, 41.1),
      box("36001", -79.8, 40.5, -71.8, 45.1),
      box("11001", -77.12, 38.79, -76.91, 38.995),
    ],
    type: "FeatureCollection",
  };
}

async function installReviewGeometry(
  page: import("@playwright/test").Page,
  body:
    | ReturnType<typeof reviewNavigationGeometry>
    | { detail: string } = reviewNavigationGeometry(),
  status = 200
) {
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({ json: body, status });
  });
}

test.describe("Review national and state scope controls", () => {
  test.beforeEach(async ({ page }) => {
    await installReviewGeometry(page);
  });

  test("writes scope=ALL when selecting United States from profile default state", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
    const scopeSelect = page.getByTestId("review-scope-select");
    await scopeSelect.focus();
    await page.keyboard.press("Enter");
    const unitedStates = page.getByRole("option", { name: "United States" });
    await expect(unitedStates).toBeVisible();
    await unitedStates.click();
    await expect(scopeSelect).toContainText("United States");
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
  });

  test("keeps explicit national scope after reload when profile defaults to a state", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page).toHaveURL(/scope=ALL/);
  });

  test("supports direct links for national and state scope", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: null });
    await page.goto("/explore");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page.getByTestId("review-scope-status")).toHaveAttribute(
      "data-request-scope",
      "ALL"
    );

    await page.goto("/explore?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
  });

  test("opens profile-default state with a different valid URL scope", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore?scope=NY");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
  });

  test("restores scope across switches, reload, and history", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "Desktop-only history flow"
    );
    await installReviewApiMocks(page, { profileState: null });
    await page.goto("/explore");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );

    await page.reload();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );

    await page.goBack({ waitUntil: "commit" });
    await expect
      .poll(() =>
        page
          .getByTestId("review-scope-results")
          .getAttribute("data-rendered-scope")
      )
      .toBe("CO");

    await page.goForward({ waitUntil: "commit" });
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
  });

  test("follows browser history after a Review county is selected", async ({
    page,
  }, testInfo) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore?scope=CO&county=08001");
    const handoff = page.getByTestId("review-investigate");
    await expect(handoff).toHaveAttribute("data-county", "08001");
    await page.getByRole("button", { name: /Boulder, CO/ }).click();
    await expect(page).toHaveURL(/county=08013/);
    await expect(handoff).toHaveAttribute("data-county", "08013");

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=08001/);
    await expect(handoff).toHaveAttribute("data-county", "08001");
    const investigateNav = page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Compare" });
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await expect(investigateNav).toHaveAttribute("href", /county=08001/);

    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=08013/);
    await expect(handoff).toHaveAttribute("data-county", "08013");
    if (
      testInfo.project.name.includes("mobile") &&
      !(await page
        .getByRole("navigation", { name: "Professional workspace" })
        .isVisible())
    ) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await expect(investigateNav).toHaveAttribute("href", /county=08013/);
  });

  test("does not change Settings default jurisdiction after scope switches", async ({
    page,
  }, testInfo) => {
    const profileMethods: string[] = [];
    await installReviewApiMocks(page, { profileMethods, profileState: "CO" });
    await page.goto("/explore?scope=NY");
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Settings" })
      .click();
    await expect(
      page.getByTestId("settings-default-jurisdiction")
    ).toContainText("Colorado");
    await expect(
      page.locator("[data-default-jurisdiction='CO']")
    ).toBeVisible();
    expect(profileMethods.filter((method) => method === "PUT")).toStrictEqual(
      []
    );
  });

  test("keeps Atlas Explorer closed until a held profile read classifies the account", async ({
    page,
  }) => {
    const profileMethods: string[] = [];
    const profileHeld = Promise.withResolvers<void>();
    await page.route("**/v1/me/profile", async (route) => {
      profileMethods.push(route.request().method());
      await profileHeld.promise;
      await route.fulfill({
        json: { profile: { starting_view_version: 1, state_code: "CO" } },
        status: 200,
      });
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

    await page.goto("/explore");
    await expect(page.getByText("Connecting the data.")).toBeVisible();
    await expect(page.getByTestId("review-scope-select")).toHaveCount(0);
    await expect(page).toHaveURL(/\/explore\/?$/);

    profileHeld.resolve();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
    await expect(page).toHaveURL(/scope=CO/);
    expect(profileMethods.filter((method) => method === "PUT")).toStrictEqual(
      []
    );
  });

  test("keeps an explicit national URL when a completed profile arrives late", async ({
    page,
  }) => {
    const profileHeld = Promise.withResolvers<void>();
    await page.route("**/v1/me/profile", async (route) => {
      await profileHeld.promise;
      await route.fulfill({
        json: { profile: { starting_view_version: 1, state_code: "CO" } },
        status: 200,
      });
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

    await page.goto("/explore?scope=ALL");
    await expect(page.getByText("Connecting the data.")).toBeVisible();
    await expect(page.getByTestId("review-scope-select")).toHaveCount(0);
    await expect(page).toHaveURL(/scope=ALL/);

    profileHeld.resolve();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "ALL"
    );
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-state-panel")).toHaveCount(0);
  });

  test("replaces a saved state scope so Back does not open national Review", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/app/settings");
    await page.goto("/explore");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("review-national-orientation")).toHaveCount(
      0
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.getByTestId("review-national-orientation")).toHaveCount(
      0
    );
  });

  test("rewrites an invalid scope to national instead of the profile state", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore?scope=NOT");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "United States"
    );
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).not.toHaveURL(/scope=NOT/);
    await expect(page.getByTestId("review-state-panel")).toHaveCount(0);
  });

  test("leaves an unrecognized state code unsupported", async ({ page }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/explore?scope=ZZ");
    await expect(page.getByTestId("review-scope-unsupported")).toHaveText(
      "ZZ is not supported — lower 48 only."
    );
    await expect(page).toHaveURL(/scope=ZZ/);
    await expect(page.getByTestId("review-national-orientation")).toHaveCount(
      0
    );
    await expect(page.getByTestId("review-state-panel")).toHaveCount(0);
  });

  test("ignores a delayed response for a previous scope", async ({ page }) => {
    let releaseScores = 0;
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({
        json: { profile: { starting_view_version: 1, state_code: "CO" } },
        status: 200,
      });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/atlas/scores**", async (route) => {
      releaseScores += 1;
      const delay = releaseScores === 1 ? 800 : 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      await route.fulfill({
        json: stateReviewResponseForUrl(route.request().url()),
        status: 200,
      });
    });

    await page.goto("/explore?scope=CO");
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await page.waitForTimeout(900);
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(page.getByTestId("review-scope-status")).toHaveAttribute(
      "data-request-scope",
      "NY"
    );
  });

  test("keeps the current state review when an earlier state's response arrives late", async ({
    page,
  }) => {
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({
        json: { profile: { starting_view_version: 1, state_code: "CO" } },
        status: 200,
      });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      const state =
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
      if (state === "CO") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      await route.fulfill({
        json: stateReviewResponseForUrl(route.request().url()),
        status: 200,
      });
    });

    const lateColorado = page
      .waitForResponse(
        (response) => response.url().includes("/v1/states/CO/review"),
        { timeout: 8000 }
      )
      .catch(() => null);
    await page.goto("/explore?scope=CO");
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-candidate")).toContainText("Albany");
    await lateColorado;
    await expect(page.getByTestId("review-candidate")).toContainText("Albany");
    await expect(page.getByText("Denver")).toHaveCount(0);
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "NY"
    );
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /scope=NY/
    );
  });
});
