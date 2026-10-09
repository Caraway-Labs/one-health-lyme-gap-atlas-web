import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import type { Tier1CountyPriority } from "@/generated/models";

import {
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../fixtures/investigate-api-fixtures";
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "../fixtures/tier1-surveillance-priority";

const E2E_RELEASE_ID = "alpha-2026";

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 80,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

function previewCounty(input: { county: string; fips: string; score: number }) {
  return {
    burgdorferi_status: "Present",
    color: "#a9d2db",
    county: input.county,
    evidence_completeness: 100,
    fips: input.fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower",
    score: { ...scoreBreakdown, score: input.score },
    state: "NY",
    state_name: "New York",
    tick_status: "Established",
  };
}

const reviewCounties = [
  previewCounty({ county: "Albany", fips: "36001", score: 90 }),
  previewCounty({ county: "Orange", fips: "36003", score: 70 }),
  previewCounty({ county: "Bronx", fips: "36005", score: 60 }),
];

type Tier1Route =
  | { body: Tier1CountyPriority; status: 200 }
  | { status: 404 | 503 };

function problem(status: number, detail: string) {
  return {
    detail,
    instance: "/v1/counties/00000/tier1-surveillance-priority",
    request_id: "tier1-test",
    status,
    title: status === 404 ? "Not found" : "Request failed",
    type: `https://carawaylabs.com/problems/http-${status}`,
  };
}

function alignedTier(result: Tier1CountyPriority, fips: string) {
  return tier1PriorityForRelease(
    tier1PriorityForCounty(result, fips),
    E2E_RELEASE_ID
  );
}

async function installTier1Review(
  page: Page,
  routes: Record<string, Tier1Route>,
  options: { metadataStatus?: number } = {}
) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    if (options.metadataStatus && options.metadataStatus !== 200) {
      await route.fulfill({
        contentType: "application/problem+json",
        json: problem(
          options.metadataStatus,
          "Release metadata is unavailable."
        ),
        status: options.metadataStatus,
      });
      return;
    }
    const requested = new URL(route.request().url()).searchParams.get(
      "dataset_version"
    );
    await route.fulfill({
      json: {
        ...reviewScopeMetadataFixture,
        release_id: requested || reviewScopeMetadataFixture.release_id,
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    const requested = new URL(route.request().url()).searchParams.get(
      "dataset_version"
    );
    await route.fulfill({
      json: {
        counties: reviewCounties,
        methodology_version: "1",
        release_id: requested || E2E_RELEASE_ID,
        settings: {
          ecological_share: 65,
          low_incidence_breakpoint: 10,
          missing_human_weakness: 75,
        },
      },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const url = new URL(route.request().url());
    const state = url.pathname.split("/").at(-2) ?? "";
    const dataset = url.searchParams.get("dataset_version") ?? E2E_RELEASE_ID;
    const counties =
      state === "NY"
        ? [
            { countyName: "Albany", fips: "36001" },
            { countyName: "Orange", fips: "36003" },
            { countyName: "Bronx", fips: "36005" },
          ]
        : [];
    const review = buildStateReview({
      candidates: counties.map((county) =>
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: county.countyName,
          fips: county.fips,
          reasonText: `${county.countyName} is included because the review method returned it.`,
        })
      ),
      resultState: counties.length > 0 ? "candidates_found" : "none_stand_out",
      state,
    });
    await route.fulfill({
      json: {
        ...review,
        data_release_version: dataset,
        requested_state: state,
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
  await page.route("**/v1/indicators**", async (route) => {
    await route.fulfill({
      json: {
        data: investigateIndicatorsFixture,
        links: { self: "/v1/indicators" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    const geography = new URL(route.request().url()).searchParams.get(
      "geography_type"
    );
    await route.fulfill({
      json: {
        data: investigateMeasuresFixture.filter(
          (measure) => measure.geography_semantics === geography
        ),
        links: { self: "/v1/measures" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      json: {
        data: investigateObservationsFor({
          fips: url.searchParams.get("geography_id") ?? "",
          measureId: url.searchParams.get("measure_id") ?? "",
          scenario: "mixed",
        }),
        links: { self: "/v1/observations" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route(
    "**/v1/counties/*/tier1-surveillance-priority",
    async (route) => {
      const fips = new URL(route.request().url()).pathname.split("/").at(-2);
      const match = fips ? routes[fips] : undefined;
      if (match?.status === 200) {
        await route.fulfill({ json: match.body, status: 200 });
        return;
      }
      if (match?.status === 503) {
        await route.fulfill({
          contentType: "application/problem+json",
          json: problem(503, "Atlas data service is unavailable."),
          status: 503,
        });
        return;
      }
      await route.fulfill({
        contentType: "application/problem+json",
        json: problem(404, "No current Tier 1 county result"),
        status: 404,
      });
    }
  );
}

async function expectNoLowTier(page: Page) {
  const region = page.getByTestId("tier1-surveillance-priority");
  await expect(region).toBeVisible();
  await expect(region).not.toHaveAttribute("data-tier", "LOW");
  await expect(region).not.toContainText(/\bLOW\b/);
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    fullPage: true,
    path: `/opt/cursor/artifacts/${name}-${testInfo.project.name}.png`,
  });
}

test.describe("Tier 1 model-assisted surveillance priority", () => {
  test("continues a returned priority from Review into Investigate", async ({
    page,
  }, testInfo) => {
    await installTier1Review(page, {
      "36001": {
        body: alignedTier(tier1HighSufficientFixture, "36001"),
        status: 200,
      },
    });
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    const review = page.getByTestId("tier1-surveillance-priority");
    await expect(review).toHaveAttribute("data-tier", "HIGH");
    await expect(review).toHaveAttribute("data-sufficiency", "SUFFICIENT");
    await expect(review).toContainText("Model-assisted");
    await expect(review).toContainText("Sufficient");
    await expect(review).toContainText("Publisher reports pathogen Present.");
    await expect(review).toContainText(
      "not disease risk or predicted incidence"
    );
    await expect(page.getByTestId("review-preview-why")).toContainText(
      "Albany is included because the review method returned it."
    );
    await review.getByText("Model and as-of details").click();
    await expect(review).toContainText("tier1-statistical-reference-v1");
    await expect(review).toContainText("98.56824689786828");
    await shot(page, testInfo, "tier1-review-high");
    const regionResults = await new AxeBuilder({ page })
      .include('[data-testid="tier1-surveillance-priority"]')
      .analyze();
    expect(regionResults.violations).toEqual([]);

    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=36001/);
    const investigate = page.getByTestId("tier1-surveillance-priority");
    await expect(investigate).toHaveAttribute("data-tier", "HIGH");
    await expect(investigate).toHaveAttribute("data-sufficiency", "SUFFICIENT");
    await expect(investigate).toContainText(
      "Publisher reports pathogen Present."
    );
    await expect(investigate).toContainText(
      "does not replace governed evidence"
    );
    await expect(page.getByTestId("investigate-evidence")).toBeVisible();
    await shot(page, testInfo, "tier1-investigate-high");
  });

  test("shows LOW with insufficient evidence and does not drop the tier", async ({
    page,
  }, testInfo) => {
    await installTier1Review(page, {
      "36003": {
        body: alignedTier(tier1LowInsufficientFixture, "36003"),
        status: 200,
      },
    });
    await page.goto("/app/review?scope=NY&county=36003&dataset=alpha-2026");
    const region = page.getByTestId("tier1-surveillance-priority");
    await expect(region).toHaveAttribute("data-tier", "LOW");
    await expect(region).toHaveAttribute("data-sufficiency", "INSUFFICIENT");
    await expect(region.getByTestId("tier1-priority-tier")).toHaveText("LOW");
    await expect(region.getByTestId("tier1-evidence-sufficiency")).toHaveText(
      "Insufficient"
    );
    await expect(region).toContainText(
      "No county-linked human record is available"
    );
    await shot(page, testInfo, "tier1-review-low-insufficient");
  });

  test("keeps a missing result, a failed request, and absent reasons off the LOW tier", async ({
    page,
  }, testInfo) => {
    await installTier1Review(page, {
      "36001": {
        body: alignedTier(
          { ...tier1HighSufficientFixture, reasons: [] },
          "36001"
        ),
        status: 200,
      },
      "36003": { status: 404 },
      "36005": { status: 503 },
    });
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    await expect(page.getByTestId("tier1-reasons-absent")).toHaveText(
      "No contributing reasons were returned."
    );
    await expect(page.getByTestId("tier1-priority-tier")).toHaveText("HIGH");

    await page.goto("/app/review?scope=NY&county=36003&dataset=alpha-2026");
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-state", "unavailable");
    await expectNoLowTier(page);
    await shot(page, testInfo, "tier1-review-unavailable");

    await page.goto("/app/review?scope=NY&county=36005&dataset=alpha-2026");
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-state", "failed", { timeout: 15_000 });
    await expectNoLowTier(page);
  });

  test("does not show a stale payload for a different county", async ({
    page,
  }) => {
    await installTier1Review(page, {
      "36001": {
        body: tier1PriorityForRelease(
          tier1LowInsufficientFixture,
          E2E_RELEASE_ID
        ),
        status: 200,
      },
    });
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    const region = page.getByTestId("tier1-surveillance-priority");
    await expect(region).toHaveAttribute("data-state", "stale");
    await expectNoLowTier(page);
    await expect(region).not.toContainText("MEDIUM");
  });

  test("does not show the current batch for a historical review or investigate release", async ({
    page,
  }) => {
    await installTier1Review(page, {
      "36001": {
        body: tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
        status: 200,
      },
    });
    await page.goto(
      "/app/review?scope=NY&county=36001&dataset=historical-2024"
    );
    const review = page.getByTestId("tier1-surveillance-priority");
    await expect(review).toHaveAttribute("data-state", "release-unaligned");
    await expect(review).toHaveAttribute("data-release-reason", "mismatch");
    await expectNoLowTier(page);
    await expect(review).not.toContainText("HIGH");
    await expect(page.getByTestId("review-county-preview")).toBeVisible();

    await page.goto(
      "/app/investigate?county=36001&scope=NY&dataset=historical-2024"
    );
    const investigate = page.getByTestId("tier1-surveillance-priority");
    await expect(investigate).toHaveAttribute(
      "data-state",
      "release-unaligned"
    );
    await expect(investigate).toHaveAttribute(
      "data-release-reason",
      "mismatch"
    );
    await expectNoLowTier(page);
    await expect(investigate).not.toContainText("HIGH");
  });

  test("drops a matched tier when the same county changes release", async ({
    page,
  }) => {
    await installTier1Review(page, {
      "36001": {
        body: alignedTier(tier1HighSufficientFixture, "36001"),
        status: 200,
      },
    });
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-tier", "HIGH");
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/app/review?scope=NY&county=36001&dataset=historical-2024";
      link.textContent = "Switch governed release";
      link.dataset.testid = "tier1-dataset-switch";
      document.body.append(link);
    });
    await page.getByTestId("tier1-dataset-switch").click();
    await expect(page).toHaveURL(/dataset=historical-2024/);
    const review = page.getByTestId("tier1-surveillance-priority");
    await expect(review).toHaveAttribute("data-state", "release-unaligned");
    await expect(review).toHaveAttribute("data-release-reason", "mismatch");
    await expect(review).not.toHaveAttribute("data-tier", "HIGH");
    await expectNoLowTier(page);

    await page.goto(
      "/app/investigate?county=36001&scope=NY&dataset=alpha-2026"
    );
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-tier", "HIGH");
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href =
        "/app/investigate?county=36001&scope=NY&dataset=historical-2024";
      link.textContent = "Switch governed release";
      link.dataset.testid = "tier1-dataset-switch";
      document.body.append(link);
    });
    await page.getByTestId("tier1-dataset-switch").click();
    await expect(page).toHaveURL(/dataset=historical-2024/);
    const investigate = page.getByTestId("tier1-surveillance-priority");
    await expect(investigate).toHaveAttribute(
      "data-state",
      "release-unaligned"
    );
    await expect(investigate).toHaveAttribute(
      "data-release-reason",
      "mismatch"
    );
    await expect(investigate).not.toHaveAttribute("data-tier", "HIGH");
    await expectNoLowTier(page);
  });

  test("does not align a tier when release metadata fails", async ({
    page,
  }) => {
    await installTier1Review(
      page,
      {
        "36001": {
          body: alignedTier(tier1HighSufficientFixture, "36001"),
          status: 200,
        },
      },
      { metadataStatus: 503 }
    );
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    const review = page.getByTestId("tier1-surveillance-priority");
    await expect(review).toHaveAttribute("data-state", "release-unaligned");
    await expect(review).toHaveAttribute("data-release-reason", "unknown");
    await expectNoLowTier(page);
    await expect(review).not.toContainText("HIGH");

    await page.goto(
      "/app/investigate?county=36001&scope=NY&dataset=alpha-2026"
    );
    const investigate = page.getByTestId("tier1-surveillance-priority");
    await expect(investigate).toHaveAttribute(
      "data-state",
      "release-unaligned"
    );
    await expect(investigate).toHaveAttribute("data-release-reason", "unknown");
    await expectNoLowTier(page);
    await expect(investigate).not.toContainText("HIGH");
  });
});
