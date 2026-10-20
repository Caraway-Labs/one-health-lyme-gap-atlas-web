import { expect, test, type Page } from "@playwright/test";

import { reviewNationalCameraPoint } from "../../src/features/ux-reset/review/review-national-camera";
import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

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

const ada = box("16001", -117, 42.6, -114.4, 44);
const valley = box("16085", -117.2, 44.2, -111, 48.9);
const teton = box("56039", -116.5, 45, -112, 47.5);

const drillGeometry = {
  features: [ada, valley, teton],
  type: "FeatureCollection" as const,
};

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 75,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

function scoredCounty(input: {
  county: string;
  fips: string;
  score: number;
  state: string;
  stateName: string;
}) {
  return {
    burgdorferi_status: "observed",
    color: "#1d4e89",
    county: input.county,
    evidence_completeness: 50,
    fips: input.fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: { ...scoreBreakdown, score: input.score },
    state: input.state,
    state_name: input.stateName,
    tick_status: "observed",
  };
}

const drillScores = {
  ...reviewScopeScoresFixture,
  counties: [
    ...reviewScopeScoresFixture.counties,
    scoredCounty({
      county: "Ada",
      fips: "16001",
      score: 82,
      state: "ID",
      stateName: "Idaho",
    }),
    scoredCounty({
      county: "Valley",
      fips: "16085",
      score: 40,
      state: "ID",
      stateName: "Idaho",
    }),
    scoredCounty({
      county: "Teton",
      fips: "56039",
      score: 55,
      state: "WY",
      stateName: "Wyoming",
    }),
  ],
};

const drillMetadata = {
  ...reviewScopeMetadataFixture,
  states: [
    ...reviewScopeMetadataFixture.states,
    { code: "ID", name: "Idaho" },
    { code: "WY", name: "Wyoming" },
  ],
};

