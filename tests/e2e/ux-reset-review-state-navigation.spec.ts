import { expect, test, type Page } from "@playwright/test";

import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";

function box(
  fips: string,
  west: number,
  south: number,
  east: number,
  north: number
) {
  return {
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
      type: "Polygon" as const,
    },
    properties: { fips },
    type: "Feature" as const,
  };
}

const navigationGeometry = {
  features: [
    box("08001", -109.1, 36.9, -102, 41.1),
    box("08013", -105.7, 39.9, -105.05, 40.26),
    box("36001", -79.8, 40.5, -71.8, 45.1),
    box("11001", -77.12, 38.79, -76.91, 38.995),
  ],
  type: "FeatureCollection" as const,
};

async function installReviewApi(
  page: Page,
  geometry: { status: number; body: unknown } | undefined = {
    body: navigationGeometry,
    status: 200,
  }
) {
  const profileMethods: string[] = [];
  await page.route("**/v1/me/profile", async (route) => {
    profileMethods.push(route.request().method());
    await route.fulfill({
      json: { profile: { state_code: "CO" } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: stateReviewResponseForUrl(route.request().url()),
      status: 200,
    });
  });
  if (geometry) {
    await page.route("**/v1/atlas/geometry**", async (route) => {
      await route.fulfill({ json: geometry.body, status: geometry.status });
    });
  }
  return profileMethods;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Review national geographic navigation", () => {
  test("selects a state from the list, keeps history, and does not write Settings", async ({
    page,
  }, testInfo) => {
    const profileMethods = await installReviewApi(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/app/review?scope=ALL");
    await expect(
      page.getByRole("heading", { name: "State orientation" })
    ).toBeVisible();
    await expect(page.locator(".ux-reset-review-state-grid")).toHaveCount(0);
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText(
      /The map is ready\.|The map could not start\. Choose a state from the list\.|The map could not load\. Choose a state from the list\./
    );
    await expect(
      page.getByRole("button", { name: "DC, not in this release" })
    ).toBeDisabled();
    await page.getByTestId("review-state-search").fill("Colorado");
    await expect(
      page.getByRole("button", { name: "NY, New York" })
    ).toHaveCount(0);
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText("Showing 1 of 49 states.");
    await page.getByRole("button", { name: "CO, Colorado" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(page.getByTestId("review-national-orientation")).toHaveCount(
      0
    );
    expect(profileMethods.filter((method) => method === "PUT")).toStrictEqual(
      []
    );

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText(
      /The map is ready\.|The map could not start\. Choose a state from the list\.|The map could not load\. Choose a state from the list\./
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: `/opt/cursor/artifacts/review-national-1440-${testInfo.project.name}.png`,
    });
  });

  test("keeps the state list usable when boundaries fail", async ({ page }) => {
    await installReviewApi(page, {
      body: { detail: "geometry unavailable" },
      status: 500,
    });
    await page.goto("/app/review?scope=ALL");
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText(
      "State boundaries are unavailable. Choose a state from the list."
    );
    await page.getByTestId("review-state-search").fill("New York");
    await page.getByRole("button", { name: "NY, New York" }).click();
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
  });

  test("keeps the state list usable without WebGL", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const prototype = HTMLCanvasElement.prototype;
      const original = prototype.getContext;
      prototype.getContext = function getContext(
        this: HTMLCanvasElement,
        contextId: string
      ) {
        if (
          contextId === "webgl" ||
          contextId === "webgl2" ||
          contextId === "experimental-webgl"
        ) {
          return null;
        }
        return original.call(this, contextId);
      } as typeof prototype.getContext;
    });
    await installReviewApi(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/app/review?scope=ALL");
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText("The map could not start. Choose a state from the list.");
    await expect(page.locator(".ux-reset-review-state-grid")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: `/opt/cursor/artifacts/review-national-390-no-webgl-${testInfo.project.name}.png`,
    });
    const search = page.getByTestId("review-state-search");
    await search.fill("Colorado");
    await search.press("Enter");
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
  });

  test("fits the national map at tablet width", async ({ page }, testInfo) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1024, width: 768 });
    await page.goto("/app/review?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page.locator(".ux-reset-review-state-grid")).toHaveCount(0);
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText(
      /The map is ready\.|The map could not start\. Choose a state from the list\.|The map could not load\. Choose a state from the list\./
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: `/opt/cursor/artifacts/review-national-768-${testInfo.project.name}.png`,
    });
  });
});
