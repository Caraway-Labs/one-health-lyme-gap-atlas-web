import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const publicOpenApiManifest = JSON.parse(
  readFileSync("contracts/public-openapi.manifest.json", "utf8")
) as { sourceCommit: string };

const docsPages = [
  { path: "/docs", heading: "Start with One Health Atlas" },
  { path: "/docs/what-is-atlas", heading: "What is One Health Atlas?" },
  {
    path: "/docs/who-is-atlas-for",
    heading: "Who is One Health Atlas for?",
  },
  {
    path: "/docs/atlas-workflow",
    heading: "The One Health Atlas decision-support workflow",
  },
  {
    path: "/docs/professional-workspace",
    heading: "Professional workspace",
  },
  { path: "/docs/current-capabilities", heading: "Current capabilities" },
  {
    path: "/docs/investigation-workflows",
    heading: "Investigation workflows",
  },
  {
    path: "/docs/evidence-and-uncertainty",
    heading: "Evidence, provenance, and uncertainty",
  },
  {
    path: "/docs/sources-and-canonical-evidence",
    heading: "Sources and canonical evidence",
  },
  {
    path: "/docs/releases-and-methodology",
    heading: "Releases and methodology labels",
  },
  {
    path: "/docs/ai-enabled-decision-intelligence",
    heading: "AI-enabled decision intelligence",
  },
  {
    path: "/docs/api-mcp-and-access",
    heading: "API, MCP, and access",
  },
  {
    path: "/docs/develop/mcp-clients",
    heading: "MCP clients",
  },
  {
    path: "/docs/api-reference",
    heading: "API reference",
  },
  {
    path: "/docs/api-reference/observations",
    heading: "Observations",
  },
  {
    path: "/docs/api-reference/observations/observations_v1_observations_get",
    heading: "Query county observations",
    operation: true,
  },
  {
    path: "/docs/api-reference/geographies/canonicalGeographyAvailability",
    heading: "Check canonical county geography publication availability",
    operation: true,
  },
  {
    path: "/docs/api-reference/counties",
    heading: "Counties",
  },
  {
    path: "/docs/api-reference/schemas",
    heading: "Schemas",
  },
  {
    path: "/docs/faq-and-troubleshooting",
    heading: "FAQ and troubleshooting",
  },
  ...generatedApiReferencePages(),
];

function generatedApiReferencePages(): {
  heading: string;
  operation: true;
  path: string;
}[] {
  const root = path.join("content", "docs", "api-reference");
  const pages: { heading: string; operation: true; path: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, entry.name);
    for (const file of readdirSync(directory)) {
      if (!file.endsWith(".mdx") || file === "index.mdx") continue;
      const source = readFileSync(path.join(directory, file), "utf8");
      const title = /^title:\s*(?<title>.+)$/m.exec(source)?.groups?.title;
      if (!title) continue;
      const parsed: unknown =
        title.startsWith('"') && title.endsWith('"')
          ? JSON.parse(title)
          : title.trim();
      if (typeof parsed !== "string") continue;
      pages.push({
        heading: parsed,
        operation: true,
        path: `/docs/api-reference/${entry.name}/${file.slice(0, -".mdx".length)}`,
      });
    }
  }
  pages.sort((left, right) => left.path.localeCompare(right.path));
  return pages;
}

test("switches documentation sections from the sidebar tablist", async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name !== "desktop";
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", { name: "Start with One Health Atlas" })
  ).toBeVisible();
  const headerDevelopers = page.getByRole("link", {
    exact: true,
    name: "Developers",
  });
  await expect(headerDevelopers).toBeVisible();
  await expect(headerDevelopers).toHaveAttribute("href", "/docs/develop");

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  if (phone) await openDocsSidebar(page);
  const sidebar = docsSidebar(page, testInfo);
  const tablist = sidebar.getByRole("tablist", {
    name: "Documentation sections",
  });
  const product = tablist.getByRole("tab", { name: "Product guide" });
  const developers = tablist.getByRole("tab", { name: "Developers" });
  await expect(product).toHaveAttribute("aria-selected", "true");
  await expect(product).toHaveAttribute("aria-current", "page");
  await expect(
    sidebar.getByRole("link", { exact: true, name: "Quickstart" })
  ).toBeVisible();

  await product.focus();
  await page.keyboard.press("ArrowRight");
  await expect(developers).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/develop$/);
  await expect(
    page.getByRole("heading", { name: "Developer overview", exact: true })
  ).toBeVisible();
  await expect(headerDevelopers).toHaveAttribute("aria-current", "page");

  if (phone) await openDocsSidebar(page);
  const developerSidebar = docsSidebar(page, testInfo);
  await developerSidebar.getByRole("tab", { name: "API reference" }).click();
  await expect(page).toHaveURL(/\/docs\/api-reference$/);
  await expect(
    page.getByRole("heading", { name: "API reference", exact: true })
  ).toBeVisible();
  const afterSwitch = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(afterSwitch).toBeLessThanOrEqual(1);
});

