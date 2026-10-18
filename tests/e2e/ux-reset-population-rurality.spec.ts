import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { populationRuralityMeasureIds } from "@/features/ux-reset/review/population-rurality-context";

import {
  populationRuralityEnvelope,
  populationRuralityObservation,
  type PopulationRuralityFixtureMeasureId,
} from "../fixtures/population-rurality-context";
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

const SAMPLE_FIPS = "08001";

function isContextMeasure(
  value: string
): value is PopulationRuralityFixtureMeasureId {
  return populationRuralityMeasureIds.some((candidate) => candidate === value);
}

async function installPopulationRuralityMocks(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({
      json: { detail: "Atlas data service is unavailable." },
      status: 503,
    });
  });
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/measures" }, meta: {} },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    await route.fulfill({
      json: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: SAMPLE_FIPS,
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        resultState: "candidates_found",
        state: "CO",
      }),
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const measureId = url.searchParams.get("measure_id") ?? "";
    const fips = url.searchParams.get("geography_id") ?? "";
    const vintage = url.searchParams.get("vintage_year");
    const hasDateFilter =
      url.searchParams.has("year") ||
      url.searchParams.has("start_date") ||
      url.searchParams.has("end_date");
    const rows =
      isContextMeasure(measureId) &&
      fips === SAMPLE_FIPS &&
      vintage !== null &&
      !hasDateFilter
        ? [populationRuralityObservation({ fips, measureId })]
        : [];
    await route.fulfill({
      json: populationRuralityEnvelope(rows),
      status: 200,
    });
  });
}

test.describe("Atlas Explorer population and rurality context", () => {
  test("shows county context and keeps the selected county in the URL", async ({
    page,
  }, testInfo) => {
    await installPopulationRuralityMocks(page);
    await page.goto(`/explore?scope=CO&county=${SAMPLE_FIPS}&mode=evidence`);
    const section = page.getByTestId("explorer-population-rurality");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-county", SAMPLE_FIPS);
    await expect(page.getByText("520,149 people")).toBeVisible();
    await expect(page.getByText("0.7264 percentile")).toBeVisible();
    await expect(page.getByText("0.6742 percentile")).toBeVisible();
    await expect(page.getByText("10.8 percent")).toBeVisible();
    await expect(
      page.getByText("Metro: area population at least 1 million (code 1)")
    ).toBeVisible();
    await expect(page.getByText("2023 classification vintage")).toBeVisible();
    await expect(
      section.getByText("2018-01-01 through 2022-12-31").first()
    ).toBeVisible();
    await expect(section.getByTestId("explorer-map-layer")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`county=${SAMPLE_FIPS}`));
    await expect(page).toHaveURL(/mode=evidence/);

    await page
      .getByRole("heading", { name: "Population & Rurality Context" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("population-rurality-loaded.png"),
    });
    await page.getByTestId("population-rurality-measure-rucc_2023").screenshot({
      path: testInfo.outputPath("population-rurality-rucc.png"),
    });

    const provenance = section.getByText("Inspect provenance").first();
    await provenance.focus();
    await page.keyboard.press("Enter");
    await expect(provenance).toBeFocused();
    await expect(
      section.getByRole("link", {
        name: "USDA ERS Rural-Urban Continuum Codes",
      })
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByTestId("explorer-population-rurality")
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`county=${SAMPLE_FIPS}`));
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page.getByText("520,149 people")).toBeVisible();

    await page.getByTestId("explorer-back-to-map").click();
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page).toHaveURL(new RegExp(`county=${SAMPLE_FIPS}`));
    await expect(page.getByTestId("explorer-population-rurality")).toHaveCount(
      0
    );

    await page.goto(`/explore?scope=CO&county=${SAMPLE_FIPS}&mode=evidence`);
    await expect(page.getByText("10.8 percent")).toBeVisible();

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(results.violations).toEqual([]);
    }

    if (releaseViewportRuns(testInfo.project.name, 390)) {
      await page.setViewportSize({ height: 844, width: 390 });
      await expect(section).toBeVisible();
      await expect(page.getByText("520,149 people")).toBeVisible();
      const overflows = await section.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1
      );
      expect(overflows).toBe(false);
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("population-rurality-mobile.png"),
      });
    }
  });
});
