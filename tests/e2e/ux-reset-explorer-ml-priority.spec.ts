import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { Tier1CountyPriority } from "@/generated/models";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "../fixtures/tier1-surveillance-priority";

const RELEASE_ID = reviewScopeMetadataFixture.release_id;

function aligned(
  result: Tier1CountyPriority,
  fips: string
): Tier1CountyPriority {
  return tier1PriorityForRelease(
    tier1PriorityForCounty(result, fips),
    RELEASE_ID
  );
}

async function installClassifiedCounties(page: Page): Promise<void> {
  const byFips = new Map<string, Tier1CountyPriority>([
    ["08001", aligned(tier1LowInsufficientFixture, "08001")],
    ["08013", aligned(tier1MediumSufficientFixture, "08013")],
    ["08031", aligned(tier1HighSufficientFixture, "08031")],
  ]);
  await page.route("**/v1/me/profile", (route) =>
    route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
    })
  );
  await page.route("**/v1/atlas/metadata**", (route) =>
    route.fulfill({ json: reviewScopeMetadataFixture })
  );
  const adams = reviewScopeScoresFixture.counties[0];
  await page.route("**/v1/atlas/scores**", (route) =>
    route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        counties: [
          { ...adams, county: "Adams", fips: "08001" },
          {
            ...adams,
            county: "Boulder",
            fips: "08013",
            score: { ...adams.score, score: 70 },
          },
          {
            ...adams,
            county: "Denver",
            fips: "08031",
            score: { ...adams.score, score: 62 },
          },
          {
            ...adams,
            county: "Clear Creek",
            fips: "08019",
            priority: "Lower",
            score: { ...adams.score, score: 40 },
          },
        ],
      },
    })
  );
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: { features: [], type: "FeatureCollection" },
    })
  );
  await page.route("**/v1/states/*/review**", (route) =>
    route.fulfill({
      json: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Adams",
            fips: "08001",
            reasonText: "Adams was returned by the method.",
          }),
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Boulder",
            fips: "08013",
            reasonText: "Boulder was returned by the method.",
          }),
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Denver",
            fips: "08031",
            reasonText: "Denver was returned by the method.",
          }),
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Clear Creek",
            fips: "08019",
            reasonText: "Clear Creek has no persisted model result.",
          }),
        ],
        resultState: "candidates_found",
        state: "CO",
      }),
    })
  );
  await page.route(
    "**/v1/counties/*/tier1-surveillance-priority**",
    (route) => {
      const fips = new URL(route.request().url()).pathname.split("/").at(-2);
      const body = fips ? byFips.get(fips) : undefined;
      if (!body) {
        return route.fulfill({
          json: { detail: "No persisted model result" },
          status: 404,
        });
      }
      return route.fulfill({ json: body });
    }
  );
  await page.route("**/v1/counties/*", (route) =>
    route.fulfill({ json: { detail: "County detail unused" }, status: 404 })
  );
}

test("desktop county rows show labeled ML surveillance priority", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop viewport only. No mobile coverage."
  );
  await installClassifiedCounties(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/app/review?scope=CO&county=08031");
  const list = page.getByRole("list", { name: "Ranked counties" });
  await expect(list.getByTestId("review-candidate")).toHaveCount(4);
  await expect(page.getByTestId("explorer-ml-priority-legend")).toHaveCount(0);
  await expect(list.locator('[data-fips="08001"]')).toHaveAttribute(
    "data-rank",
    "1"
  );
  await expect(list.locator('[data-fips="08013"]')).toHaveAttribute(
    "data-rank",
    "2"
  );
  await expect(list.locator('[data-fips="08031"]')).toHaveAttribute(
    "data-rank",
    "3"
  );
  await expect(list.locator('[data-fips="08019"]')).toHaveAttribute(
    "data-rank",
    "4"
  );
  await expect(list.locator('[data-fips="08001"]')).toContainText(
    "Published score 75"
  );

  const boulder = list.locator('[data-fips="08013"]');
  await boulder.focus();
  await expect(boulder).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/county=08013/);
  await expect(boulder).toHaveAttribute("aria-current", "true");

  const accessibility = await new AxeBuilder({ page })
    .include(".ux-reset-explorer-list")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
