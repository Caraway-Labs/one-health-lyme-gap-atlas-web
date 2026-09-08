import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("offers an accessible AI Ethics link from public footers", async ({
  page,
}) => {
  for (const route of ["/privacy", "/ai-ethics"]) {
    await page.goto(route);
    await expect(
      page.getByRole("link", { name: "AI Ethics", exact: true })
    ).toBeVisible();
  }

  await page.goto("/privacy");
  const ethicsLink = page.getByRole("link", {
    name: "AI Ethics",
    exact: true,
  });
  await expect(ethicsLink).toHaveAttribute("href", "/ai-ethics");
  await expect(ethicsLink).toHaveAttribute("target", "_blank");
  await expect(ethicsLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(ethicsLink).not.toHaveAttribute("data-atlas-analytics-control");

  await ethicsLink.focus();
  await expect(ethicsLink).toBeFocused();
  const newTab = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const ethicsPage = await newTab;
  await expect(ethicsPage).toHaveURL(/\/ai-ethics$/);
  await expect(
    ethicsPage.getByRole("heading", { name: "How Atlas approaches AI" })
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
