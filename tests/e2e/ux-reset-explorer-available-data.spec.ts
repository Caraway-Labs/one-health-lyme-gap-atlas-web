import { expect, test, type Page, type Route } from "@playwright/test";

import { EXPLORER_AVAILABLE_DATA_EMPTY } from "@/features/ux-reset/review/explorer-county-reference";

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

type ScoreCounty = {
  burgdorferi_status: string;
  county: string;
  evidence_completeness: number;
  fips: string;
  human_status: string;
  tick_status: string;
};

function scoreCounty(county: ScoreCounty) {
  return {
    ...county,
    color: "#245",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: scoreBreakdown,
    state: "AL",
    state_name: "Alabama",
  };
}

const percentCounties = [
  scoreCounty({
    burgdorferi_status: "Present",
    county: "Autauga",
    evidence_completeness: 6,
    fips: "01001",
    human_status: "published_count_floor",
    tick_status: "Established",
  }),
  scoreCounty({
    burgdorferi_status: "No records",
    county: "Baldwin",
    evidence_completeness: 80,
    fips: "01003",
    human_status: "missing",
    tick_status: "No records",
  }),
  scoreCounty({
    burgdorferi_status: "No records",
    county: "Bibb",
    evidence_completeness: 83,
    fips: "01007",
    human_status: "missing",
    tick_status: "No records",
  }),
];

function scoresBody(counties: readonly ReturnType<typeof scoreCounty>[]) {
  return {
    counties,
    methodology_version: "1",
    release_id: releaseId,
    settings: {
      ecological_share: 65,
      low_incidence_breakpoint: 10,
      missing_human_weakness: 75,
    },
  };
}

function square(fips: string, index: number) {
  const west = -88 + index * 0.5;
  const south = 32;
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
    properties: { fips },
    type: "Feature",
  };
}

async function installExplorer(
  page: Page,
  counties: readonly ReturnType<typeof scoreCounty>[],
  scores: (route: Route) => Promise<void>
) {
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
        states: [{ code: "AL", name: "Alabama" }],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", scores);
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: {
        features: counties.map((county, index) => square(county.fips, index)),
        type: "FeatureCollection",
      },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: buildStateReview({
        candidates: counties.map((county) =>
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: county.county,
            fips: county.fips,
            reasonText: `${county.county} was returned by the method.`,
          })
        ),
        resultState: "candidates_found",
        state: "AL",
      }),
      status: 200,
    });
  });
  await page.route("**/v1/measures", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/measures" }, meta: {} },
      status: 200,
    });
  });
  await page.route("**/v1/observations", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/observations" }, meta: {} },
      status: 200,
    });
  });
}

async function chooseAvailableData(page: Page, name: string) {
  await page.getByTestId("explorer-available-data").click();
  await page.getByRole("option", { name }).click();
}

test.describe("Explorer available data", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Desktop widths only. No mobile coverage."
    );
  });

  test("treats most data fields as a percent and drops filtered counties from the map", async ({
    page,
  }) => {
    await installExplorer(page, percentCounties, async (route) => {
      await route.fulfill({
        json: scoresBody(percentCounties),
        status: 200,
      });
    });
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL");
    await expect(page.getByTestId("review-candidate")).toHaveCount(3);

    await chooseAvailableData(page, "Most data fields available");
    await expect(page.getByTestId("review-candidate")).toHaveCount(1);
    await expect(page.getByTestId("review-candidate")).toContainText("Bibb");
    await expect(page.getByTestId("review-candidate")).not.toContainText(
      "Autauga"
    );
    await expect(page.getByTestId("review-candidate")).not.toContainText(
      "Baldwin"
    );
    const region = page.getByTestId("review-state-map-region");
    await expect(region).toHaveAttribute("data-map-fips", "01007");
    await expect(region).toHaveAttribute("data-include-unscored", "false");
    await expect(page.getByTestId("review-state-map-empty")).toHaveCount(0);
  });

  test("says when the available-data filter matches no counties", async ({
    page,
  }) => {
    const counties = percentCounties.filter(
      (county) => county.fips !== "01007"
    );
    await installExplorer(page, counties, async (route) => {
      await route.fulfill({ json: scoresBody(counties), status: 200 });
    });
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL");
    await chooseAvailableData(page, "Most data fields available");
    await expect(
      page.getByTestId("explorer-map-available-data-empty")
    ).toHaveText(EXPLORER_AVAILABLE_DATA_EMPTY);
    await expect(page.getByTestId("explorer-available-data-empty")).toHaveText(
      EXPLORER_AVAILABLE_DATA_EMPTY
    );
    await expect(page.getByTestId("review-state-map-empty")).toHaveCount(0);
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "data-map-fips",
      ""
    );
  });

  test("hides counties while a restrictive filter is still loading", async ({
    page,
  }) => {
    let releaseScores = (): void => undefined;
    const scoresReady = new Promise<void>((resolve) => {
      releaseScores = resolve;
    });
    try {
      await installExplorer(page, percentCounties, async (route) => {
        await scoresReady;
        await route.fulfill({
          json: scoresBody(percentCounties),
          status: 200,
        });
      });
      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/explore?scope=AL");
      await expect(page.getByTestId("review-candidate")).toHaveCount(3);

      await chooseAvailableData(page, "Published Lyme case count available");
      await expect(
        page.getByTestId("explorer-available-data-loading")
      ).toBeVisible();
      await expect(
        page.getByTestId("explorer-map-available-data-loading")
      ).toBeVisible();
      await expect(page.getByTestId("review-candidate")).toHaveCount(0);
      await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
      await expect(
        page.getByTestId("explorer-available-data-empty")
      ).toHaveCount(0);

      releaseScores();
      await expect(page.getByTestId("review-candidate")).toHaveCount(1);
      await expect(page.getByTestId("review-candidate")).toContainText(
        "Autauga"
      );
      const region = page.getByTestId("review-state-map-region");
      await expect(region).toHaveAttribute("data-map-fips", "01001");
      await expect(region).toHaveAttribute("data-include-unscored", "false");
    } finally {
      releaseScores();
    }
  });

  test("hides counties when a restrictive filter cannot be checked", async ({
    page,
  }) => {
    await installExplorer(page, percentCounties, async (route) => {
      await route.fulfill({
        json: { detail: "scores unavailable" },
        status: 500,
      });
    });
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL");
    await expect(page.getByTestId("review-candidate")).toHaveCount(3);

    await chooseAvailableData(page, "Published Lyme case count available");
    await expect(page.getByTestId("explorer-available-data-error")).toBeVisible(
      {
        timeout: 20_000,
      }
    );
    await expect(
      page.getByTestId("explorer-map-available-data-error")
    ).toBeVisible();
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await expect(page.getByTestId("explorer-available-data-empty")).toHaveCount(
      0
    );
  });
});
