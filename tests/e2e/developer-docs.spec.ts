import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { releaseViewportRuns } from "./release-phone-viewport";

const developerPages = [
  { path: "/docs/develop", heading: "Developer overview" },
  { path: "/docs/develop/quickstart", heading: "Quickstart" },
  { path: "/docs/develop/rest", heading: "REST API" },
  { path: "/docs/develop/geography", heading: "Geography" },
  {
    path: "/docs/develop/resources",
    heading: "Indicators, measures, and observations",
  },
  { path: "/docs/develop/provenance", heading: "Provenance and evidence" },
  { path: "/docs/develop/workflows", heading: "Workflow guides" },
  { path: "/docs/develop/observation-queries", heading: "Observation queries" },
  { path: "/docs/develop/mcp-clients", heading: "MCP clients" },
  {
    path: "/docs/develop/support",
    heading: "OpenAPI, GitHub, and support",
  },
] as const;

test("renders developer guides with accessible headings", async ({ page }) => {
  test.setTimeout(120_000);

  for (const developerPage of developerPages) {
    await page.goto(developerPage.path);
    await expect(
      page.getByRole("heading", { name: developerPage.heading, exact: true })
    ).toBeVisible();
    await expect(page).toHaveTitle(
      new RegExp(
        `${developerPage.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Atlas documentation`
      )
    );
    await expect(page.locator(".app-shell")).toHaveCount(0);

    const results = await new AxeBuilder({ page }).include("main").analyze();
    const blockingViolations = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );
    expect(blockingViolations, developerPage.path).toEqual([]);
  }
});

test("publishes onehealthatlas canonical URLs and contract links", async ({
  page,
}) => {
  await page.goto("/docs/api-reference");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://onehealthatlas.org/docs/api-reference"
  );
  await expect(
    page.getByRole("link", { name: "OpenAPI schema" })
  ).toHaveAttribute("href", "https://api.onehealthatlas.org/openapi.json");
  await expect(
    page.getByRole("link", {
      name: "Atlas documentation and developer guides",
    })
  ).toHaveAttribute("href", "https://onehealthatlas.org/docs");

  const html = await page.content();
  expect(html).not.toContain("api.carawaylabs.com");
  expect(html).not.toContain("carawaylabs.com/docs");

  await page.goto("/docs/develop/support");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://onehealthatlas.org/docs/develop/support"
  );
  await expect(
    page.getByRole("link", { name: "openapi.json" })
  ).toHaveAttribute("href", "https://api.onehealthatlas.org/openapi.json");
});

test("follows the quickstart county request from the developer overview", async ({
  page,
}) => {
  await page.goto("/docs/develop");
  await page
    .locator("main")
    .getByRole("link", { name: "Quickstart", exact: true })
    .click();
  await expect(page).toHaveURL(/\/docs\/develop\/quickstart\/?$/);
  await expect(
    page.getByText(
      "https://api.onehealthatlas.org/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023"
    )
  ).toBeVisible();
  await expect(page.getByText("RATE_LIMITED").first()).toBeVisible();
  await expect(page.getByText("Retry-After").first()).toBeVisible();

  const citation = page
    .locator("main")
    .getByRole("link", { name: "workflow guides", exact: true });
  await citation.click();
  await expect(page).toHaveURL(/\/docs\/develop\/workflows\/?$/);
  await expect(
    page.getByRole("heading", { name: "Query a county", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compare geographies", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Retrieve environmental context",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Reproduce and cite an observation",
      exact: true,
    })
  ).toBeVisible();
});

test("keeps the developer quickstart usable at 375px", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width developer docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/quickstart");
  await expect(
    page.getByRole("heading", { name: "Quickstart", exact: true })
  ).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  const openSidebar = page.getByRole("button", { name: "Open Sidebar" });
  if ((await openSidebar.count()) > 0) {
    await openSidebar.click();
  }
  const sidebar = page.locator(
    "#nd-sidebar:visible, #nd-sidebar-mobile:visible"
  );
  await expect(
    sidebar.getByRole("link", { name: "Developer overview", exact: true })
  ).toBeVisible();

  await page.goto("/docs/develop/support");
  await expect(
    page.getByRole("link", { name: "openapi.json" })
  ).toHaveAttribute("href", "https://api.onehealthatlas.org/openapi.json");
  const supportOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(supportOverflow).toBeLessThanOrEqual(1);
});

