import { expect, test, type Page } from "@playwright/test";

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
    box("08001", -109.05, 37, -102.05, 41),
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
  },
  metadata: typeof reviewScopeMetadataFixture = reviewScopeMetadataFixture
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
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      metadata.release_id;
    await route.fulfill({
      json: { ...metadata, release_id: releaseId },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      metadata.release_id;
    await route.fulfill({
      json: {
        ...stateReviewResponseForUrl(route.request().url()),
        data_release_version: releaseId,
      },
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

async function chooseState(page: Page, name: string) {
  await page.getByTestId("review-scope-select").click();
  await page.getByRole("option", { name }).click();
}

test.describe("Review national geographic navigation", () => {
  test("shows national county values, zoom, and a bounded county column", async ({
    page,
  }) => {
    const profileMethods = await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    const national = page.getByTestId("review-national-orientation");
    await expect(national).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Atlas gap score" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "published score colors"
    );
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "No published value"
    );
    await expect(page.getByTestId("explorer-fit-national")).toBeVisible();
    await expect(page.getByLabel("Zoom in")).toBeVisible();
    await expect(page.getByLabel("Zoom out")).toBeVisible();
    await expect(page.getByText(/49 of 49 states/)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "State orientation" })
    ).toHaveCount(0);
    const mapBox = await page.locator(".ux-reset-explorer-map").boundingBox();
    const listBox = await page.locator(".ux-reset-explorer-list").boundingBox();
    expect(mapBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    if (mapBox && listBox) {
      expect(Math.abs(listBox.y - mapBox.y)).toBeLessThan(8);
      expect(listBox.y + listBox.height).toBeLessThanOrEqual(
        mapBox.y + mapBox.height + 8
      );
    }
    await expectNoHorizontalOverflow(page);
    expect(profileMethods.filter((method) => method === "PUT")).toStrictEqual(
      []
    );
  });

  test("browses a state and selects a county without leaving the United States", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await page.getByTestId("national-browse-state").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await page.getByRole("button", { name: /Denver, CO/ }).click();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Denver");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).not.toHaveURL(/county=08001/);
  });

  test("keeps a selected-county deep link on the national map", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1673 });
    await page.goto("/explore?scope=ALL&county=08001&dataset=alpha-2026");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Denver");
    await expect(page.getByTestId("explorer-fit-national")).toBeVisible();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).toHaveURL(/county=08001/);
  });

  test("switches between national and state scope without losing history", async ({
    page,
  }) => {
    const profileMethods = await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await chooseState(page, "Colorado (CO)");
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(page.getByLabel("Zoom in")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fit Colorado" })
    ).toBeVisible();
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    expect(profileMethods.filter((method) => method === "PUT")).toStrictEqual(
      []
    );
    await expectNoHorizontalOverflow(page);
  });

  test("keeps county browsing usable when the map cannot load", async ({
    page,
  }) => {
    await installReviewApi(page, {
      body: { detail: "geometry unavailable" },
      status: 500,
    });
    await page.setViewportSize({ height: 1000, width: 1280 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-map-region")).toContainText(
      "temporarily unavailable"
    );
    await page.getByTestId("national-browse-state").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await page.getByRole("button", { name: /Albany, NY/ }).click();
    await expect(page).toHaveURL(/county=36001/);
    await expect(page).toHaveURL(/scope=ALL/);
  });

  test("keeps county browsing usable without WebGL", async ({ page }) => {
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
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-map-region")).toContainText(
      "temporarily unavailable"
    );
    await page.getByTestId("national-browse-state").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(
      page.getByRole("button", { name: /Denver, CO/ })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("switches the national layer without dropping the county", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1920 });
    await page.goto("/explore?scope=ALL&county=08013");
    await expect(
      page.getByRole("heading", { name: "Atlas gap score" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "No published value"
    );
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "County boundaries" }).click();
    await expect(page).toHaveURL(/layer=boundaries/);
    await expect(page).toHaveURL(/county=08013/);
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "County boundaries"
    );
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
  });
});
