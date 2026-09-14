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
    path: "/docs/ai-enabled-decision-intelligence",
    heading: "AI-enabled decision intelligence",
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
    page.getByText("Experimental/demo", { exact: true })
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