const scoringTabLabel = "county-v1 scoring";
const evidenceTabLabel = "county-v2 evidence";
const scoringPanelText = "Cache-Control: public, max-age=300, must-revalidate";
const evidencePanelText =
  "county-v2 requires release, exact period and distinct measures.";

async function expectTemplatePanel(
  page: Page,
  label: string,
  visibleText: string,
  hiddenText: string
) {
  await expect(
    page.getByRole("tab", { exact: true, name: label })
  ).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(visibleText);
  await expect(page.getByText(hiddenText)).toBeHidden();
}

test("switches county report template tabs and records the selector", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/develop/workflows");
  await expect(
    page.getByRole("heading", { name: "Download a county report", exact: true })
  ).toBeVisible();
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  await page.getByRole("tab", { exact: true, name: evidenceTabLabel }).click();
  await expectTemplatePanel(
    page,
    evidenceTabLabel,
    evidencePanelText,
    "Observation context requires county-v2."
  );
  await page.getByRole("tab", { exact: true, name: scoringTabLabel }).click();
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  await page.screenshot({
    path: testInfo.outputPath("county-report-workflows.png"),
  });

  const workflowResults = await new AxeBuilder({ page })
    .include("main")
    .analyze();
  expect(
    workflowResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    )
  ).toEqual([]);

  await page.goto(
    "/docs/api-reference/counties#county_report_pdf_v1_counties__fips__report_pdf_get"
  );
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  await page.getByRole("tab", { exact: true, name: evidenceTabLabel }).click();
  await expectTemplatePanel(
    page,
    evidenceTabLabel,
    evidencePanelText,
    "Observation context requires county-v2."
  );
  await page.getByRole("tab", { exact: true, name: scoringTabLabel }).click();
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  await page.screenshot({
    path: testInfo.outputPath("county-report-reference.png"),
  });
  const referenceResults = await new AxeBuilder({ page })
    .include("main")
    .analyze();
  expect(
    referenceResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    ),
    "county report reference"
  ).toEqual([]);
});

test("keeps county report template tabs usable at 375px", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width county report docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/workflows");
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  await page.getByRole("tab", { exact: true, name: evidenceTabLabel }).click();
  await expectTemplatePanel(
    page,
    evidenceTabLabel,
    evidencePanelText,
    "Observation context requires county-v2."
  );
  const workflowOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(workflowOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("county-report-workflows-phone.png"),
  });

  await page.goto("/docs/api-reference/counties");
  await page
    .getByRole("heading", { name: "Download a county report", exact: true })
    .scrollIntoViewIfNeeded();
  await expectTemplatePanel(
    page,
    scoringTabLabel,
    scoringPanelText,
    evidencePanelText
  );
  const referenceOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(referenceOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("county-report-reference-phone.png"),
  });
});

test("renders MCP client recipes, transport, and copyable guardrails", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/develop/mcp-clients");
  await expect(
    page.getByRole("heading", { name: "MCP clients", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Transport and auth", exact: true })
  ).toBeVisible();
  await expect(page.getByText("2025-06-18").first()).toBeVisible();
  await expect(page.locator("main")).toContainText("notifications/initialized");
  await expect(page.locator("main")).toContainText(
    "MCP-Protocol-Version: 2025-06-18"
  );
  await expect(
    page.getByRole("cell", { name: "No sign in", exact: true })
  ).toBeVisible();

  const endpoint = page.getByText("https://mcp.onehealthatlas.org/mcp").first();
  await expect(endpoint).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mcp-clients-transport.png"),
  });

  await page
    .getByRole("heading", { name: "Cursor", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.getByText('"type": "http"').first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mcp-clients-cursor.png"),
  });

  const guardrails = page.getByRole("heading", {
    name: "Interpretation guardrails",
    exact: true,
  });
  await guardrails.scrollIntoViewIfNeeded();
  const guardrailBlock = page.locator("pre").filter({
    hasText: "Atlas interpretation guardrails:",
  });
  await expect(guardrailBlock).toBeVisible();
  await expect(guardrailBlock).toContainText("Missing is not zero.");
  await expect(guardrailBlock).toContainText("semantic version");
  await expect(guardrailBlock).toContainText("not risk or a diagnosis");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy interpretation guardrails" })
    .click();
  await expect(
    page.getByRole("button", { name: "Copied interpretation guardrails" })
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Missing is not zero.");
  expect(copied).toContain("source vintage");
  await page.screenshot({
    path: testInfo.outputPath("mcp-clients-guardrails.png"),
  });

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);
});

