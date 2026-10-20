import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";

const conejosScore = {
  access_signal: 84.8,
  community: 87.3,
  ecological: 0,
  human_weakness: 75,
  pathogen_signal: 0,
  rural_signal: 100,
  score: 22.9,
  svi_signal: 83.8,
  tick_signal: 0,
};

const scenarioScores = {
  counties: [
    {
      burgdorferi_status: "No records",
      color: "#55a8a3",
      county: "Conejos County",
      evidence_completeness: 50,
      fips: "08021",
      human_status: "no_county_linked_record",
      in_contiguous_tick_scope: true,
      priority: "Lower Atlas priority — Not a safety finding",
      score: conejosScore,
      state: "CO",
      state_name: "Colorado",
      tick_status: "No records",
    },
  ],
  methodology_version: "1",
  release_id: "alpha-2026",
  settings: {
    ecological_share: 65,
    low_incidence_breakpoint: 10,
    missing_human_weakness: 75,
  },
};

function countyBox(fips: string, west: number, south: number) {
  const east = west + 0.4;
  const north = south + 0.3;
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
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

async function installExplorer(
  page: Page,
  options: {
    candidates?: ReturnType<typeof reviewCandidate>[];
    geometry?:
      | "unavailable"
      | { features: unknown[]; type: "FeatureCollection" };
    scores?: unknown;
  } = {}
) {
  const scores = options.scores ?? scenarioScores;
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scores, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    if (options.geometry && options.geometry !== "unavailable") {
      await route.fulfill({ json: options.geometry, status: 200 });
      return;
    }
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/counties/**", async (route) => {
    await route.fulfill({ json: { detail: "missing" }, status: 404 });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: buildStateReview({
        candidates: options.candidates ?? [
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Conejos",
            fips: "08021",
            reasonText: "Conejos was returned by the method.",
          }),
        ],
        resultState: "candidates_found",
        state: "CO",
      }),
      status: 200,
    });
  });
}

test.describe("Explorer what-if scenario", () => {
  test("keeps the governed score and updates the adjusted scenario from the sliders", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.goto("/app/review?scope=CO");

    const panel = page.getByTestId("explorer-what-if-scenario");
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute("open", "");
    await expect(panel).toContainText("Explore different scenarios");
    await expect(panel).not.toContainText("What-if scenario");
    await expect(panel).toContainText("Adjust assumptions");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.getByTestId("review-candidate")).toContainText(
      "Published score 22.9"
    );
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("Published Atlas score 22.9 · No adjustments");
    await page.screenshot({
      path: "/opt/cursor/artifacts/what-if-collapsed.png",
      fullPage: true,
    });

    const summary = page.getByTestId("explorer-what-if-summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    const missing = page.getByRole("slider", {
      name: "Assumption for missing county case data",
    });
    await expect(missing).toBeVisible();
    await missing.focus();
    await missing.fill("40");
    await expect(page).toHaveURL(/[?&]missing=40(?:&|$)/);
    const historyLength = await page.evaluate(() => history.length);
    await missing.fill("50");
    await expect(page).toHaveURL(/[?&]missing=50(?:&|$)/);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await missing.fill("40");

    const candidate = page.getByTestId("review-candidate");
    await expect(candidate).toContainText("Published score 22.9");
    await expect(candidate).toContainText("Adjusted scenario 12.2");
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "Adjusted scenario"
    );
    await page.getByRole("button", { name: "About Adjusted scenario" }).click();
    await expect(
      page.getByRole("dialog", { name: "About Adjusted scenario" })
    ).not.toContainText("not personal disease risk");
    await page.keyboard.press("Escape");
    const impactSummary = page.getByTestId("explorer-scenario-impact-summary");
    await expect(
      page.getByTestId("explorer-scenario-impact-description")
    ).toHaveText("Published Atlas score to the score with your changes.");
    await expect(impactSummary).toContainText("22.9 → 12.2 · −10.7 points");
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Conejos County");
    await expect(impact).toContainText("Published Atlas score");
    await expect(impact).toContainText("Score with your changes");
    await expect(impact).toContainText("12.2");
    await expect(impact).toContainText("−10.7 points");
    await expect(impact).toContainText("Follow-up category unchanged");
    await expect(impact).not.toContainText("Not a safety finding");
    await expect(page.getByTestId("explorer-scenario-caveat")).toHaveCount(0);
    await expect(page.getByTestId("explorer-scenario-lower-score")).toHaveCount(
      0
    );
    await expect(
      page.getByTestId("explorer-what-if-scenario")
    ).not.toContainText("do not measure individual Lyme disease risk");
    await page.screenshot({
      path: "/opt/cursor/artifacts/what-if-expanded-changed.png",
      fullPage: true,
    });
    await candidate.scrollIntoViewIfNeeded();
    await candidate.screenshot({
      path: "/opt/cursor/artifacts/what-if-county-adjusted.png",
    });

    await page.reload();
    await expect(candidate).toContainText("Adjusted scenario 12.2");
    await expect(panel).not.toHaveAttribute("open", "");
    await summary.click();
    await expect(missing).toHaveValue("40");

    await page.getByTestId("explorer-scenario-reset").click();
    await expect(page).not.toHaveURL(/[?&]missing=/);
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("Published Atlas score 22.9 · No adjustments");
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).not.toContainText("points");
    await expect(candidate).toContainText("Published score 22.9");
    await expect(missing).toHaveValue("75");

    const axe = await new AxeBuilder({ page })
      .include("[data-testid='explorer-what-if-scenario']")
      .analyze();
    expect(axe.violations).toEqual([]);
  });

  test("shows the scenario for a lower-48 state and keeps it off unsupported scopes", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.goto("/app/review?scope=DC");
    await expect(page.getByTestId("explorer-what-if-scenario")).toBeVisible();

    await page.goto("/app/review?scope=AK");
    await expect(page.getByTestId("explorer-what-if-scenario")).toHaveCount(0);
    await expect(page.getByTestId("review-scope-unsupported")).toBeVisible();
  });

  test("ignores undeclared incidence and keeps a raised threshold limited", async ({
    page,
  }) => {
    const lower = "Lower Atlas priority — Not a safety finding";
    const publishedZero = (
      fips: string,
      county: string,
      incidence?: number
    ) => ({
      burgdorferi_status: "Present",
      color: "#a9d2db",
      county,
      evidence_completeness: 50,
      fips,
      human_status: "published_count_floor",
      in_contiguous_tick_scope: true,
      priority: lower,
      score: {
        access_signal: 100,
        community: 100,
        ecological: 100,
        human_weakness: 0,
        pathogen_signal: 100,
        rural_signal: 100,
        score: 0,
        svi_signal: 100,
        tick_signal: 100,
      },
      state: "CO",
      state_name: "Colorado",
      tick_status: "Established",
      ...(incidence === undefined ? {} : { incidence_floor_2023: incidence }),
    });
    await installExplorer(page, {
      candidates: [
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Twelve",
          fips: "08012",
          reasonText: "Twelve was returned by the method.",
        }),
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Thirty",
          fips: "08030",
          reasonText: "Thirty was returned by the method.",
        }),
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Clamped",
          fips: "08001",
          reasonText: "Clamped was returned by the method.",
        }),
      ],
      geometry: {
        features: [
          countyBox("08001", -105.2, 39.5),
          countyBox("08012", -105.8, 39.2),
          countyBox("08030", -106.4, 38.8),
        ],
        type: "FeatureCollection",
      },
      scores: {
        counties: [
          publishedZero("08012", "Twelve County", 12),
          publishedZero("08030", "Thirty County", 30),
          publishedZero("08001", "Clamped County"),
        ],
        methodology_version: "1",
        release_id: "alpha-2026",
        settings: scenarioScores.settings,
      },
    });
    await page.goto("/app/review?scope=CO");
    const map = page.getByTestId("review-state-map-region");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(map).toHaveAttribute("data-map-colors", /08012:#a9d2db/i);

    const panel = page.getByTestId("explorer-what-if-scenario");
    await page.getByTestId("explorer-what-if-summary").click();
    const threshold = page.getByRole("slider", {
      name: "Reported Lyme disease rate reference point",
    });
    await threshold.fill("20");
    await expect(page).toHaveURL(/[?&]breakpoint=20(?:&|$)/);

    const twelve = page.locator(
      "[data-testid='review-candidate'][data-fips='08012']"
    );
    const thirty = page.locator(
      "[data-testid='review-candidate'][data-fips='08030']"
    );
    const clamped = page.locator(
      "[data-testid='review-candidate'][data-fips='08001']"
    );
    await expect(twelve).toContainText("Published score 0");
    await expect(twelve).toContainText("Adjusted scenario unavailable");
    await expect(twelve).not.toContainText("Scenario rank");
    await expect(thirty).toContainText("Adjusted scenario unavailable");
    await expect(thirty).not.toContainText("Scenario rank");
    await expect(clamped).toContainText("Adjusted scenario unavailable");
    await expect(clamped).not.toContainText("Scenario rank");
    await expect(page.getByTestId("explorer-scenario-selected")).toContainText(
      "Adjusted scenario unavailable"
    );
    await expect(page.getByTestId("explorer-scenario-selected")).toContainText(
      "Governed score 0"
    );
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Twelve County");
    await expect(impact).toContainText("Unavailable");
    await expect(impact).toContainText("Published Atlas score");
    await expect(impact).not.toContainText("points");
    await expect(impact).not.toContainText("Scenario rank");
    await expect(impact).not.toContainText("→");
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("Score with your changes unavailable");
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).not.toContainText("→");

    await thirty.click();
    await expect(impact).toContainText("How the changes affect Thirty County");
    await expect(impact).not.toContainText("Twelve County");
    await expect(impact).toContainText("Unavailable");
    await expect(impact).not.toContainText("points");
    await expect(page.getByTestId("explorer-scenario-selected")).toContainText(
      "Adjusted scenario unavailable"
    );
    await clamped.click();
    await expect(page.getByTestId("explorer-scenario-selected")).toContainText(
      "Adjusted scenario unavailable"
    );

    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "Gap review score"
    );
    await page.getByRole("button", { name: "About Adjusted scenario" }).click();
    const scenarioAbout = page.getByRole("dialog", {
      name: "About Adjusted scenario",
    });
    await expect(scenarioAbout).not.toContainText("not personal disease risk");
    await expect(scenarioAbout).toContainText(
      "keep the governed score and color"
    );
    await page.keyboard.press("Escape");
    await expect(map).toHaveAttribute("data-map-colors", /08012:#a9d2db/i);
    await expect(map).toHaveAttribute("data-map-colors", /08030:#a9d2db/i);
    await expect(map).toHaveAttribute("data-map-colors", /08001:#a9d2db/i);

    await page.reload();
    await expect(panel).not.toHaveAttribute("open", "");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(twelve).toContainText("Adjusted scenario unavailable");
    await expect(thirty).not.toContainText("Scenario rank");
    await expect(clamped).toContainText("Adjusted scenario unavailable");
    await expect(map).toHaveAttribute("data-map-colors", /08012:#a9d2db/i);
  });

  test("loads scenario inputs on a boundaries cold arrival, then switches layers and resets", async ({
    page,
  }) => {
    await installExplorer(page, {
      geometry: {
        features: [countyBox("08021", -106.2, 37)],
        type: "FeatureCollection",
      },
    });
    await page.goto("/app/review?scope=CO&layer=boundaries");

    const map = page.getByTestId("review-state-map-region");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "County boundaries"
    );
    await expect(page.getByTestId("review-candidate")).toContainText(
      "Published score 22.9"
    );

    await page.getByTestId("explorer-what-if-summary").click();
    await page
      .getByRole("slider", { name: "Assumption for missing county case data" })
      .fill("40");
    await expect(page.getByTestId("review-candidate")).toContainText(
      "Adjusted scenario 12.2"
    );
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "County boundaries"
    );

    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Gap review score" }).click();
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "Gap review score"
    );
    await expect(map).toHaveAttribute("data-map-colors", /08021:#a9d2db/i);

    await page.getByTestId("explorer-scenario-reset").click();
    await expect(page).not.toHaveURL(/[?&]missing=/);
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(map).toHaveAttribute("data-map-colors", /08021:#55a8a3/i);
  });

  test("drops invalid scenario params back to the governed defaults", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.goto("/app/review?scope=CO&missing=41&eco=39");
    await expect(page).not.toHaveURL(/[?&]missing=/);
    await expect(page).not.toHaveURL(/[?&]eco=/);
    await page.getByTestId("explorer-what-if-summary").click();
    await expect(
      page.getByRole("slider", {
        name: "Assumption for missing county case data",
      })
    ).toHaveValue("75");
    await expect(
      page.getByRole("slider", {
        name: "Weight given to tick and pathogen data",
      })
    ).toHaveValue("65");
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
  });

  test("hydrates a shared scenario and keeps the comparison on the selected county", async ({
    page,
  }) => {
    const review = "Priority 2 — Review";
    const investigate = "Priority 1 — Investigate";
    const lower = "Lower Atlas priority — Not a safety finding";
    const watch = "Watch — Monitor signals";
    const scoreFor = (
      fips: string,
      county: string,
      priority: string,
      human: number,
      score: number
    ) => ({
      burgdorferi_status: "Present",
      color: "#55a8a3",
      county,
      evidence_completeness: 80,
      fips,
      human_status: "published_count_floor",
      in_contiguous_tick_scope: true,
      priority,
      score: {
        access_signal: 0,
        community: 0,
        ecological: 100,
        human_weakness: human,
        pathogen_signal: 100,
        rural_signal: 0,
        score,
        svi_signal: 0,
        tick_signal: 100,
      },
      state: "CO",
      state_name: "Colorado",
      tick_status: "Established",
    });
    await installExplorer(page, {
      candidates: [
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Boulder",
          fips: "08013",
          reasonText: "Boulder was returned by the method.",
        }),
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Lake",
          fips: "08065",
          reasonText: "Lake was returned by the method.",
        }),
      ],
      geometry: {
        features: [
          countyBox("08013", -105.6, 40),
          countyBox("08065", -106.4, 39),
        ],
        type: "FeatureCollection",
      },
      scores: {
        counties: [
          scoreFor("08013", "Boulder County", review, 100, 65),
          scoreFor("08065", "Lake County", lower, 0, 0),
        ],
        methodology_version: "1",
        release_id: "alpha-2026",
        settings: scenarioScores.settings,
      },
    });

    await page.setViewportSize({ width: 1711, height: 900 });
    await page.goto("/app/review?scope=CO&county=08013&eco=85");
    const summary = page.getByTestId("explorer-scenario-impact-summary");
    await expect(
      page.getByTestId("explorer-scenario-impact-description")
    ).toHaveText("Published Atlas score to the score with your changes.");
    await expect(summary).toContainText("65.0 → 85.0 · +20.0 points");
    await expect(
      page.getByTestId("explorer-what-if-scenario")
    ).not.toHaveAttribute("open", "");

    await page.getByTestId("explorer-what-if-summary").click();
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Boulder County");
    await expect(impact).toContainText(
      `Follow-up category changed: ${review} → ${investigate}`
    );
    await expect(impact).toContainText("Published Atlas score");
    await expect(impact).toContainText("85.0");

    await page
      .getByRole("slider", { name: "Weight given to tick and pathogen data" })
      .fill("40");
    await expect(summary).toContainText("65.0 → 40.0 · −25.0 points");
    await expect(impact).toContainText(
      `Follow-up category changed: ${review} → ${watch}`
    );

    await page
      .getByRole("slider", { name: "Weight given to tick and pathogen data" })
      .fill("85");
    const lake = page.locator(
      "[data-testid='review-candidate'][data-fips='08065']"
    );
    await lake.click();
    await expect(page).toHaveURL(/county=08065/);
    await expect(summary).toContainText("0.0 → 0.0 · 0.0 points");
    await expect(summary).not.toContainText("65.0");
    await expect(summary).not.toContainText("85.0");
    await expect(impact).toContainText("How the changes affect Lake County");
    await expect(impact).not.toContainText("Boulder");
    await expect(impact).toContainText("Follow-up category unchanged");

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(summary).toBeVisible();
    await expect(impact).toBeVisible();
    await expect(summary).toContainText("0.0 → 0.0 · 0.0 points");
  });

  test("hydrates an unchanged scenario from a shared URL and clears it on reset", async ({
    page,
  }) => {
    const lower = "Lower Atlas priority — Not a safety finding";
    await installExplorer(page, {
      candidates: [
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Lake",
          fips: "08065",
          reasonText: "Lake was returned by the method.",
        }),
      ],
      scores: {
        counties: [
          {
            burgdorferi_status: "Present",
            color: "#55a8a3",
            county: "Lake County",
            evidence_completeness: 80,
            fips: "08065",
            human_status: "published_count_floor",
            in_contiguous_tick_scope: true,
            priority: lower,
            score: {
              access_signal: 0,
              community: 0,
              ecological: 100,
              human_weakness: 0,
              pathogen_signal: 100,
              rural_signal: 0,
              score: 0,
              svi_signal: 0,
              tick_signal: 100,
            },
            state: "CO",
            state_name: "Colorado",
            tick_status: "Established",
          },
        ],
        methodology_version: "1",
        release_id: "alpha-2026",
        settings: scenarioScores.settings,
      },
    });

    await page.goto("/app/review?scope=CO&county=08065&eco=85");
    const summary = page.getByTestId("explorer-scenario-impact-summary");
    await expect(summary).toContainText("0.0 → 0.0 · 0.0 points");
    await expect(summary).not.toContainText("No adjustments");
    await expect(
      page.getByTestId("explorer-what-if-scenario")
    ).not.toHaveAttribute("open", "");

    await page.getByTestId("explorer-what-if-summary").click();
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Lake County");
    await expect(impact).toContainText("Follow-up category unchanged");
    await expect(impact).not.toContainText("Adjusted scenario unavailable");
    await expect(
      page.getByRole("slider", {
        name: "Weight given to tick and pathogen data",
      })
    ).toHaveValue("85");

    await page.getByTestId("explorer-scenario-reset").click();
    await expect(page).not.toHaveURL(/[?&]eco=/);
    await expect(summary).toContainText(
      "Published Atlas score 0.0 · No adjustments"
    );
    await expect(summary).not.toContainText("0.0 points");
    await expect(
      page.getByRole("slider", {
        name: "Weight given to tick and pathogen data",
      })
    ).toHaveValue("65");
  });

  test("shows the what-if panel on national browse and keeps scenario settings into a state", async ({
    page,
  }) => {
    const review = "Priority 2 — Review";
    const investigate = "Priority 1 — Investigate";
    await installExplorer(page, {
      candidates: [
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Boulder",
          fips: "08013",
          reasonText: "Boulder was returned by the method.",
        }),
      ],
      geometry: {
        features: [
          countyBox("08013", -105.6, 40),
          countyBox("08021", -106.2, 37),
        ],
        type: "FeatureCollection",
      },
      scores: {
        counties: [
          {
            burgdorferi_status: "Present",
            color: "#55a8a3",
            county: "Boulder County",
            evidence_completeness: 80,
            fips: "08013",
            human_status: "published_count_floor",
            in_contiguous_tick_scope: true,
            priority: review,
            score: {
              access_signal: 0,
              community: 0,
              ecological: 100,
              human_weakness: 100,
              pathogen_signal: 100,
              rural_signal: 0,
              score: 65,
              svi_signal: 0,
              tick_signal: 100,
            },
            state: "CO",
            state_name: "Colorado",
            tick_status: "Established",
          },
          scenarioScores.counties[0],
        ],
        methodology_version: "1",
        release_id: "alpha-2026",
        settings: scenarioScores.settings,
      },
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/review?scope=ALL");
    const panel = page.getByTestId("explorer-what-if-scenario");
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute("open", "");
    await expect(panel).toContainText("Explore different scenarios");
    await expect(page.getByTestId("explorer-what-if-summary")).toContainText(
      "Adjust assumptions"
    );
    await expect(
      page.getByTestId("explorer-what-if-summary")
    ).not.toContainText("65%");
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText(
      "Select a county to compare its published Atlas score with the score using your changes."
    );
    await expect(panel).not.toContainText("points");
    await expect(page.getByTestId("review-national-orientation")).toBeVisible();
    await expect(page.getByTestId("explorer-map-legend")).not.toContainText(
      "national average"
    );
    await page.screenshot({
      fullPage: true,
      path: "/opt/cursor/artifacts/national-explorer-what-if-after-collapsed.png",
    });

    const summary = page.getByTestId("explorer-what-if-summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("slider")).toHaveCount(3);
    const missing = page.getByRole("slider", {
      name: "Assumption for missing county case data",
    });
    await missing.fill("40");
    await expect(page).toHaveURL(/[?&]missing=40(?:&|$)/);
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText(
      "Select a county to compare its published Atlas score with the score using your changes."
    );
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "Gap review score"
    );
    const map = page.getByTestId("review-national-map-region");
    await expect(map).toHaveAttribute("data-map-colors", /08021:#a9d2db/i);
    await expect(map).not.toHaveAttribute("data-map-colors", /02\d{3}:/);

    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "County boundaries" }).click();
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "County boundaries"
    );
    await expect(page.getByTestId("explorer-map-layer")).not.toContainText(
      "Adjusted scenario"
    );
    await expect(map).not.toHaveAttribute("data-map-colors", /08021:#a9d2db/i);

    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Gap review score" }).click();
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "Gap review score"
    );

    await page.getByTestId("explorer-scenario-reset").click();
    await expect(page).not.toHaveURL(/[?&]missing=/);
    await expect(
      page.getByRole("heading", { name: "Explore county patterns" })
    ).toBeVisible();
    await expect(missing).toHaveValue("75");

    await page.goto("/app/review?scope=ALL&county=08013&eco=85");
    await expect(panel).not.toHaveAttribute("open", "");
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("65.0 → 85.0 · +20.0 points");
    await summary.click();
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Boulder County");
    await expect(impact).toContainText(
      `Follow-up category changed: ${review} → ${investigate}`
    );
    await expect(impact).not.toContainText("Conejos");
    await page.screenshot({
      fullPage: true,
      path: "/opt/cursor/artifacts/national-explorer-what-if-after-selected.png",
    });
    const axe = await new AxeBuilder({ page })
      .include("[data-testid='explorer-what-if-scenario']")
      .analyze();
    expect(axe.violations).toEqual([]);

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(panel).toBeVisible();
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("65.0 → 85.0 · +20.0 points");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page).toHaveURL(/county=08013/);
    await expect(page).toHaveURL(/[?&]eco=85(?:&|$)/);
    await expect(page.getByTestId("review-national-orientation")).toHaveCount(
      0
    );
    await expect(
      page.getByTestId("explorer-scenario-impact-summary")
    ).toContainText("65.0 → 85.0 · +20.0 points");
    await expect(page.getByTestId("explorer-what-if-scenario")).toHaveCount(1);

    await page.goto("/app/review?scope=ALL&county=08013&mode=evidence&eco=85");
    await expect(page.getByTestId("explorer-what-if-scenario")).toHaveCount(0);

    await page.goto("/app/review?scope=ALL&county=08013&mode=follow-up&eco=85");
    await expect(page.getByTestId("explorer-what-if-scenario")).toHaveCount(0);
  });

  test("keeps a limited national county honest and leaves Alaska without the panel", async ({
    page,
  }) => {
    const lower = "Lower Atlas priority — Not a safety finding";
    await installExplorer(page, {
      geometry: {
        features: [countyBox("08001", -105, 39.5)],
        type: "FeatureCollection",
      },
      scores: {
        counties: [
          {
            burgdorferi_status: "Present",
            color: "#a9d2db",
            county: "Adams County",
            evidence_completeness: 80,
            fips: "08001",
            human_status: "published_count_floor",
            in_contiguous_tick_scope: true,
            priority: lower,
            score: {
              access_signal: 0,
              community: 0,
              ecological: 100,
              human_weakness: 0,
              pathogen_signal: 100,
              rural_signal: 0,
              score: 0,
              svi_signal: 0,
              tick_signal: 100,
            },
            state: "CO",
            state_name: "Colorado",
            tick_status: "Established",
          },
        ],
        methodology_version: "1",
        release_id: "alpha-2026",
        settings: scenarioScores.settings,
      },
    });

    await page.goto("/app/review?scope=ALL&county=08001&breakpoint=20");
    const summary = page.getByTestId("explorer-scenario-impact-summary");
    await expect(summary).toContainText(
      "Published Atlas score 0.0 · Score with your changes unavailable"
    );
    await expect(summary).not.toContainText("points");
    await page.getByTestId("explorer-what-if-summary").click();
    const impact = page.getByTestId("explorer-scenario-impact");
    await expect(impact).toContainText("How the changes affect Adams County");
    await expect(impact).toContainText("Unavailable");
    await expect(impact).not.toContainText("points");
    await expect(impact).not.toContainText("Scenario rank");
    await expect(
      page.getByTestId("review-national-map-region")
    ).toHaveAttribute("data-map-colors", /08001:#a9d2db/i);

    await page.goto("/app/review?scope=AK&breakpoint=20");
    await expect(page.getByTestId("explorer-what-if-scenario")).toHaveCount(0);
    await expect(page.getByTestId("review-scope-unsupported")).toBeVisible();
  });
});
