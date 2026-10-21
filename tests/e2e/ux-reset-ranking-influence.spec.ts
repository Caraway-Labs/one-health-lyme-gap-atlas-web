import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import baldwin from "../fixtures/review-al-v11-01003.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { openEvidenceDisclosure } from "./explorer-rail";

const release = baldwin.release.release_id;

const worth = {
  ...baldwin,
  burgdorferi_status: "No records",
  case_count_floor_2023: null,
  color: "#a9d2db",
  county: "Worth County",
  evidence_completeness: 50,
  fips: "19195",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
  human_status: "no_county_linked_record",
  incidence_floor_2023: null,
  pacificus_status: "No records",
  population: 7417,
  priority: "Lower Atlas priority — Not a safety finding",
  rucc_2023: 9,
  scapularis_status: "No records",
  score: {
    access_signal: 25.6,
    community: 28.9,
    ecological: 0,
    human_weakness: 75,
    pathogen_signal: 0,
    rural_signal: 100,
    score: 7.6,
    svi_signal: 2.3,
    tick_signal: 0,
  },
  state: "IA",
  state_name: "Iowa",
  svi_percentile: 0.0232,
  tick_status: "No records",
  uninsured_percent: 5.9,
  uninsured_percentile: 0.2564,
};

const district = {
  ...baldwin,
  burgdorferi_status: "Present",
  case_count_floor_2023: 108,
  color: "#a9d2db",
  county: "District of Columbia",
  evidence_completeness: 100,
  fips: "11001",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
  human_status: "published_count_floor",
  incidence_floor_2023: 16.11,
  pacificus_status: "No records",
  population: 670_587,
  priority: "Lower Atlas priority — Not a safety finding",
  rucc_2023: 1,
  scapularis_status: "Established",
  score: {
    access_signal: 2.9,
    community: 32.2,
    ecological: 100,
    human_weakness: 0,
    pathogen_signal: 100,
    rural_signal: 0,
    score: 0,
    svi_signal: 62.6,
    tick_signal: 100,
  },
  state: "DC",
  state_name: "District of Columbia",
  svi_percentile: 0.6262,
  tick_status: "Established",
  uninsured_percent: 3.4,
  uninsured_percentile: 0.0293,
};

const counties = [worth, district];

async function installRankingFixtures(page: Page) {
  await fulfillCompletedStartingView(page);
  await page.route("**/v1/atlas/metadata**", (route) =>
    route.fulfill({ json: { ...baldwin.release, release_id: release } })
  );
  await page.route("**/v1/atlas/scores**", (route) =>
    route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        counties: counties.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          burgdorferi_status: entry.burgdorferi_status,
          color: entry.color,
          county: entry.county,
          evidence_completeness: entry.evidence_completeness,
          fips: entry.fips,
          scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
          human_status: entry.human_status,
          priority: entry.priority,
          score: entry.score,
          state: entry.state,
          state_name: entry.state_name,
          tick_status: entry.tick_status,
        })),
        release_id: release,
      },
    })
  );
  await page.route("**/v1/states/*/review**", (route) => {
    const state = new URL(route.request().url()).pathname.split("/").at(-2);
    const review = buildStateReview({
      resultState: "unsupported",
      state: state ?? "IA",
    });
    review.data_release_version = release;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({ json: { features: [], type: "FeatureCollection" } })
  );
  await page.route("**/v1/counties/*", (route) => {
    const url = route.request().url();
    if (url.includes("/availability") || url.includes("/tier1-")) {
      return route.fallback();
    }
    const fips = new URL(url).pathname.split("/").at(-1);
    const detail = counties.find((entry) => entry.fips === fips);
    return detail
      ? route.fulfill({ json: detail })
      : route.fulfill({ status: 404, json: { detail: "No published record" } });
  });
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({
      json: { detail: "Catalog unavailable in this fixture" },
      status: 503,
    })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ json: { detail: "No matching priority" }, status: 404 })
  );
  await page.route("**/v1/geographies/county/*/availability", (route) =>
    route.fulfill({
      json: {
        availability: "UNAVAILABLE",
        data: null,
        limitations: [
          "Canonical geography identity delivery is not published by this API capability.",
        ],
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
        release_id: release,
      },
      status: 200,
    })
  );
}

async function captureCard(page: Page, testInfo: TestInfo, name: string) {
  const preview = page.getByTestId("review-published-county-preview");
  await preview.evaluate((card) => {
    const column = card.closest(".ux-reset-explorer-preview");
    if (column instanceof HTMLElement) {
      column.style.height = "auto";
      column.style.overflow = "visible";
    }
  });
  await preview.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.describe("Ranking influence", () => {
  test("explains Worth County without a numeric breakdown and keeps the card actions", async ({
    page,
  }, testInfo) => {
    await installRankingFixtures(page);
    await page.setViewportSize({ height: 1100, width: 1440 });
    await page.goto(`/explore?scope=IA&dataset=${release}&county=19195`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toHaveAttribute("data-fips", "19195");
    await expect(
      preview.getByTestId("selected-county-gap-score")
    ).toContainText("7.6");
    await expect(preview.getByTestId("review-rationale-1")).toContainText(
      "No county-linked 2023 Lyme case record is available."
    );
    await openEvidenceDisclosure(page);
    await expect(preview.getByTestId("review-rationale-6")).toBeVisible();
    const influence = preview.getByTestId("ranking-influence");
    await expect(influence).not.toHaveAttribute("open");
    await expect(
      preview.getByTestId("selected-county-response-tier")
    ).toHaveCount(0);
    await expect(preview.getByTestId("explore-download-pdf")).toBeVisible();
    await expect(page.getByTestId("explorer-map-follow-up")).toBeVisible();
    await captureCard(page, testInfo, "worth-ranking-collapsed");

    await influence.locator("summary").press("Enter");
    await expect(influence).toHaveAttribute("open");
    await expect(
      influence.getByTestId("ranking-influence-breakdown")
    ).toContainText("No score breakdown is available");
    await expect(influence).toContainText("not low ecological hazard");
    await expect(influence).toContainText("not proof of underreporting");
    await expect(influence).not.toContainText("7.6");
    await expect(influence).not.toContainText("75");
    await expect(influence).not.toContainText("%");
    await expect(
      influence.getByRole("link", { name: "How county scoring works" })
    ).toHaveAttribute(
      "href",
      "/docs/releases-and-methodology#how-county-scoring-works"
    );
    await captureCard(page, testInfo, "worth-ranking-expanded");

    const results = await new AxeBuilder({ page })
      .include("[data-testid='review-published-county-preview']")
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("explains a complete-evidence zero score without calling it no hazard", async ({
    page,
  }, testInfo) => {
    await installRankingFixtures(page);
    await page.setViewportSize({ height: 1100, width: 1440 });
    await page.goto(`/explore?scope=DC&dataset=${release}&county=11001`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toHaveAttribute("data-fips", "11001");
    await expect(
      preview.getByTestId("selected-county-gap-score")
    ).toContainText("0.0");
    await expect(preview.getByTestId("review-rationale-2")).toContainText(
      "established"
    );
    await openEvidenceDisclosure(page);
    const influence = preview.getByTestId("ranking-influence");
    await influence.locator("summary").click();
    await expect(influence).toContainText(
      "not a finding of no ecological hazard"
    );
    await expect(influence).not.toContainText("16.11");
    await expect(influence).not.toContainText("%");
    await expect(page.getByTestId("explorer-map-follow-up")).toBeVisible();
    await captureCard(page, testInfo, "dc-ranking-expanded");
  });
});
