import { readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedListEntry } from "@/generated/models/feedListEntry";

import { intelligenceSourcesEnvelope } from "../fixtures/intelligence-feed-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

const FEED_URL = "**/v1/intelligence/feed**";
const SOURCES_URL = "**/v1/intelligence/sources**";
const COURTESY = "Courtesy of the U.S. National Library of Medicine";
const COPYRIGHT = "© 2026 Fixture Publisher.";
const PUBMED_URL = "https://pubmed.ncbi.nlm.nih.gov/12345678/";

const listFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/feed-pubmed-abstracts.json"),
    "utf8"
  )
) as { data: FeedListEntry[] };
const fullFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/feed-pubmed-entry-full.json"),
    "utf8"
  )
) as { entries: Record<string, { data: FeedEntry }> };

function row(title: string): FeedListEntry {
  const found = listFixture.data.find((entry) => entry.title === title);
  if (!found) {
    throw new Error(`Missing fixture row ${title}`);
  }
  return found;
}

function card(page: Page, title: string) {
  return page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: title }),
  });
}

async function installAbstractFeed(
  page: Page,
  byIdStatus: number | "hold" = 200
): Promise<{ byIdCalls: () => number; release: () => void }> {
  let calls = 0;
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(FEED_URL, async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/").filter(Boolean);
    const itemId = decodeURIComponent(parts.at(-1) ?? "");
    const payload = fullFixture.entries[itemId];
    if (payload) {
      calls += 1;
      if (byIdStatus === "hold") {
        await held;
        await route.fulfill({ json: payload, status: 200 });
        return;
      }
      if (byIdStatus === 200) {
        await route.fulfill({ json: payload, status: 200 });
        return;
      }
      await route.fulfill({
        json: {
          detail: "Unavailable",
          status: byIdStatus,
          title: "Unavailable",
          type: "about:blank",
        },
        status: byIdStatus,
      });
      return;
    }
    await route.fulfill({ json: listFixture, status: 200 });
  });
  return { byIdCalls: () => calls, release };
}

test.beforeEach(async ({ page }, testInfo) => {
  await fulfillCompletedStartingView(page);
  await page.route(SOURCES_URL, async (route) => {
    await route.fulfill({
      json: intelligenceSourcesEnvelope([]),
      status: 200,
    });
  });
  if (!testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ height: 900, width: 1280 });
  }
});

