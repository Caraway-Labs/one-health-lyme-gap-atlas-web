import { expect, test, type Page } from "@playwright/test";

import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import baldwin from "../fixtures/review-al-v11-01003.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";

/**
 * Local Alabama fixtures only. Limestone County 01083 is the Baldwin record
 * with its identity rewritten so the preview card can render. ATLAS_E2E
 * bypasses sign-in. Measurements assume browser zoom 100% and
 * devicePixelRatio 1. They are not authenticated production values.
 */
const RELEASE_ID = baldwin.release.release_id;
const COUNTY_FIPS = "01083";
const REVIEW_PATH = `/explore?scope=AL&dataset=${RELEASE_ID}&layer=tick_status&county=${COUNTY_FIPS}`;
const EDGE_TOLERANCE_PX = 1;
/** Same key as `RESET_PRO_SIDEBAR_STORAGE_KEY` in the professional shell. */
const SIDEBAR_STORAGE_KEY = "ux-reset-pro-sidebar";
/** 4.25rem compact shell at a 16px root. */
const COLLAPSED_SIDEBAR_PX = 68;
/** 16rem shell at a 16px root. */
const EXPANDED_SIDEBAR_PX = 256;
/** Desktop three-column tracks: county nav, map, selected county. */
const THREE_COLUMN_SHARES = [0.18, 0.52, 0.3] as const;
/** 20rem two-column preview cap below the 1200px breakpoint. */
const TWO_COLUMN_PREVIEW_CAP_PX = 320;

type SidebarState = "collapsed" | "expanded";

type WidthCase = {
  height: number;
  kind: "three-column" | "two-column";
  label: string;
  sidebar: SidebarState;
  width: number;
};

const WIDTH_CASES: readonly WidthCase[] = [
  {
    height: 800,
    kind: "three-column",
    label: "1280-collapsed",
    sidebar: "collapsed",
    width: 1280,
  },
  {
    height: 900,
    kind: "three-column",
    label: "1440-collapsed",
    sidebar: "collapsed",
    width: 1440,
  },
  {
    height: 896,
    kind: "three-column",
    label: "1673-collapsed",
    sidebar: "collapsed",
    width: 1673,
  },
  {
    height: 1080,
    kind: "three-column",
    label: "1920-collapsed",
    sidebar: "collapsed",
    width: 1920,
  },
  {
    height: 1080,
    kind: "three-column",
    label: "1920-expanded",
    sidebar: "expanded",
    width: 1920,
  },
  {
    height: 727,
    kind: "two-column",
    label: "1164-two-column",
    sidebar: "collapsed",
    width: 1164,
  },
];

type ExplorerLayout = {
  alignItems: string;
  browseRight: number;
  candidateOverflow: string;
  canvasHeight: number;
  browseWidth: number;
  contentRight: number;
  contentWidth: number;
  devicePixelRatio: number;
  display: string;
  documentOverflow: number;
  flexDirection: string;
  gridTemplateColumns: string;
  innerWidth: number;
  listBottom: number;
  listRight: number;
  listTop: number;
  listWidth: number;
  mainOverflow: number;
  mapBottom: number;
  mapTop: number;
  mapWidth: number;
  previewLeft: number;
  previewRight: number;
  previewTop: number;
  previewWidth: number;
  resultWidth: number;
  rootFontSize: number;
  sidebarState: string | null;
  sidebarWidth: number;
  tracks: number[];
  zoom: number;
};

function limestoneDetail(): Record<string, unknown> {
  return {
    ...baldwin,
    county: "Limestone County",
    fips: COUNTY_FIPS,
  };
}

