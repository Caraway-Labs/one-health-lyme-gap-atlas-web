import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { docsCanonicalUrl } from "../../src/lib/docs-config";

test("shows the pinned API changelog and its feed", async ({ page }) => {
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

  await page.screenshot({
    fullPage: false,
    path: "/opt/cursor/artifacts/api-changelog-desktop-top.png",
  });
  await page.screenshot({
    fullPage: true,
    path: "/opt/cursor/artifacts/api-changelog-desktop.png",
  });

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