test("shows PubMed abstract previews and expands the full text", async ({
  page,
}) => {
  const feed = await installAbstractFeed(page);
  await page.goto("/app/feed");
  const preview = card(page, "Fixture preview article");
  const previewText = row("Fixture preview article").abstract_preview ?? "";
  await expect(preview.getByTestId("feed-abstract")).toHaveText(previewText);
  await expect(preview.getByTestId("feed-abstract-copyright")).toHaveText(
    COPYRIGHT
  );
  await expect(preview.getByText(COURTESY)).toHaveCount(1);
  const pubmed = preview.getByRole("link", { name: /View on PubMed/ });
  await expect(pubmed).toHaveAttribute("href", PUBMED_URL);
  await expect(pubmed).toHaveAttribute("rel", "noopener noreferrer");
  await expect(pubmed).toHaveAttribute("target", "_blank");
  await expect(pubmed).not.toHaveAttribute("data-atlas-analytics-control");
  const toggle = preview.getByRole("button", {
    name: /Show full abstract|Show less/,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).not.toHaveAttribute("data-atlas-analytics-control");
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(
    preview.getByRole("button", { name: "Read more" })
  ).toBeVisible();
  const collapsed = await new AxeBuilder({ page }).include("main").analyze();
  expect(collapsed.violations).toEqual([]);
  await preview.screenshot({
    path: "/opt/cursor/artifacts/pubmed-abstract-collapsed.png",
  });

  const full =
    fullFixture.entries[row("Fixture preview article").item_id]?.data.abstract
      ?.text;
  if (!full) {
    throw new Error("Missing full abstract fixture");
  }
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toBeFocused();
  await expect(preview.getByTestId("feed-abstract")).toHaveText(full);
  await expect(preview.getByTestId("feed-abstract-status")).toHaveText(
    "Full abstract shown."
  );
  const expanded = await new AxeBuilder({ page }).include("main").analyze();
  expect(expanded.violations).toEqual([]);
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "/opt/cursor/artifacts/pubmed-abstract-expanded.png",
  });
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await expect(preview.getByTestId("feed-abstract")).toHaveText(previewText);
  await toggle.click();
  await expect(preview.getByTestId("feed-abstract")).toHaveText(full);
  expect(feed.byIdCalls()).toBe(1);

  await preview.getByRole("button", { name: "Read more" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("feed-abstract")).toHaveText(full);
  await expect(dialog.getByText(COURTESY)).toHaveCount(1);
  await expect(
    dialog.getByRole("link", { name: /View on PubMed/ })
  ).toHaveAttribute("data-atlas-analytics-control", "feed_item_pubmed_open");
  await page.keyboard.press("Escape");

  const short = card(page, "Fixture short abstract");
  await expect(short.getByTestId("feed-abstract")).toHaveText(
    row("Fixture short abstract").abstract_preview ?? ""
  );
  await expect(
    short.getByRole("button", { name: "Show full abstract" })
  ).toHaveCount(0);
  await expect(short.getByTestId("feed-abstract-copyright")).toHaveCount(0);

  const emptyPreview = card(page, "Fixture empty preview");
  await expect(emptyPreview.getByTestId("feed-abstract")).toHaveCount(0);
  await expect(emptyPreview.getByTestId("feed-abstract-copyright")).toHaveText(
    COPYRIGHT
  );
  await emptyPreview
    .getByRole("button", { name: "Show full abstract" })
    .click();
  await expect(emptyPreview.getByTestId("feed-abstract")).toHaveText(
    "Fixture full abstract after an empty preview."
  );

  const other = card(page, "Fixture county surveillance");
  await expect(other.getByTestId("feed-description")).toHaveText(
    "County surveillance note for a non PubMed item."
  );
  await expect(other.getByTestId("feed-abstract")).toHaveCount(0);
  await expect(other.getByRole("link", { name: /View on PubMed/ })).toHaveCount(
    0
  );

  for (const title of [
    "Fixture blank abstract",
    "Fixture record without abstract",
    "Fixture private abstract",
    "Fixture quiet abstract",
  ]) {
    const item = card(page, title);
    await expect(item.getByTestId("feed-abstract")).toHaveCount(0);
    await expect(item.getByTestId("feed-abstract-region")).toHaveCount(0);
    await expect(
      item.getByRole("link", { name: /View on PubMed/ })
    ).toHaveAttribute("href", PUBMED_URL);
    if (title === "Fixture quiet abstract") {
      await expect(item).not.toContainText(/removed|withheld|suppressed/i);
    }
    await item.getByRole("button", { name: "Details" }).click();
    const panel = page.getByRole("dialog");
    await expect(
      panel.getByRole("link", { name: /View on PubMed/ })
    ).toHaveAttribute("href", PUBMED_URL);
    if (title === "Fixture record without abstract") {
      await expect(panel).toContainText("No abstract in the PubMed record.");
    } else {
      await expect(panel.getByTestId("feed-abstract")).toHaveCount(0);
      await expect(
        panel.getByText("No abstract in the PubMed record.")
      ).toHaveCount(0);
    }
    if (title === "Fixture quiet abstract") {
      await expect(panel).not.toContainText(/removed|withheld|suppressed/i);
    }
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);
  }

  await short.getByRole("button", { name: "Details" }).click();
  const shortPanel = page.getByRole("dialog");
  await expect(shortPanel.getByTestId("feed-abstract")).toHaveText(
    row("Fixture short abstract").abstract_preview ?? ""
  );
  await expect(shortPanel.getByTestId("feed-abstract-copyright")).toHaveCount(
    0
  );
  await shortPanel.getByRole("button", { name: "Close" }).click();
});

