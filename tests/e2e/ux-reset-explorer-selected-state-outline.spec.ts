import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { populationRuralityObservation } from "../fixtures/population-rurality-context";
import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
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
const valley = box("16085", -116.8, 44, -114, 45.2);
const denver = box("08001", -105.1, 39.6, -104.6, 39.9);
const teton = box("56039", -111, 43.5, -110.4, 44.1);

const outlineGeometry = {
  features: [ada, valley, denver, teton],
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
  tickStatus: string;
}) {
  return {
    burgdorferi_status: "Present",
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
    tick_status: input.tickStatus,
  };
}

const outlineScores = {
  ...reviewScopeScoresFixture,
  counties: [
    ...reviewScopeScoresFixture.counties,
    scoredCounty({
      county: "Ada",
      fips: "16001",
      score: 82,
      state: "ID",
      stateName: "Idaho",
      tickStatus: "Established",
    }),
    scoredCounty({
      county: "Valley",
      fips: "16085",
      score: 40,
      state: "ID",
      stateName: "Idaho",
      tickStatus: "Reported",
    }),
    scoredCounty({
      county: "Teton",
      fips: "56039",
      score: 55,
      state: "WY",
      stateName: "Wyoming",
      tickStatus: "No records",
    }),
  ],
};

const outlineMetadata = {
  ...reviewScopeMetadataFixture,
  states: [
    ...reviewScopeMetadataFixture.states,
    { code: "ID", name: "Idaho" },
    { code: "WY", name: "Wyoming" },
  ],
};

async function installOutlineApi(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/v1/atlas/metadata")) {
      const releaseId =
        new URL(url).searchParams.get("dataset_version") ??
        outlineMetadata.release_id;
      await route.fulfill({
        json: { ...outlineMetadata, release_id: releaseId },
        status: 200,
      });
      return;
    }
    if (url.includes("/v1/atlas/scores")) {
      const releaseId =
        new URL(url).searchParams.get("dataset_version") ??
        outlineScores.release_id;
      await route.fulfill({
        json: { ...outlineScores, release_id: releaseId },
        status: 200,
      });
      return;
    }
    if (url.includes("/v1/atlas/geometry")) {
      await route.fulfill({ json: outlineGeometry, status: 200 });
      return;
    }
    if (url.includes("/v1/states/") && url.includes("/review")) {
      const releaseId =
        new URL(url).searchParams.get("dataset_version") ??
        outlineMetadata.release_id;
      await route.fulfill({
        json: {
          ...stateReviewResponseForUrl(url),
          data_release_version: releaseId,
        },
        status: 200,
      });
      return;
    }
    if (url.includes("/v1/observations")) {
      const request = new URL(url);
      const measureId = request.searchParams.get("measure_id");
      const fips = request.searchParams.getAll("geography_id");
      const rows =
        measureId === "uninsured_percent_2022"
          ? fips.map((id) =>
              populationRuralityObservation({
                fips: id,
                measureId: "uninsured_percent_2022",
                value: "12.5",
              })
            )
          : [];
      await route.fulfill({
        json: {
          data: rows,
          links: { self: "/v1/observations" },
          meta: { next_page_token: null },
        },
        status: 200,
      });
      return;
    }
    await route.fulfill({ json: {}, status: 404 });
  });
  await fulfillCompletedStartingView(page);
}

type OutlineReading = {
  attribute: string | null;
  colors: Record<string, string>;
  fill: unknown;
  lineColor: unknown;
  lineWidth: unknown;
  selected: string[];
  selectedCountyColor: unknown;
  selectedCountyWidth: unknown;
  stage: string | null;
};

