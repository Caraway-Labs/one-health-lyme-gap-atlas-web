import { expect, test, type Page } from "@playwright/test";

import {
  ASK_ATLAS_PAGE_REFERENCE_PARAM,
  readAskAtlasPageReference,
} from "@/features/ux-reset/ask-atlas/page-reference";

import {
  LOWER_48_DC_CAMERA_BOUNDS,
  reviewNationalCameraContains,
  reviewNationalNavigationCamera,
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
      json: { profile: { starting_view_version: 1, state_code: "CO" } },
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

function publishedAskHandoff(href: string | null) {
  const url = new URL(href ?? "", "http://127.0.0.1");
  const state = readAskAtlasPageReference(url.pathname, url.searchParams);
  const geography =
    state.kind === "validated"
      ? state.reference.context.fields.geography
      : null;
  const returnHref = state.kind === "validated" ? state.returnHref : "";
  return {
    county: url.searchParams.get("county"),
    geography: geography?.state === "validated" ? geography.id : null,
    pageRef: url.searchParams.get(ASK_ATLAS_PAGE_REFERENCE_PARAM) !== null,
    returnCounty: new URL(returnHref, "http://127.0.0.1").searchParams.get(
      "county"
    ),
  };
}

function dedicatedAskAtlasLink(page: Page) {
  return page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Ask Atlas" });
}

async function expectPublishedNationalCounty(page: Page, fips: string) {
  const expected = {
    county: fips,
    geography: fips,
    pageRef: true,
    returnCounty: fips,
  };
  await expect(
    page.getByTestId("review-published-county-preview")
  ).toHaveAttribute("data-fips", fips);
  await expect
    .poll(async () =>
      publishedAskHandoff(
        await dedicatedAskAtlasLink(page).getAttribute("href")
      )
    )
    .toEqual(expected);
  await expect(
    page.locator(".ux-reset-pro-app .app-header").getByRole("link", {
      name: "Ask Atlas",
    })
  ).toHaveCount(0);
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

type NationalCameraReading = {
  height: number;
  lat: number;
  lng: number;
  width: number;
  zoom: number;
};

async function readNationalCamera(page: Page): Promise<NationalCameraReading> {
  return page.locator(".maplibre-atlas").evaluate((element) => ({
    height: element.clientHeight,
    lat: Number(element.dataset.mapCameraLat),
    lng: Number(element.dataset.mapCameraLng),
    width: element.clientWidth,
    zoom: Number(element.dataset.mapCameraZoom),
  }));
}

function nationalExtentReport(reading: NationalCameraReading) {
  const view = {
    center: [reading.lng, reading.lat] as [number, number],
    zoom: reading.zoom,
  };
  const contains = (longitude: number, latitude: number) =>
    reviewNationalCameraContains(
      view,
      reading.width,
      reading.height,
      longitude,
      latitude
    );
  const fitted = reviewNationalNavigationCamera(reading.width, reading.height);
  return {
    california: contains(-124.2, 37),
    dc: contains(-77.0369, 38.9072),
    east: contains(LOWER_48_DC_CAMERA_BOUNDS.east, 39),
    fitted:
      fitted !== null &&
      Math.abs(reading.zoom - fitted.zoom) < 0.02 &&
      Math.abs(reading.lng - fitted.center[0]) < 0.02 &&
      Math.abs(reading.lat - fitted.center[1]) < 0.02,
    north: contains(-98, LOWER_48_DC_CAMERA_BOUNDS.north),
    ny: contains(-74, 43),
    south: contains(-98, LOWER_48_DC_CAMERA_BOUNDS.south),
    west: contains(LOWER_48_DC_CAMERA_BOUNDS.west, 39),
  };
}

const VISIBLE_NATIONAL_EXTENTS = {
  california: true,
  dc: true,
  east: true,
  fitted: true,
  north: true,
  ny: true,
  south: true,
  west: true,
};

async function expectNationalExtentsVisible(page: Page) {
  await expect
    .poll(async () => nationalExtentReport(await readNationalCamera(page)))
    .toStrictEqual(VISIBLE_NATIONAL_EXTENTS);
}

async function waitForStableZoom(page: Page) {
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const zoom = (await readNationalCamera(page)).zoom;
      const stable = Math.abs(zoom - previous) < 0.01;
      previous = zoom;
      return stable;
    })
    .toBe(true);
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
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await page.getByRole("button", { name: "About Atlas gap score" }).click();
    await expect(
      page.getByRole("dialog", { name: "About Atlas gap score" })
    ).toContainText("published score colors");
    await page.keyboard.press("Escape");
    await expect(
      page
        .getByTestId("explorer-map-legend")
        .getByRole("button", { name: /Gap score unavailable/ })
    ).toBeVisible();
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

  test("selects a county from the national list without a local state filter", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1100, width: 1637 });
    await page.goto("/explore?scope=ALL");
    const list = page.locator(".ux-reset-explorer-list");
    await expect(list.getByRole("heading").first()).toHaveText(
      "Choose a county"
    );
    await expect(page.getByTestId("national-browse-state")).toHaveCount(0);
    await expect(page.getByText("Browse a state")).toHaveCount(0);
    await expect(list.locator(".ux-reset-ranked-counties-eyebrow")).toHaveCount(
      0
    );
    await expect(page.getByTestId("review-scope-select")).toHaveCount(1);
    // Measured before WEB #709 at this width: the first row sat 163px below
    // the county card. The page-level State filter is the only state control.
    const firstRowOffset = await list.evaluate((card) => {
      const row = card.querySelector(
        "[data-testid='national-published-county']"
      );
      if (!row) {
        return null;
      }
      return row.getBoundingClientRect().y - card.getBoundingClientRect().y;
    });
    expect(firstRowOffset).not.toBeNull();
    expect(firstRowOffset ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      163 - 70
    );
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

  test("restores the explicit national county on Back and Forward", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await page.getByRole("button", { name: /Denver, CO/ }).click();
    await expect(page).toHaveURL(/county=08001/);
    await expectPublishedNationalCounty(page, "08001");
    await page.getByRole("button", { name: /Boulder, CO/ }).click();
    await expect(page).toHaveURL(/county=08013/);
    await expectPublishedNationalCounty(page, "08013");
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).not.toHaveURL(/county=08013/);
    await expectPublishedNationalCounty(page, "08001");
    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=08013/);
    await expectPublishedNationalCounty(page, "08013");
  });

  test("restores the explicit national county when Explorer remounts", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await page.getByRole("button", { name: /Denver, CO/ }).click();
    await expect(page).toHaveURL(/county=08001/);
    await expectPublishedNationalCounty(page, "08001");
    await page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Settings" })
      .click();
    await expect(
      page.getByTestId("settings-default-jurisdiction")
    ).toBeVisible();
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expectPublishedNationalCounty(page, "08001");
  });

  test("keeps the explicit national county when the map layer changes", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await page.getByRole("button", { name: /Denver, CO/ }).click();
    await expect(page).toHaveURL(/county=08001/);
    await expectPublishedNationalCounty(page, "08001");
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "County boundaries" }).click();
    await expect(page).toHaveURL(/layer=boundaries/);
    await expect(page).toHaveURL(/county=08001/);
    await page.goBack({ waitUntil: "commit" });
    await expect(page).not.toHaveURL(/layer=boundaries/);
    await expectPublishedNationalCounty(page, "08001");
    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/layer=boundaries/);
    await expect(page).toHaveURL(/county=08001/);
    await expectPublishedNationalCounty(page, "08001");
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
      page.getByRole("button", { name: "Fit CO (Colorado)" })
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
    await expect(
      page.getByRole("button", { name: /Denver, CO/ })
    ).toBeVisible();
    await expect(page.getByTestId("national-browse-state")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("switches the national layer without dropping the county", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1920 });
    await page.goto("/explore?scope=ALL&county=08013");
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(
      page
        .getByTestId("explorer-map-legend")
        .getByRole("button", { name: /Gap score unavailable/ })
    ).toBeVisible();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "County boundaries" }).click();
    await expect(page).toHaveURL(/layer=boundaries/);
    await expect(page).toHaveURL(/county=08013/);
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "County boundaries"
    );
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect
      .poll(async () => {
        const handoff = publishedAskHandoff(
          await dedicatedAskAtlasLink(page).getAttribute("href")
        );
        return {
          county: handoff.county,
          geography: handoff.geography,
          returnCounty: handoff.returnCounty,
        };
      })
      .toEqual({
        county: null,
        geography: null,
        returnCounty: null,
      });
  });

  test("fits California, DC, New York, and the country extents at desktop widths", async ({
    page,
  }) => {
    await installReviewApi(page);
    await page.setViewportSize({ height: 1000, width: 1920 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("explorer-fit-national")).toBeVisible();
    await expect(page.getByLabel("Zoom in")).toBeVisible();
    for (const width of [1280, 1440, 1673, 1920]) {
      await page.setViewportSize({ height: 1000, width });
      await page.getByTestId("explorer-fit-national").click();
      await expectNationalExtentsVisible(page);
    }
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.getByTestId("explorer-fit-national").click();
    await expectNationalExtentsVisible(page);
    const overview = await readNationalCamera(page);
    await page.getByLabel("Zoom in").click();
    await waitForStableZoom(page);
    const zoomed = await readNationalCamera(page);
    expect(zoomed.zoom).toBeGreaterThan(overview.zoom + 0.4);
    await page.setViewportSize({ height: 1000, width: 1280 });
    await waitForStableZoom(page);
    const afterResize = await readNationalCamera(page);
    expect(afterResize.zoom).toBeGreaterThan(overview.zoom + 0.4);
    await page.getByTestId("explorer-fit-national").click();
    await expectNationalExtentsVisible(page);
    await page.setViewportSize({ height: 1000, width: 1920 });
    await expectNationalExtentsVisible(page);
  });
});