test("renders the public documentation page without the Atlas shell", async ({
  page,
}, testInfo) => {
  await page.goto("/docs");

  await expect(
    page.getByRole("heading", { name: "Start with One Health Atlas" })
  ).toBeVisible();
  const sidebar = page.locator("#nd-sidebar");
  await expect(sidebar).toHaveCount(1);
  if (testInfo.project.name === "desktop") await expect(sidebar).toBeVisible();
  const visibleSearch =
    testInfo.project.name === "desktop"
      ? page.locator("[data-search-full]:visible")
      : page.locator("[data-search]:visible");
  await expect(visibleSearch).toHaveCount(1);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page).toHaveTitle(
    /Start with One Health Atlas \| One Health Atlas documentation/
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("keeps every HelpDocs route reachable and accessible", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const seen = new Set<string>();

  for (const docsPage of docsPages) {
    if (seen.has(docsPage.path)) continue;
    seen.add(docsPage.path);
    await page.goto(docsPage.path);
    await expect(
      page.getByRole("heading", { name: docsPage.heading, exact: true })
    ).toBeVisible();
    await expect(page).toHaveTitle(
      new RegExp(
        `${docsPage.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| One Health Atlas documentation`
      )
    );

    await page.waitForFunction(async () => {
      await document.fonts.ready;
      return [...document.querySelectorAll(".overflow-x-auto")].every(
        (element) => {
          if (!(element instanceof HTMLElement)) return true;
          if (element.scrollWidth <= element.clientWidth + 1) return true;
          return element.tabIndex >= 0;
        }
      );
    });
    if ("operation" in docsPage) {
      await expectOperationControlNames(page, docsPage.path);
    }
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const blockingViolations = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );
    expect(blockingViolations, docsPage.path).toEqual([]);
  }

  const sidebar = docsSidebar(page, testInfo);
  if (testInfo.project.name !== "desktop") {
    await openDocsSidebar(page);
  }
  await expectDocsTab(sidebar, "API reference");
  const observations = sidebar
    .getByRole("link", { exact: true, name: "Observations" })
    .or(sidebar.getByRole("button", { exact: true, name: "Observations" }));
  await observations.scrollIntoViewIfNeeded();
  await expect(observations).toBeVisible();
  await expect(
    sidebar.getByRole("link", { exact: true, name: "Developer overview" })
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole("link", { exact: true, name: "FAQ and troubleshooting" })
  ).toHaveCount(0);

  await sidebar.getByRole("tab", { name: "Product guide" }).click();
  await expect(page).toHaveURL(/\/docs$/);
  if (testInfo.project.name !== "desktop") {
    await openDocsSidebar(page);
  }
  const productSidebar = docsSidebar(page, testInfo);
  await expectDocsTab(productSidebar, "Product guide");
  const quickstart = productSidebar.getByRole("link", {
    exact: true,
    name: "Quickstart",
  });
  await quickstart.scrollIntoViewIfNeeded();
  await expect(quickstart).toBeVisible();
  const faq = productSidebar.getByRole("link", {
    exact: true,
    name: "FAQ and troubleshooting",
  });
  await faq.scrollIntoViewIfNeeded();
  await expect(faq).toBeVisible();
  const access = productSidebar.getByRole("link", {
    name: "API, MCP, and access",
  });
  await access.scrollIntoViewIfNeeded();
  await expect(access).toBeVisible();
  await expect(
    productSidebar.getByRole("link", {
      exact: true,
      name: "Developer overview",
    })
  ).toHaveCount(0);

  await productSidebar.getByRole("tab", { name: "Developers" }).click();
  await expect(page).toHaveURL(/\/docs\/develop$/);
  if (testInfo.project.name !== "desktop") {
    await openDocsSidebar(page);
  }
  const developerSidebar = docsSidebar(page, testInfo);
  await expectDocsTab(developerSidebar, "Developers");
  await expect(
    developerSidebar.getByRole("link", {
      exact: true,
      name: "Developer overview",
    })
  ).toBeVisible();
  await expect(
    developerSidebar.getByRole("link", { exact: true, name: "Quickstart" })
  ).toBeVisible();
  await expect(
    developerSidebar.getByRole("link", {
      exact: true,
      name: "FAQ and troubleshooting",
    })
  ).toHaveCount(0);
});