async function readOutline(page: Page): Promise<OutlineReading> {
  return page.locator(".maplibre-atlas").evaluate((element) => {
    const map = Reflect.get(element, "atlasCountyMap") as
      | {
          getPaintProperty: (layer: string, name: string) => unknown;
          querySourceFeatures: (
            source: string
          ) => Array<{ properties?: Record<string, unknown> }>;
        }
      | undefined;
    if (!map) {
      return {
        attribute: element.getAttribute("data-state-outline"),
        colors: {},
        fill: null,
        lineColor: null,
        lineWidth: null,
        selected: [],
        selectedCountyColor: null,
        selectedCountyWidth: null,
        stage:
          element
            .closest("[data-testid='review-national-map-region']")
            ?.getAttribute("data-map-stage") ?? null,
      };
    }
    const features = map.querySourceFeatures("counties");
    const colors: Record<string, string> = {};
    for (const feature of features) {
      const fips = feature.properties?.fips;
      const color = feature.properties?.color;
      if (typeof fips === "string" && typeof color === "string") {
        colors[fips] = color;
      }
    }
    const selected = [
      ...new Set(
        features
          .filter((feature) => feature.properties?.selectedState === true)
          .map((feature) => feature.properties?.fips)
          .filter((fips): fips is string => typeof fips === "string")
      ),
    ].sort();
    return {
      attribute: element.getAttribute("data-state-outline"),
      colors,
      fill: map.getPaintProperty("counties-fill", "fill-color"),
      lineColor: map.getPaintProperty("selected-state-outline", "line-color"),
      lineWidth: map.getPaintProperty("selected-state-outline", "line-width"),
      selected,
      selectedCountyColor: map.getPaintProperty(
        "selected-outline",
        "line-color"
      ),
      selectedCountyWidth: map.getPaintProperty(
        "selected-outline",
        "line-width"
      ),
      stage:
        element
          .closest("[data-testid='review-national-map-region']")
          ?.getAttribute("data-map-stage") ?? null,
    };
  });
}

