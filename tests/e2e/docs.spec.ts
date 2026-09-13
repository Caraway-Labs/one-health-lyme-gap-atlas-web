import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
  await expect(page).toHaveTitle(/Start with Atlas \| Atlas documentation/);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("opens the configured docs destination in a secure new tab", async ({
  page,
}) => {
  await page.goto("/privacy");
  const docsLink = page.getByRole("link", {
    name: "Open Atlas documentation (opens in a new tab)",
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