async function openDocsSidebar(page: Page) {
  await page
    .locator("#nd-subnav")
    .getByRole("button", { name: "Open Sidebar" })
    .click();
}

function docsSidebar(page: Page, testInfo: { project: { name: string } }) {
  return testInfo.project.name === "desktop"
    ? page.locator("#nd-sidebar")
    : page.locator("#nd-sidebar-mobile");
}

async function expectDocsTab(
  sidebar: ReturnType<Page["locator"]>,
  name: string
) {
  const tab = sidebar.getByRole("tab", { exact: true, name });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toHaveAttribute("aria-current", "page");
  await expect(
    sidebar.getByRole("tablist", { name: "Documentation sections" })
  ).toBeVisible();
}

async function expectOperationControlNames(page: Page, route: string) {
  const schemaSwitch = page.getByRole("switch", {
    name: "Show response schema",
  });
  const responseStatus = page.getByRole("combobox", {
    name: "Response status",
  });
  const codeSampleLanguage = page.getByRole("combobox", {
    name: "Code sample language",
  });
  await expect(schemaSwitch).toBeVisible();
  await expect(schemaSwitch).toHaveAttribute(
    "aria-label",
    "Show response schema"
  );
  await expect(responseStatus).toBeVisible();
  await expect(responseStatus).toHaveAttribute("aria-label", "Response status");
  await expect(codeSampleLanguage).toBeVisible();
  await expect(codeSampleLanguage).toHaveAttribute(
    "aria-label",
    "Code sample language"
  );
  if (!route.endsWith("/observations_v1_observations_get")) return;

  const schemaVariant = page.getByRole("combobox", { name: "Schema variant" });
  const responseExample = page.getByRole("combobox", {
    name: "Response example",
  });
  await expect(schemaVariant).toBeVisible();
  await expect(responseExample).toBeVisible();
  await schemaSwitch.click();
  await expect(schemaSwitch).toHaveAttribute("aria-checked", "true");
  await expect(schemaSwitch).toHaveAttribute(
    "aria-label",
    "Show response schema"
  );
  await codeSampleLanguage.click();
  await page.getByRole("option", { exact: true, name: "JavaScript" }).click();
  await expect(codeSampleLanguage).toHaveAttribute(
    "aria-label",
    "Code sample language"
  );
  await responseStatus.click();
  await page.getByRole("option", { exact: true, name: "429" }).click();
  await expect(responseStatus).toHaveAttribute("aria-label", "Response status");
  await expect(schemaSwitch).toHaveAttribute(
    "aria-label",
    "Show response schema"
  );
  await expect(schemaVariant).toHaveAttribute("aria-label", "Schema variant");
}

async function expectVisibleRetryAfterHeader(page: Page) {
  const headers = page.getByRole("region", { name: "Response Headers" });
  await expect(
    headers.getByRole("heading", { name: "Retry-After", exact: true })
  ).toBeVisible();
  await expect(headers.getByText("string", { exact: true })).toBeVisible();
  await expect(
    headers.getByText("Seconds before retry when supplied by the service.")
  ).toBeVisible();
}