async function chooseLayer(page: Page, name: string) {
  await page.getByTestId("explorer-map-layer").click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function fitUnitedStates(page: Page) {
  await page.getByTestId("explorer-fit-national").click();
  await expect
    .poll(async () => (await readOutline(page)).stage)
    .toBe("national");
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function chooseScope(page: Page, name: string) {
  await page.getByTestId("review-scope-select").click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function nudgeStateCamera(page: Page) {
  await page.locator(".maplibre-atlas").evaluate((element) => {
    const map = Reflect.get(element, "atlasCountyMap") as
      | {
          panBy: (offset: [number, number]) => void;
          zoomIn: (delta?: number) => void;
        }
      | undefined;
    map?.panBy([48, -24]);
    map?.zoomIn(0.6);
  });
}

test.describe("State-scoped Explorer boundaries", () => {
  test("keeps black state and county boundaries across layers, scope changes, and history", async ({
    page,
  }) => {
    await installOutlineApi(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=ID");
    await expect(page.getByTestId("review-state-map-region")).toBeVisible();
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          lineWidth: outline.lineWidth,
          selected: outline.selected,
        };
      })
      .toEqual({
        lineColor: "#000000",
        lineWidth: 2.5,
        selected: ["16001", "16085"],
      });
    const idaho = await readOutline(page);
    expect(idaho.selected).not.toContain("08001");
    expect(idaho.selectedCountyColor).toBe("#000000");
    expect(idaho.selectedCountyWidth).toBe(5);

    await page.getByRole("button", { name: /Ada, ID/ }).click();
    await expect(page).toHaveURL(/county=16001/);
    await expect
      .poll(async () => (await readOutline(page)).lineColor)
      .toBe("#000000");
    expect((await readOutline(page)).selectedCountyColor).toBe("#000000");
    expect((await readOutline(page)).selectedCountyWidth).toBe(5);

    await nudgeStateCamera(page);
    await expect
      .poll(async () => (await readOutline(page)).selectedCountyWidth)
      .toBe(5);
    expect((await readOutline(page)).selectedCountyColor).toBe("#000000");
    expect((await readOutline(page)).lineColor).toBe("#000000");

    await chooseLayer(page, "Uninsured population");
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "percent"
    );
    await expect
      .poll(async () => (await readOutline(page)).colors["16001"])
      .not.toBe(idaho.colors["16001"]);
    const uninsured = await readOutline(page);
    expect(uninsured.lineColor).toBe("#000000");
    expect(uninsured.lineWidth).toBe(2.5);
    expect(JSON.stringify(uninsured.fill)).not.toContain("#000000");

    for (const layerName of [
      "Blacklegged tick status",
      "Borrelia burgdorferi status",
      "Evidence completeness",
      "Gap review score",
    ]) {
      await chooseLayer(page, layerName);
      await expect
        .poll(async () => (await readOutline(page)).lineColor)
        .toBe("#000000");
    }
    await chooseScope(page, "Colorado (CO)");
    await expect(page).toHaveURL(/scope=CO/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["08001"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");
    expect((await readOutline(page)).selected).not.toContain("16001");

    await chooseScope(page, "Idaho (ID)");
    await expect(page).toHaveURL(/scope=ID/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["16001", "16085"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");

    await page.reload();
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          selected: outline.selected,
        };
      })
      .toEqual({
        lineColor: "#000000",
        selected: ["16001", "16085"],
      });

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=CO/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["08001"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");
    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/scope=ID/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["16001", "16085"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");

    await chooseScope(page, "United States");
    await expect(page).toHaveURL(/scope=ALL/);
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          selected: outline.selected,
          stage: outline.stage,
        };
      })
      .toEqual({
        lineColor: "#0b7285",
        selected: [],
        stage: "national",
      });
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("US view outline reset", () => {
  test("drops a zoomed-out state outline without flashing teal", async ({
    page,
  }) => {
    await installOutlineApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL&focus=ID");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["16001", "16085"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");
    expect((await readOutline(page)).attribute).toBe("black");

    await page.locator(".maplibre-atlas").evaluate((element) => {
      const map = Reflect.get(element, "atlasCountyMap") as {
        getPaintProperty: (layer: string, name: string) => unknown;
        jumpTo: (camera: { center: [number, number]; zoom: number }) => void;
        on: (event: string, handler: () => void) => void;
      };
      map.jumpTo({ center: [-115.7, 43.3], zoom: 2.2 });
      const colors: unknown[] = [];
      map.on("render", () => {
        colors.push(
          map.getPaintProperty("selected-state-outline", "line-color")
        );
      });
      Reflect.set(element, "outlineColorFrames", colors);
    });
    const canvas = page.locator(".maplibre-atlas canvas");
    await canvas.hover({ position: { x: 420, y: 280 } });
    await page
      .getByRole("button", { name: "US view" })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
      });
    await expect(page).not.toHaveURL(/focus=/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual([]);
    await expect
      .poll(async () => (await readOutline(page)).stage)
      .toBe("national");

    const frames = await page.locator(".maplibre-atlas").evaluate((element) => {
      const map = Reflect.get(element, "atlasCountyMap") as {
        getFilter: (layer: string) => unknown;
        getPaintProperty: (layer: string, name: string) => unknown;
      };
      return {
        colors: Reflect.get(element, "outlineColorFrames") as unknown[],
        filter: map.getFilter("selected-state-outline"),
        lineColor: map.getPaintProperty("selected-state-outline", "line-color"),
      };
    });
    expect(frames.colors.length).toBeGreaterThan(0);
    expect(frames.colors).not.toContain("#0b7285");
    expect(frames.lineColor).toBe("#000000");
    expect(frames.filter).toEqual([
      "==",
      ["literal", true],
      ["literal", false],
    ]);
    expect((await readOutline(page)).attribute).toBe("accent");
  });
});

test.describe("Selected state outlines at U.S. zoom", () => {
  test("keeps black state and county strokes across layers, state changes, and history", async ({
    page,
  }, testInfo) => {
    await installOutlineApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect
      .poll(async () => (await readOutline(page)).lineColor)
      .toBe("#0b7285");
    const untouched = await readOutline(page);
    expect(untouched.selected).toEqual([]);
    expect(untouched.attribute).toBe("accent");
    expect(untouched.stage).toBe("national");

    await page.getByRole("button", { name: /Ada, ID/ }).click();
    await expect(page).toHaveURL(/county=16001/);
    await expect(page).not.toHaveURL(/focus=/);
    await fitUnitedStates(page);
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          attribute: outline.attribute,
          lineColor: outline.lineColor,
          lineWidth: outline.lineWidth,
          selected: outline.selected,
          stage: outline.stage,
        };
      })
      .toEqual({
        attribute: "accent",
        lineColor: "#000000",
        lineWidth: 2.5,
        selected: ["16001", "16085"],
        stage: "national",
      });
    const idaho = await readOutline(page);
    expect(idaho.selectedCountyColor).toBe("#000000");
    expect(idaho.selectedCountyWidth).toBe(5);
    expect(idaho.selected).not.toContain("08001");
    expect(idaho.selected).not.toContain("56039");

    await chooseLayer(page, "Uninsured population");
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "percent"
    );
    await expect
      .poll(async () => (await readOutline(page)).colors["16001"])
      .not.toBe(idaho.colors["16001"]);
    const uninsured = await readOutline(page);
    expect(uninsured.lineWidth).toBe(2.5);
    expect(uninsured.fill).toEqual(idaho.fill);
    expect(uninsured.colors["16001"]).not.toBe(idaho.colors["16001"]);
    expect(JSON.stringify(uninsured.fill)).not.toContain("#000000");
    await page
      .locator(".ux-reset-explorer-map")
      .first()
      .screenshot({
        path: testInfo.outputPath("selected-state-uninsured-desktop.png"),
      });

    await chooseLayer(page, "Blacklegged tick status");
    await expect(page.getByTestId("explorer-map-legend")).toHaveAttribute(
      "data-legend-layer",
      "tick_status"
    );
    await expect
      .poll(async () => (await readOutline(page)).colors["16001"])
      .not.toBe(uninsured.colors["16001"]);
    const tick = await readOutline(page);
    expect(tick.lineColor).toBe("#000000");
    expect(tick.lineWidth).toBe(2.5);
    expect(tick.selected).toEqual(["16001", "16085"]);
    expect(tick.colors["16001"]).not.toBe(uninsured.colors["16001"]);
    for (const layerName of [
      "Borrelia burgdorferi status",
      "Evidence completeness",
      "Gap review score",
    ]) {
      await chooseLayer(page, layerName);
      await expect
        .poll(async () => (await readOutline(page)).lineColor)
        .toBe("#000000");
    }
    expect((await readOutline(page)).lineWidth).toBe(2.5);
    await page
      .locator(".ux-reset-explorer-map")
      .first()
      .screenshot({
        path: testInfo.outputPath("selected-state-tick-desktop.png"),
      });

    await page.getByRole("button", { name: /Denver, CO/ }).click();
    await expect(page).toHaveURL(/county=08001/);
    await fitUnitedStates(page);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["08001"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");

    await page.getByRole("button", { name: /Ada, ID/ }).click();
    await expect(page).toHaveURL(/county=16001/);
    await fitUnitedStates(page);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["16001", "16085"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=08001/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["08001"]);
    expect((await readOutline(page)).lineColor).toBe("#000000");
    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/county=16001/);
    await expect
      .poll(async () => (await readOutline(page)).selected)
      .toEqual(["16001", "16085"]);

    await page.getByTestId("explorer-county-clear").click();
    await expect(page).not.toHaveURL(/county=/);
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          selected: outline.selected,
          stage: outline.stage,
        };
      })
      .toEqual({
        lineColor: "#000000",
        selected: [],
        stage: "national",
      });

    const axe = await new AxeBuilder({ page })
      .include(".ux-reset-explorer-map-heading")
      .include(".ux-reset-explorer-map-layer")
      .analyze();
    expect(axe.violations).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });

  test("keeps the black outline legible at a tablet width", async ({
    page,
  }) => {
    await installOutlineApi(page);
    await page.setViewportSize({ height: 900, width: 768 });
    await page.goto("/explore?scope=ALL&county=16001");
    await expect(page.getByRole("button", { name: /Ada, ID/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    await fitUnitedStates(page);
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          lineWidth: outline.lineWidth,
          selected: outline.selected,
          stage: outline.stage,
        };
      })
      .toEqual({
        lineColor: "#000000",
        lineWidth: 2.5,
        selected: ["16001", "16085"],
        stage: "national",
      });
    await expectNoHorizontalOverflow(page);
  });

  test("keeps the black outline legible on a phone width", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width selected-state outlines run on the mobile project."
    );
    await installOutlineApi(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/explore?scope=ALL&county=16001");
    await expect(page.getByRole("button", { name: /Ada, ID/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    await fitUnitedStates(page);
    await chooseLayer(page, "Uninsured population");
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "percent"
    );
    await expect
      .poll(async () => {
        const outline = await readOutline(page);
        return {
          lineColor: outline.lineColor,
          lineWidth: outline.lineWidth,
          selected: outline.selected,
          stage: outline.stage,
        };
      })
      .toEqual({
        lineColor: "#000000",
        lineWidth: 2.5,
        selected: ["16001", "16085"],
        stage: "national",
      });
    await expectNoHorizontalOverflow(page);
    await page
      .locator(".ux-reset-explorer-map")
      .first()
      .screenshot({
        path: testInfo.outputPath("selected-state-uninsured-phone.png"),
      });
  });
});