async function installDrillApi(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      drillMetadata.release_id;
    await route.fulfill({
      json: { ...drillMetadata, release_id: releaseId },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      drillScores.release_id;
    await route.fulfill({
      json: { ...drillScores, release_id: releaseId },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const releaseId =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      drillMetadata.release_id;
    await route.fulfill({
      json: {
        ...stateReviewResponseForUrl(route.request().url()),
        data_release_version: releaseId,
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({ json: drillGeometry, status: 200 });
  });
}

type CameraReading = {
  frame: string | null;
  height: number;
  lat: number;
  lng: number;
  outline: string | null;
  stage: string | null;
  width: number;
  zoom: number;
};

async function readCamera(page: Page): Promise<CameraReading> {
  return page.locator(".maplibre-atlas").evaluate((element) => {
    const region = element.closest(
      "[data-testid='review-national-map-region']"
    );
    return {
      frame: element.getAttribute("data-camera-frame"),
      height: element.clientHeight,
      lat: Number(element.dataset.mapCameraLat),
      lng: Number(element.dataset.mapCameraLng),
      outline: element.getAttribute("data-state-outline"),
      stage: region?.getAttribute("data-map-stage") ?? null,
      width: element.clientWidth,
      zoom: Number(element.dataset.mapCameraZoom),
    };
  });
}

async function projectedCountyPoint(
  page: Page,
  longitude: number,
  latitude: number
) {
  const map = page.locator(".maplibre-atlas");
  let previousZoom = Number.NaN;
  const readPoint = async () => {
    const box = await map.boundingBox();
    const camera = await readCamera(page);
    const zoomSettled = Math.abs(camera.zoom - previousZoom) < 0.01;
    previousZoom = camera.zoom;
    if (!zoomSettled || !box || !(camera.width > 0) || !(camera.height > 0)) {
      return null;
    }
    const projected = reviewNationalCameraPoint(
      { center: [camera.lng, camera.lat], zoom: camera.zoom },
      camera.width,
      camera.height,
      longitude,
      latitude
    );
    if (
      !projected ||
      projected.x < 8 ||
      projected.y < 8 ||
      projected.x > camera.width - 8 ||
      projected.y > camera.height - 8
    ) {
      return null;
    }
    return { x: box.x + projected.x, y: box.y + projected.y };
  };
  await expect.poll(readPoint).not.toBeNull();
  const point = await readPoint();
  if (!point) {
    throw new Error("expected the county to be inside the map");
  }
  return point;
}

async function settledCamera(
  page: Page,
  stage: CameraReading["stage"],
  movedFrom?: number
) {
  let previousZoom = Number.NaN;
  let sawMovement = movedFrom === undefined;
  let settled: CameraReading | null = null;
  await expect
    .poll(async () => {
      const camera = await readCamera(page);
      if (movedFrom !== undefined && Math.abs(camera.zoom - movedFrom) > 0.3) {
        sawMovement = true;
      }
      const stable =
        sawMovement &&
        camera.stage === stage &&
        Number.isFinite(camera.zoom) &&
        Math.abs(camera.zoom - previousZoom) < 0.01;
      previousZoom = camera.zoom;
      settled = stable ? camera : null;
      return stable;
    })
    .toBe(true);
  return settled ?? (await readCamera(page));
}

async function clickCounty(page: Page, longitude: number, latitude: number) {
  let point = await projectedCountyPoint(page, longitude, latitude);
  const viewport = page.viewportSize();
  const outsideViewport =
    viewport !== null &&
    (point.x < 8 ||
      point.y < 8 ||
      point.x > viewport.width - 8 ||
      point.y > viewport.height - 8);
  if (outsideViewport) {
    await page.locator(".maplibre-atlas").evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "center" });
    });
    point = await projectedCountyPoint(page, longitude, latitude);
  }
  await page.mouse.click(point.x, point.y);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Explorer two-stage map drill", () => {
  test("goes from the United States to Idaho to Ada County and back", async ({
    page,
  }) => {
    await installDrillApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    const national = await readCamera(page);
    expect(national.stage).toBe("national");
    expect(national.outline).toBe("accent");
    expect(page.url()).not.toContain("focus=");
    expect(page.url()).not.toContain("county=");

    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    await expect(page).toHaveURL(/scope=ALL/);
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        return {
          closer: camera.zoom > national.zoom + 0.4,
          frame: camera.frame,
          outline: camera.outline,
          stage: camera.stage,
        };
      })
      .toEqual({
        closer: true,
        frame: "ID",
        outline: "black",
        stage: "state",
      });
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    const idaho = await readCamera(page);

    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/county=16001/);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    await expect(page.getByRole("button", { name: /Ada, ID/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    let ada = await readCamera(page);
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        const stable =
          camera.stage === "county" &&
          camera.zoom > idaho.zoom + 0.4 &&
          Math.abs(camera.lat - ada.lat) < 0.01 &&
          Math.abs(camera.lng - ada.lng) < 0.01;
        ada = camera;
        return stable;
      })
      .toBe(true);

    await page.getByTestId("explorer-fit-national").click();
    await expect(page).not.toHaveURL(/focus=/);
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        return {
          outline: camera.outline,
          stage: camera.stage,
          zoom: Math.abs(camera.zoom - national.zoom) < 0.05,
        };
      })
      .toEqual({ outline: "accent", stage: "national", zoom: true });

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=16001/);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        return {
          closerThanState: camera.zoom > idaho.zoom + 0.4,
          lat: Math.abs(camera.lat - ada.lat) < 0.35,
          lng: Math.abs(camera.lng - ada.lng) < 0.35,
          stage: camera.stage,
        };
      })
      .toEqual({
        closerThanState: true,
        lat: true,
        lng: true,
        stage: "county",
      });
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    await expect.poll(async () => (await readCamera(page)).stage).toBe("state");
    await page.goBack({ waitUntil: "commit" });
    await expect(page).not.toHaveURL(/focus=/);
    await expect
      .poll(async () => (await readCamera(page)).stage)
      .toBe("national");
    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    await expectNoHorizontalOverflow(page);
  });

  test("refocuses a different state and keeps list selection direct", async ({
    page,
  }) => {
    await installDrillApi(page);
    await page.setViewportSize({ height: 1000, width: 1280 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/focus=ID/);
    await clickCounty(page, -114.25, 46.25);
    await expect(page).toHaveURL(/focus=WY/);
    await expect(page).not.toHaveURL(/county=/);
    await expect.poll(async () => (await readCamera(page)).frame).toBe("WY");
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();

    await page.getByTestId("explorer-fit-national").click();
    await expect(page).not.toHaveURL(/focus=/);
    const beforeList = await readCamera(page);
    await page.getByRole("button", { name: /Ada, ID/ }).click();
    await expect(page).toHaveURL(/county=16001/);
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(page).not.toHaveURL(/focus=/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        return (
          camera.stage === "national" && camera.zoom > beforeList.zoom + 0.3
        );
      })
      .toBe(true);
    await page.goBack({ waitUntil: "commit" });
    await expect(page).not.toHaveURL(/county=/);

    await page.goto("/explore?scope=ALL&county=16001");
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    await expect(page).not.toHaveURL(/focus=/);
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();

    await page.goto("/explore?scope=ALL&focus=ID");
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    const reloadedState = await settledCamera(page, "state");
    await page.goto("/explore?scope=ALL&focus=ID&county=16001");
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    const reloadedCounty = await settledCamera(page, "county");
    expect(reloadedCounty.zoom).toBeGreaterThan(reloadedState.zoom + 0.4);
    expect(reloadedCounty.lat).toBeLessThan(reloadedState.lat - 0.4);

    await page.getByTestId("explorer-fit-national").click();
    await expect(page).not.toHaveURL(/focus=/);
    await expect(page).toHaveURL(/county=16001/);
    const nationalAgain = await settledCamera(page, "national");
    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    const idahoAgain = await settledCamera(page, "state", nationalAgain.zoom);
    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/county=16001/);
    await expect
      .poll(async () => {
        const camera = await readCamera(page);
        return camera.stage === "county" && camera.zoom > idahoAgain.zoom + 0.4;
      })
      .toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test("drills Idaho on a phone without horizontal scroll", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Explorer map drill runs on the mobile project."
    );
    await installDrillApi(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    await expect
      .poll(async () => (await readCamera(page)).outline)
      .toBe("black");
    await clickCounty(page, -115.7, 43.3);
    await expect(page).toHaveURL(/county=16001/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toContainText("Ada");
    await page.getByTestId("explorer-fit-national").click();
    await expect(page).not.toHaveURL(/focus=/);
    await expect
      .poll(async () => (await readCamera(page)).stage)
      .toBe("national");
    await expectNoHorizontalOverflow(page);
  });

  test("a double-click focuses the state and does not select the county", async ({
    page,
  }) => {
    await installDrillApi(page);
    await page.setViewportSize({ height: 1000, width: 1280 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("explorer-fit-national")).toBeVisible();
    const map = page.locator(".maplibre-atlas");
    await expect(map).toHaveAttribute("data-double-click-zoom", "false");
    const point = await projectedCountyPoint(page, -115.7, 43.3);
    await page.mouse.dblclick(point.x, point.y);
    await expect(page).toHaveURL(/focus=ID/);
    await expect(page).not.toHaveURL(/county=/);
    await expect.poll(async () => (await readCamera(page)).stage).toBe("state");
  });
});
