import { expect, test, type Page } from "@playwright/test";

import autauga from "../fixtures/review-al-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-01003.json" with { type: "json" };
import barbour from "../fixtures/review-al-01005.json" with { type: "json" };
import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";

const release = baldwin.release.release_id;
const unavailableDetail = { ...barbour, color: "#111111" };

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
    await expect(followUp).toContainText(
      "Compare the published county case-count floor"
    );
    await expect(followUp).toContainText("not documented negative findings");
    await expect(followUp).not.toContainText("within 2 weeks");
    const placement = await page.evaluate(() => {
      const map = document.querySelector(".ux-reset-explorer-map");
      const followUpCard = document.querySelector(
        "[data-testid='explorer-map-follow-up']"
      );
      if (
        !(map instanceof HTMLElement) ||
        !(followUpCard instanceof HTMLElement)
      ) {
        return null;
      }
      const mapBox = map.getBoundingClientRect();
      const cardBox = followUpCard.getBoundingClientRect();
      return {
        aligned: Math.abs(cardBox.left - mapBox.left) < 4,
        below: cardBox.top >= mapBox.bottom - 2,
        similarWidth: Math.abs(cardBox.width - mapBox.width) < 8,
      };
    });
    expect(placement).toStrictEqual({
      aligned: true,
      below: true,
      similarWidth: true,
    });
    await followUp.screenshot({
      path: "test-results/follow-up-available-1792.png",
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await followUp.screenshot({
      path: "test-results/follow-up-available-1440.png",
    });
    const narrow = await columnShares(page);
    expect(narrow?.list).toBeGreaterThan(0.16);
    expect(narrow?.map).toBeGreaterThan(0.5);
    expect(narrow?.preview).toBeGreaterThan(0.28);

    await page.goto(`/explore?scope=AL&dataset=${release}&county=01001`);
    await expect(followUp).toContainText(
      "Check whether additional county case information is available"
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
    await expect(followUp).toContainText(
      "not a scored recommendation or an instruction to escalate"
    );
    await expect(
      page.getByTestId("explorer-follow-up-response")
    ).not.toHaveText("Continue routine review");
    await followUp.screenshot({
      path: "test-results/follow-up-unavailable-1792.png",
    });
  });
});
