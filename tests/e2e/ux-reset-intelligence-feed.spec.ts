import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  intelligenceFeedEnvelope,
  intelligenceSourcesEnvelope,
  mixedIntelligenceFeedItems,
} from "../fixtures/intelligence-feed-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

const FEED_URL = "**/v1/intelligence/feed**";
const SOURCES_URL = "**/v1/intelligence/sources**";
const SCRIPT_URL = ["java", "script:alert(1)"].join("");
const feedUrls: string[] = [];

function localPublishedFrom(days: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const shifted = new Date(
    Date.UTC(
      Number(value("year")),
      Number(value("month")) - 1,
      Number(value("day"))
    )
  );
  shifted.setUTCDate(shifted.getUTCDate() - days);
  const year = String(shifted.getUTCFullYear()).padStart(4, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function feedParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

function expectFeedParams(
  url: string,
  expected: Record<string, string | null>
) {
  const params = feedParams(url);
  expect([...params.keys()].sort()).toEqual(
    Object.entries(expected)
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([key]) => key)
      .sort()
  );
  for (const [key, value] of Object.entries(expected)) {
    expect(params.get(key)).toBe(value);
  }
}

async function expectNoAxeViolations(page: Page) {
  await page.keyboard.press("Escape");
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
}

async function installFeed(page: Page, status: number, json: unknown) {
  await page.route(FEED_URL, async (route) => {
    feedUrls.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      json,
      status,
    });
  });
}

async function installSources(page: Page, mode: "ok" | "fail" = "ok") {
  await page.route(SOURCES_URL, async (route) => {
    if (mode === "fail") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          detail: "Sources failed",
          status: 500,
          title: "Sources failed",
          type: "about:blank",
        },
        status: 500,
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      json: intelligenceSourcesEnvelope(
        mixedIntelligenceFeedItems.map((item) => item.source)
      ),
      status: 200,
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

test.beforeEach(async ({ page }, testInfo) => {
  feedUrls.length = 0;
  await fulfillCompletedStartingView(page);
  await installSources(page);
  if (!testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ height: 900, width: 1280 });
  }
});

test("shows trusted-source items from workspace navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop feed coverage");
  await installFeed(page, 200, mixedFeed());
  await page.goto("/explore");
  await page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Feed", exact: true })
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

