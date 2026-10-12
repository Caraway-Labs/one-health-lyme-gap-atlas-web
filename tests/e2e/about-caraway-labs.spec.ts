import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { FRONT_PORCH_HERO_HEADLINE } from "@/features/front-porch/front-porch-copy";
import { ABOUT_CARAWAY_LABS_PATH } from "@/features/ux-reset/routes";
import { pageMetadataForRoute } from "@/lib/navigation";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const ABOUT_METADATA = pageMetadataForRoute(ABOUT_CARAWAY_LABS_PATH);

async function keyboardFocus(page: Page, control: Locator) {
  for (let step = 0; step < 20; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("About page control was not reached by keyboard");
}

test("publishes an anonymous About Caraway Labs page", async ({
  page,
}, testInfo) => {
  const response = await page.goto(ABOUT_CARAWAY_LABS_PATH);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(ABOUT_METADATA.title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    ABOUT_METADATA.description
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://onehealthatlas.org${ABOUT_CARAWAY_LABS_PATH}`
  );
  await expect(page).not.toHaveURL(/sign-in/);

  await expect(
    page.getByRole("heading", { level: 1, name: "About Caraway Labs" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "One Health Atlas",
    "How we approach the work",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Evidence before certainty.",
    "Connected perspectives.",
    "Practical decision support.",
  ]);
  await expect(
    page.getByText(
      "One Health Atlas is an independent Caraway Labs project. It is not an official public-health agency service, and its information is not medical advice."
    )
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);

  const principles = page
    .getByRole("main")
    .getByRole("list")
    .locator(":scope > li");
  const principleBoxes = await principles.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().top)
  );
  expect(principleBoxes).toHaveLength(3);
  if (testInfo.project.name === "mobile") {
    expect(principleBoxes[1]).toBeGreaterThan(principleBoxes[0]!);
    expect(principleBoxes[2]).toBeGreaterThan(principleBoxes[1]!);
  } else {
    expect(
      Math.abs(principleBoxes[0]! - principleBoxes[1]!)
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(principleBoxes[1]! - principleBoxes[2]!)
    ).toBeLessThanOrEqual(2);
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  const returnLink = page.getByRole("link", {
    name: "Return to One Health Atlas",
  });
  await keyboardFocus(page, returnLink);
  await expect(returnLink).toBeFocused();
  await expect(returnLink).toHaveAttribute("href", "/");
  const focusCue = await returnLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusCue.outlineStyle).toBe("solid");
  expect(focusCue.outlineWidth).toBeGreaterThanOrEqual(2);
  await page.screenshot({
    path: testInfo.outputPath("about-caraway-labs-focus.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    document.documentElement.style.zoom = "200%";
  });
  await expect(returnLink).toBeVisible();
  const zoomOverflow = await page.locator("main").evaluate((main) => {
    const box = main.getBoundingClientRect();
    return box.right - box.left > document.documentElement.clientWidth + 1;
  });
  expect(zoomOverflow).toBeFalsy();
  await page.screenshot({
    path: testInfo.outputPath("about-caraway-labs-zoom.png"),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  await returnLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { name: FRONT_PORCH_HERO_HEADLINE })
  ).toBeVisible();

  await page.goto(ABOUT_CARAWAY_LABS_PATH);
  await page
    .getByRole("main")
    .getByRole("link", { exact: true, name: "Privacy" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page).not.toHaveURL(/sign-in/);

  await fulfillCompletedStartingView(page);
  await page.goto("/app/review");
  const brand = page.getByRole("contentinfo").getByRole("link", {
    name: "One Health Atlas by Caraway Labs (opens in a new tab)",
  });
  await expect(brand).toHaveAttribute("href", ABOUT_CARAWAY_LABS_PATH);
  await expect(brand).toHaveAttribute("target", "_blank");
  await expect(brand).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = page.waitForEvent("popup");
  await brand.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/about\/caraway-labs$/);
  await expect(popup).not.toHaveURL(/sign-in/);
  await expect(
    popup.getByRole("heading", { level: 1, name: "About Caraway Labs" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/review$/);
  await popup.screenshot({
    path: testInfo.outputPath("about-caraway-labs.png"),
    fullPage: true,
  });
  await popup.close();
});
