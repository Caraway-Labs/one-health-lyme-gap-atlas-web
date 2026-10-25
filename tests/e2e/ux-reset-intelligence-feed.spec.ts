import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { BriefingSourceReviewedTrustClassification } from "@/generated/models/briefingSourceReviewedTrustClassification";

import {
  intelligenceFeedEnvelope,
  intelligenceFeedEntry,
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
    .getByRole("link", { name: "Research & News", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Feed" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Lyme disease surveillance update/ })
  ).toBeVisible();
  await expect(page.getByText("CDC", { exact: true })).toBeVisible();
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
    page.getByRole("heading", { name: "No items in this date window" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show all dates" })
  ).toBeVisible();
  await expect(page.getByText(/no items in this feed right now/i)).toHaveCount(
    0
  );
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

  feedUrls.length = 0;
  await page.goto("/app/feed?source=missing-source&published=30d");
  await expect(page).toHaveURL(/\/app\/feed\?source=missing-source$/);
  await expect(page.getByRole("combobox", { name: "Source" })).toContainText(
    "missing-source"
  );
  await expect(
    page.getByRole("button", { name: "Remove filter Source: missing-source" })
  ).toBeVisible();
  await expect
    .poll(() =>
      feedUrls.some((url) => url.includes("source_id=missing-source"))
    )
    .toBe(true);
  expect(
    feedUrls.some((url) => new URL(url).searchParams.get("source_id") === null)
  ).toBe(false);
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
    page.getByRole("status").getByRole("button", { name: "Try again" })
  ).toHaveAttribute("data-atlas-analytics-control", "feed_sources_retry");
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

test("keeps a default date window empty distinct from an unfiltered feed", async ({
  page,
}) => {
  const older = {
    ...mixedIntelligenceFeedItems[0],
    published_at: "2020-01-15T00:00:00Z",
    title: "Older surveillance note",
  };
  const undated = {
    ...mixedIntelligenceFeedItems[1],
    publication_date_state: "not_provided" as const,
    published_at: null,
    title: "Undated surveillance note",
  };
  await page.route(FEED_URL, async (route) => {
    const url = route.request().url();
    feedUrls.push(url);
    const publishedFrom = new URL(url).searchParams.get("published_from");
    await route.fulfill({
      contentType: "application/json",
      json: intelligenceFeedEnvelope(publishedFrom ? [] : [older, undated]),
      status: 200,
    });
  });
  await page.goto("/app/feed");
  await expect(
    page.getByRole("heading", { name: "No items in this date window" })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Approved trusted sources have no items in this feed right now."
    )
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(
    0
  );
  await page.getByRole("button", { name: "Show all dates" }).click();
  await expect(
    page.getByRole("heading", { name: "Older surveillance note" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Undated surveillance note" })
  ).toBeVisible();
  await expect(page).toHaveURL(/published=all/);
  expect(
    feedUrls.some((url) => new URL(url).searchParams.get("published_from"))
  ).toBe(true);
  expect(
    feedUrls.some((url) => !new URL(url).searchParams.has("published_from"))
  ).toBe(true);
});

test("resets cached feed pages to page one when a filter changes or clears", async ({
  page,
}) => {
  const [first, second, third] = mixedIntelligenceFeedItems;
  let defaultPageOneVisits = 0;
  const pageOneTokens: string[] = [];
  await page.route(FEED_URL, async (route) => {
    const url = route.request().url();
    feedUrls.push(url);
    const params = new URL(url).searchParams;
    const token = params.get("page_token");
    const publishedFrom = params.get("published_from");
    const isSevenDays = publishedFrom === localPublishedFrom(7);
    if (isSevenDays) {
      await route.fulfill({
        contentType: "application/json",
        json: intelligenceFeedEnvelope([third], token ? null : "7d-1"),
        status: 200,
      });
      return;
    }
    if (token) {
      await route.fulfill({
        contentType: "application/json",
        json: intelligenceFeedEnvelope([
          { ...second, title: `Continuation ${token}` },
        ]),
        status: 200,
      });
      return;
    }
    defaultPageOneVisits += 1;
    const nextToken = `30d-${defaultPageOneVisits}`;
    pageOneTokens.push(nextToken);
    await route.fulfill({
      contentType: "application/json",
      json: intelligenceFeedEnvelope(
        [{ ...first, title: "Default first" }],
        nextToken
      ),
      status: 200,
    });
  });

  const settledPageOneToken = async () => {
    await expect(
      page.getByRole("heading", { name: "Default first" })
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    const token = pageOneTokens.at(-1);
    expect(token).toBeTruthy();
    return token ?? "";
  };

  await page.goto("/app/feed");
  const firstToken = await settledPageOneToken();
  await page.getByRole("button", { name: "Show more items" }).click();
  await expect(
    page.getByRole("heading", { name: `Continuation ${firstToken}` })
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Published" }).click();
  await page.getByRole("option", { name: "Past 7 days" }).click();
  await expect(
    page.getByRole("heading", { name: "New York Lyme disease information" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Continuation ${firstToken}` })
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: "Published" }).click();
  await page.getByRole("option", { name: "Past 30 days" }).click();
  const returnedToken = await settledPageOneToken();
  expect(returnedToken).not.toBe(firstToken);
  await expect(
    page.getByRole("heading", { name: `Continuation ${firstToken}` })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show more items" }).click();
  await expect(
    page.getByRole("heading", { name: `Continuation ${returnedToken}` })
  ).toBeVisible();
  expect(
    feedUrls.filter((url) => url.includes(`page_token=${returnedToken}`))
  ).toHaveLength(1);
  expect(
    feedUrls.filter((url) => url.includes(`page_token=${firstToken}`))
  ).toHaveLength(1);

  await page.getByRole("combobox", { name: "Published" }).click();
  await page.getByRole("option", { name: "Past 7 days" }).click();
  await expect(
    page.getByRole("heading", { name: "New York Lyme disease information" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  const clearedToken = await settledPageOneToken();
  expect(clearedToken).not.toBe(returnedToken);
  await expect(
    page.getByRole("heading", { name: `Continuation ${returnedToken}` })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show more items" }).click();
  await expect(
    page.getByRole("heading", { name: `Continuation ${clearedToken}` })
  ).toBeVisible();
  expect(
    feedUrls.filter((url) => url.includes(`page_token=${clearedToken}`))
  ).toHaveLength(1);
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

const RICH_FEED_CAVEATS = ["Fixture caveat A", "Fixture caveat B"] as const;

function richDescribedEntry() {
  return intelligenceFeedEntry("described", {
    attribution: "Source: Centers for Disease Control and Prevention",
    description: {
      state: "present",
      text: "Wastewater surveillance detected influenza A(H5) in Oregon.",
    },
    limitations: [...RICH_FEED_CAVEATS],
    organization: "Centers for Disease Control and Prevention",
    publisher: "Centers for Disease Control and Prevention",
    sourceFamily: "cdc_mmwr",
    sourceFamilyLabel: "CDC MMWR",
    sourceId: "cdc-mmwr",
    tags: ["Influenza", "Wastewater", "Oregon", "H5"],
    title: "Described MMWR item",
    trust: BriefingSourceReviewedTrustClassification.official_public_health,
  });
}

function richPubMedEntry() {
  return intelligenceFeedEntry("pubmed-card", {
    abstract: {
      copyright_line: "© 2026 Elsevier GmbH.",
      state: "present",
      text: "N".repeat(3400),
    },
    attribution: "Courtesy of the U.S. National Library of Medicine",
    authors: ["Smith J", "Lee K"],
    description: { state: "not_provided", text: null },
    limitations: [...RICH_FEED_CAVEATS],
    organization: "National Library of Medicine",
    pmid: "41234567",
    publisher: "Ticks and Tick-borne Diseases",
    sourceFamily: "pubmed",
    sourceId: "pubmed-tick-borne",
    tags: ["Lyme disease"],
    title: "PubMed abstract item",
    trust: BriefingSourceReviewedTrustClassification.research_index,
  });
}

async function installRichFeed(
  page: Page,
  remoteItemId: string,
  remoteBody: unknown
): Promise<void> {
  await installFeed(
    page,
    200,
    intelligenceFeedEnvelope([richDescribedEntry(), richPubMedEntry()], null)
  );
  await page.route("**/v1/intelligence/feed/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith(remoteItemId)) {
      await route.fulfill({
        json: {
          data: remoteBody,
          meta: { projection_version: "intelligence-feed-read-v2" },
        },
        status: 200,
      });
      return;
    }
    await route.fulfill({
      json: {
        code: "INTELLIGENCE_ITEM_NOT_FOUND",
        detail: "No intelligence feed entry exists for this id.",
        status: 404,
        title: "Not found",
        type: "about:blank",
      },
      status: pathname.includes("%") ? 422 : 404,
    });
  });
}

test("shows richer cards and a detail drawer", async ({ page }) => {
  const described = richDescribedEntry();
  const remote = intelligenceFeedEntry("remote-item", {
    description: { state: "present", text: "Remote description text." },
    organization: "Centers for Disease Control and Prevention",
    publisher: "Centers for Disease Control and Prevention",
    sourceFamily: "cdc_eid",
    sourceId: "cdc-eid-expedited",
    title: "Remote EID item",
    trust: BriefingSourceReviewedTrustClassification.official_public_health,
  });
  await installRichFeed(page, remote.item_id, remote);
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/app/feed");
  await expect(
    page.getByRole("heading", { name: "Described MMWR item" })
  ).toBeVisible();
  await expect(page.getByText("CDC MMWR")).toBeVisible();
  await expect(page.getByTestId("feed-shared-caveats")).toContainText(
    "Fixture caveat A"
  );
  const copyright = page.getByTestId("feed-abstract-copyright");
  await expect(copyright).toBeVisible();
  await expect(copyright).toHaveText("© 2026 Elsevier GmbH.");
  await page.screenshot({
    fullPage: true,
    path: "/opt/cursor/artifacts/feed-after-desktop.png",
  });
  await page.getByRole("button", { name: "Details" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`item=${described.item_id}`));
  const pageHeading = page.locator("#intelligence-feed-heading");
  await expect(pageHeading).toHaveText("Feed");
  const headingBox = await pageHeading.boundingBox();
  expect(headingBox?.width ?? 0).toBeGreaterThan(0);
  const drawer = await dialog.boundingBox();
  expect(drawer?.width ?? 0).toBeGreaterThan(440);
  expect(drawer?.width ?? 0).toBeLessThan(520);
  expect((drawer?.x ?? 0) + (drawer?.width ?? 0)).toBeGreaterThan(1200);
  await page.screenshot({
    path: "/opt/cursor/artifacts/feed-after-desktop-detail.png",
  });
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/item=/);

  await page.goto(`/app/feed?item=${remote.item_id}`);
  await expect(page.getByRole("dialog")).toContainText(
    "Remote description text."
  );
  await page.goto(`/app/feed?item=${encodeURIComponent("%%%bad")}`);
  await expect(page.getByRole("dialog")).toContainText(
    "This item is no longer in the feed."
  );
});

test("keeps the feed detail sheet inside the phone widths", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 320),
    "Phone-width feed sheets run on the mobile project."
  );
  const remote = intelligenceFeedEntry("remote-item", {
    description: { state: "present", text: "Remote description text." },
    organization: "Centers for Disease Control and Prevention",
    publisher: "Centers for Disease Control and Prevention",
    sourceFamily: "cdc_eid",
    sourceId: "cdc-eid-expedited",
    title: "Remote EID item",
    trust: BriefingSourceReviewedTrustClassification.official_public_health,
  });
  await installRichFeed(page, remote.item_id, remote);
  await page.goto("/app/feed");
  await expect(
    page.getByRole("heading", { name: "Described MMWR item" })
  ).toBeVisible();

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ height: 800, width });
    const cardCopyright = page.getByTestId("feed-abstract-copyright");
    await cardCopyright.scrollIntoViewIfNeeded();
    const cardCopyrightBox = await cardCopyright.boundingBox();
    expect(cardCopyrightBox?.width ?? 0).toBeGreaterThan(0);
    expect(
      (cardCopyrightBox?.x ?? 0) + (cardCopyrightBox?.width ?? 0)
    ).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole("button", { name: "Read more" })).toBeVisible();
    if (width === 320) {
      const clamped = await page
        .getByTestId("feed-abstract")
        .evaluate((element) => element.scrollHeight > element.clientHeight + 1);
      expect(clamped).toBeTruthy();
    }
    await page.getByRole("button", { name: "Read more" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.x ?? 1).toBeLessThanOrEqual(1);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(width - 1);
    const copy = sheet.getByText("© 2026 Elsevier GmbH.");
    await expect(copy).toBeVisible();
    const copyBox = await copy.boundingBox();
    expect((copyBox?.x ?? 0) + (copyBox?.width ?? 0)).toBeLessThanOrEqual(
      width + 1
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    if (width === 390) {
      await page.screenshot({
        path: "/opt/cursor/artifacts/feed-after-390-detail.png",
      });
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  }
});