test("keeps MCP client recipes usable at 375px", async ({ page }, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width MCP client docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/mcp-clients");
  await expect(
    page.getByRole("heading", { name: "MCP clients", exact: true })
  ).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("mcp-clients-phone.png"),
  });
});

const observationPanels = [
  { marker: "privacy-protected floor", tab: "Annual surveillance" },
  { marker: "scapularis_status", tab: "Cumulative vector and pathogen" },
  { marker: "nclimgrid_tavg_county_day", tab: "January 2025 environment" },
  { marker: "nlcd_forest_area_share_county_year", tab: "Land cover" },
  { marker: "svi_percentile_2022", tab: "2022 SVI and ACS" },
  { marker: "Metro: area population at least 1 million", tab: "2023 RUCC" },
] as const;

async function expectObservationPanel(
  page: Page,
  selected: (typeof observationPanels)[number]
): Promise<void> {
  await expect(page.getByRole("tab", { name: selected.tab })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(
    page.getByRole("heading", { exact: true, name: selected.tab })
  ).toBeVisible();
  await expect(page.getByText(selected.marker).first()).toBeVisible();
  for (const panel of observationPanels) {
    if (panel.tab === selected.tab) {
      continue;
    }
    await expect(
      page.getByRole("heading", { exact: true, name: panel.tab })
    ).toBeHidden();
  }
}

test("persists the observation slice tab and shows the temporal matrix", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/develop/observation-queries");
  await expect(
    page.getByRole("heading", { name: "Observation queries", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "vintage_year", exact: true })
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Temporal parameters", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("observation-queries-matrix.png"),
  });

  for (const [index, panel] of observationPanels.entries()) {
    if (index > 0) {
      await page.getByRole("tab", { name: panel.tab }).click();
    }
    await expectObservationPanel(page, panel);
    if (panel.tab === "2023 RUCC") {
      await page.screenshot({
        path: testInfo.outputPath("observation-queries-rucc.png"),
      });
    }
    await page.evaluate(() => {
      sessionStorage.clear();
    });
    await page.reload();
    await expectObservationPanel(page, panel);
  }

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);
});

test("opens a hidden observation slice from its heading hash", async ({
  page,
}) => {
  await page.goto(
    "/docs/develop/observation-queries#cumulative-vector-and-pathogen"
  );
  await expect(
    page.getByRole("heading", {
      exact: true,
      name: "Cumulative vector and pathogen",
    })
  ).toBeVisible();
  await expect(page.getByText("scapularis_status").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Annual surveillance" })
  ).toBeHidden();

  await page.goto("/docs/develop/observation-queries");
  await page
    .getByRole("link", { exact: true, name: "Cumulative vector and pathogen" })
    .click();
  await expect(page).toHaveURL(/#cumulative-vector-and-pathogen$/);
  await expect(page.getByText("scapularis_status").first()).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Cumulative vector and pathogen" })
  ).toHaveAttribute("aria-selected", "true");
});

test("keeps observation query tabs usable at 375px", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width observation query docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/observation-queries");
  await expect(
    page.getByRole("heading", { name: "Temporal parameters", exact: true })
  ).toBeVisible();
  await page.getByRole("tab", { name: "January 2025 environment" }).click();
  await expect(
    page.getByText("nclimgrid_tavg_county_day").first()
  ).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("observation-queries-phone.png"),
  });
});

test("renders contract value states and separate 413 and 414 rows", async ({
  page,
}) => {
  await page.goto("/docs/develop/resources");
  await expect(
    page.getByRole("cell", { exact: true, name: "NO_COUNTY_LINKED_RECORD" })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { exact: true, name: "NO_RECORDS" })
  ).toBeVisible();

  await page.goto("/docs/develop/rest");
  await expect(
    page.getByRole("row", { name: /413\s+INVALID_REQUEST/ })
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /414\s+INVALID_REQUEST/ })
  ).toBeVisible();
});
