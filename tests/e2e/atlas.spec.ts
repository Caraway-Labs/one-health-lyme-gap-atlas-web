import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const metadata = {
  release_id: "alpha-2026-08-06",
  schema_version: "0.2.0",
  generated_at: "2026-08-06T05:37:16Z",
  loaded_at: "2026-08-15T00:00:00Z",
  scope: "United States counties",
  bundle_sha256: "a".repeat(64),
  score_defaults: {},
  methodology_version: "alpha-0.2.0",
  limitations: "Not individual risk.",
  sources: [{ key: "human", label: "CDC Lyme surveillance", vintage: "2023", url: "https://cdc.gov", note: "Published floor." }],
  states: [{ code: "CO", name: "Colorado" }],
};

const summary = {
  fips: "08001", county: "Adams", state: "CO", state_name: "Colorado",
  in_contiguous_tick_scope: true, human_status: "no_county_linked_record",
  tick_status: "Established", burgdorferi_status: "Present", evidence_completeness: 6,
  score: { score: 61.9, human_weakness: 75, ecological: 100, community: 50, tick_signal: 100, pathogen_signal: 100, svi_signal: 50, access_signal: 50, rural_signal: 12.5 },
  priority: "Priority 2 — Review", color: "#efc64a",
};

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let contentType = "application/json";
    if (url.pathname.endsWith("/metadata")) body = metadata;
    else if (url.pathname.endsWith("/geometry")) body = { type: "FeatureCollection", features: [{ type: "Feature", id: "08001", properties: { fips: "08001" }, geometry: { type: "Polygon", coordinates: [[[-105, 39], [-104, 39], [-104, 40], [-105, 40], [-105, 39]]] } }] };
    else if (url.pathname.endsWith("/scores")) body = { release_id: metadata.release_id, methodology_version: metadata.methodology_version, settings: {}, counties: [summary] };
    else if (url.pathname.includes("/counties/")) body = { ...summary, population: 500000, case_count_floor_2023: null, incidence_floor_2023: null, state_unallocated_records_2023: 1, scapularis_status: "Established", pacificus_status: "No records", svi_percentile: 0.5, uninsured_percentile: 0.5, uninsured_percent: 8, rucc_2023: 2, release: metadata };
    else if (url.pathname.endsWith("ranking.csv")) { body = "rank,fips,county\n1,08001,Adams"; contentType = "text/csv"; }
    await route.fulfill({ status: 200, contentType, body: typeof body === "string" ? body : JSON.stringify(body) });
  });
});

test("renders the atlas and full non-map results", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveCSS("position", "fixed");
  await expect(page.getByRole("link", { name: "One Health Lyme Gap Atlas home" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("heading", { name: /Find the places/ })).toBeVisible();
  await expect(page.getByText("Adams, CO").first()).toBeVisible();
  await page.getByRole("button", { name: "View full results table" }).click();
  await expect(page.getByRole("table")).toContainText("08001");
  const results = await new AxeBuilder({ page }).exclude(".maplibre-atlas").analyze();
  expect(results.violations).toEqual([]);
});
