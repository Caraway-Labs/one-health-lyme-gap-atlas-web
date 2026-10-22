import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { DATA_PROVENANCE_NAV_DESCRIPTION } from "@/features/ux-reset/paths";

import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
});

const SOURCE_DESCRIPTION = DATA_PROVENANCE_NAV_DESCRIPTION;

async function focusByTab(page: Page, locator: Locator) {
  for (let step = 0; step < 30; step += 1) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("keyboard focus did not reach the expected control");
}

async function expectProvenanceTooltip(page: Page) {
  const tooltip = page.locator("[data-slot='tooltip-content']").filter({
    hasText: SOURCE_DESCRIPTION,
  });
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator("span").nth(0)).toHaveText("Data Provenance");
  await expect(tooltip.locator("span").nth(1)).toHaveText(SOURCE_DESCRIPTION);
}

function envelope(data: unknown[]) {
  return {
    data,
    links: { self: "/v1/example" },
    meta: { next_page_token: null },
  };
}

async function installCatalog(page: Page) {
  await page.route("**/v1/sources**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: envelope([
        {
          dataset_id: "cdc-lyme-dataset",
          label: "CDC Lyme surveillance",
          limitations: ["County of residence is not the exposure location."],
          lineage_source_id: "lineage-cdc-lyme",
          publisher: "Centers for Disease Control and Prevention",
          release_version: "release-1",
          semantic_version: "semantic-1",
          source_id: "cdc-lyme",
          source_retrieved_at: "2026-01-15T00:00:00Z",
          source_url: "https://example.com/cdc-lyme",
          source_vintage: "2023",
          upstream_updated_at: "2024-06-01T00:00:00Z",
        },
        {
          dataset_id: "tick-dataset",
          label: "Tick establishment records",
          limitations: [],
          lineage_source_id: "lineage-ticks",
          publisher: "Illustrative publisher",
          release_version: "release-1",
          semantic_version: "semantic-1",
          source_id: "cdc-ticks",
          source_vintage: "2024",
        },
      ]),
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: envelope([
        {
          definition: "Published county-linked Lyme case information.",
          indicator_id: "human_disease_burden",
          label: "Lyme cases",
          measure_id: "lyme_cases",
          missingness_semantics:
            "Missing and suppressed values stay null and are not zero.",
          semantic_version: "semantic-1",
          source_ids: ["cdc-lyme"],
          temporal_semantics: "Annual surveillance year.",
        },
        {
          definition: "Published tick establishment status.",
          indicator_id: "tick_surveillance",
          label: "Tick status",
          measure_id: "tick_status",
          semantic_version: "semantic-1",
          source_ids: ["cdc-ticks"],
        },
      ]),
    });
  });
  await page.route("**/v1/indicators**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: envelope([
        {
          definition: null,
          domain: "human",
          indicator_id: "human_disease_burden",
          label: "Human disease",
          measure_ids: ["lyme_cases"],
          semantic_version: "semantic-1",
        },
        {
          definition: null,
          domain: "vector",
          indicator_id: "tick_surveillance",
          label: "Ticks",
          measure_ids: ["tick_status"],
          semantic_version: "semantic-1",
        },
      ]),
    });
  });
}

test("adds Data Provenance between Feed and Docs", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/explore");
  const navigation = page.getByRole("navigation", {
    name: "Professional workspace",
  });
  await expect(
    navigation.getByRole("link", { name: "Atlas Explorer" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Docs, opens in a new tab" })
  ).toBeVisible();
  const labels = await navigation
    .locator("a")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label"))
    );
  expect(labels).toEqual([
    "Atlas Explorer",
    "Compare",
    "Ask Atlas",
    "Research & News",
    "Data Provenance",
    "Settings",
    "Docs, opens in a new tab",
  ]);
  const provenance = navigation.getByRole("link", {
    exact: true,
    name: "Data Provenance",
  });
  await expect(provenance).toHaveAttribute(
    "aria-description",
    SOURCE_DESCRIPTION
  );
  await expect(provenance.locator("svg")).toHaveClass(
    /lucide-fingerprint-pattern/
  );
  await page.screenshot({
    path: testInfo.outputPath("sidebar-expanded.png"),
  });

  await provenance.hover();
  await expectProvenanceTooltip(page);
  await page.screenshot({
    path: testInfo.outputPath("sidebar-tooltip.png"),
  });

  await page.getByRole("button", { name: "Hide navigation" }).click();
  await expect(page.locator("#ux-reset-pro-navigation")).toHaveAttribute(
    "data-state",
    "collapsed"
  );
  await expect(provenance).toHaveAttribute("aria-label", "Data Provenance");
  await expect(provenance).toHaveAttribute(
    "aria-description",
    SOURCE_DESCRIPTION
  );
  // The collapse click is pointer input. Base UI opens the shared tooltip
  // only for :focus-visible, so the keyboard check has to be a real Tab.
  await page.mouse.move(1100, 240);
  await focusByTab(page, provenance);
  await expect(provenance).toBeFocused();
  await expectProvenanceTooltip(page);

  await page.keyboard.press("Shift+Tab");
  await expect(provenance).not.toBeFocused();
  await page.mouse.move(1100, 240);
  await expect(
    page.locator("[data-slot='tooltip-content']").filter({
      hasText: SOURCE_DESCRIPTION,
    })
  ).toBeHidden();
  await provenance.hover();
  await expectProvenanceTooltip(page);
  await page.screenshot({
    path: testInfo.outputPath("sidebar-collapsed.png"),
  });
});

