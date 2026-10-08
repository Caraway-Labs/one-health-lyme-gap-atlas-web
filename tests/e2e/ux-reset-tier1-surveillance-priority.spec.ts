import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import type { Tier1CountyPriority } from "@/generated/models";

import {
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../fixtures/investigate-api-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
} from "../fixtures/tier1-surveillance-priority";

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

async function installTier1Review(
  page: Page,
  routes: Record<string, Tier1Route>
) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        counties: reviewCounties,
        methodology_version: "1",
        release_id: "alpha-2026",
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
        body: tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
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
      "Lower review priority"
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
        body: tier1PriorityForCounty(tier1LowInsufficientFixture, "36003"),
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
        body: tier1PriorityForCounty(
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
        body: tier1LowInsufficientFixture,
        status: 200,
      },
    });
    await page.goto("/app/review?scope=NY&county=36001&dataset=alpha-2026");
    const region = page.getByTestId("tier1-surveillance-priority");
    await expect(region).toHaveAttribute("data-state", "stale");
    await expectNoLowTier(page);
    await expect(region).not.toContainText("MEDIUM");
  });
});
