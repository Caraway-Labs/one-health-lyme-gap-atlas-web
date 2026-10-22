import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  intelligenceFeedEnvelope,
  mixedIntelligenceFeedItems,
} from "../fixtures/intelligence-feed-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";

const FEED_URL = "**/v1/intelligence/feed**";
const SCRIPT_URL = ["java", "script:alert(1)"].join("");

async function installFeed(page: Page, status: number, json: unknown) {
  await page.route(FEED_URL, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json,
      status,
    });
  });
}

function mixedFeed() {
  return intelligenceFeedEnvelope(
    mixedIntelligenceFeedItems.map((item) =>
      item.source.source_id === "nysdoh-lyme"
        ? { ...item, canonical_url: SCRIPT_URL }
        : item
    )
  );
}

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
  await page.setViewportSize({ height: 900, width: 1280 });
});

test("shows trusted-source items from workspace navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop feed coverage");
  await installFeed(page, 200, mixedFeed());
  await page.goto("/explore");
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Research & News", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Feed" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await expect(page.getByText("CDC")).toBeVisible();
  await expect(page.getByText("March 2, 2026")).toBeVisible();
  await expect(page.getByText("Publication date not provided")).toBeVisible();
  await expect(page.getByText("Publication date withheld")).toBeVisible();
  await expect(
    page.getByText("New York State Department of Health")
  ).toBeVisible();

  const cdc = page.getByRole("link", {
    name: "Lyme disease surveillance update (opens in a new tab)",
  });
  await expect(cdc).toHaveAttribute(
    "href",
    "https://www.cdc.gov/lyme/index.html"
  );
  await expect(cdc).toHaveAttribute("rel", "noopener noreferrer");
  await expect(cdc).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: /New York Lyme disease information/ })
  ).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.mouse.move(640, 450);
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("intelligence-feed-populated.png"),
  });
});

test("keeps an empty feed distinct from failure and unavailability", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop feed coverage");
  await installFeed(page, 200, intelligenceFeedEnvelope([]));
  await page.goto("/app/feed");
  await expect(
    page.getByRole("heading", { name: "No new items" })
  ).toBeVisible();
  await expect(
    page.getByText(/no items in this feed right now/i)
  ).toBeVisible();
  const feed = page.getByTestId("intelligence-feed");
  await expect(feed.getByRole("alert")).toHaveCount(0);
  await expect(feed.getByText(/fail|error|unavailable/i)).toHaveCount(0);
  const empty = await new AxeBuilder({ page }).include("main").analyze();
  expect(empty.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("intelligence-feed-empty.png"),
  });

  await page.unroute(FEED_URL);
  await installFeed(page, 503, {
    code: "SERVICE_UNAVAILABLE",
    detail: "Disabled or unavailable",
    instance: "/v1/intelligence/feed",
    status: 503,
    title: "Service unavailable",
    type: "https://carawaylabs.com/problems/http-503",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Intelligence feed unavailable" })
  ).toBeVisible();
  await expect(
    page.getByTestId("intelligence-feed").getByRole("alert")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No new items" })).toHaveCount(
    0
  );
  const unavailable = await new AxeBuilder({ page }).include("main").analyze();
  expect(unavailable.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("intelligence-feed-unavailable.png"),
  });

  await page.unroute(FEED_URL);
  await installFeed(page, 500, {
    detail: "Request failed",
    instance: "/v1/intelligence/feed",
    status: 500,
    title: "Request failed",
    type: "https://carawaylabs.com/problems/http-500",
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Intelligence feed request failed" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No new items" })).toHaveCount(
    0
  );
  const failed = await new AxeBuilder({ page }).include("main").analyze();
  expect(failed.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("intelligence-feed-error.png"),
  });
});

test("keeps loaded items when the next page fails", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop feed coverage");
  const [first, second] = mixedIntelligenceFeedItems;
  let nextPageAttempts = 0;
  await page.route(FEED_URL, async (route) => {
    const token = new URL(route.request().url()).searchParams.get("page_token");
    if (token) {
      nextPageAttempts += 1;
      if (nextPageAttempts === 1) {
        await route.fulfill({
          contentType: "application/json",
          json: {
            detail: "Request failed",
            instance: "/v1/intelligence/feed",
            status: 500,
            title: "Request failed",
            type: "https://carawaylabs.com/problems/http-500",
          },
          status: 500,
        });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        json: intelligenceFeedEnvelope([second]),
        status: 200,
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      json: intelligenceFeedEnvelope([first], "page-2"),
      status: 200,
    });
  });

  await page.goto("/app/feed");
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Show more items" }).click();
  await expect(
    page.getByRole("heading", { name: "More items could not be loaded" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Intelligence feed request failed" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: /County-level Lyme reporting, a review/ })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "More items could not be loaded" })
  ).toHaveCount(0);
  expect(nextPageAttempts).toBe(2);
  await page.screenshot({
    path: testInfo.outputPath("intelligence-feed-next-page-recovered.png"),
  });
});