test("opens source cards, deep links, and keeps inline provenance", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await installCatalog(page);
  await page.goto("/data-provenance");
  await expect(
    page.getByRole("heading", { level: 1, name: "Data Provenance" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Where our data comes from" })
  ).toBeVisible();
  const pipeline = page.getByRole("list", {
    name: "Conceptual evidence pipeline",
  });
  await expect(pipeline.getByRole("heading").nth(0)).toContainText("Source");
  await expect(pipeline.getByRole("heading").nth(4)).toContainText("Explore");
  await expect(
    page.getByRole("heading", { exact: true, level: 4, name: "Literature" })
  ).toBeVisible();
  await expect(page.getByText("not predicted Lyme risk")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-page.png"),
  });

  const surveillance = page.locator("#source-cdc-lyme");
  await page.getByText("CDC Lyme surveillance", { exact: true }).click();
  await expect(
    page.getByText("County of residence is not the exposure location.")
  ).toBeVisible();
  await expect(page.getByText("Source type: Not provided")).toHaveCount(2);
  await expect(page).toHaveURL(/#source-cdc-lyme$/);
  await page.getByText("Tick establishment records", { exact: true }).click();
  await expect(page.getByText("Human surveillance")).toBeVisible();
  await expect(page.getByText("Ticks and pathogens")).toBeVisible();
  await expect(surveillance).toHaveAttribute("open", "");
  await surveillance.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-source-card.png"),
  });

  await page.goto("/data-provenance#source-cdc-lyme");
  await expect(page.locator("#source-cdc-lyme")).toHaveAttribute("open", "");
  await page.reload();
  await expect(page.locator("#source-cdc-lyme")).toHaveAttribute("open", "");

  await page.goto("/data-provenance#source-not-a-source");
  await expect(page.getByTestId("data-provenance-unmatched")).toBeVisible();
  await expect(page.locator("#source-cdc-lyme")).not.toHaveAttribute(
    "open",
    ""
  );
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-unmatched.png"),
  });

  await page.goto("/explore");
  await expect(
    page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", {
        name: "Data Provenance",
      })
  ).not.toHaveAttribute("aria-current", "page");
  await page.goto("/data-provenance");
  await expect(
    page.getByRole("link", { exact: true, name: "Data Provenance" })
  ).toHaveAttribute("aria-current", "page");

  const results = await new AxeBuilder({ page })
    .include(".ux-reset-provenance-page")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("shows a request failure without hiding the page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.route("**/v1/sources**", async (route) => {
    await route.fulfill({ status: 503, json: { detail: "unavailable" } });
  });
  await page.goto("/data-provenance");
  await expect(
    page.getByRole("heading", { level: 1, name: "Data Provenance" })
  ).toBeVisible();
  await expect(page.locator(".ux-reset-provenance-status")).toContainText(
    "The source catalog could not be loaded."
  );
  await expect(
    page.getByRole("list", { name: "Conceptual evidence pipeline" })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-error.png"),
  });
});

test("keeps a phone layout for the provenance page", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 390),
    "Phone-width Data Provenance checks run on the mobile project."
  );
  await page.setViewportSize({ height: 844, width: 390 });
  await installCatalog(page);
  await page.goto("/data-provenance");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { exact: true, name: "Data Provenance" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(
    page.getByRole("list", { name: "Conceptual evidence pipeline" })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("data-provenance-phone.png"),
  });
});
