import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("approved sign-in entrance is reachable, responsive, and accessible", async ({
  page,
}) => {
  await page.goto("/auth/sign-in?error=expired_or_invalid&next=%2Faccount");
  await expect(
    page.getByRole("heading", { name: "Sign in or create an account" })
  ).toBeVisible();
  await expect(page.locator(".auth-entrance-error")).toContainText(
    "That sign-in link is no longer valid."
  );
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/privacy"
  );
  await expect(page.getByRole("link", { name: "Help" })).toHaveAttribute(
    "href",
    "https://onehealthatlas.org/docs"
  );

  const logo = page.locator(".auth-entrance-google-logo");
  await expect(logo).toHaveAttribute("alt", "");
  const logoBox = await logo.boundingBox();
  expect(logoBox?.width).toBe(20);
  expect(logoBox?.height).toBe(20);

  const headingSize = await page
    .getByRole("heading", { name: "Sign in or create an account" })
    .evaluate((element) => getComputedStyle(element).fontSize);
  const width = page.viewportSize()?.width ?? 0;
  expect(headingSize).toBe(width <= 500 ? "26px" : "28px");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
