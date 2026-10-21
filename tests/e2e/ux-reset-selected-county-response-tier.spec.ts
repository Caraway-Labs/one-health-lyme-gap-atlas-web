import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import autauga from "../fixtures/review-al-v11-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-v11-01003.json" with { type: "json" };
import barbour from "../fixtures/review-al-v11-01005.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { openEvidenceDisclosure } from "./explorer-rail";
import { releaseViewportRuns } from "./release-phone-viewport";

const release = baldwin.release.release_id;

const tierShots = [
  {
    color: "#a9d2db",
    detail: "Continue routine surveillance",
    followUp: "Continue routine review",
    name: "lower",
    title: "Lower review priority",
  },
  {
    color: "#efc64a",
    detail: "Conduct targeted follow-up",
    followUp: "Conduct targeted follow-up",
    name: "moderate",
    title: "Moderate review priority",
  },
  {
    color: "#e9602b",
    detail: "Prioritize local investigation",
    followUp: "Prioritize targeted follow-up",
    name: "highest",
    title: "Highest review priority",
  },
  {
    color: " ",
    detail: null,
    followUp: "Gap score unavailable",
    name: "unavailable",
    title: "Gap score unavailable",
  },
] as const;

let publishedColor: string | null = null;

async function installPublishedReview(page: Page) {
  await fulfillCompletedStartingView(page);
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
        counties: identities.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          ...entry,
          state_name: entry.stateName,
          // The score mark reads the published map color from this collection.
          // County detail overrides do not change that chip or its category.
          ...(publishedColor !== null && entry.fips === "01003"
            ? { color: publishedColor }
            : {}),
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
        features: identities.slice(0, 4).map((entry, index) => {
          const west = -88 + index * 0.4;
          const south = 30;
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
    if (!detail) {
      return route.fulfill({
        status: 404,
        json: { detail: "No published record" },
      });
    }
    return route.fulfill({
      json:
        publishedColor === null ? detail : { ...detail, color: publishedColor },
    });
  });
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

async function captureTierShots(
  page: Page,
  testInfo: TestInfo,
  viewport: "desktop" | "mobile"
) {
  for (const shot of tierShots) {
    publishedColor = shot.color;
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    const scoreButton = preview.getByRole("button", {
      name: /Surveillance Gap Score/,
    });
    await expect(
      preview.getByTestId("selected-county-response-tier")
    ).toHaveCount(0);
    await expect(scoreButton).toHaveAttribute(
      "data-tooltip",
      shot.detail ? shot.title : "Published score"
    );
    await expect(page.getByTestId("explorer-follow-up-response")).toHaveText(
      shot.followUp
    );
    await preview.evaluate((card) => {
      card.scrollIntoView({ block: "start", inline: "nearest" });
    });
    await preview.screenshot({
      path: testInfo.outputPath(`response-tier-${viewport}-${shot.name}.png`),
    });
  }
}

test.describe("selected county response tier", () => {
  test("shows the review category on the score mark", async ({
    page,
  }, testInfo) => {
    publishedColor = null;
    await installPublishedReview(page);
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    const scoreButton = preview.getByRole("button", {
      name: /Surveillance Gap Score/,
    });
    const followUp = page.getByTestId("explorer-follow-up-response");
    await expect(
      preview.getByTestId("selected-county-response-tier")
    ).toHaveCount(0);
    await expect(followUp).toHaveText("Conduct targeted follow-up");
    await expect(scoreButton).toHaveAttribute(
      "data-tooltip",
      "Published score"
    );
    await expect(preview.locator(".priority-pill")).toHaveCount(0);
    await expect(preview.getByTestId("selected-county-gap-score")).toHaveText(
      "75.0"
    );
    await expect(preview).not.toContainText("Priority 1");
    await expect(preview.getByTestId("review-investigate")).toHaveCount(0);
    await expect(
      preview.getByTestId("review-view-county-follow-up")
    ).toBeVisible();
    await expect(preview.getByTestId("review-compare")).toBeVisible();
    const placed = await page.evaluate(() => {
      const card = document.querySelector(
        "[data-testid='review-published-county-preview']"
      );
      const tier = card?.querySelector(
        "[data-testid='selected-county-gap-score']"
      );
      const heading = card?.querySelector("h2");
      if (!(tier instanceof HTMLElement) || !(heading instanceof HTMLElement)) {
        return null;
      }
      const tierBox = tier.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      const overlaps = !(
        tierBox.right <= headingBox.left ||
        tierBox.left >= headingBox.right ||
        tierBox.bottom <= headingBox.top ||
        tierBox.top >= headingBox.bottom
      );
      return {
        clipped: tier.scrollWidth > tier.clientWidth + 1,
        overlaps,
      };
    });
    expect(placed?.clipped).toBe(false);
    expect(placed?.overlaps).toBe(false);
    const result = await new AxeBuilder({ page })
      .include(".ux-reset-explorer-preview")
      .analyze();
    expect(result.violations).toEqual([]);
    await captureTierShots(page, testInfo, "desktop");
  });

  test("uses the full card width when the preview is 300px", async ({
    page,
  }) => {
    publishedColor = null;
    await installPublishedReview(page);
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(
      preview.getByTestId("selected-county-gap-score")
    ).toBeVisible();
    await openEvidenceDisclosure(page);
    const layout = await preview.evaluate((card) => {
      if (!(card instanceof HTMLElement)) {
        return null;
      }
      card.style.boxSizing = "border-box";
      card.style.width = "300px";
      card.style.maxWidth = "300px";
      const heading = card.querySelector("h2");
      const rationale = card.querySelector("[data-testid='review-rationale']");
      if (
        !(heading instanceof HTMLElement) ||
        !(rationale instanceof HTMLElement)
      ) {
        return null;
      }
      const style = getComputedStyle(card);
      const paddingLeft = Number.parseFloat(style.paddingLeft);
      const paddingRight = Number.parseFloat(style.paddingRight);
      const columnGap = Number.parseFloat(style.columnGap) || 0;
      const contentWidth = card.clientWidth - paddingLeft - paddingRight;
      const cardBox = card.getBoundingClientRect();
      const contentStart = cardBox.left + card.clientLeft + paddingLeft;
      const tracks = style.gridTemplateColumns
        .split(/\s+/)
        .map((part) => Number.parseFloat(part))
        .filter((width) => Number.isFinite(width));
      let cursor = contentStart;
      const columns = tracks.map((width) => {
        const start = cursor;
        const end = cursor + width;
        cursor = end + columnGap;
        return { end, start };
      });
      const boxes = [...card.children]
        .filter((child) => child instanceof HTMLElement)
        .map((child) => child.getBoundingClientRect());
      const emptyTracks = columns.filter(
        (column) =>
          !boxes.some(
            (box) => box.right > column.start + 1 && box.left < column.end - 1
          )
      );
      const rationaleBox = rationale.getBoundingClientRect();
      return {
        contentWidth,
        display: style.display,
        emptyTracks: emptyTracks.length,
        headingClipped: heading.scrollWidth > heading.clientWidth + 1,
        overflow: card.scrollWidth > card.clientWidth + 1,
        rationaleWidth: rationaleBox.width,
        tracks: tracks.length,
      };
    });
    expect(layout?.display).toBe("grid");
    expect(layout?.tracks).toBe(1);
    expect(layout?.emptyTracks).toBe(0);
    expect(layout?.contentWidth ?? 0).toBeGreaterThan(200);
    expect(layout?.overflow).toBe(false);
    expect(layout?.headingClipped).toBe(false);
    expect(layout?.rationaleWidth ?? 0).toBeGreaterThan(
      (layout?.contentWidth ?? 0) * 0.9
    );
  });

  test("leaves a missing tier unavailable on the selected county card", async ({
    page,
  }) => {
    publishedColor = " ";
    await installPublishedReview(page);
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    const scoreButton = preview.getByRole("button", {
      name: /Surveillance Gap Score/,
    });
    await expect(page.getByTestId("explorer-follow-up-response")).toHaveText(
      "Gap score unavailable"
    );
    await expect(
      preview.getByTestId("selected-county-response-tier")
    ).toHaveCount(0);
    await expect(scoreButton).toHaveAttribute(
      "data-tooltip",
      "Published score"
    );
    await expect(preview).not.toContainText("Elevated review priority");
    await expect(preview).not.toContainText("Priority 1");
    await expect(preview.locator(".priority-pill")).toHaveCount(0);
    const placed = await scoreButton.evaluate(
      (mark) =>
        mark instanceof HTMLElement && mark.scrollWidth <= mark.clientWidth + 1
    );
    expect(placed).toBe(true);
  });

  test("keeps the response tier readable on a phone", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width selected county pill checks run on the mobile project."
    );
    await page.setViewportSize({ height: 844, width: 390 });
    publishedColor = null;
    await installPublishedReview(page);
    await captureTierShots(page, testInfo, "mobile");
    const tier = page
      .getByTestId("review-published-county-preview")
      .getByTestId("selected-county-gap-score");
    const readable = await tier.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      return element.scrollWidth <= element.clientWidth + 1;
    });
    expect(readable).toBe(true);
  });
});
