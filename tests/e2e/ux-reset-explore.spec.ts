import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  EXPLORE_CASES_MEASURE_ID,
  EXPLORE_PRECIPITATION_MEASURE_ID,
  EXPLORE_TICK_MEASURE_ID,
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsEnvelope,
  exploreScoresFixture,
} from "../fixtures/explore-api-fixtures";

type ExploreRouteControls = {
  delayMeasureId: string | null;
  failGeometry: boolean;
  failMeasureId: string | null;
};

async function installExploreApiMocks(
  page: Page,
  controls: ExploreRouteControls,
  delayedRequest: Promise<void>
) {
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: exploreMetadataFixture, status: 200 });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({ json: exploreMeasuresEnvelope, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: exploreScoresFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    if (controls.failGeometry) {
      await route.fulfill({
        json: { detail: "display geometry unavailable" },
        status: 500,
      });
      return;
    }
    await route.fulfill({ json: exploreGeometryFixture, status: 200 });
  });
  await page.route("**/v1/observations**", async (route) => {
    const measureId = new URL(route.request().url()).searchParams.get(
      "measure_id"
    );
    if (measureId && measureId === controls.failMeasureId) {
      await route.fulfill({
        json: { detail: "observations unavailable" },
        status: 500,
      });
      return;
    }
    if (measureId && measureId === controls.delayMeasureId) {
      await delayedRequest;
    }
    await route.fulfill({
      json: exploreObservationsEnvelope(
        measureId ?? EXPLORE_PRECIPITATION_MEASURE_ID
      ),
      status: 200,
    });
  });
}

async function expectMeasureAgreement(
  page: Page,
  expected: { measureId: string; period: string; unit: string; value: string }
) {
  const layer = page.getByTestId("explore-layer-identity");
  const legend = page.getByTestId("explore-map-legend");
  const evidence = page.getByTestId("explore-selected-evidence");
  const adams = page.getByTestId("explore-county-row").filter({
    has: page.getByRole("button", { name: "Adams" }),
  });
  await expect(layer).toHaveAttribute("data-measure-id", expected.measureId);
  await expect(layer).toHaveAttribute("data-unit", expected.unit);
  await expect(layer).toHaveAttribute("data-period", expected.period);
  await expect(legend).toHaveAttribute("data-measure-id", expected.measureId);
  await expect(legend).toHaveAttribute("data-unit", expected.unit);
  await expect(legend).toHaveAttribute("data-period", expected.period);
  await expect(evidence).toContainText(expected.value);
  await expect(evidence).toContainText(expected.period);
  await expect(adams).toHaveAttribute("data-measure-id", expected.measureId);
  await expect(adams).toHaveAttribute("data-unit", expected.unit);
  await expect(adams).toHaveAttribute("data-period", expected.period);
  await expect(page.getByTestId("explore-map-region")).toHaveAttribute(
    "data-measure-id",
    expected.measureId
  );
}

test.describe("Explore spatial workspace", () => {
  test("switches measures and keeps legend, evidence, and the table in agreement", async ({
    page,
  }, testInfo) => {
    const controls: ExploreRouteControls = {
      delayMeasureId: EXPLORE_CASES_MEASURE_ID,
      failGeometry: false,
      failMeasureId: null,
    };
    let releaseDelayed = () => {};
    const delayedRequest = new Promise<void>((resolve) => {
      releaseDelayed = resolve;
    });
    await installExploreApiMocks(page, controls, delayedRequest);
    await page.goto("/app/explore?scope=CO&county=08001");
    await expectMeasureAgreement(page, {
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      period: "January 1, 2025 (daily)",
      unit: "mm",
      value: "4.5 mm",
    });
    const countyNames = await page
      .getByTestId("explore-county-row")
      .locator("button")
      .allTextContents();
    expect(countyNames).toEqual(["Adams", "Boulder"]);

    await page.getByTestId("explore-measure-select").click();
    await page.getByRole("option", { name: "Reported Lyme cases" }).click();
    await expect(page.getByTestId("explore-request-status")).toContainText(
      "Reported Lyme cases"
    );
    await expect(page.getByTestId("explore-layer-identity")).toHaveAttribute(
      "data-measure-id",
      EXPLORE_PRECIPITATION_MEASURE_ID
    );
    await expect(page.getByTestId("explore-map-legend")).toHaveAttribute(
      "data-unit",
      "mm"
    );

    releaseDelayed();
    await expectMeasureAgreement(page, {
      measureId: EXPLORE_CASES_MEASURE_ID,
      period: "2023",
      unit: "cases",
      value: "2 cases",
    });

    controls.failMeasureId = EXPLORE_TICK_MEASURE_ID;
    controls.delayMeasureId = null;
    await page.getByTestId("explore-measure-select").click();
    await page.getByRole("option", { name: "Tick abundance" }).click();
    await expect(page.getByTestId("explore-request-status")).toContainText(
      "could not be loaded"
    );
    await expectMeasureAgreement(page, {
      measureId: EXPLORE_CASES_MEASURE_ID,
      period: "2023",
      unit: "cases",
      value: "2 cases",
    });

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-map")
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("keeps evidence and Investigate/Compare usable without a map when geometry fails", async ({
    page,
  }) => {
    const controls: ExploreRouteControls = {
      delayMeasureId: null,
      failGeometry: true,
      failMeasureId: null,
    };
    await installExploreApiMocks(page, controls, Promise.resolve());
    await page.goto("/app/explore?scope=CO&county=08001");
    await expect(page.getByTestId("explore-map-fallback")).toBeVisible();
    await expectMeasureAgreement(page, {
      measureId: EXPLORE_PRECIPITATION_MEASURE_ID,
      period: "January 1, 2025 (daily)",
      unit: "mm",
      value: "4.5 mm",
    });
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

    const adams = page.getByRole("button", { name: "Adams" });
    await adams.focus();
    await expect(adams).toBeFocused();
    await page.keyboard.press("Enter");

    const investigate = page.getByTestId("explore-investigate");
    await investigate.focus();
    await expect(investigate).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);
    expect(new URL(page.url()).searchParams.get("metric")).toBeNull();

    await page.goBack();
    await expect(page.getByTestId("explore-map-fallback")).toBeVisible();
    const compare = page.getByTestId("explore-compare");
    await compare.focus();
    await expect(compare).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/compare/);
  });

  test("keeps the same actions available when WebGL cannot start", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (String(type).includes("webgl")) {
          return null;
        }
        return original.call(this, type as never, ...(args as never[]));
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    const controls: ExploreRouteControls = {
      delayMeasureId: null,
      failGeometry: false,
      failMeasureId: null,
    };
    await installExploreApiMocks(page, controls, Promise.resolve());
    await page.goto("/app/explore?scope=CO&county=08001");
    await expect(page.getByTestId("explore-map-fallback")).toBeVisible();
    await expect(page.getByTestId("explore-selected-evidence")).toContainText(
      "4.5 mm"
    );
    const investigate = page.getByTestId("explore-investigate");
    await investigate.focus();
    await expect(investigate).toBeFocused();
    const compare = page.getByTestId("explore-compare");
    await compare.focus();
    await expect(compare).toBeFocused();
  });
});
