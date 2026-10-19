import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { releaseViewportRuns } from "./release-phone-viewport";

test("copies the exported page markdown and opens its raw source", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/what-is-atlas");
  await expect(
    page.getByRole("heading", { name: "What is Atlas Lyme?" })
  ).toBeVisible();

  const actions = page.getByRole("group", { name: "Page actions" });
  const copyButton = actions.getByRole("button", { name: "Copy Markdown" });
  const sourceLink = actions.getByRole("link", {
    name: "View source, opens raw Markdown in a new tab",
  });
  await expect(copyButton).toBeVisible();
  await expect(sourceLink).toHaveAttribute("href", "/docs/what-is-atlas.mdx");
  await expect(sourceLink).toHaveAttribute("target", "_blank");

  const exported = await (
    await page.request.get("/docs/what-is-atlas.md")
  ).text();
  const raw = await (await page.request.get("/docs/what-is-atlas.mdx")).text();
  expect(exported.startsWith("# What is Atlas Lyme?")).toBeTruthy();
  expect(raw.startsWith("---")).toBeTruthy();
  expect(exported).not.toBe(raw);

  await copyButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Copied page Markdown.");
  await expect(copyButton).toBeFocused();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(exported);

  const sourcePagePromise = page.waitForEvent("popup");
  await sourceLink.click();
  const sourcePage = await sourcePagePromise;
  await sourcePage.waitForLoadState("domcontentloaded");
  expect(new URL(sourcePage.url()).pathname).toBe("/docs/what-is-atlas.mdx");
  expect(await sourcePage.locator("body").innerText()).toContain(
    "title: What is Atlas Lyme?"
  );
  await sourcePage.close();

  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
});

test("keeps the page action bar on screen at phone width", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 390),
    "Phone-width docs page actions run on the mobile project."
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");
  const actions = page.getByRole("group", { name: "Page actions" });
  await expect(
    actions.getByRole("button", { name: "Copy Markdown" })
  ).toBeVisible();
  await expect(
    actions.getByRole("link", {
      name: "View source, opens raw Markdown in a new tab",
    })
  ).toBeVisible();
  const box = await actions.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test("selects the exported markdown when the clipboard API is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = () => false;
  });
  await page.goto("/docs/evidence-and-uncertainty");
  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Clipboard is unavailable. The page Markdown is selected below."
  );
  const manual = page.getByRole("textbox", { name: "Page Markdown" });
  await expect(manual).toBeFocused();
  const exported = await (
    await page.request.get("/docs/evidence-and-uncertainty.md")
  ).text();
  await expect(manual).toHaveValue(exported);
});