async function installLimestoneReview(page: Page): Promise<void> {
  await page.route("**/v1/me/profile", (route) =>
    route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
    })
  );
  await page.route("**/v1/atlas/metadata**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      RELEASE_ID;
    return route.fulfill({
      json: { ...baldwin.release, release_id: dataset },
    });
  });
  await page.route("**/v1/atlas/scores**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      RELEASE_ID;
    return route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        counties: identities.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          ...entry,
          state_name: entry.stateName,
        })),
        release_id: dataset,
      },
    });
  });
  await page.route("**/v1/states/*/review**", (route) => {
    const url = new URL(route.request().url());
    const state = url.pathname.split("/").at(-2) ?? "AL";
    const review = buildStateReview({ resultState: "unsupported", state });
    review.data_release_version =
      url.searchParams.get("dataset_version") ?? RELEASE_ID;
    review.coverage.assessed_counties = 67;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: {
        features: identities.map((entry, index) => {
          const west = -88 + (index % 8) * 0.4;
          const south = 30 + Math.floor(index / 8) * 0.4;
          return {
            geometry: {
              coordinates: [
                [
                  [west, south],
                  [west + 0.3, south],
                  [west + 0.3, south + 0.3],
                  [west, south + 0.3],
                  [west, south],
                ],
              ],
              type: "Polygon",
            },
            properties: { fips: entry.fips },
            type: "Feature",
          };
        }),
        type: "FeatureCollection",
      },
    })
  );
  await page.route("**/v1/counties/*", (route) => {
    const fips = new URL(route.request().url()).pathname.split("/").at(-1);
    return fips === COUNTY_FIPS
      ? route.fulfill({ json: limestoneDetail() })
      : route.fulfill({ json: { detail: "No published record" }, status: 404 });
  });
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({
      json: { detail: "Catalog unavailable in this fixture" },
      status: 503,
    })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ json: { detail: "No matching priority" }, status: 404 })
  );
}

function sidebarStorageValue(state: SidebarState): "false" | "true" {
  return state === "expanded" ? "true" : "false";
}

function sidebarToggleName(
  state: SidebarState
): "Hide navigation" | "Show navigation" {
  return state === "collapsed" ? "Hide navigation" : "Show navigation";
}

async function writeSidebarPreference(
  page: Page,
  state: SidebarState
): Promise<void> {
  const stored = sidebarStorageValue(state);
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [SIDEBAR_STORAGE_KEY, stored] as const
  );
}

async function settleSidebar(page: Page, state: SidebarState): Promise<void> {
  const sidebar = page.locator("#ux-reset-pro-navigation");
  const targetWidth =
    state === "collapsed" ? COLLAPSED_SIDEBAR_PX : EXPANDED_SIDEBAR_PX;
  // The trigger always toggles. Storage hydration also sets the state once,
  // after the first paint. A single click sampled while the sidebar is still
  // expanded can land after that read and open it again, then the preference
  // effect saves "true". Each attempt writes the supported preference and
  // clicks only while the named control for this state is still present.
  await expect(async () => {
    await writeSidebarPreference(page, state);
    if ((await sidebar.getAttribute("data-state")) !== state) {
      await page
        .getByRole("button", { exact: true, name: sidebarToggleName(state) })
        .click({ timeout: 1_000 });
    }
    await expect(sidebar).toHaveAttribute("data-state", state, {
      timeout: 1_000,
    });
    expect(Math.round((await sidebar.boundingBox())?.width ?? 0)).toBe(
      targetWidth
    );
  }).toPass({
    intervals: [50, 100, 250, 500],
    timeout: 15_000,
  });
}

