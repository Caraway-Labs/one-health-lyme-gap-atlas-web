import type { Page } from "@playwright/test";

export const metadata = {
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

export const counties = Array.from({ length: 24 }, (_, index) => ({
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

export async function mockApi(page: Page) {
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
