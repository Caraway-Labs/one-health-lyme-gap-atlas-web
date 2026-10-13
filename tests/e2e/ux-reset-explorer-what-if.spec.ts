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

async function installExplorer(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scenarioScores, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
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
        candidates: [
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
    await expect(panel).toContainText("What-if scenario");
    await expect(panel).toContainText("65%");
    await expect(panel).toContainText("10 per 100,000");
    await expect(panel).toContainText("View & adjust assumptions");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.getByTestId("review-candidate")).toContainText(
      "Published score 22.9"
    );
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
    await page.screenshot({
      path: "/opt/cursor/artifacts/what-if-collapsed.png",
      fullPage: true,
    });

    const summary = page.getByTestId("explorer-what-if-summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    const missing = page.getByRole("slider", {
      name: "Missing county-record value",
    });
    await expect(missing).toBeVisible();
    await missing.focus();
    await missing.fill("40");

    const candidate = page.getByTestId("review-candidate");
    await expect(candidate).toContainText("Published score 22.9");
    await expect(candidate).toContainText("Adjusted scenario 12.2");
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "Adjusted scenario"
    );
    await expect(page.getByTestId("explorer-map-legend")).toContainText(
      "not personal disease risk"
    );
    await page.screenshot({
      path: "/opt/cursor/artifacts/what-if-expanded-changed.png",
      fullPage: true,
    });
    await candidate.scrollIntoViewIfNeeded();
    await candidate.screenshot({
      path: "/opt/cursor/artifacts/what-if-county-adjusted.png",
    });

    await page.getByTestId("explorer-scenario-reset").click();
    await expect(page.getByTestId("explorer-scenario-score")).toHaveCount(0);
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
});