async function readExplorerLayout(page: Page): Promise<ExplorerLayout> {
  return page.evaluate(() => {
    const requireElement = (selector: string): HTMLElement => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing ${selector}`);
      }
      return element;
    };
    const main = requireElement("main.ux-reset-pro-main");
    const operating = requireElement(".ux-reset-review-operating");
    const browse = requireElement(
      ".ux-reset-review-operating .ux-reset-explorer-browse"
    );
    const preview = requireElement(
      ".ux-reset-review-operating .ux-reset-explorer-preview"
    );
    const list = requireElement(
      ".ux-reset-review-operating .ux-reset-explorer-list"
    );
    const map = requireElement(
      ".ux-reset-review-operating .ux-reset-explorer-map"
    );
    const result = requireElement(
      ".ux-reset-review-operating .ux-reset-review-result"
    );
    const sidebar = requireElement("#ux-reset-pro-navigation");
    const mainStyle = getComputedStyle(main);
    const operatingStyle = getComputedStyle(operating);
    const mainRect = main.getBoundingClientRect();
    const browseRect = browse.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(mainStyle.paddingLeft);
    const paddingRight = Number.parseFloat(mainStyle.paddingRight);
    const contentLeft = mainRect.left + main.clientLeft + paddingLeft;
    const contentRight =
      mainRect.left + main.clientLeft + main.clientWidth - paddingRight;
    const canvas = map.querySelector(".map-wrap");
    const candidates = list.querySelector(".ux-reset-review-candidate-list");
    return {
      alignItems: operatingStyle.alignItems,
      browseRight: browseRect.right,
      candidateOverflow: candidates
        ? getComputedStyle(candidates).overflowY
        : "",
      canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
      browseWidth: browseRect.width,
      contentRight,
      contentWidth: contentRight - contentLeft,
      devicePixelRatio: window.devicePixelRatio,
      display: operatingStyle.display,
      documentOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
      flexDirection: operatingStyle.flexDirection,
      gridTemplateColumns: operatingStyle.gridTemplateColumns,
      innerWidth: window.innerWidth,
      listBottom: listRect.bottom,
      listRight: listRect.right,
      listTop: listRect.top,
      listWidth: listRect.width,
      mainOverflow: main.scrollWidth - main.clientWidth,
      mapBottom: mapRect.bottom,
      mapTop: mapRect.top,
      mapWidth: mapRect.width,
      previewLeft: previewRect.left,
      previewRight: previewRect.right,
      previewTop: previewRect.top,
      previewWidth: previewRect.width,
      resultWidth: result.getBoundingClientRect().width,
      rootFontSize: Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize
      ),
      sidebarState: sidebar.getAttribute("data-state"),
      sidebarWidth: sidebar.getBoundingClientRect().width,
      tracks: getComputedStyle(browse)
        .gridTemplateColumns.split(/\s+/)
        .map((part) => Number.parseFloat(part)),
      zoom: window.visualViewport?.scale ?? 1,
    };
  });
}

function expectNear(
  actual: number,
  expected: number,
  tolerance = EDGE_TOLERANCE_PX
): void {
  expect(
    Math.abs(actual - expected),
    `expected ${actual} within ${tolerance}px of ${expected}`
  ).toBeLessThanOrEqual(tolerance);
}

function expectNoOverflow(layout: ExplorerLayout): void {
  expect(layout.documentOverflow).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(layout.mainOverflow).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

function expectStretchContext(
  layout: ExplorerLayout,
  sidebar: SidebarState
): void {
  const sidebarWidth =
    sidebar === "collapsed" ? COLLAPSED_SIDEBAR_PX : EXPANDED_SIDEBAR_PX;
  expect(layout.devicePixelRatio).toBe(1);
  expect(layout.zoom).toBe(1);
  expect(layout.rootFontSize).toBe(16);
  expect(layout.sidebarState).toBe(sidebar);
  expectNear(layout.sidebarWidth, sidebarWidth);
  expect(layout.display).toBe("flex");
  expect(layout.flexDirection).toBe("column");
  expect(layout.alignItems).toBe("stretch");
  expect(layout.gridTemplateColumns).toBe("none");
  expectNear(layout.previewRight, layout.contentRight);
  expectNear(layout.browseRight, layout.contentRight);
  expectNear(layout.browseWidth, layout.contentWidth);
  expectNear(layout.resultWidth, layout.browseWidth);
  expectNoOverflow(layout);
}

function trackAt(tracks: readonly number[], index: number): number {
  const value = tracks[index];
  if (value === undefined || Number.isNaN(value)) {
    throw new Error(`Missing grid track ${index}`);
  }
  return value;
}

function expectThreeColumn(layout: ExplorerLayout): void {
  expect(layout.tracks).toHaveLength(3);
  const trackSum = layout.tracks.reduce((sum, track) => sum + track, 0);
  expectNear(trackAt(layout.tracks, 0), trackSum * THREE_COLUMN_SHARES[0], 2);
  expectNear(trackAt(layout.tracks, 1), trackSum * THREE_COLUMN_SHARES[1], 2);
  expectNear(trackAt(layout.tracks, 2), trackSum * THREE_COLUMN_SHARES[2], 2);
  expect(layout.previewWidth).toBeGreaterThan(layout.listWidth);
  expect(layout.listBottom).toBeLessThanOrEqual(
    layout.mapBottom + EDGE_TOLERANCE_PX
  );
  expectNear(layout.canvasHeight, 32 * layout.rootFontSize);
  expect(layout.candidateOverflow).toBe("auto");
}

function expectTwoColumn(layout: ExplorerLayout): void {
  expect(layout.tracks).toHaveLength(2);
  expectNear(layout.previewWidth, TWO_COLUMN_PREVIEW_CAP_PX);
  expectNear(trackAt(layout.tracks, 1), TWO_COLUMN_PREVIEW_CAP_PX);
  expectNear(layout.mapWidth, layout.browseWidth);
  expect(layout.mapBottom).toBeLessThanOrEqual(
    layout.listTop + EDGE_TOLERANCE_PX
  );
  expect(layout.mapTop).toBeLessThan(layout.previewTop);
  expectNear(layout.previewTop, layout.listTop);
  expect(layout.previewLeft).toBeGreaterThan(layout.listRight);
}

function layoutNamed(
  layouts: ReadonlyMap<string, ExplorerLayout>,
  label: string
): ExplorerLayout {
  const layout = layouts.get(label);
  if (!layout) {
    throw new Error(`Missing layout measurement for ${label}`);
  }
  return layout;
}

function expectMapGrew(
  narrower: ExplorerLayout,
  wider: ExplorerLayout,
  viewportGrowth: number
): void {
  expect(wider.mapWidth).toBeGreaterThan(narrower.mapWidth);
  const browseGrowth = wider.browseWidth - narrower.browseWidth;
  expectNear(browseGrowth, viewportGrowth, 4);
  expectNear(
    wider.mapWidth - narrower.mapWidth,
    browseGrowth * THREE_COLUMN_SHARES[1],
    4
  );
  expect(wider.previewWidth).toBeGreaterThan(wider.listWidth);
  expect(narrower.previewWidth).toBeGreaterThan(narrower.listWidth);
}

test("desktop browse grid fills the main content edge", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop widths only. No mobile coverage."
  );
  test.setTimeout(90_000);
  testInfo.annotations.push({
    description:
      "Local fixtures, county 01083, ATLAS_E2E shell, zoom 100%, devicePixelRatio 1. Not production.",
    type: "fixture",
  });
  await installLimestoneReview(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "false");
  }, SIDEBAR_STORAGE_KEY);
  await page.setViewportSize({ height: 800, width: 1280 });
  await page.goto(REVIEW_PATH);
  await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
    "data-result-state",
    "unsupported"
  );
  await expect(
    page.getByTestId("review-published-county-preview")
  ).toHaveAttribute("data-fips", COUNTY_FIPS);
  await expect(
    page.getByTestId("review-published-county-preview")
  ).toContainText("Limestone County");

  const layouts = new Map<string, ExplorerLayout>();
  for (const widthCase of WIDTH_CASES) {
    await test.step(widthCase.label, async () => {
      await page.setViewportSize({
        height: widthCase.height,
        width: widthCase.width,
      });
      await settleSidebar(page, widthCase.sidebar);
      const layout = await readExplorerLayout(page);
      layouts.set(widthCase.label, layout);
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`${widthCase.label}.png`),
      });
    });
  }

  await testInfo.attach("explorer-widths.json", {
    body: JSON.stringify(Object.fromEntries(layouts), null, 2),
    contentType: "application/json",
  });

  for (const widthCase of WIDTH_CASES) {
    const layout = layoutNamed(layouts, widthCase.label);
    expect(layout.innerWidth).toBe(widthCase.width);
    expectStretchContext(layout, widthCase.sidebar);
    if (widthCase.kind === "three-column") {
      expectThreeColumn(layout);
      continue;
    }
    if (widthCase.kind === "two-column") {
      expectTwoColumn(layout);
      continue;
    }
    const unreachable: never = widthCase.kind;
    throw new Error(`Unhandled width case ${unreachable}`);
  }

  expectMapGrew(
    layoutNamed(layouts, "1673-collapsed"),
    layoutNamed(layouts, "1920-collapsed"),
    1920 - 1673
  );
});