test("renders the generated observations reference with version, source, and raw spec", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/api-reference");
  await expect(
    page.getByRole("heading", { name: "API reference", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("OpenAPI version", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Application version", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: publicOpenApiManifest.sourceCommit })
  ).toBeVisible();
  const rawSpec = page.getByRole("link", { name: "OpenAPI schema" });
  await expect(rawSpec).toHaveAttribute(
    "href",
    "https://api.onehealthatlas.org/openapi.json"
  );

  await page.goto("/docs/api-reference/observations");
  await expect(
    page.getByRole("heading", {
      name: "Query county observations",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText("observations_v1_observations_get", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Parameters, responses, and schema" })
    .click();
  await expect(page).toHaveURL(
    /\/docs\/api-reference\/observations\/observations_v1_observations_get$/
  );
  await expect(
    page.getByRole("heading", { name: "Query Parameters" })
  ).toBeVisible();
  await expect(page.getByText("case_count_floor_2023").first()).toBeVisible();
  const parameterSearch = await page.request.get(
    "/api/search?query=case_count_floor_2023"
  );
  expect(parameterSearch.ok()).toBeTruthy();
  const parameterHits = await parameterSearch.text();
  expect(parameterHits).toContain(
    "/docs/api-reference/observations/observations_v1_observations_get"
  );
  await expect(
    page.getByRole("heading", { name: "Response Body" })
  ).toBeVisible();
  await page.goto("/docs/api-reference/atlas/geometry_v1_atlas_geometry_get");
  const geometryDescription =
    "Existing generalized CDC/ATSDR SVI 2022 display geometry in EPSG:4326, identified by stable five-digit county FIPS. This resource never returns internal 2025 TIGER/Line analysis polygons used for raster aggregation.";
  await expect(
    page.getByText(geometryDescription, { exact: true })
  ).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    geometryDescription
  );
  await expect(
    page.getByRole("heading", { name: "Response Body" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Response Headers" })
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "429", exact: true }).click();
  await expectVisibleRetryAfterHeader(page);
  await page.getByRole("tab", { name: "503", exact: true }).click();
  await expectVisibleRetryAfterHeader(page);
  await page.goto("/docs/api-reference/schemas#schema-problemdetails");
  await expect(
    page.getByRole("heading", { name: "ProblemDetails", exact: true })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  );
  expect(overflow, testInfo.project.name).toBe(false);

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);
});

test("keeps canonical product language and safety boundaries in the rendered guides", async ({
  page,
}) => {
  await page.goto("/docs");
  await expect(
    page.getByText("Epidemiologist Decision Intelligence Platform", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.locator("main p").filter({
      hasText:
        /from fragmented surveillance data to timely, interpretable, evidence-backed public-health action/i,
    })
  ).toBeVisible();

  await page.goto("/docs/ai-enabled-decision-intelligence");
  await expect(
    page.getByText(
      "signals → evidence → hypotheses → anomaly candidates → investigation priorities",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByText("Early access, feature-gated", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("Planned", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("Atlas does not:", { exact: true })
  ).toBeVisible();

  await page.goto("/docs/evidence-and-uncertainty");
  await expect(
    page.getByRole("heading", {
      name: "Low signal is not the same as insufficient surveillance",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText(/The current release does not establish this/)
  ).toBeVisible();

  await page.goto("/docs/sources-and-canonical-evidence");
  await expect(
    page.getByRole("heading", {
      name: "What is released and what is intent",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText("Available now", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("Planned", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("Not supported", { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText(/source-specific adapter/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "OpenAPI schema" })
  ).toBeVisible();
});

test("opens HelpDocs search and finds the evidence guide", async ({
  page,
}, testInfo) => {
  await page.goto("/docs");
  const visibleSearch =
    testInfo.project.name === "desktop"
      ? page.locator("[data-search-full]:visible")
      : page.locator("[data-search]:visible");
  await expect(visibleSearch).toHaveCount(1);
  await visibleSearch.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Search").fill("uncertainty");
  await expect(
    dialog.getByRole("button", {
      name: /One Health Atlas documentation Product guide Evidence, provenance, and uncertainty/,
    })
  ).toBeVisible({ timeout: 15_000 });
});

test("workspace Docs keeps the analytical URL while search and a heading link survive reload", async ({
  page,
}, testInfo) => {
  const reviewPath = "/explore?scope=NY&county=36061&sort=score";
  await fulfillCompletedStartingView(page);
  await page.goto(reviewPath);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Explore county Lyme data",
    })
  ).toBeVisible();

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    const closeNavigation = page.getByRole("button", {
      name: "Close navigation",
    });
    await expect(closeNavigation).toBeFocused();
    const docsLink = page.getByRole("link", {
      name: "Docs, opens in a new tab",
    });
    for (let step = 0; step < 20; step += 1) {
      if (await docsLink.evaluate((node) => node === document.activeElement)) {
        break;
      }
      await page.keyboard.press("Tab");
    }
    await expect(docsLink).toBeFocused();
  }

  const docsLink = page.getByRole("link", { name: "Docs, opens in a new tab" });
  await expect(docsLink).toHaveAttribute("href", "/docs");
  await expect(docsLink).toHaveAttribute("target", "_blank");
  await expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");
  await docsLink.focus();

  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const docsPage = await popupPromise;
  await docsPage.waitForLoadState("domcontentloaded");
  await expect(docsPage).toHaveURL(/\/docs\/?$/);
  await expect(
    docsPage.getByRole("heading", { name: "Start with One Health Atlas" })
  ).toBeVisible();

  const fullSearch = docsPage.locator("[data-search-full]:visible");
  if ((await fullSearch.count()) > 0) {
    await fullSearch.click();
  } else {
    await docsPage.locator("#nd-subnav [data-search]").click();
  }
  const dialog = docsPage.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Search").fill("default jurisdiction");
  await dialog.getByRole("button", { name: /Professional workspace/ }).click();
  await expect(docsPage).toHaveURL(/\/docs\/professional-workspace\/?$/);

  const heading = docsPage.getByRole("heading", {
    name: "Open Docs from the workspace",
    exact: true,
  });
  await expect(heading).toBeVisible();
  const headingLink = heading.locator("a");
  if ((await headingLink.count()) > 0) {
    await headingLink.click();
  } else {
    await docsPage.goto(
      "/docs/professional-workspace#open-docs-from-the-workspace"
    );
  }
  await expect(docsPage).toHaveURL(/#open-docs-from-the-workspace$/);
  await docsPage.reload();
  await expect(heading).toBeVisible();
  await expect(docsPage).toHaveURL(/#open-docs-from-the-workspace$/);

  await docsPage.goto("/docs/api-mcp-and-access");
  await expect(
    docsPage.getByRole("heading", { name: "API, MCP, and access", exact: true })
  ).toBeVisible();
  const openApiLink = docsPage
    .getByRole("link", { name: "OpenAPI schema" })
    .first();
  await expect(openApiLink).toHaveAttribute(
    "href",
    "https://api.onehealthatlas.org/openapi.json"
  );
  await openApiLink.click();
  await expect(docsPage).toHaveURL(
    "https://api.onehealthatlas.org/openapi.json"
  );
  await expect(docsPage.locator("body")).toContainText('"openapi"');

  await page.bringToFront();
  await expect(page).toHaveURL(/\/explore\?/);
  const workspaceUrl = new URL(page.url());
  expect(workspaceUrl.searchParams.get("scope")).toBe("NY");
  expect(workspaceUrl.searchParams.get("county")).toBe("36061");
  expect(workspaceUrl.searchParams.get("sort")).toBe("score");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Explore county Lyme data",
    })
  ).toBeVisible();
});

test("renders the capability-boundaries table with one column count", async ({
  page,
}) => {
  await page.goto("/docs/current-capabilities");
  const table = page
    .locator("main table")
    .filter({ hasText: "Historical release trends" });
  await expect(table).toBeVisible();
  const shape = await table.evaluate((node) => {
    const headers = [...node.querySelectorAll("thead th")].map(
      (cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? ""
    );
    const rows = [...node.querySelectorAll("tbody tr")].map(
      (row) => row.querySelectorAll("td").length
    );
    return { headers, rows };
  });
  expect(shape).toEqual({
    headers: ["Capability", "Status", "What this means for you"],
    rows: [3, 3, 3, 3, 3, 3, 3, 3],
  });
});

test("opens the configured docs destination from the workspace sidebar", async ({
  page,
}, testInfo) => {
  await fulfillCompletedStartingView(page);
  await page.goto("/explore");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const docsLink = page.getByRole("link", {
    name: "Docs, opens in a new tab",
  });

  await expect(docsLink).toHaveAttribute("href", "/docs");
  await expect(docsLink).toHaveAttribute("target", "_blank");
  await expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");

  const newTab = page.waitForEvent("popup");
  await docsLink.click();
  const docsPage = await newTab;
  await expect(docsPage).toHaveURL(/\/docs\/?$/);
});