test("keeps the preview when the full abstract request fails", async ({
  page,
}) => {
  await installAbstractFeed(page, 503);
  await page.goto("/app/feed");
  const preview = card(page, "Fixture preview article");
  const previewText = row("Fixture preview article").abstract_preview ?? "";
  await preview.getByRole("button", { name: "Show full abstract" }).click();
  await expect(preview.getByTestId("feed-abstract-status")).toHaveText(
    "The full abstract is unavailable right now."
  );
  await expect(preview.getByTestId("feed-abstract")).toHaveText(previewText);
  await expect(preview.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(
    preview.getByRole("link", { name: /View on PubMed/ })
  ).toHaveAttribute("href", PUBMED_URL);
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
  await preview.screenshot({
    path: "/opt/cursor/artifacts/pubmed-abstract-error.png",
  });
});

test("keeps the preview when the item is gone", async ({ page }) => {
  await installAbstractFeed(page, 404);
  await page.goto("/app/feed");
  const preview = card(page, "Fixture preview article");
  await preview.getByRole("button", { name: "Show full abstract" }).click();
  await expect(preview.getByTestId("feed-abstract-status")).toHaveText(
    "This item is no longer in the feed."
  );
  await expect(preview.getByTestId("feed-abstract")).toHaveText(
    row("Fixture preview article").abstract_preview ?? ""
  );
  await expect(preview.getByRole("button", { name: "Retry" })).toHaveCount(0);
  await expect(
    preview.getByRole("link", { name: /View on PubMed/ })
  ).toBeVisible();
});

test("announces a loading abstract without axe violations", async ({
  page,
}) => {
  const feed = await installAbstractFeed(page, "hold");
  await page.goto("/app/feed");
  const preview = card(page, "Fixture preview article");
  await preview.getByRole("button", { name: "Show full abstract" }).click();
  await expect(preview.getByTestId("feed-abstract-region")).toHaveAttribute(
    "aria-busy",
    "true"
  );
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
  feed.release();
  await expect(preview.getByTestId("feed-abstract")).toHaveText(
    fullFixture.entries[row("Fixture preview article").item_id]?.data.abstract
      ?.text ?? ""
  );
});

test("keeps a long abstract inside phone widths", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 320),
    "Phone-width abstract cards run on the mobile project."
  );
  await installAbstractFeed(page);
  await page.goto("/app/feed");
  const preview = card(page, "Fixture long abstract");
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ height: 800, width });
    const toggle = preview.getByRole("button", { name: "Show full abstract" });
    await toggle.scrollIntoViewIfNeeded();
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((toggleBox?.x ?? 0) + (toggleBox?.width ?? 0)).toBeLessThanOrEqual(
      width + 1
    );
    const copy = preview.getByTestId("feed-abstract-copyright");
    await expect(copy).toBeVisible();
    const copyBox = await copy.boundingBox();
    expect((copyBox?.x ?? 0) + (copyBox?.width ?? 0)).toBeLessThanOrEqual(
      width + 1
    );
    const pubmed = preview.getByRole("link", { name: /View on PubMed/ });
    const pubmedBox = await pubmed.boundingBox();
    expect(pubmedBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((pubmedBox?.x ?? 0) + (pubmedBox?.width ?? 0)).toBeLessThanOrEqual(
      width + 1
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }
    await expect(preview.getByTestId("feed-abstract")).toHaveText(
      fullFixture.entries[row("Fixture long abstract").item_id]?.data.abstract
        ?.text ?? ""
    );
    const expandedOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(expandedOverflow).toBeLessThanOrEqual(1);
  }
});
