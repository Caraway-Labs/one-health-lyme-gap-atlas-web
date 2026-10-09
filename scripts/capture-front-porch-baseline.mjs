import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";
const dir = "design-references/front-porch/review";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [320, 700],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await page.goto("https://carawaylabs.com/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".front-porch-image-frame img")
    .evaluate((image) => image.decode());
  await page.screenshot({
    path: `${dir}/baseline-${width}.png`,
    animations: "disabled",
  });
  await page.close();
}
await browser.close();
