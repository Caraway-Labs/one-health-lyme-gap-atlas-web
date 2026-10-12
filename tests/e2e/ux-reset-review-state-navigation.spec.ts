import { expect, test, type Page } from "@playwright/test";

import {
  reviewNationalCameraContains,
  type ReviewNationalCamera,
} from "../../src/features/ux-reset/review/review-national-camera";
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
    await route.fulfill({ json: metadata, status: 200 });
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

const coastalNavigationGeometry = {
  features: [
    box("06037", -124.4, 32.5, -114.1, 42),
    box("36001", -79.8, 40.5, -71.8, 45.1),
    box("11001", -77.6, 38.3, -76.4, 39.3),
  ],
  type: "FeatureCollection" as const,
};

const coastalRelease = {
  ...reviewScopeMetadataFixture,
  states: [
    { code: "CA", name: "California" },
    { code: "DC", name: "District of Columbia" },
    { code: "NY", name: "New York" },
  ],
};

const coastalPlaces = [
  {
    code: "CA",
    label: "CA, California",
    latitude: 37,
    longitude: -120,
  },
  {
    code: "NY",
    label: "NY, New York",
    latitude: 43,
    longitude: -75,
  },
  {
    code: "DC",
    label: "DC, District of Columbia",
    latitude: 38.8,
    longitude: -77,
  },
] as const;

async function readNationalCamera(page: Page) {
  return page
    .getByTestId("review-state-navigation-map-canvas")
    .evaluate((element) => ({
      height: element.clientHeight,
      latitude: Number(element.dataset.reviewCameraLat),
      longitude: Number(element.dataset.reviewCameraLng),
      width: element.clientWidth,
      zoom: Number(element.dataset.reviewCameraZoom),
    }));
}

function cameraFromReading(reading: {
  latitude: number;
  longitude: number;
  zoom: number;
}): ReviewNationalCamera {
  return {
    center: [reading.longitude, reading.latitude],
    zoom: reading.zoom,
  };
}

function coastalPlacesAreFramed(reading: {
  height: number;
  latitude: number;
  longitude: number;
  width: number;
  zoom: number;
}) {
  const camera = cameraFromReading(reading);
  return Object.fromEntries(
    coastalPlaces.map((place) => [
      place.code,
      reviewNationalCameraContains(
        camera,
        reading.width,
        reading.height,
        place.longitude,
        place.latitude
      ),
    ])
  );
}