test("filters the feed by source and publication date", async ({
  page,
}, testInfo) => {
  await installFeed(
    page,
    200,
    intelligenceFeedEnvelope(mixedIntelligenceFeedItems)
  );
  await page.goto("/app/feed");
  await expect(page.getByRole("combobox", { name: "Source" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Published" })).toBeVisible();
  await expect(
    page.getByText("Items without a publication date appear under All dates.")
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect.poll(() => feedUrls.length).toBeGreaterThan(0);
  expectFeedParams(feedUrls[0], {
    page_size: null,
    page_token: null,
    published_from: localPublishedFrom(30),
    published_to: null,
    source_id: null,
  });
  await expectNoAxeViolations(page);

  await page.getByRole("combobox", { name: "Source" }).click();
  await page
    .getByRole("option", {
      name: "Centers for Disease Control and Prevention",
    })
    .click();
  await expect(page).toHaveURL(/source=cdc-lyme/);
  await expect
    .poll(() => feedUrls.at(-1) ?? "")
    .toContain("source_id=cdc-lyme");
  expectFeedParams(feedUrls.at(-1) ?? "", {
    page_token: null,
    published_from: localPublishedFrom(30),
    published_to: null,
    source_id: "cdc-lyme",
  });
  await expect(
    page.getByRole("button", {
      name: "Remove filter Source: Centers for Disease Control and Prevention",
    })
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("combobox", { name: "Published" }).click();
  await page.getByRole("option", { name: "Past 7 days" }).click();
  await expect(page).toHaveURL(/published=7d/);
  await expect(page).toHaveURL(/source=cdc-lyme/);
  await expect
    .poll(() => feedUrls.at(-1) ?? "")
    .toContain(`published_from=${localPublishedFrom(7)}`);
  expectFeedParams(feedUrls.at(-1) ?? "", {
    page_token: null,
    published_from: localPublishedFrom(7),
    published_to: null,
    source_id: "cdc-lyme",
  });
  await expectNoAxeViolations(page);

  await page
    .getByRole("button", {
      name: "Remove filter Published: Past 7 days",
    })
    .click();
  await expect(page).not.toHaveURL(/published=/);
  await expect(page).toHaveURL(/source=cdc-lyme/);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(
    0
  );
  await expect(page.getByRole("group", { name: "Feed filters" })).toBeFocused();
  await expectNoAxeViolations(page);

  await page.getByRole("combobox", { name: "Published" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Past 7 days" })).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/published=7d/);
  await page.keyboard.press("Escape");
  await expectNoAxeViolations(page);
  await page.screenshot({
    path: testInfo.outputPath("fixture-backed-intelligence-feed-filters.png"),
  });
});

test("restores feed filters with Back and a deep link", async ({ page }) => {
  await installFeed(
    page,
    200,
    intelligenceFeedEnvelope(mixedIntelligenceFeedItems)
  );
  await page.goto("/app/feed");
  await page.getByRole("combobox", { name: "Published" }).click();
  await page.getByRole("option", { name: "All dates" }).click();
  await expect(page).toHaveURL(/published=all/);
  const allDatesUrl = feedUrls.at(-1) ?? "";
  expectFeedParams(allDatesUrl, {
    page_token: null,
    published_from: null,
    published_to: null,
    source_id: null,
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(page.getByRole("combobox", { name: "Published" })).toContainText(
    "Past 30 days"
  );
  await page.goForward();
  await expect(page).toHaveURL(/published=all/);
  await expect(page.getByRole("combobox", { name: "Published" })).toContainText(
    "All dates"
  );
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await expectNoAxeViolations(page);

  feedUrls.length = 0;
  await page.goto("/app/feed?source=cdc-lyme&published=90d");
  await expect.poll(() => feedUrls[0] ?? "").toContain("source_id=cdc-lyme");
  expectFeedParams(feedUrls[0] ?? "", {
    page_token: null,
    published_from: localPublishedFrom(90),
    published_to: null,
    source_id: "cdc-lyme",
  });
  await expect(page.getByRole("combobox", { name: "Published" })).toContainText(
    "Past 90 days"
  );
  await expectNoAxeViolations(page);

  await page.goto("/app/feed?source=not%20valid&published=nope");
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expectNoAxeViolations(page);

  await page.goto("/app/feed?source=missing-source&published=30d");
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expectNoAxeViolations(page);
});

test("sends active filters with Show more and keeps empty, too-broad, and source errors distinct", async ({
  page,
}, testInfo) => {
  const [first, second] = mixedIntelligenceFeedItems;
  await page.route(FEED_URL, async (route) => {
    const url = route.request().url();
    feedUrls.push(url);
    const token = new URL(url).searchParams.get("page_token");
    await route.fulfill({
      contentType: "application/json",
      json: intelligenceFeedEnvelope(
        token ? [second] : [first],
        token ? null : "page-2"
      ),
      status: 200,
    });
  });
  await page.goto("/app/feed?source=cdc-lyme&published=7d");
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Show more items" }).click();
  await expect(
    page.getByRole("heading", { name: /County-level Lyme reporting, a review/ })
  ).toBeVisible();
  const nextUrl = feedUrls.find((url) => url.includes("page_token=page-2"));
  expect(nextUrl).toBeTruthy();
  expectFeedParams(nextUrl ?? "", {
    page_token: "page-2",
    published_from: localPublishedFrom(7),
    published_to: null,
    source_id: "cdc-lyme",
  });
  await expect(page.getByText(/Showing 2 items/)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.unroute(FEED_URL);
  feedUrls.length = 0;
  await installFeed(page, 200, intelligenceFeedEnvelope([]));
  await page.goto("/app/feed?published=7d");
  await expect(
    page.getByRole("heading", { name: "No items match these filters" })
  ).toBeVisible();
  await expect(page.getByText("Showing 0 items")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No new items" })).toHaveCount(
    0
  );
  await expectNoAxeViolations(page);
  await page.screenshot({
    path: testInfo.outputPath(
      "fixture-backed-intelligence-feed-filtered-empty.png"
    ),
  });

  await page.unroute(FEED_URL);
  await installFeed(page, 400, {
    code: "QUERY_TOO_BROAD",
    detail: "Narrow the source or publication dates.",
    status: 400,
    title: "Query too broad",
    type: "about:blank",
  });
  await page.goto("/app/feed?published=all");
  await expect(
    page.getByRole("heading", { name: "Too many items to show at once" })
  ).toBeVisible();
  await expect(
    page.getByText("Choose a source or a shorter date range.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Intelligence feed request failed" })
  ).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Source" })).toBeEnabled();
  await expectNoAxeViolations(page);

  await page.unroute(SOURCES_URL);
  await installSources(page, "fail");
  await page.unroute(FEED_URL);
  await installFeed(
    page,
    200,
    intelligenceFeedEnvelope(mixedIntelligenceFeedItems)
  );
  await page.goto("/app/feed");
  await expect(page.getByText("Sources couldn't load")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Intelligence feed request failed" })
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.screenshot({
    path: testInfo.outputPath(
      "fixture-backed-intelligence-feed-source-error.png"
    ),
  });
});

test("stacks feed filters at 375px without horizontal scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width feed filters run on the mobile project."
  );
  await installFeed(
    page,
    200,
    intelligenceFeedEnvelope(mixedIntelligenceFeedItems)
  );
  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto("/app/feed");
  const source = page.getByRole("combobox", { name: "Source" });
  const published = page.getByRole("combobox", { name: "Published" });
  await expect(source).toBeVisible();
  await source.click();
  await page
    .getByRole("option", {
      name: "Centers for Disease Control and Prevention",
    })
    .click();
  const sourceBox = await source.boundingBox();
  const publishedBox = await published.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(publishedBox).toBeTruthy();
  expect((sourceBox?.y ?? 0) + (sourceBox?.height ?? 0)).toBeLessThanOrEqual(
    (publishedBox?.y ?? 0) + 1
  );
  expect(sourceBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(publishedBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expectNoAxeViolations(page);
  await page.screenshot({
    path: testInfo.outputPath(
      "fixture-backed-intelligence-feed-filters-375.png"
    ),
  });
});
