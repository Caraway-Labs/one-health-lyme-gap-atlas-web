import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const docsPages = [
  { path: "/docs", heading: "Start with Atlas Lyme" },
  { path: "/docs/what-is-atlas", heading: "What is Atlas Lyme?" },
  { path: "/docs/who-is-atlas-for", heading: "Who is Atlas for?" },
  {
    path: "/docs/atlas-workflow",
    heading: "The Atlas decision-support workflow",
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
    path: "/docs/api-reference",
    heading: "API reference",
  },
  {
    path: "/docs/api-reference/observations",
    heading: "Observations",
  },
  {
    path: "/docs/api-reference/schemas",
    heading: "Schemas",
  },
  {
    path: "/docs/faq-and-troubleshooting",
    heading: "FAQ and troubleshooting",
  },
] as const;

test("renders the public documentation page without the Atlas shell", async ({
  page,
}, testInfo) => {
  await page.goto("/docs");

  await expect(
    page.getByRole("heading", { name: "Start with Atlas" })
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
    /Start with Atlas Lyme \| Atlas documentation/
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("keeps every HelpDocs route reachable and accessible", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  for (const docsPage of docsPages) {
    await page.goto(docsPage.path);
    await expect(
      page.getByRole("heading", { name: docsPage.heading, exact: true })
    ).toBeVisible();
    await expect(page).toHaveTitle(
      new RegExp(
        `${docsPage.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Atlas documentation`
      )
    );

    const results = await new AxeBuilder({ page }).include("main").analyze();
    const blockingViolations = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );
    expect(blockingViolations, docsPage.path).toEqual([]);
  }

  const sidebar =
    testInfo.project.name === "desktop"
      ? page.locator("#nd-sidebar")
      : page.locator("#nd-sidebar-mobile");
  if (testInfo.project.name !== "desktop") {
    await page.getByRole("button", { name: "Open Sidebar" }).click();
  }
  await expect(
    sidebar.getByRole("link", { exact: true, name: "Developer overview" })
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { exact: true, name: "FAQ and troubleshooting" })
  ).toBeVisible();
  const apiReferenceFolder = sidebar.getByRole("button", {
    name: "API reference",
  });
  await expect(apiReferenceFolder).toBeVisible();
  await apiReferenceFolder.click();
  await expect(
    sidebar.getByRole("link", { exact: true, name: "Observations" })
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "API, MCP, and access" })
  ).toBeVisible();
});

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
    page.getByRole("cell", { name: "25cd3ec90a9b330c620f02ca012576fd98b3f4ab" })
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
  await expect(page.getByText("case_count_floor_2023").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "400", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("application/problem+json").first()
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "429", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "503", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Retry-After", exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("Seconds before retry when supplied by the service.").first()
  ).toBeVisible();
  const schemaLink = page.getByRole("link", { name: "ProblemDetails" }).first();
  await expect(schemaLink).toHaveAttribute(
    "href",
    "/docs/api-reference/schemas#schema-problemdetails"
  );
  await schemaLink.click();
  await expect(page).toHaveURL(
    /\/docs\/api-reference\/schemas#schema-problemdetails$/
  );
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
      name: /Atlas documentation Evidence, provenance, and uncertainty/,
    })
  ).toBeVisible({ timeout: 15_000 });
});

test("workspace Docs keeps the analytical URL while search and a heading link survive reload", async ({
  page,
}, testInfo) => {
  const reviewPath = "/explore?scope=NY&county=36061&sort=score";
  await page.goto(reviewPath);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Explore the evidence behind every county.",
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
    docsPage.getByRole("heading", { name: "Start with Atlas" })
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
      name: "Explore the evidence behind every county.",
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
