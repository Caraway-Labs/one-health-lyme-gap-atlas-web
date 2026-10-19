import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  environmentalContextMeasureIds,
  type EnvironmentalContextMeasureId,
} from "@/features/ux-reset/review/environmental-context";

import {
  ENVIRONMENTAL_DAY_CONVENTION,
  environmentalEnvelope,
  environmentalObservation,
} from "../fixtures/environmental-context";
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

const RELEASE_ID = "alpha-2026";
const SAMPLE_FIPS = "48277";

function isEnvironmentalMeasure(
  value: string
): value is EnvironmentalContextMeasureId {
  return environmentalContextMeasureIds.some(
    (candidate) => candidate === value
  );
}

function texasScores() {
  const template = reviewScopeScoresFixture.counties[0];
  return {
    ...reviewScopeScoresFixture,
    counties: [
      ...reviewScopeScoresFixture.counties,
      {
        ...template,
        county: "Gonzales",
        fips: SAMPLE_FIPS,
        state: "TX",
        state_name: "Texas",
      },
    ],
  };
}

async function installEnvironmentalMocks(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({
      json: { detail: "Atlas data service is unavailable." },
      status: 503,
    });
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
        ...reviewScopeMetadataFixture,
        states: [
          ...reviewScopeMetadataFixture.states,
          { code: "TX", name: "Texas" },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: texasScores(), status: 200 });
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
            countyName: "Gonzales",
            fips: SAMPLE_FIPS,
            reasonText:
              "Gonzales is included because the review method returned it.",
          }),
        ],
        resultState: "candidates_found",
        state: "TX",
      }),
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const measureId = url.searchParams.get("measure_id") ?? "";
    const fips = url.searchParams.get("geography_id") ?? "";
    const date = url.searchParams.get("start_date") ?? "";
    const rows =
      isEnvironmentalMeasure(measureId) &&
      fips === SAMPLE_FIPS &&
      date === "2025-01-17"
        ? [
            environmentalObservation({
              date,
              fips,
              measureId,
              releaseId: RELEASE_ID,
            }),
          ]
        : [];
    await route.fulfill({
      json: environmentalEnvelope(rows),
      status: 200,
    });
  });
}

test.describe("Atlas Explorer environmental context", () => {
  test("shows January NOAA context for the selected county", async ({
    page,
  }, testInfo) => {
    await installEnvironmentalMocks(page);
    await page.goto(`/explore?scope=TX&county=${SAMPLE_FIPS}&mode=evidence`);
    const section = page.getByTestId("explorer-environmental-context");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-county", SAMPLE_FIPS);
    await expect(page.getByLabel("Observation date")).toHaveValue("2025-01-17");
    await expect(page.getByText("0.0 mm")).toBeVisible();
    await expect(page.getByText("-1.992294192037333 °C")).toBeVisible();
    await expect(page.getByText("16.29939307942125 °C")).toBeVisible();
    await expect(page.getByText("7.153611977327104 °C")).toBeVisible();
    await expect(
      page.getByText(ENVIRONMENTAL_DAY_CONVENTION).first()
    ).toBeVisible();
    const methodVersion = section
      .getByText("Method version", { exact: true })
      .first();
    await methodVersion.scrollIntoViewIfNeeded();
    await expect(methodVersion).toBeVisible();
    await expect(
      section.getByText("noaa_nclimgrid_daily_202501", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText(/not the latest day/)).toBeVisible();
    await expect(section.getByTestId("explorer-map-layer")).toHaveCount(0);

    await page
      .getByRole("heading", { name: "Environmental context" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("environmental-context-loaded.png"),
    });
    await page
      .getByTestId("environmental-measure-nclimgrid_prcp_county_day")
      .screenshot({
        path: testInfo.outputPath("environmental-context-precipitation.png"),
      });

    const provenance = page.getByText("Inspect provenance").first();
    await provenance.focus();
    await page.keyboard.press("Enter");
    await expect(provenance).toBeFocused();
    await expect(
      section
        .getByText("Provenance reference", { exact: true })
        .filter({ visible: true })
        .first()
    ).toBeVisible();

    await page.getByLabel("Observation date").fill("2025-01-18");
    await expect(page.getByText("0.0 mm")).toHaveCount(0);
    await expect(page.getByText(/absence is not zero/i)).toHaveCount(0);
    await expect(
      page.getByText(/No governed observation was returned/i).first()
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("environmental-context-other-day.png"),
    });

    await page.getByLabel("Observation date").fill("2025-01-17");
    await expect(page.getByText("0.0 mm")).toBeVisible();

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(results.violations).toEqual([]);
    }

    if (releaseViewportRuns(testInfo.project.name, 390)) {
      await page.setViewportSize({ height: 844, width: 390 });
      await expect(section).toBeVisible();
      await expect(page.getByText("0.0 mm")).toBeVisible();
      const overflows = await section.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1
      );
      expect(overflows).toBe(false);
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("environmental-context-mobile.png"),
      });
    }
  });
});
