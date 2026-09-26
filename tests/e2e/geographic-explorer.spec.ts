import { readFile } from "node:fs/promises";

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
counties.push({
  ...counties[0],
  fips: "06085",
  county: "Santa Clara",
  state: "CA",
  state_name: "California",
  evidence_completeness: 100,
});
counties.push({
  ...counties[0],
  fips: "06001",
  county: "Alameda",
  state: "CA",
  state_name: "California",
  evidence_completeness: 67,
});

async function mockApi(page: Page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.has("dataset_version") &&
      url.searchParams.get("dataset_version") !== metadata.release_id
    )
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
    if (url.pathname.endsWith("/report.pdf"))
      return route.fulfill({
        body: "%PDF-1.7 mock Atlas state report with non-empty content",
        contentType: "application/pdf",
        headers: {
          "Access-Control-Expose-Headers": "Content-Disposition",
          "Content-Disposition": 'attachment; filename="california-state.pdf"',
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

test("TC10–TC13: California, search, evidence filter, and selected FIPS agree", async ({
  page,
}) => {
  await page.goto("/geographic_explorer");
  await page.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "California" }).click();
  await expect(page).toHaveURL(/state=CA/);
  const table = page.getByRole("table");
  await expect(table).toContainText("06085");
  await expect(table).not.toContainText("08001");

  await page
    .getByRole("combobox", { name: "Filter counties by available data" })
    .click();
  await page
    .getByRole("option", { name: "Most data fields available" })
    .click();
  await expect(page).toHaveURL(/evidence=complete/);
  await expect(table).toContainText("06085");
  await expect(table).not.toContainText("06001");

  await page.getByLabel("County name or FIPS code").fill("Santa Clara");
  await expect(page).toHaveURL(/q=Santa/);
  await expect(table).toContainText("06085");
  await expect(table).not.toContainText("06037");
  await table.getByRole("button", { name: /Santa Clara, CA.*06085/ }).click();
  const detail = page.getByRole("complementary", { name: "Selected county" });
  await expect(detail).toContainText("Santa Clara, CA");
  await expect(detail).toContainText("FIPS 06085");
  await expect(page).toHaveURL(/county=06085/);
});

test("TC14–TC17: comparison, matrix, dictionary, and non-risk method", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?state=CA&county=06085");
  const detail = page.getByRole("complementary", { name: "Selected county" });
  await expect(detail).toContainText("FIPS 06085");
  await detail.getByRole("button", { name: "Add to comparison" }).click();
  await page
    .getByRole("table")
    .getByRole("button", { name: /Los Angeles, CA.*06037/ })
    .click();
  await detail.getByRole("button", { name: "Add to comparison" }).click();
  await detail.getByRole("button", { name: "View comparison" }).click();
  await expect(page).toHaveURL(/view=compare/);
  await expect(page).toHaveURL(/selected=06085%2C06037|selected=06085,06037/);
  await expect(
    page
      .locator(".geo-comparisons")
      .getByRole("heading", { name: "Santa Clara, CA" })
  ).toBeVisible();
  await expect(
    page
      .locator(".geo-comparisons")
      .getByRole("heading", { name: "Los Angeles, CA" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Evidence matrix", exact: true })
    .click();
  await expect(page).toHaveURL(/view=matrix/);
  await expect(page.getByRole("table")).toContainText(
    "No county-linked record"
  );
  await page.getByRole("button", { name: "Data dictionary" }).click();
  await expect(
    page.getByRole("dialog", { name: "Data dictionary" })
  ).toContainText("County Review Priority");
  await page
    .getByRole("dialog", { name: "Data dictionary" })
    .getByRole("button", { name: "Close data dictionary" })
    .click();
  await expect(
    page.getByText(
      /Review priority is not a diagnosis, an individual disease-risk estimate/
    )
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How counties are prioritized" })
  ).toBeVisible();
});

test("TC18–TC19: state PDF and filtered county CSV downloads contain the active results", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?state=CA&evidence=complete");
  await expect(page.getByRole("table")).toContainText("06085");
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const pdf = await pdfEvent;
  expect(pdf.suggestedFilename()).toBe("california-state.pdf");
  const pdfPath = await pdf.path();
  expect(pdfPath).not.toBeNull();
  expect((await readFile(pdfPath as string)).subarray(0, 5).toString()).toBe(
    "%PDF-"
  );

  const csvEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download county list" }).click();
  const csv = await csvEvent;
  const csvPath = await csv.path();
  expect(csvPath).not.toBeNull();
  const lines = (await readFile(csvPath as string, "utf8"))
    .trim()
    .split(/\r?\n/);
  const headers = lines[0].split(",");
  expect(headers).toContain("fips");
  expect(headers).toContain("evidence_completeness_percent");
  const rows = lines.slice(1).map((line) => {
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) =>
      match[1].replaceAll('""', '"')
    );
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index]])
    );
  });
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.map((row) => row.fips).sort()).toEqual(["06037", "06085"]);
  for (const row of rows) {
    expect(row.state).toBe("CA");
    expect(Number(row.evidence_completeness_percent)).toBeGreaterThanOrEqual(
      83
    );
  }
});

