import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";

async function installOperatingPicture(
  page: Page,
  reviewForState: (state: string) => unknown
) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    await route.fulfill({ json: reviewForState(state), status: 200 });
  });
}

test.describe("Review operating picture", () => {
  test("shows a candidate reason, basis, caveat, and Investigate path", async ({
    page,
  }, testInfo) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08031",
            detail: "Environmental context stays a data gap.",
          },
        ],
        resultState: "candidates_found",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "candidates_found"
    );
    await expect(page.getByTestId("review-methodology")).toContainText(
      "atlas-county-review 1.0.0"
    );
    await expect(page.getByTestId("review-observed-basis")).toContainText(
      "Borrelia burgdorferi sensu stricto"
    );
    await expect(page.getByTestId("review-county-preview")).toContainText(
      "Collection dates are unavailable"
    );
    await expect(page.getByTestId("review-data-gap")).toHaveAttribute(
      "data-fips",
      "08031"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(1);
    const href =
      (await page.getByTestId("review-investigate").getAttribute("href")) ?? "";
    expect(href).toContain("county=08001");
    expect(href).toContain("/app/investigate");
    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);

    if (!testInfo.project.name.includes("mobile")) {
      await page.goBack();
      await expect(page.getByTestId("review-state-panel")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("keeps an unavailable review request distinct from nothing stands out", async ({
    page,
  }) => {
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      await route.fulfill({
        json: { detail: "Atlas data service is unavailable." },
        status: 503,
      });
    });
    await page.goto("/app/review?scope=CO");
    await expect(page.locator("[data-atlas-status='error']")).toContainText(
      "temporarily unavailable"
    );
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
  });

  test("keeps insufficient evidence distinct from data gaps and nothing stands out", async ({
    page,
  }) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08001",
            detail: "Eligible evidence is missing for this county.",
          },
        ],
        resultState: "insufficient_evidence",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "insufficient_evidence"
    );
    await expect(page.getByTestId("review-result-summary")).toContainText(
      "not enough eligible evidence"
    );
    await expect(page.getByTestId("review-data-gap")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    await expect(page.getByTestId("review-data-gaps")).toContainText(
      "Unavailable"
    );
  });

  test("renders unsupported gaps as data-gap-only", async ({ page }) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08031",
            detail: "Environmental context stays a data gap.",
          },
        ],
        resultState: "unsupported",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "data_gap_only"
    );
    await expect(page.getByTestId("review-result-summary")).toContainText(
      "No review candidate was returned"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.getByTestId("review-data-gap")).toHaveCount(1);
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
  });

  test("clears the county when the next result has no candidates", async ({
    page,
  }) => {
    await installOperatingPicture(page, (state) => {
      if (state === "NY") {
        return buildStateReview({
          resultState: "none_stand_out",
          state,
        });
      }
      return buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        resultState: "candidates_found",
        state,
      });
    });
    await page.goto("/app/review?scope=CO&county=08001");
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "data-county",
      "08001"
    );
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "none_stand_out"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).not.toHaveURL(/county=/);
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
  });

  test("shows loading before a review result", async ({ page }) => {
    let releaseReview = () => {};
    const reviewGate = new Promise<void>((resolve) => {
      releaseReview = resolve;
    });
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      await reviewGate;
      await route.fulfill({
        json: buildStateReview({
          resultState: "none_stand_out",
          state: "CO",
        }),
        status: 200,
      });
    });
    await page.goto("/app/review?scope=CO");
    await expect(page.getByText("Loading review results…")).toBeVisible();
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    releaseReview();
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "none_stand_out"
    );
  });
});
