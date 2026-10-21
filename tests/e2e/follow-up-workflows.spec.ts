import { expect, test, type Page } from "@playwright/test";

import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import autauga from "../fixtures/review-al-v11-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-v11-01003.json" with { type: "json" };
import barbour from "../fixtures/review-al-v11-01005.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";

const release = baldwin.release.release_id;
const unavailableDetail = { ...barbour, color: "#111111" };

async function installPublishedReview(page: Page) {
  await page.route("**/v1/me/profile", (route) =>
    route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
    })
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
        counties: identities.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          ...entry,
          state_name: entry.stateName,
        })),
        release_id: dataset,
      },
    });
  });
  await page.route("**/v1/states/*/review**", (route) => {
    const url = new URL(route.request().url());
    const state = url.pathname.split("/").at(-2) ?? "AL";
    const review = buildStateReview({ resultState: "none_stand_out", state });
    review.data_release_version =
      url.searchParams.get("dataset_version") ?? release;
    review.coverage.assessed_counties = 67;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: {
        features: [],
        type: "FeatureCollection",
      },
    })
  );
  await page.route("**/v1/counties/*", (route) => {
    const fips = new URL(route.request().url()).pathname.split("/").at(-1);
    if (fips === unavailableDetail.fips) {
      return route.fulfill({ json: unavailableDetail });
    }
    const detail = [autauga, baldwin].find((entry) => entry.fips === fips);
    return detail
      ? route.fulfill({ json: detail })
      : route.fulfill({ json: { detail: "No published record" }, status: 404 });
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
}

async function columnShares(page: Page) {
  return page.evaluate(() => {
    const browse = document.querySelector("[data-testid='explorer-browse']");
    if (!browse) {
      return null;
    }
    const width = browse.getBoundingClientRect().width;
    const share = (selector: string) => {
      const node = browse.querySelector(selector);
      return node ? node.getBoundingClientRect().width / width : 0;
    };
    return {
      map: share(".ux-reset-explorer-map"),
      rail: share("[data-testid='explorer-rail']"),
    };
  });
}

test.describe("five-category suggested follow-up", () => {
  test("updates county evidence and keeps the desktop columns", async ({
    page,
  }) => {
    await installPublishedReview(page);
    await page.setViewportSize({ height: 850, width: 1792 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("suggested-follow-up")).toHaveCount(0);
    const wide = await columnShares(page);
    // The map leads. The rail (List and County tabs) is the companion.
    expect(wide?.map).toBeGreaterThan(0.6);
    expect(wide?.map).toBeLessThan(0.75);
    expect(wide?.rail).toBeGreaterThan(0.22);
    expect(wide?.rail).toBeLessThan(0.35);
    const card = page.getByTestId("explorer-map-follow-up");
    const followUp = card.getByTestId("suggested-follow-up");
    await expect(followUp).toBeVisible();
    await expect(page.getByTestId("explorer-follow-up-response")).toHaveText(
      "Conduct targeted follow-up"
    );
    for (const label of [
      "Human disease surveillance",
      "Vector and pathogen surveillance",
      "Clinical and laboratory reporting",
      "Community context and outreach",
      "Coordination and documentation",
    ]) {
      await expect(followUp.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(followUp.getByTestId("follow-up-interpretation")).toHaveCount(
      0
    );
    await expect(followUp).not.toContainText(
      "Atlas supports professional review, not individual risk measurement"
    );
    await expect(followUp).toContainText(
      "compare the published minimum reported cases"
    );
    await expect(followUp.getByTestId("follow-up-questions")).toContainText(
      "Which specific inconsistency in the published or locally verified evidence warrants targeted follow-up?"
    );
    await expect(followUp.getByTestId("follow-up-what-if-note")).toHaveCount(0);
    await expect(followUp).toContainText("not documented negative findings");
    await expect(followUp).not.toContainText("within 2 weeks");
    await page.getByTestId("explorer-official-resources-trigger").click();
    const resources = page.getByTestId("explorer-official-resources");
    await expect(resources).toBeVisible();
    await expect(
      resources.getByRole("heading", { name: "Official resources" })
    ).toBeVisible();
    await expect(resources).toContainText(
      "Authoritative references to support surveillance review, reporting, and public health action."
    );
    await expect(resources).not.toContainText("Official resources & guidance");
    await expect(resources).not.toContainText("Resources for follow-up");
    for (const topic of [
      "Lyme disease surveillance",
      "Tick and vector surveillance",
      "Clinical testing and reporting",
    ]) {
      await expect(
        resources.getByRole("heading", { name: topic })
      ).toBeVisible();
    }
    await expect(resources.getByRole("link")).toHaveCount(5);
    await expect(
      resources.getByRole("link", { name: /Lyme surveillance case definition/ })
    ).toHaveAttribute(
      "href",
      "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/"
    );
    await page.keyboard.press("Escape");
    await expect(resources).toHaveCount(0);
    const placement = await page.evaluate(() => {
      const browse = document.querySelector("[data-testid='explorer-browse']");
      const map = document.querySelector(".ux-reset-explorer-map");
      const rail = document.querySelector("[data-testid='explorer-rail']");
      const followUpCard = document.querySelector(
        "[data-testid='explorer-map-follow-up']"
      );
      if (
        !(browse instanceof HTMLElement) ||
        !(map instanceof HTMLElement) ||
        !(rail instanceof HTMLElement) ||
        !(followUpCard instanceof HTMLElement)
      ) {
        return null;
      }
      const browseBox = browse.getBoundingClientRect();
      const mapBox = map.getBoundingClientRect();
      const railBox = rail.getBoundingClientRect();
      return {
        followInRail: rail.contains(followUpCard),
        railBesideMap: railBox.left >= mapBox.right - 2,
        spansContent:
          Math.abs(mapBox.left - browseBox.left) < 4 &&
          Math.abs(railBox.right - browseBox.right) < 4,
      };
    });
    expect(placement).toStrictEqual({
      followInRail: true,
      railBesideMap: true,
      spansContent: true,
    });
    await followUp.screenshot({
      path: "test-results/follow-up-available-1792.png",
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await followUp.screenshot({
      path: "test-results/follow-up-available-1440.png",
    });
    const narrow = await columnShares(page);
    expect(narrow?.map).toBeGreaterThan(0.55);
    expect(narrow?.rail).toBeGreaterThan(0.22);
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01001`);
    await expect(followUp).toContainText(
      "check whether additional county case information is available"
    );
    await expect(followUp).not.toContainText(
      "Compare the published minimum reported cases"
    );

    await page.setViewportSize({ height: 850, width: 1792 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01005`);
    await expect(followUp).toHaveAttribute("data-review-level", "unavailable");
    await expect(page.getByTestId("explorer-follow-up-response")).toHaveText(
      "Review level unavailable"
    );
    await expect(followUp).not.toContainText(
      "not a scored recommendation or an instruction to escalate"
    );
    await expect(
      page.getByTestId("explorer-follow-up-response")
    ).not.toHaveText("Continue routine review");
    await followUp.screenshot({
      path: "test-results/follow-up-unavailable-1792.png",
    });

    await page.setViewportSize({ height: 900, width: 800 });
    const stacked = await page.evaluate(() => {
      const map = document.querySelector(".ux-reset-explorer-map");
      const rail = document.querySelector("[data-testid='explorer-rail']");
      if (!(map instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
        return null;
      }
      const mapBox = map.getBoundingClientRect();
      const railBox = rail.getBoundingClientRect();
      return {
        mapFirst: mapBox.bottom <= railBox.top + 2,
        similarWidth: Math.abs(mapBox.width - railBox.width) < 8,
      };
    });
    expect(stacked).toStrictEqual({
      mapFirst: true,
      similarWidth: true,
    });
  });
});
