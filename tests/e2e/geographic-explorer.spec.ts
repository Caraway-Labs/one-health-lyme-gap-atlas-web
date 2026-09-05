import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const metadata = {
  release_id: "alpha-explorer",
  schema_version: "0.2.0",
  generated_at: "2026-08-06T00:00:00Z",
  loaded_at: "2026-08-15T00:00:00Z",
  scope: "United States counties",
  bundle_sha256: "a".repeat(64),
  methodology_version: "alpha-0.2.0",
  limitations: "Not individual risk.",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      url: "https://cdc.gov",
      vintage: "2023",
      note: "Published floor.",
    },
  ],
  states: [
    { code: "CO", name: "Colorado" },
    { code: "CA", name: "California" },
  ],
};
const counties = Array.from({ length: 24 }, (_, index) => ({
  fips: `08${String(index * 2 + 1).padStart(3, "0")}`,
  county: index === 0 ? "Adams" : `County ${index}`,
  state: "CO",
  state_name: "Colorado",
  in_contiguous_tick_scope: true,
  human_status: "no_county_linked_record",
  tick_status: "Established",
  burgdorferi_status: "Present",
  evidence_completeness: Math.round(((index % 7) / 6) * 100),
  score: {
    score: 90 - index,
    human_weakness: 75,
    ecological: 90,
    community: 50,
    tick_signal: 100,
    pathogen_signal: 100,
    svi_signal: 50,
    access_signal: 50,
    rural_signal: 50,
  },
  priority: "Priority 2 — Review",
  color: "#efc64a",
}));
counties.push({
  ...counties[0],
  fips: "06037",
  county: "Los Angeles",
  state: "CA",
  state_name: "California",
  evidence_completeness: 100,
});

async function mockApi(page: Page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("dataset_version") === "old-release")
      return route.fulfill({
        status: 404,
        json: { detail: "Release unavailable" },
      });
    if (url.pathname.endsWith("/metadata"))
      return route.fulfill({ json: metadata });
    if (url.pathname.endsWith("/scores"))
      return route.fulfill({
        json: {
          release_id: metadata.release_id,
          methodology_version: metadata.methodology_version,
          settings: {},
          counties,
        },
      });
    if (url.pathname.endsWith("/geometry"))
      return route.fulfill({
        json: {
          type: "FeatureCollection",
          features: counties.map((county, index) => ({
            type: "Feature",
            properties: { fips: county.fips },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-105 + index / 10, 39],
                  [-104.95 + index / 10, 39],
                  [-104.95 + index / 10, 39.05],
                  [-105 + index / 10, 39.05],
                  [-105 + index / 10, 39],
                ],
              ],
            },
          })),
        },
      });
    return route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
}
test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("Variants navigation opens geographic explorer; grids link to accessible county results", async ({
  page,
}, testInfo) => {
  await page.goto("/variant_7");
  await page.getByRole("button", { name: "Variants", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Geographic explorer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Geographic explorer", exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL(/dataset=alpha-explorer/);
  await page.screenshot({
    path: testInfo.outputPath("geographic-tiles.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "CO: 24 matching counties" }).click();
  await expect(page).toHaveURL(/state=CO/);
  await expect(page.getByRole("table")).toContainText("Adams");
  await expect(page.getByRole("table")).not.toContainText("Los Angeles");
  await page
    .getByRole("button", { name: "Small multiples", exact: true })
    .click();
  await expect(
    page.getByText(/All panels use the same horizontal/)
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Evidence matrix", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText(
    "No county-linked record"
  );
  await page.getByRole("button", { name: "Next counties" }).click();
  await expect(page.getByRole("table")).toContainText("County 23");
  await page.getByLabel("County name or FIPS code").fill("Adams");
  await expect(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("08001");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("ranking and comparison persist exact county values across reload and filtering", async ({
  page,
}) => {
  await page.goto("/variant_7?view=ranking&county=08001");
  await expect(
    page.getByRole("heading", { name: "Ranked dot plot" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to comparison", exact: true })
    .click();
  await page
    .getByRole("table")
    .getByRole("button", { name: /Los Angeles/ })
    .click();
  await page
    .getByRole("button", { name: "Add to comparison", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View comparison", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Adams, CO", exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Adams" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Los Angeles" })
  ).toBeVisible();
  await page.getByLabel("County name or FIPS code").fill("no-such-county");
  await expect(page.getByText(/No counties match these filters/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Adams" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Adams" }).click();
  await expect(page.getByRole("button", { name: "Remove Adams" })).toHaveCount(
    0
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("maps render and scatter keyboard selection links to county profile", async ({
  page,
}) => {
  await page.goto("/variant_7?view=maps&county=08001");
  await expect(
    page.getByText("Maps ready. Pan and zoom are synchronized.")
  ).toBeVisible();
  await expect(page.locator(".geo-map-canvas canvas")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Map + scatterplot", exact: true })
    .click();
  const point = page.getByRole("button", {
    name: "Select Adams, CO: 0%, score 90",
    exact: true,
  });
  await point.focus();
  await point.press("Enter");
  await expect(
    page.getByRole("complementary", { name: "Selected county" })
  ).toContainText("Adams, CO");
  await expect(page).toHaveURL(/county=08001/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("release mismatch is explicit and unavailable history never becomes a fabricated trend", async ({
  page,
}) => {
  await page.goto("/variant_7?dataset=old-release");
  await expect(
    page.getByRole("heading", {
      name: "Geographic explorer is temporarily unavailable",
    })
  ).toBeVisible();
  await expect(page).toHaveURL(/dataset=old-release/);
  await page.getByRole("button", { name: "Use current release" }).click();
  await page
    .getByRole("button", { name: "Release trends", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Comparable release history is not available yet",
    })
  ).toBeVisible();
  await expect(
    page.getByText("Method alpha-0.2.0", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CDC Lyme surveillance/ })
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("geometry errors retain the matching table and provide recovery", async ({
  page,
}) => {
  await page.route("**/v1/atlas/geometry?*", (route) =>
    route.fulfill({ status: 503, json: { detail: "Geometry unavailable" } })
  );
  await page.goto("/variant_7?view=maps");
  await expect(
    page.getByRole("button", { name: "Retry geometry" })
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Adams");
  await expect(
    page.getByRole("heading", { name: "How to interpret the Atlas" })
  ).toBeVisible();
});

test("inconsistent score provenance fails closed before rendering charts", async ({
  page,
}) => {
  await page.route("**/v1/atlas/scores?*", (route) =>
    route.fulfill({
      json: {
        release_id: "wrong-release",
        methodology_version: metadata.methodology_version,
        settings: {},
        counties,
      },
    })
  );
  await page.goto("/variant_7");
  await expect(
    page.getByRole("heading", {
      name: "Geographic explorer is temporarily unavailable",
    })
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
