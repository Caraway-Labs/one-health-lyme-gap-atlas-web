import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const stories: { id: string; text: string }[] = [
  { id: "atlas-section-header--with-aside", text: "Adams County, Colorado" },
  {
    id: "atlas-section-header--title-only",
    text: "Evidence used for this county",
  },
  {
    id: "atlas-section-header--long-title",
    text: "Synthetic county with a long heading",
  },
  { id: "atlas-map-legend--review-priority", text: "Higher review priority" },
  { id: "atlas-map-legend--narrow", text: "Narrow legend" },
  {
    id: "atlas-evidence-snapshot--card",
    text: "Technical release and methodology identifiers",
  },
  { id: "atlas-evidence-snapshot--banner", text: "Evidence snapshot" },
  { id: "atlas-evidence-snapshot--missing", text: "Unavailable" },
  { id: "overview-ranked-counties--short", text: "Boulder County" },
  { id: "overview-ranked-counties--empty", text: "Selected none" },
  {
    id: "overview-ranked-counties--long-list",
    text: "Showing the first 40",
  },
  {
    id: "overview-results-table--populated",
    text: "Boulder County, Colorado",
  },
  { id: "overview-results-table--empty", text: "Complete county list" },
  {
    id: "overview-results-table--long-cell",
    text: "Synthetic county with a long display name",
  },
  {
    id: "county-evidence-panel--published",
    text: "12 published county-linked cases",
  },
  {
    id: "county-evidence-panel--published-zero",
    text: "0 published county-linked cases",
  },
  {
    id: "county-evidence-panel--missing",
    text: "No county-linked published record",
  },
  { id: "county-evidence-panel--compact", text: "Observed evidence" },
  {
    id: "county-uncertainty-panel--complete",
    text: "observed zero is different from an unavailable",
  },
  {
    id: "county-uncertainty-panel--limited",
    text: "No record does not establish that ticks are absent",
  },
  {
    id: "county-action-plan--priority",
    text: "Prioritize targeted follow-up",
  },
  {
    id: "county-action-plan--missing-records",
    text: "Coordinate a local assessment",
  },
  {
    id: "investigation-scoring-assumptions--open",
    text: "How this follow-up priority score is calculated",
  },
  {
    id: "investigation-scoring-assumptions--collapsible",
    text: "Scoring calculation",
  },
  { id: "geographic-explorer-state-grid--tiles", text: "Selected state ALL" },
  {
    id: "geographic-explorer-state-grid--multiples",
    text: "Each dot is one county",
  },
  {
    id: "geographic-explorer-state-grid--colorado",
    text: "Selected state CO",
  },
  {
    id: "geographic-explorer-evidence-table--populated",
    text: "Exact county evidence",
  },
  {
    id: "geographic-explorer-evidence-table--boulder",
    text: "Selected Boulder County (08013)",
  },
  {
    id: "geographic-explorer-scatter-plot--points",
    text: "Evidence completeness (%)",
  },
  {
    id: "geographic-explorer-scatter-plot--adams",
    text: "Selected Adams County (08001)",
  },
  {
    id: "geographic-explorer-view-selector--tiles",
    text: "Active view Geographic tiles",
  },
  {
    id: "geographic-explorer-view-selector--trends",
    text: "Active view Release trends",
  },
];

function track(page: Page): string[] {
  const blocked: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      host = "";
    }
    const external = host !== "" && host !== "127.0.0.1";
    const service =
      url.includes("/v1/") || url.toLowerCase().includes("amplitude");
    if (external || service) {
      blocked.push(url);
    }
  });
  return blocked;
}

async function openStory(page: Page, id: string): Promise<void> {
  await page.goto(`iframe.html?id=${id}&viewMode=story`);
}

