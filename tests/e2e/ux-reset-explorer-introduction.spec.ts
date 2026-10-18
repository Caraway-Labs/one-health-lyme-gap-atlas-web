import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { PAGE_INTRODUCTION_COPY } from "@/features/ux-reset/page-introduction-copy";
import { EXPLORER_COUNTY_EXPORT_NOTE } from "@/features/ux-reset/review/explorer-county-reference";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";

const releaseId = "alpha-2026";

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 40,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

const counties = [
  {
    burgdorferi_status: "Present",
    color: "#245",
    county: "Autauga",
    evidence_completeness: 80,
    fips: "01001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2 — Review",
    score: { ...scoreBreakdown, score: 70 },
    state: "AL",
    state_name: "Alabama",
    tick_status: "Established",
  },
  {
    burgdorferi_status: "No records",
    color: "#ccc",
    county: "Baldwin",
    evidence_completeness: 1,
    fips: "01003",
    human_status: "missing",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: scoreBreakdown,
    state: "AL",
    state_name: "Alabama",
    tick_status: "No records",
  },
  {
    burgdorferi_status: "No records",
    color: "#ccc",
    county: "Aleutians East",
    evidence_completeness: 1,
    fips: "02013",
    human_status: "missing",
    in_contiguous_tick_scope: false,
    priority: "Priority 3 — Review",
    score: scoreBreakdown,
    state: "AK",
    state_name: "Alaska",
    tick_status: "No records",
  },
  {
    burgdorferi_status: "Present",
    color: "#ccc",
    county: "District of Columbia",
    evidence_completeness: 6,
    fips: "11001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2 — Review",
    score: scoreBreakdown,
    state: "DC",
    state_name: "District of Columbia",
    tick_status: "Reported",
  },
];

async function installExplorer(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({
      json: {
        bundle_sha256: "abc",
        generated_at: "2026-01-01T00:00:00.000Z",
        limitations: "Sample",
        loaded_at: "2026-01-01T00:00:00.000Z",
        methodology_version: "1",
        release_id: releaseId,
        schema_version: "1",
        scope: "US",
        score_defaults: {},
        sources: [],
        states: [
          { code: "AK", name: "Alaska" },
          { code: "AL", name: "Alabama" },
          { code: "DC", name: "District of Columbia" },
          { code: "HI", name: "Hawaii" },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        counties,
        methodology_version: "1",
        release_id: releaseId,
        settings: {
          ecological_share: 65,
          low_incidence_breakpoint: 10,
          missing_human_weakness: 75,
        },
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "AL";
    const stateCounties = counties.filter((county) => county.state === state);
    await route.fulfill({
      json: buildStateReview({
        candidates: stateCounties.map((county) =>
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: county.county,
            fips: county.fips,
            reasonText: `${county.county} was returned by the method.`,
          })
        ),
        resultState:
          stateCounties.length > 0 ? "candidates_found" : "none_stand_out",
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

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    main: (() => {
      const main = document.querySelector("main");
      if (!(main instanceof HTMLElement)) {
        return 0;
      }
      return main.scrollWidth - main.clientWidth;
    })(),
  }));
  expect(overflow.document).toBe(0);
  expect(overflow.main).toBeLessThanOrEqual(0);
}

test.describe("Explorer and Compare introductions", () => {
  test("shows approved copy, a working county toolbar, and a filtered FIPS export", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL");
    const explorer = PAGE_INTRODUCTION_COPY.explorer;
    await expect(
      page.getByRole("heading", { level: 1, name: explorer.headline })
    ).toBeVisible();
    await expect(page.getByText(explorer.supporting)).toBeVisible();
    await expect(page.getByText(explorer.guidanceLead)).toBeVisible();
    await expect(page.getByText(explorer.guidance)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByText("From data to better decisions")).toHaveCount(
      0
    );
    await expect(page.getByTestId("page-introduction-compare")).toHaveCount(0);
    await expect(page.getByTestId("explorer-county-toolbar")).toBeVisible();
    await expect(page.getByText(EXPLORER_COUNTY_EXPORT_NOTE)).toBeVisible();
    await expect(page.getByTestId("explorer-browse")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-explorer-1440.png",
    });

    await page.getByTestId("review-scope-select").click();
    await expect(
      page.getByRole("option", { name: "Alabama (AL)" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "District of Columbia (DC)" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "United States" })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: /Alaska/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Hawaii/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const search = page.getByTestId("explorer-county-search");
    await search.fill("01001");
    await search.press("Enter");
    await expect(page).toHaveURL(/county=01001/);
    await expect(page).toHaveURL(/scope=AL/);
    await search.fill("");
    await expect(page.getByTestId("review-candidate")).toHaveCount(2);

    await page.getByTestId("explorer-available-data").click();
    await page
      .getByRole("option", { name: "Published Lyme case count available" })
      .click();
    await expect(page.getByTestId("review-candidate")).toHaveCount(1);
    await expect(page.getByTestId("review-candidate")).toContainText("Autauga");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("explorer-download-counties").click(),
    ]);
    expect(download.suggestedFilename()).toBe("atlas-explorer-counties-al.csv");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath ?? "", "utf8");
    expect(csv.startsWith("fips,county,state\r\n")).toBe(true);
    expect(csv).toContain('"01001"');
    expect(csv).toContain('"Autauga"');
    expect(csv).toContain('"AL"');
    expect(csv).not.toContain("01003");
    expect(csv).not.toContain("02013");
    expect(csv).not.toContain("Aleutians");
    expect(csv).not.toContain("score");
    await expectNoHorizontalOverflow(page);

    const toolbar = await new AxeBuilder({ page })
      .include(
        "[data-testid='page-introduction-explorer'], [data-testid='explorer-county-toolbar']"
      )
      .analyze();
    expect(toolbar.violations).toEqual([]);

    await page.setViewportSize({ height: 1000, width: 1920 });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("explorer-browse")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-explorer-1920.png",
    });
  });

  test("uses the Compare introduction only on Compare", async ({ page }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/compare");
    const compare = PAGE_INTRODUCTION_COPY.compare;
    await expect(
      page.getByRole("heading", { level: 1, name: compare.headline })
    ).toBeVisible();
    await expect(page.getByText(compare.supporting)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: compare.stripHeading })
    ).toBeVisible();
    await expect(page.getByText(compare.stripBody)).toBeVisible();
    await expect(page.getByTestId("page-introduction-explorer")).toHaveCount(0);
    await expect(page.getByTestId("compare-return")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-compare-1440.png",
    });
    await page.setViewportSize({ height: 1000, width: 1920 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: "/opt/cursor/artifacts/after-compare-1920.png",
    });

    await page.goto("/askatlas");
    await expect(page.getByTestId("page-introduction-explorer")).toHaveCount(0);
    await expect(page.getByTestId("page-introduction-compare")).toHaveCount(0);
    await expect(page.getByText(compare.headline)).toHaveCount(0);
    await expect(
      page.getByText(PAGE_INTRODUCTION_COPY.explorer.headline)
    ).toHaveCount(0);
  });
});