async function clickMappedState(
  page: Page,
  code: string,
  longitude: number,
  latitude: number
) {
  const canvas = page.getByTestId("review-state-navigation-map-canvas");
  const point = await canvas.evaluate(
    (element, place) => {
      const map = Reflect.get(element, "reviewNavigationMap") as
        | {
            project: (lngLat: [number, number]) => { x: number; y: number };
            queryRenderedFeatures: (
              geometry: [number, number],
              options: { layers: string[] }
            ) => { properties?: { code?: unknown } }[];
          }
        | undefined;
      if (!map) {
        return null;
      }
      const projected = map.project([place.longitude, place.latitude]);
      const rendered = (x: number, y: number) =>
        map
          .queryRenderedFeatures([x, y], { layers: ["review-states-fill"] })
          .some((feature) => feature.properties?.code === place.code);
      if (rendered(projected.x, projected.y)) {
        return { x: projected.x, y: projected.y };
      }
      for (let y = 4; y < element.clientHeight; y += 6) {
        for (let x = 4; x < element.clientWidth; x += 6) {
          if (rendered(x, y)) {
            return { x, y };
          }
        }
      }
      return null;
    },
    { code, latitude, longitude }
  );
  if (!point) {
    throw new Error(`No rendered ${code} feature is available to click.`);
  }
  await canvas.locator("canvas").click({
    position: { x: point.x, y: point.y },
  });
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

  test("frames coastal states on a wide map, refits when narrowed, and opens them from the map", async ({
    page,
  }, testInfo) => {
    await installReviewApi(
      page,
      { body: coastalNavigationGeometry, status: 200 },
      coastalRelease
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/app/review?scope=ALL");
    await expect(
      page.getByTestId("review-state-navigation-status")
    ).toContainText("The map is ready.");
    for (const place of coastalPlaces) {
      await expect(
        page.getByRole("button", { name: place.label })
      ).toBeEnabled();
    }
    const wide = await readNationalCamera(page);
    expect(coastalPlacesAreFramed(wide)).toStrictEqual({
      CA: true,
      DC: true,
      NY: true,
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect
      .poll(async () => (await readNationalCamera(page)).zoom)
      .toBeLessThan(wide.zoom);
    const narrow = await readNationalCamera(page);
    expect(coastalPlacesAreFramed(narrow)).toStrictEqual({
      CA: true,
      DC: true,
      NY: true,
    });
    await page.screenshot({
      fullPage: true,
      path: `/opt/cursor/artifacts/review-national-390-webgl-${testInfo.project.name}.png`,
    });
    for (const place of coastalPlaces) {
      await clickMappedState(page, place.code, place.longitude, place.latitude);
      await expect(page).toHaveURL(new RegExp(`scope=${place.code}`));
      await expect(page.getByTestId("review-national-orientation")).toHaveCount(
        0
      );
      await expect(page.getByTestId("review-scope-status")).toContainText(
        place.label.split(", ")[1] ?? place.code
      );
      if (place.code !== "DC") {
        await page.goBack({ waitUntil: "commit" });
        await expect(page).toHaveURL(/scope=ALL/);
        await expect(
          page.getByTestId("review-state-navigation-status")
        ).toContainText("The map is ready.");
      }
    }
  });

  test("announces the focused state as keyboard focus moves on the map and in the list", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/app/review?scope=ALL");
    const live = page.getByTestId("review-state-navigation-live");
    await expect(live).toContainText(
      "Map status: The map is ready. Focused state: none."
    );
    const map = page.getByTestId("review-state-navigation-map");
    await map.focus();
    await map.press("ArrowRight");
    await expect(live).toContainText(
      "Focused state: Colorado (CO), available."
    );
    await map.press("ArrowRight");
    await expect(live).toContainText(
      "Focused state: New York (NY), available."
    );
    const colorado = page.getByRole("button", { name: "CO, Colorado" });
    await colorado.focus();
    await expect(live).toContainText(
      "Focused state: Colorado (CO), available."
    );
    await colorado.press("ArrowDown");
    await expect(live).toContainText(
      "Focused state: New York (NY), available."
    );
    await expect(
      page.getByRole("button", { name: "DC, not in this release" })
    ).toBeDisabled();
    await expect(page).toHaveURL(/scope=ALL/);
  });

  test("starts at the last state when reversing and clears focus after leaving the map", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/app/review?scope=ALL");
    const live = page.getByTestId("review-state-navigation-live");
    const status = page.getByTestId("review-state-navigation-status");
    await expect(live).toContainText("The map is ready.");
    const map = page.getByTestId("review-state-navigation-map");
    await map.focus();
    await map.press("ArrowLeft");
    await expect(live).toContainText(
      "Focused state: New York (NY), available."
    );
    await expect(status).toContainText("Focused state: New York (NY).");
    await map.press("Home");
    await expect(status).toContainText("Focused state: Colorado (CO).");
    await map.press("End");
    await expect(status).toContainText("Focused state: New York (NY).");
    await map.press("Escape");
    await expect(live).toContainText("Focused state: none.");
    await map.press("ArrowRight");
    await expect(status).toContainText("Focused state: Colorado (CO).");
    await page.getByTestId("review-state-search").focus();
    await expect(status).toContainText("Focused state: none.");
    await expect(live).toContainText("Focused state: none.");
    await map.focus();
    await map.press("ArrowUp");
    await expect(live).toContainText(
      "Focused state: New York (NY), available."
    );
    await expect(page).toHaveURL(/scope=ALL/);
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