test.describe("Domain catalog rows 34-46", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The matrix runs on desktop. Mobile coverage is the long table."
    );
  });

  for (const story of stories) {
    test(`${story.id} renders without a service request`, async ({ page }) => {
      const blocked = track(page);
      await openStory(page, story.id);
      await expect(page.getByText(story.text).first()).toBeVisible();
      expect(blocked).toEqual([]);
    });
  }

  test("ranked selection and the full-list toggle stay local", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "overview-ranked-counties--short");
    await page.getByRole("button", { name: /Wake County/ }).click();
    await expect(page.getByText("Selected Wake County (37183)")).toBeVisible();
    await page.getByRole("button", { name: "View full county list" }).click();
    await expect(page.getByText("Full list open")).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("results table selection stays local", async ({ page }) => {
    const blocked = track(page);
    await openStory(page, "overview-results-table--populated");
    await page
      .getByRole("button", { name: "District of Columbia, DC" })
      .click();
    await expect(
      page.getByText("Selected District of Columbia (11001)")
    ).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("evidence and snapshot disclosures open from the keyboard", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "county-evidence-panel--published");
    await page
      .getByRole("button", { name: "Show community context and completeness" })
      .click();
    await expect(page.getByText("42th percentile")).toBeVisible();
    await openStory(page, "atlas-evidence-snapshot--missing");
    await page
      .getByRole("button", {
        name: "Technical release and methodology identifiers",
      })
      .click();
    await expect(page.getByText("Unavailable").first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("scoring range and reset stay local", async ({ page }) => {
    const blocked = track(page);
    await openStory(page, "investigation-scoring-assumptions--open");
    const slider = page.getByRole("slider", {
      name: "Tick and pathogen share",
    });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Tick and pathogen share 65%")).toBeVisible();
    await page.getByRole("button", { name: "Reset assumptions" }).click();
    await expect(page.getByText("Tick and pathogen share 60%")).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("state grid, evidence table, and scatter selection stay local", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "geographic-explorer-state-grid--tiles");
    await expect(
      page.getByRole("button", { name: "WY: 0 matching counties" })
    ).toBeDisabled();
    await page.getByRole("button", { name: "CO: 2 matching counties" }).click();
    await expect(page.getByText("Selected state CO")).toBeVisible();
    await openStory(page, "geographic-explorer-evidence-table--populated");
    await page.getByRole("button", { name: /Wake County, NC/ }).click();
    await expect(page.getByText("Selected Wake County (37183)")).toBeVisible();
    await openStory(page, "geographic-explorer-scatter-plot--points");
    const boulder = page.getByRole("button", {
      name: /Select Boulder County, Colorado/,
    });
    await boulder.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Selected Boulder County (08013)")
    ).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("view selector keeps the trends prerequisite honest", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "geographic-explorer-view-selector--tiles");
    await expect(page.getByText("Needs release history")).toBeVisible();
    await page.getByRole("button", { name: "Release trends" }).click();
    await expect(page.getByText("Active view Release trends")).toBeVisible();
    expect(blocked).toEqual([]);
  });

  for (const id of [
    "atlas-section-header--with-aside",
    "atlas-map-legend--review-priority",
    "county-uncertainty-panel--limited",
  ]) {
    test(`${id} has no accessibility violations`, async ({ page }) => {
      await openStory(page, id);
      const results = await new AxeBuilder({ page })
        .include("#storybook-root")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("snapshot and scoring docs keep fixed ids in one frame", async ({
    page,
  }) => {
    await page.goto(
      "iframe.html?id=atlas-evidence-snapshot--docs&viewMode=docs"
    );
    await expect(page.locator("#release-education")).toHaveCount(0);
    await expect(
      page.frameLocator("iframe").first().locator("#release-education")
    ).toHaveCount(1);
    await page.goto(
      "iframe.html?id=investigation-scoring-assumptions--docs&viewMode=docs"
    );
    await expect(page.locator("#score-assumptions-heading")).toHaveCount(0);
    await expect(
      page.frameLocator("iframe").first().locator("#score-assumptions-heading")
    ).toHaveCount(1);
  });
});

test("mobile grid scrolls and the long county cell stays visible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Narrow coverage is mobile.");
  const blocked = track(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await openStory(page, "geographic-explorer-state-grid--tiles");
  const scroller = page.locator(".geo-grid-scroll");
  await expect(scroller).toBeVisible();
  const overflow = await scroller.evaluate((node) => node.scrollWidth > 320);
  expect(overflow).toBe(true);
  await openStory(page, "overview-results-table--long-cell");
  await expect(
    page.getByText("Synthetic county with a long display name")
  ).toBeVisible();
  expect(blocked).toEqual([]);
});
