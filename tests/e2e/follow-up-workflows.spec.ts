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
      list: share(".ux-reset-explorer-list"),
      map: share(".ux-reset-explorer-map"),
      preview: share(".ux-reset-explorer-preview"),
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
    expect(wide?.list).toBeGreaterThan(0.16);
    expect(wide?.list).toBeLessThan(0.2);
    expect(wide?.map).toBeGreaterThan(0.5);
    expect(wide?.map).toBeLessThan(0.54);
    expect(wide?.preview).toBeGreaterThan(0.28);
    expect(wide?.preview).toBeLessThan(0.32);
    const card = page.getByTestId("explorer-map-follow-up");
    const followUp = card.getByTestId("suggested-follow-up");
    await expect(followUp).toBeVisible();
    await expect(page.getByTestId("explorer-follow-up-response")).toHaveText(
      "Verify with local information"
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
      "compare the published county case-count floor"
    );
    await expect(followUp.getByTestId("follow-up-questions")).toContainText(
      "Do locally held case records agree with the published county count"
    );
    await expect(followUp.getByTestId("follow-up-what-if-note")).toHaveCount(0);
    await expect(followUp).toContainText("not documented negative findings");
    await expect(followUp).not.toContainText("within 2 weeks");
    const resources = page.getByTestId("explorer-official-resources");
    await expect(resources).toBeVisible();
    await expect(
      resources.getByRole("heading", { name: "Resources for follow-up" })
    ).toBeVisible();
    await expect(resources.getByRole("link")).toHaveCount(8);
    const placement = await page.evaluate(() => {
      const browse = document.querySelector("[data-testid='explorer-browse']");
      const map = document.querySelector(".ux-reset-explorer-map");
      const lower = document.querySelector(
        "[data-testid='explorer-lower-workspace']"
      );
      const followUpCard = document.querySelector(
        "[data-testid='explorer-map-follow-up']"
      );
      const resourcesCard = document.querySelector(
        "[data-testid='explorer-official-resources']"
      );
      if (
        !(browse instanceof HTMLElement) ||
        !(map instanceof HTMLElement) ||
        !(lower instanceof HTMLElement) ||
        !(followUpCard instanceof HTMLElement) ||
        !(resourcesCard instanceof HTMLElement)
      ) {
        return null;
      }
      const browseBox = browse.getBoundingClientRect();
      const mapBox = map.getBoundingClientRect();
      const lowerBox = lower.getBoundingClientRect();
      const followBox = followUpCard.getBoundingClientRect();
      const resourcesBox = resourcesCard.getBoundingClientRect();
      const gap = resourcesBox.left - followBox.right;
      const inner = followBox.width + resourcesBox.width + gap;
      return {
        belowMap: lowerBox.top >= mapBox.bottom - 2,
        followShare: followBox.width / inner,
        resourcesShare: resourcesBox.width / inner,
        sideBySide: followBox.left < resourcesBox.left,
        spansContent:
          Math.abs(lowerBox.left - browseBox.left) < 4 &&
          Math.abs(lowerBox.right - browseBox.right) < 4,
      };
    });
    expect(placement?.spansContent).toBeTruthy();
    expect(placement?.belowMap).toBeTruthy();
    expect(placement?.sideBySide).toBeTruthy();
    expect(placement?.followShare).toBeGreaterThan(0.58);
    expect(placement?.followShare).toBeLessThan(0.66);
    expect(placement?.resourcesShare).toBeGreaterThan(0.34);
    expect(placement?.resourcesShare).toBeLessThan(0.42);
    await followUp.screenshot({
      path: "test-results/follow-up-available-1792.png",
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await followUp.screenshot({
      path: "test-results/follow-up-available-1440.png",
    });
    const desktopResources = await page.evaluate(() => {
      const followUpCard = document.querySelector(
        "[data-testid='explorer-map-follow-up']"
      );
      const resourcesCard = document.querySelector(
        "[data-testid='explorer-official-resources']"
      );
      if (
        !(followUpCard instanceof HTMLElement) ||
        !(resourcesCard instanceof HTMLElement)
      ) {
        return null;
      }
      const followBox = followUpCard.getBoundingClientRect();
      const resourcesBox = resourcesCard.getBoundingClientRect();
      return followBox.left < resourcesBox.left;
    });
    expect(desktopResources).toBeTruthy();
    const narrow = await columnShares(page);
    expect(narrow?.list).toBeGreaterThan(0.16);
    expect(narrow?.map).toBeGreaterThan(0.5);
    expect(narrow?.preview).toBeGreaterThan(0.28);

    await page.goto(`/explore?scope=AL&dataset=${release}&county=01001`);
    await expect(followUp).toContainText(
      "check whether additional county case information is available"
    );
    await expect(followUp).not.toContainText(
      "Compare the published county case-count floor"
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
    await expect(resources.getByRole("link")).toHaveCount(8);

    await page.setViewportSize({ height: 900, width: 800 });
    const stacked = await page.evaluate(() => {
      const followUpCard = document.querySelector(
        "[data-testid='explorer-map-follow-up']"
      );
      const resourcesCard = document.querySelector(
        "[data-testid='explorer-official-resources']"
      );
      if (
        !(followUpCard instanceof HTMLElement) ||
        !(resourcesCard instanceof HTMLElement)
      ) {
        return null;
      }
      const followBox = followUpCard.getBoundingClientRect();
      const resourcesBox = resourcesCard.getBoundingClientRect();
      return {
        followFirst: followBox.bottom <= resourcesBox.top + 2,
        similarWidth: Math.abs(followBox.width - resourcesBox.width) < 8,
      };
    });
    expect(stacked).toStrictEqual({
      followFirst: true,
      similarWidth: true,
    });
  });
});
