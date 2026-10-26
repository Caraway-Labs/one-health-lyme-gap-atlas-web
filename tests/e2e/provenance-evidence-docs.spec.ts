import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  evidenceFlowAlt,
  evidenceFlowSteps,
} from "@/features/docs/evidence-flow";
import { publishedGetCurl } from "@/features/docs/observation-query-example";
import { provenanceCitationPaths } from "@/features/docs/provenance-evidence-model";
import { DOCS_THEME_STORAGE_KEY } from "@/lib/docs-theme";

import { releaseViewportRuns } from "./release-phone-viewport";

const artifactsDirectory = "/opt/cursor/artifacts";

async function frameDiagram(page: Page) {
  await page.locator(".docs-mermaid").evaluate((node) => {
    node.scrollIntoView({ block: "start" });
  });
}

async function waitForVisibleDiagram(page: Page) {
  await page.waitForFunction(() => {
    const images = document.querySelectorAll(".docs-mermaid img");
    for (const node of images) {
      if (!(node instanceof HTMLImageElement)) continue;
      if (getComputedStyle(node).display === "none") continue;
      if (node.complete && node.naturalWidth > 0) return true;
    }
    return false;
  });
}

async function saveShot(page: Page, name: string) {
  if (!fs.existsSync(artifactsDirectory)) return;
  await page.screenshot({
    path: path.join(artifactsDirectory, `${name}.png`),
    fullPage: false,
  });
}

test("annotates provenance citation, null semantics, and field names", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/docs/develop/workflows");
  await page
    .locator('a[href="/docs/develop/provenance#cite-from-discovery"]')
    .click();
  await expect(page).toHaveURL(
    /\/docs\/develop\/provenance#cite-from-discovery$/
  );
  const citation = page.getByRole("heading", {
    exact: true,
    name: "Cite from discovery",
  });
  await expect(citation).toBeVisible();
  await expect(citation).toHaveAttribute("id", "cite-from-discovery");
  await expect(
    page.getByRole("heading", { exact: true, name: "Discover" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Observe" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Resolve" })
  ).toBeVisible();
  await expect(
    page.getByText(publishedGetCurl(provenanceCitationPaths.observeGap))
  ).toBeVisible();
  await expect(
    page.getByText(publishedGetCurl(provenanceCitationPaths.resolveMethodology))
  ).toBeVisible();
  await saveShot(page, "provenance-citation-steps");

  await page
    .locator("#value-state-null")
    .getByRole("button", { name: /value_state/u })
    .click();
  await expect(
    page.getByText("Never treat a `null` value as zero")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "ValueState" })).toHaveAttribute(
    "href",
    "https://onehealthatlas.org/docs/api-reference/schemas#schema-valuestate"
  );
  await saveShot(page, "provenance-value-state-table");

  const gap = page.locator("pre", { hasText: '"value_state": "MISSING"' });
  await expect(gap.locator(".highlighted-word")).toHaveText("MISSING");
  await expect(gap.locator(".highlighted").first()).toBeVisible();
  await expect(page.getByText("[!code")).toHaveCount(0);
  await gap.scrollIntoViewIfNeeded();
  await saveShot(page, "provenance-annotated-gap");

  await page
    .locator("#provenance-field-names")
    .getByRole("button", { name: /source_label/u })
    .click();
  await expect(
    page.getByText("The source resource field with this value is label.")
  ).toBeVisible();
  await page.locator("#provenance-field-names").scrollIntoViewIfNeeded();
  await saveShot(page, "provenance-field-names");

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);
});

test("shows the evidence flow in words and at 375px", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/docs/develop/provenance");
  const heading = page.getByRole("heading", {
    exact: true,
    name: "Follow a citation",
  });
  await expect(heading).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  const diagram = page.getByRole("img", { name: evidenceFlowAlt });
  await expect(diagram).toBeVisible();
  await waitForVisibleDiagram(page);
  const caption = page.locator(".docs-mermaid figcaption");
  for (const step of evidenceFlowSteps) {
    await expect(
      caption.getByText(`${step.title}.`, { exact: true })
    ).toBeVisible();
  }
  await expect(caption).toContainText("Null is not zero");
  await expect(caption).toContainText("not a literature citation");
  await expect(caption).toContainText(
    "does not show when the publisher last updated the data"
  );
  await frameDiagram(page);
  await saveShot(page, "after-provenance-diagram-desktop");

  const evidenceFlowDiagramViewport = { height: 812, width: 375 };
  await page.setViewportSize(evidenceFlowDiagramViewport);
  await heading.scrollIntoViewIfNeeded();
  await expect(diagram).toBeVisible();
  const lightOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(lightOverflow).toBeLessThanOrEqual(1);
  await frameDiagram(page);
  await saveShot(page, "after-provenance-diagram-375-light");

  await page.evaluate((key) => {
    localStorage.setItem(key, "dark");
  }, DOCS_THEME_STORAGE_KEY);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page
    .getByRole("heading", { exact: true, name: "Follow a citation" })
    .scrollIntoViewIfNeeded();
  const darkDiagram = page.getByRole("img", { name: evidenceFlowAlt });
  await expect(darkDiagram).toBeVisible();
  await waitForVisibleDiagram(page);
  const darkOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(darkOverflow).toBeLessThanOrEqual(1);
  await frameDiagram(page);
  await saveShot(page, "after-provenance-diagram-375-dark");
});

test("keeps annotated provenance usable at 375px", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width provenance docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/provenance");
  await expect(
    page.getByRole("heading", { exact: true, name: "Cite from discovery" })
  ).toBeVisible();
  await expect(
    page.getByText(publishedGetCurl(provenanceCitationPaths.resolveSource))
  ).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});
