import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import autauga from "../fixtures/review-al-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-01003.json" with { type: "json" };
import barbour from "../fixtures/review-al-01005.json" with { type: "json" };
import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";

const release = baldwin.release.release_id;
async function installPublishedReview(page: Page) {
  await page.route("**/v1/me/profile", (route) =>
    route.fulfill({ json: { profile: null } })
  );
  await page.route("**/v1/atlas/metadata**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      release;
    return route.fulfill({ json: { ...baldwin.release, release_id: dataset } });
  });
  await page.route("**/v1/atlas/scores**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      release;
    return route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        release_id: dataset,
        counties:
          dataset === "empty-release"
            ? []
            : identities.map((entry) => ({
                ...reviewScopeScoresFixture.counties[0],
                ...entry,
                state_name: entry.stateName,
              })),
      },
    });
  });
  await page.route("**/v1/states/*/review**", (route) => {
    const url = new URL(route.request().url());
    const state = url.pathname.split("/").at(-2) ?? "AL";
    const review = buildStateReview({ state, resultState: "unsupported" });
    review.data_release_version =
      url.searchParams.get("dataset_version") ?? release;
    review.coverage.assessed_counties = 67;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: {
        type: "FeatureCollection",
        features: identities.map((entry, index) => {
          const west = -88 + (index % 8) * 0.4;
          const south = 30 + Math.floor(index / 8) * 0.4;
          return {
            type: "Feature",
            properties: { fips: entry.fips },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [west, south],
                  [west + 0.3, south],
                  [west + 0.3, south + 0.3],
                  [west, south + 0.3],
                  [west, south],
                ],
              ],
            },
          };
        }),
      },
    })
  );
  await page.route("**/v1/counties/*", (route) => {
    const fips = new URL(route.request().url()).pathname.split("/").at(-1);
    const detail = [autauga, baldwin, barbour].find(
      (entry) => entry.fips === fips
    );
    return detail
      ? route.fulfill({ json: detail })
      : route.fulfill({ status: 404, json: { detail: "No published record" } });
  });
  // Keep downstream request failures bounded; they are not scientific absence.
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Catalog unavailable in this fixture" },
    })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ status: 404, json: { detail: "No matching priority" } })
  );
}
async function choose(page: Page, fips: string) {
  await page
    .getByRole("combobox", { name: "Published county", exact: true })
    .click();
  await page.getByRole("option", { name: new RegExp(fips) }).click();
  await expect(page).toHaveURL(new RegExp(`county=${fips}`));
  await expect(
    page.getByTestId("review-published-county-preview")
  ).toHaveAttribute("data-fips", fips);
}

test.describe("Published Review county exploration", () => {
  test("67 county picker, keyboard, refresh, history and Investigate return", async ({
    page,
  }) => {
    await installPublishedReview(page);
    await page.goto(`/app/review?scope=AL&dataset=${release}&county=01001`);
    const picker = page.getByRole("combobox", {
      name: "Published county",
      exact: true,
    });
    await expect(picker).toBeEnabled();
    await picker.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option")).toHaveCount(67);
    await page.keyboard.press("Escape");
    await choose(page, "01003");
    await expect(page.getByText("5 (published count floor)")).toBeVisible();
    await expect(
      page.getByText("A floor, not an exact case total.")
    ).toBeVisible();
    await picker.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/county=01005/);
    await page.reload();
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toHaveAttribute("data-fips", "01005");
    await page.goBack();
    await expect(page).toHaveURL(/county=01003/);
    await page.goForward();
    await expect(page).toHaveURL(/county=01005/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toHaveAttribute("data-fips", "01005");
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /county=01005/
    );
    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(
      /\/app\/review\?.*county=01005.*mode=evidence|\/app\/review\?.*mode=evidence.*county=01005/,
      {
        timeout: 30000,
      }
    );
    await expect(page).toHaveURL(new RegExp(`dataset=${release}`));
    await page.goBack();
    await expect(picker).toBeFocused();
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.getByTestId("review-backend-result")).toContainText(
      "Unsupported"
    );
    const result = await new AxeBuilder({ page })
      .include(".ux-reset-review-operating-side")
      .analyze();
    expect(result.violations).toEqual([]);
  });
  test("rejects unpublished direct links and clears selection on state/release changes", async ({
    page,
  }) => {
    await installPublishedReview(page);
    await page.goto(`/app/review?scope=AL&dataset=${release}&county=01999`);
    await expect(page.getByText(/67 published counties/)).toBeVisible();
    await expect(page).not.toHaveURL(/county=/);
    await choose(page, "01001");
    await page
      .getByRole("combobox", { name: "Review scope", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Colorado (CO)", exact: true })
      .click();
    await expect(page).not.toHaveURL(/county=/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toHaveCount(0);
    await page.goto("/app/review?scope=AL&county=01003&dataset=empty-release");
    await expect(page).not.toHaveURL(/county=/);
    await expect(page.getByTestId("review-investigate")).toHaveCount(0);
  });
  test("MapLibre geography click selects a published noncandidate", async ({
    page,
  }) => {
    await installPublishedReview(page);
    await page.goto(`/app/review?scope=AL&dataset=${release}`);
    const canvas = page.getByLabel(/Map of Alabama/).locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "aria-busy",
      "false"
    );
    // Real renderer, fixture polygons: click within the rendered county grid.
    const bounds = await canvas.boundingBox();
    if (!bounds) {
      throw new Error("Map canvas bounds missing");
    }
    await canvas.click({
      position: { x: bounds.width * 0.47, y: bounds.height / 2 },
    });
    await expect(page).toHaveURL(/county=01\d{3}/);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toBeVisible();
  });
});
