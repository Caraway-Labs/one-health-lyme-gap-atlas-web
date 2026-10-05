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

  if (testInfo.project.name === "desktop") {
    await expect(page.locator("#nd-sidebar a")).toHaveCount(
      docsPages.length + 1
    );
  }
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
  const reviewPath = "/app/review?scope=NY&county=36061&sort=score";
  await page.goto(reviewPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Review" })
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
  await expect(
    docsPage.getByRole("link", { name: "OpenAPI schema" }).first()
  ).toHaveAttribute("href", "https://api.carawaylabs.com/openapi.json");

  await page.bringToFront();
  await expect(page).toHaveURL(/\/app\/review\?/);
  const workspaceUrl = new URL(page.url());
  expect(workspaceUrl.searchParams.get("scope")).toBe("NY");
  expect(workspaceUrl.searchParams.get("county")).toBe("36061");
  expect(workspaceUrl.searchParams.get("sort")).toBe("score");
  await expect(
    page.getByRole("heading", { level: 1, name: "Review" })
  ).toBeVisible();
});

test("opens the configured docs destination from the analytical sidebar", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const docsLink = page.getByRole("link", {
    name: "Docs",
  });

  await expect(docsLink).toHaveAttribute(
    "href",
    "https://carawaylabs.com/docs"
  );
  await expect(docsLink).toHaveAttribute("target", "_blank");
  await expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");

  const newTab = page.waitForEvent("popup");
  await docsLink.click();
  const docsPage = await newTab;
  await expect(docsPage).toHaveURL("https://carawaylabs.com/docs");
});
