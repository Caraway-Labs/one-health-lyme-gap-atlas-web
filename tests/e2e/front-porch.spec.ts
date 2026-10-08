import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_EXPLORE_LABEL,
  FRONT_PORCH_FOLLOW_STORY_LABEL,
  FRONT_PORCH_FOOTER_LINKS,
  FRONT_PORCH_GLASS_CALLOUT,
  FRONT_PORCH_HERO_HEADLINE,
  FRONT_PORCH_HERO_SUPPORT,
} from "@/features/front-porch/front-porch-copy";

async function expectNoCountyPreselection(page: Page) {
  const url = page.url().toLowerCase();
  expect(url).not.toContain("buncombe");
  expect(url).not.toContain("37021");
  expect(url).not.toContain("alaska");
  expect(url).not.toContain("hawaii");
  expect(new URL(page.url()).searchParams.get("county")).toBeNull();
}

test("signed-out front porch tells the qualitative story and keeps auth paths clear", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: FRONT_PORCH_HERO_HEADLINE })
  ).toBeVisible();
  await expect(page.getByText(FRONT_PORCH_HERO_SUPPORT)).toBeVisible();
  await expect(page.getByText(FRONT_PORCH_GLASS_CALLOUT)).toHaveCount(1);

  const headlineFont = await page
    .locator("#front-porch-headline")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        family: style.fontFamily,
        style: style.fontStyle,
        weight: style.fontWeight,
      };
    });
  expect(headlineFont.weight).toBe("500");
  expect(headlineFont.style).toBe("normal");
  expect(headlineFont.color).toBe("rgb(255, 255, 255)");
  expect(headlineFont.family.toLowerCase()).not.toContain("georgia");

  const image = page.locator(".front-porch-image-frame img");
  await expect(image).toHaveAttribute("alt", "");
  const imageSrc = await image.getAttribute("src");
  expect(imageSrc).toBeTruthy();
  const imageResponse = await page.request.get(imageSrc!);
  expect(imageResponse.status()).toBe(200);

  for (const beat of FRONT_PORCH_BEATS) {
    await expect(
      page.getByRole("heading", { level: 2, name: beat.title })
    ).toBeVisible();
  }
  await expect(page.getByText(/data pending/i)).toHaveCount(0);
  await expect(page.getByText(/buncombe/i)).toHaveCount(0);

  const follow = page.getByRole("link", {
    name: FRONT_PORCH_FOLLOW_STORY_LABEL,
  });
  await follow.focus();
  await expect(follow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#front-porch-story$/);
  await expect(page.locator("#front-porch-story")).toBeInViewport();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy();

  for (const item of FRONT_PORCH_FOOTER_LINKS) {
    const response = await page.request.get(item.href);
    expect(response.status(), item.href).toBeLessThan(400);
  }

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: FRONT_PORCH_EXPLORE_LABEL }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fapp%2Freview$/);
  await expectNoCountyPreselection(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Atlas" })
  ).toBeVisible();
});

test("signed-in review entry does not preselect a county", async ({ page }) => {
  await page.goto("/app/review");
  await expect(page).toHaveURL(/\/app\/review\/?$/);
  await expectNoCountyPreselection(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Review" })
  ).toBeVisible();
});
