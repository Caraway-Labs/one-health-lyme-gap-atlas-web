import { expect, test } from "@playwright/test";

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

async function installReviewApiMocks(
  page: import("@playwright/test").Page,
  options: { profileState?: string | null; scoreDelayMs?: number } = {}
) {
  const profileState =
    options.profileState === undefined ? "CO" : options.profileState;
  const scoreDelayMs = options.scoreDelayMs ?? 0;

  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: {
        profile: profileState ? { state_code: profileState } : null,
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
}

test.describe("Review national and state scope controls", () => {
  test("writes scope=ALL when selecting United States from profile default state", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/app/review");
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
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
    await page.goto("/app/review?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page).toHaveURL(/scope=ALL/);
  });

  test("supports direct links for national and state scope", async ({
    page,
  }) => {
    await installReviewApiMocks(page, { profileState: null });
    await page.goto("/app/review");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page.getByTestId("review-scope-status")).toHaveAttribute(
      "data-request-scope",
      "ALL"
    );

    await page.goto("/app/review?scope=CO");
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
    await page.goto("/app/review?scope=NY");
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
    await page.goto("/app/review");
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
    await page.goto("/app/review?scope=CO&county=08001");
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
      .getByRole("link", { name: "Investigate" });
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
    await installReviewApiMocks(page, { profileState: "CO" });
    await page.goto("/app/review?scope=NY");
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
  });

  test("ignores a delayed response for a previous scope", async ({ page }) => {
    let releaseScores = 0;
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({
        json: { profile: { state_code: "CO" } },
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

    await page.goto("/app/review?scope=CO");
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
});
