import { expect, type Page, test } from "@playwright/test";

import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";

const releaseId = "alpha-2026";
const ramps = [
  "#a9d2db",
  "#55a8a3",
  "#87b982",
  "#efc64a",
  "#f49a32",
  "#e9602b",
];
const coloradoNames = [
  "Adams",
  "Alamosa",
  "Arapahoe",
  "Archuleta",
  "Baca",
  "Bent",
  "Boulder",
  "Broomfield",
  "Chaffee",
  "Cheyenne",
  "Clear Creek",
  "Conejos",
  "Costilla",
  "Crowley",
  "Custer",
  "Delta",
  "Denver",
  "Dolores",
  "Douglas",
  "Eagle",
  "Elbert",
  "El Paso",
  "Fremont",
  "Garfield",
  "Gilpin",
  "Grand",
  "Gunnison",
  "Hinsdale",
  "Huerfano",
  "Jackson",
  "Jefferson",
  "Kiowa",
  "Kit Carson",
  "Lake",
  "La Plata",
  "Larimer",
  "Las Animas",
  "Lincoln",
  "Logan",
  "Mesa",
  "Mineral",
  "Moffat",
  "Montezuma",
  "Montrose",
];

const counties = coloradoNames.map((county, index) => {
  const fips = `08${String(index + 1).padStart(3, "0")}`;
  return {
    burgdorferi_status: "observed",
    color: ramps[index % ramps.length],
    county,
    evidence_completeness: 40 + (index % 50),
    fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 90 - index,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "observed",
  };
});

async function installExplorer(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({ json: {}, status: 200 });
  });
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({
      json: {
        bundle_sha256: "abc",
        generated_at: "2026-01-01T00:00:00.000Z",
        limitations: "Sample",
        loaded_at: "2026-01-01T00:00:00.000Z",
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
        methodology_version: "1",
        release_id: releaseId,
        schema_version: "1",
        scope: "US",
        score_defaults: {},
        sources: [],
        states: [{ code: "CO", name: "Colorado" }],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        counties,
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
        methodology_version: "1",
        release_id: releaseId,
        settings: {
          ecological_share: 65,
          smooth_k: 50,
          missing_human_weakness: 75,
        },
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { features: [], type: "FeatureCollection" },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    await route.fulfill({
      json: buildStateReview({
        resultState: "none_stand_out",
        state,
      }),
      status: 200,
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/measures" }, meta: {} },
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/observations" }, meta: {} },
      status: 200,
    });
  });
}

async function expectDesktopColumns(page: Page) {
  const mapBox = await page.locator(".ux-reset-explorer-map").boundingBox();
  const railBox = await page.getByTestId("explorer-rail").boundingBox();
  expect(mapBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  if (!(mapBox && railBox)) {
    return;
  }
  // The map leads; the rail (List and County tabs) sits beside it.
  const total = mapBox.width + railBox.width;
  expect(Math.abs(mapBox.y - railBox.y)).toBeLessThan(8);
  expect(mapBox.x).toBeLessThan(railBox.x);
  expect(mapBox.width / total).toBeGreaterThan(0.6);
  expect(mapBox.width / total).toBeLessThan(0.78);
  expect(railBox.width / total).toBeGreaterThan(0.22);
  expect(railBox.width / total).toBeLessThan(0.4);
  expect(mapBox.y).toBeLessThan(450);
  expect(mapBox.y + 240).toBeLessThan(900);
}
async function expectStickyCountiesHeading(page: Page) {
  const list = page.locator(".ux-reset-explorer-list");
  const heading = list.getByRole("heading", { exact: true, name: "Counties" });
  const rowList = list.locator(".ux-reset-ranked-county-list");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveJSProperty("tagName", "H2");
  await expect(list.locator(".ux-reset-ranked-counties-eyebrow")).toHaveCount(
    0
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Counties" })
  ).toHaveCount(0);
  const before = await heading.boundingBox();
  expect(before).not.toBeNull();
  await rowList.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(async () => rowList.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(40);
  const after = await heading.boundingBox();
  expect(after?.y).toBe(before?.y);
  await expect(heading).toBeInViewport();
  const firstVisibleRank = await rowList.evaluate((node) => {
    const rows = [...node.querySelectorAll(".ux-reset-ranked-row")];
    const visible = rows.find((row) => {
      const rect = row.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      return rect.bottom > bounds.top + 4 && rect.top < bounds.bottom;
    });
    return visible?.querySelector(".ux-reset-ranked-number")?.textContent ?? "";
  });
  expect(Number(firstVisibleRank)).toBeGreaterThan(1);
}

test("keeps Counties above the scrolled ranked list at national and state scope", async ({
  page,
}) => {
  await installExplorer(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/explore?scope=ALL");
  await expect(page.getByTestId("review-scope-select")).toContainText(
    "United States"
  );
  await expectDesktopColumns(page);
  await expectStickyCountiesHeading(page);

  await page.goto("/explore?scope=CO");
  await expect(page.getByTestId("review-scope-select")).toContainText(
    "Colorado"
  );
  await expect(
    page.getByTestId("explorer-national-shortlist-note")
  ).toHaveCount(0);
  await expectDesktopColumns(page);
  await expectStickyCountiesHeading(page);
});
