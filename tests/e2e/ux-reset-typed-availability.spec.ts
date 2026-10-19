import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../fixtures/investigate-api-fixtures";
import autaugaCounty from "../fixtures/review-al-01001.json" with { type: "json" };
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

const RELEASE = "alpha-2026";
const KNOWN_EMPTY_LIMITATION =
  "No published observations match this selection in the checked release. This does not establish biological absence, source coverage, or geography membership.";

const COUNTIES = [
  {
    county: "Autauga County",
    fips: "01001",
    state: "AL",
    stateName: "Alabama",
  },
  {
    county: "Ballard County",
    fips: "21007",
    state: "KY",
    stateName: "Kentucky",
  },
  {
    county: "Capitol Planning Region",
    fips: "09110",
    state: "CT",
    stateName: "Connecticut",
  },
] as const;

type ObservationMode = "error" | "known-empty" | "populated";

function polygon(fips: string, west: number) {
  return {
    geometry: {
      coordinates: [
        [
          [west, 32],
          [west + 1, 32],
          [west + 1, 33],
          [west, 33],
          [west, 32],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

function scores() {
  const template = reviewScopeScoresFixture.counties[0];
  if (!template) {
    throw new Error("Missing score template.");
  }
  return {
    ...reviewScopeScoresFixture,
    counties: COUNTIES.map((county) => ({
      ...template,
      county: county.county,
      fips: county.fips,
      state: county.state,
      state_name: county.stateName,
    })),
  };
}

function metadata() {
  return {
    ...reviewScopeMetadataFixture,
    states: COUNTIES.map((county) => ({
      code: county.state,
      name: county.stateName,
    })),
  };
}

function observationEnvelope(
  mode: ObservationMode,
  measureId: string,
  fips: string
) {
  if (mode === "error") {
    return {
      body: { detail: "Service unavailable", status: 503 },
      status: 503,
    };
  }
  if (mode === "known-empty") {
    return {
      body: {
        data: [],
        links: { self: "/v1/observations" },
        meta: {
          availability: "UNAVAILABLE",
          limitations: [KNOWN_EMPTY_LIMITATION],
          next_page_token: null,
          reason: "NO_PUBLISHED_RESULTS",
          release_id: RELEASE,
          response_at: "2026-10-18T00:00:00.000Z",
        },
      },
      status: 200,
    };
  }
  return {
    body: {
      data: investigateObservationsFor({
        fips,
        measureId,
        scenario: "sparse",
      }),
      links: { self: "/v1/observations" },
      meta: {
        availability: "AVAILABLE",
        limitations: [],
        next_page_token: null,
        reason: null,
        release_id: RELEASE,
        response_at: "2026-10-18T00:00:00.000Z",
      },
    },
    status: 200,
  };
}

async function installAvailabilityMocks(
  page: Page,
  options: { availabilityStatus?: number; observations?: ObservationMode } = {}
) {
  const availabilityStatus = options.availabilityStatus ?? 200;
  const observations = options.observations ?? "known-empty";
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
    await route.fulfill({ json: metadata(), status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scores(), status: 200 });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state = new URL(route.request().url()).pathname.split("/").at(-2);
    const county = COUNTIES.find((entry) => entry.state === state);
    await route.fulfill({
      json: buildStateReview({
        candidates: county
          ? [
              reviewCandidate({
                caveat:
                  "This review reason is separate from canonical geography publication.",
                countyName: county.county,
                fips: county.fips,
                reasonText: "Pathogen status is reported for this county.",
              }),
            ]
          : [],
        state: state ?? "AL",
      }),
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: {
        features: COUNTIES.map((county, index) =>
          polygon(county.fips, -88 + index)
        ),
        type: "FeatureCollection",
      },
      status: 200,
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
  await page.route("**/v1/geographies/county/*/availability", async (route) => {
    if (availabilityStatus !== 200) {
      await route.fulfill({
        json: {
          code:
            availabilityStatus === 404
              ? "RESOURCE_NOT_FOUND"
              : "SERVICE_UNAVAILABLE",
          detail:
            availabilityStatus === 404
              ? "County is not in the current geography release."
              : "Service unavailable",
          status: availabilityStatus,
          title: "Request failed",
        },
        status: availabilityStatus,
      });
      return;
    }
    await route.fulfill({
      headers: { "cache-control": "no-store" },
      json: {
        availability: "UNAVAILABLE",
        data: null,
        limitations: [
          "Canonical geography identity delivery is not published by this API capability.",
          "County membership is confirmed from the governed county directory release. No canonical, display, or analysis geometry is returned or inferred.",
        ],
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
        release_id: RELEASE,
      },
      status: 200,
    });
  });
  await page.route("**/v1/counties/*", async (route) => {
    const fips =
      new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const county = COUNTIES.find((entry) => entry.fips === fips);
    await route.fulfill({
      json: {
        ...autaugaCounty,
        county: county?.county ?? autaugaCounty.county,
        fips: county?.fips ?? fips,
        release: { ...autaugaCounty.release, release_id: RELEASE },
        state: county?.state ?? autaugaCounty.state,
        state_name: county?.stateName ?? autaugaCounty.state_name,
      },
      status: 200,
    });
  });
  await page.route(
    "**/v1/counties/*/tier1-surveillance-priority**",
    async (route) => {
      await route.fulfill({
        json: { detail: "No matching priority" },
        status: 404,
      });
    }
  );
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const measureId = url.searchParams.get("measure_id") ?? "reported-cases";
    const fips = url.searchParams.get("geography_id") ?? "";
    if (url.searchParams.get("page_token")) {
      await route.fulfill({
        json: {
          data: [],
          links: { self: "/v1/observations" },
          meta: {
            availability: "AVAILABLE",
            limitations: [],
            next_page_token: null,
            reason: null,
            release_id: RELEASE,
          },
        },
        status: 200,
      });
      return;
    }
    const envelope = observationEnvelope(observations, measureId, fips);
    await route.fulfill({ json: envelope.body, status: envelope.status });
  });
}

async function saveDesktopShot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  testId: string
) {
  if (!releaseViewportRuns(testInfo.project.name, 1280)) {
    return;
  }
  await page.getByTestId(testId).screenshot({
    path: testInfo.outputPath(`${name}.png`),
  });
}

test.describe("typed geography and observation availability", () => {
  for (const county of COUNTIES) {
    test(`shows unpublished canonical geography for ${county.fips} without hiding the county`, async ({
      page,
    }, testInfo) => {
      await installAvailabilityMocks(page);
      await page.goto(
        `/explore?scope=${county.state}&county=${county.fips}&dataset=${RELEASE}`
      );
      const preview = page.getByTestId("review-county-preview");
      await expect(preview).toContainText(county.county);
      await expect(preview).toContainText(county.fips);
      await expect(
        preview.getByTestId("canonical-geography-availability")
      ).toHaveCount(0);
      await expect(preview).not.toContainText(
        "Canonical geography is not yet published"
      );
      await expect(page.getByTestId("review-state-map-region")).toBeVisible();
      await saveDesktopShot(
        page,
        testInfo,
        `unpublished-county-${county.fips}`,
        "review-county-preview"
      );
    });
  }

  test("shows known-empty observations without calling them an error", async ({
    page,
  }, testInfo) => {
    await installAvailabilityMocks(page, { observations: "known-empty" });
    await page.goto(
      `/explore?scope=AL&county=01001&dataset=${RELEASE}&mode=evidence`
    );
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      "Autauga County"
    );
    const notice = page.getByTestId("investigate-known-empty");
    await expect(notice).toContainText(
      "No published results for this selection."
    );
    await expect(notice).toContainText("does not establish biological absence");
    await expect(notice).toHaveAttribute(
      "data-selection-reason",
      "NO_PUBLISHED_RESULTS"
    );
    await expect(
      page
        .getByTestId("explorer-county-evidence")
        .getByTestId("canonical-geography-availability")
    ).toHaveAttribute("data-status", "unpublished");
    await expect(page.locator("[data-atlas-status='error']")).toHaveCount(0);
    await saveDesktopShot(
      page,
      testInfo,
      "known-empty-observations-01001",
      "explorer-county-evidence"
    );
  });

  test("keeps a populated observation and its source", async ({
    page,
  }, testInfo) => {
    await installAvailabilityMocks(page, { observations: "populated" });
    await page.goto(
      `/explore?scope=KY&county=21007&dataset=${RELEASE}&mode=evidence`
    );
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      "Ballard County"
    );
    await expect(page.getByText("7").first()).toBeVisible();
    await expect(page.getByText("CDC surveillance").first()).toBeVisible();
    await expect(page.getByTestId("investigate-known-empty")).toHaveCount(0);
    await expect(
      page
        .getByTestId("explorer-county-evidence")
        .getByTestId("canonical-geography-availability")
    ).toContainText(
      "Canonical geography is not yet published for this county."
    );
    await saveDesktopShot(
      page,
      testInfo,
      "populated-observations-21007",
      "explorer-county-evidence"
    );
  });

  test("keeps a failed observation request distinct from known-empty", async ({
    page,
  }) => {
    await installAvailabilityMocks(page, { observations: "error" });
    await page.goto(
      `/explore?scope=CT&county=09110&dataset=${RELEASE}&mode=evidence`
    );
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      "Capitol Planning Region"
    );
    await expect(
      page.locator("[data-atlas-status='error']").first()
    ).toBeVisible();
    await expect(page.getByTestId("investigate-known-empty")).toHaveCount(0);
    await expect(
      page.getByText("No published results for this selection.")
    ).toHaveCount(0);
  });

  test("renders a missing availability identity as an error", async ({
    page,
  }) => {
    await installAvailabilityMocks(page, { availabilityStatus: 404 });
    await page.goto(`/explore?scope=AL&county=01001&dataset=${RELEASE}`);
    await expect(
      page.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    await expect(page.getByTestId("review-county-preview")).toContainText(
      "Autauga County"
    );
    await expect(page.getByTestId("review-county-preview")).not.toContainText(
      "not in the current geography release"
    );
  });

  test("keeps the unpublished notice readable on a phone width", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width availability checks run on the mobile project."
    );
    await installAvailabilityMocks(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`/explore?scope=AL&county=01001&dataset=${RELEASE}`);
    const preview = page.getByTestId("review-county-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    const box = await preview.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  });

  test("has no accessibility violations on the unpublished county card", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 1280),
      "Desktop axe runs on the desktop project."
    );
    await installAvailabilityMocks(page);
    await page.goto(`/explore?scope=CT&county=09110&dataset=${RELEASE}`);
    const preview = page.getByTestId("review-county-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .include("[data-testid='review-county-preview']")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
