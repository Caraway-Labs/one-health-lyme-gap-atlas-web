import { accessSync, constants, copyFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { docsCanonicalUrl } from "../../src/lib/docs-config";

const OPTIONAL_ARTIFACT_DIRECTORY = "/opt/cursor/artifacts";

/** Required images go to the Playwright output dir. Artifact copies are optional. */
async function saveOutcomeScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
  fullPage: boolean
) {
  const outputPath = testInfo.outputPath(filename);
  await page.screenshot({ fullPage, path: outputPath });
  try {
    accessSync(OPTIONAL_ARTIFACT_DIRECTORY, constants.W_OK);
    copyFileSync(outputPath, join(OPTIONAL_ARTIFACT_DIRECTORY, filename));
  } catch {
    // CI checkouts have no writable /opt/cursor/artifacts directory.
  }
}

test("shows the pinned API changelog and its feed", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/develop/quickstart");
  const whatsNew = page
    .locator("main")
    .getByRole("link", { name: "What's new", exact: true });
  await whatsNew.focus();
  await expect(whatsNew).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/develop\/changelog\/?$/);
  await expect(
    page.getByRole("heading", { name: "What's new", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("4bc001bb6c03d16aef80762174691fdf9b898707")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026-10-25" })).toBeVisible();
  await expect(page.getByText("Added").first()).toBeVisible();
  await expect(
    page.getByText(
      "results are not a diagnosis and not an estimate of an individual's risk."
    )
  ).toBeVisible();

  const feedLink = page.getByRole("link", { name: "changelog feed" });
  await expect(feedLink).toHaveAttribute("href", "/docs/changelog.xml");
  await expect(
    page.locator('link[type="application/atom+xml"]')
  ).toHaveAttribute("href", docsCanonicalUrl("/docs/changelog.xml"));

  const observations = page
    .getByRole("link", { name: "GET /v1/observations" })
    .first();
  await observations.click();
  await expect(page).toHaveURL(
    /\/docs\/api-reference\/observations\/listObservations$/
  );
  await expect(
    page.getByRole("heading", { name: "Query county observations" })
  ).toBeVisible();

  await page.goto("/docs/api-reference");
  await page.getByRole("link", { name: "API changelog", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/develop\/changelog\/?$/);

  await page.goto("/docs/develop/changelog");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blocking = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blocking).toEqual([]);

  await saveOutcomeScreenshot(
    page,
    testInfo,
    "api-changelog-desktop-top.png",
    false
  );
  await saveOutcomeScreenshot(
    page,
    testInfo,
    "api-changelog-desktop.png",
    true
  );

  const feed = await page.request.get("/docs/changelog.xml");
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("application/atom+xml");
  const xml = await feed.text();
  expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  expect(xml).toContain("4bc001bb6c03d16aef80762174691fdf9b898707");
  expect(xml).toContain(
    "https://onehealthatlas.org/docs/api-reference/observations/listObservations"
  );
});
