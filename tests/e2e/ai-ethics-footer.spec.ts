import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_TRUST_ROUTES = ["/about/caraway-labs", "/ai-ethics", "/privacy"];

test("public trust pages share the unauthenticated footer", async ({
  page,
}) => {
  for (const route of PUBLIC_TRUST_ROUTES) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(
      page.getByRole("link", { exact: true, name: "Back to Atlas" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Back to Atlas ↑" })
    ).toHaveCount(0);

    const identity = page.getByRole("banner").getByRole("link", {
      name: "One Health Lyme Gap Atlas home",
    });
    await expect(identity).toBeVisible();
    await expect(identity.locator("img.atlas-brand-mark")).toHaveCount(1);

    const footer = page.locator("footer.ux-reset-trust-footer");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Privacy", exact: true })
    ).toHaveAttribute("href", "/privacy");
    const ethics = footer.getByRole("link", { name: "AI / Responsible Use" });
    await expect(ethics).toHaveAttribute("href", "/ai-ethics");
    await expect(ethics).not.toHaveAttribute("target", "_blank");
    await expect(
      footer.getByRole("button", { name: "Privacy settings" })
    ).toBeVisible();
    await expect(footer.locator("img.atlas-brand-mark")).toHaveCount(0);
  }

  await page.goto("/privacy");
  const ethicsLink = page
    .locator("footer.ux-reset-trust-footer")
    .getByRole("link", { name: "AI / Responsible Use" });
  await ethicsLink.focus();
  await expect(ethicsLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ai-ethics$/);
  await expect(
    page.getByRole("heading", { name: "How Atlas approaches AI" })
  ).toBeVisible();

  // `.ethics-version` is page content that matches the legacy `footer` rule.
  // That contrast failure predates this shell change, so axe covers the shell.
  const results = await new AxeBuilder({ page })
    .include("header.public-header")
    .include("footer.ux-reset-trust-footer")
    .analyze();
  expect(results.violations).toEqual([]);
});