for (const [ordered, primary] of [
  ["06085,06037", "Santa Clara, CA"],
  ["06037,06085", "Los Angeles, CA"],
] as const) {
  test(`TC20–TC21: compare URL ${ordered} hydrates and reloads with ${primary} primary`, async ({
    page,
  }) => {
    await page.goto(
      `/geographic_explorer?dataset=alpha-explorer&state=CA&selected=${ordered}&view=compare`
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        page.getByRole("complementary", { name: "Selected county" })
      ).toContainText(primary);
      await expect(
        page.getByRole("complementary", { name: "Selected county" })
      ).toContainText(`FIPS ${ordered.slice(0, 5)}`);
      await expect(
        page
          .locator(".geo-comparisons")
          .getByRole("heading", { name: "Santa Clara, CA" })
      ).toBeVisible();
      await expect(
        page
          .locator(".geo-comparisons")
          .getByRole("heading", { name: "Los Angeles, CA" })
      ).toBeVisible();
      const url = new URL(page.url());
      expect(url.searchParams.get("dataset")).toBe("alpha-explorer");
      expect(url.searchParams.get("state")).toBe("CA");
      expect(url.searchParams.get("view")).toBe("compare");
      expect(url.searchParams.get("selected")).toBe(ordered);
      if (attempt === 0) await page.reload();
    }
  });
}

test("experimental Geographic Explorer URLs remain direct-link accessible and isolated", async ({
  page,
}) => {
  await page.goto("/variant_7?view=ranking&county=08001");

  await expect(page).toHaveURL(/\/variant_7\?view=ranking&county=08001/);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Geographic explorer" })
  ).toBeVisible();
});

test("Primary navigation links to Geographic Explorer; grids link to accessible county results", async ({
  page,
}, testInfo) => {
  await page.goto("/geographic_explorer");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const geographicExplorerLink = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Geographic Explorer" });
  await expect(geographicExplorerLink).toHaveAttribute(
    "href",
    "/geographic_explorer"
  );
  if (testInfo.project.name.includes("mobile")) {
    await page
      .getByRole("dialog", { name: "Primary navigation" })
      .getByRole("button", { name: "Close navigation" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Geographic explorer", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Variant 7", { exact: true })).toHaveCount(0);
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
  await page.goto("/geographic_explorer?view=ranking&county=08001");
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
    page
      .locator(".geo-comparisons")
      .getByRole("heading", { name: "Adams, CO", exact: true })
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
  await page.goto("/geographic_explorer?view=maps&county=08001");
  await expect(
    page.getByText("Maps ready. Pan and zoom are synchronized.")
  ).toBeVisible();
  await expect(page.locator(".geo-map-canvas canvas")).toHaveCount(2);
  await expect(page).toHaveURL(/county=08001/);
  await page
    .getByRole("table")
    .getByRole("button", { name: /County 1, CO/ })
    .click();
  await expect(page).toHaveURL(/county=08003/);
  await expect(
    page.getByText("Maps ready. Pan and zoom are synchronized.")
  ).toBeVisible();
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
  await page.goto("/geographic_explorer?dataset=old-release");
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
  await page.goto("/geographic_explorer?view=maps");
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
  await page.goto("/geographic_explorer");
  await expect(
    page.getByRole("heading", {
      name: "Geographic explorer is temporarily unavailable",
    })
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
