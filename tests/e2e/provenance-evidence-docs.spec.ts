import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { publishedGetCurl } from "@/features/docs/observation-query-example";
import { provenanceCitationPaths } from "@/features/docs/provenance-evidence-model";

import { releaseViewportRuns } from "./release-phone-viewport";

const artifactsDirectory = "/opt/cursor/artifacts";

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
