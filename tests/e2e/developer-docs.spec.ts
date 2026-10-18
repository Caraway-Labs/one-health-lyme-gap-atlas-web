import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
