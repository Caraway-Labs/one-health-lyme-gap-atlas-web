import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const DOCS_ROUTES = [
  "/docs",
  "/docs/what-is-atlas",
  "/docs/api-reference",
  "/docs/api-reference/counties/county_v1_counties__fips__get",
] as const;

const ANALYTICAL_ROUTES = ["/assistant", "/account"] as const;

async function expectAnonymousTrustFooter(page: Page) {
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  const footer = page.locator("footer.ux-reset-trust-footer");
  await expect(footer).toHaveCount(1);
  await expect(footer).toBeVisible();
  await expect(footer).not.toContainText("Independent Caraway Labs prototype");
  await expect(footer).not.toContainText("Back to Atlas");
  await expect(footer).not.toContainText("One Health Lyme Gap Atlas");
  const brand = footer.getByRole("link", {
    name: "One Health Atlas by Caraway Labs (opens in a new tab)",
  });
  await expect(brand).toHaveAttribute("href", "/about/caraway-labs");
  await expect(brand).toHaveAttribute("target", "_blank");
  await expect(brand).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    footer.getByRole("link", { exact: true, name: "Privacy" })
  ).toHaveAttribute("href", "/privacy");
  const ethics = footer.getByRole("link", { name: "AI / Responsible Use" });
  await expect(ethics).toHaveAttribute("href", "/ai-ethics");
  await expect(ethics).not.toHaveAttribute("target", "_blank");
  await expect(
    footer.getByRole("button", { name: "Privacy settings" })
  ).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Privacy settings" })
  ).toHaveCount(0);
}

test("docs pages inherit one anonymous trust footer", async ({ page }) => {
  for (const route of DOCS_ROUTES) {
    await page.goto(route);
    await expectAnonymousTrustFooter(page);
    await expect(page.locator("#nd-sidebar")).toBeVisible();
  }

  await page.goto("/docs/what-is-atlas");
  const ethics = page
    .locator("footer.ux-reset-trust-footer")
    .getByRole("link", { name: "AI / Responsible Use" });
  await ethics.focus();
  await expect(ethics).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include("footer").analyze()).violations
  ).toEqual([]);
});

test("analytical shell routes use the anonymous trust footer", async ({
  page,
}) => {
  for (const route of ANALYTICAL_ROUTES) {
    await page.goto(route);
    await expectAnonymousTrustFooter(page);
  }

  await page.goto("/assistant");
  const footer = page.locator("footer.ux-reset-trust-footer");
  await footer.getByRole("button", { name: "Privacy settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Privacy settings" });
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/sign-in/);
  await dialog
    .getByRole("button", { name: "Allow optional analytics" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("atlas.analytics-preference.v1");
        return raw ? (JSON.parse(raw) as { decision?: string }).decision : null;
      })
    )
    .toBe("granted");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await footer.getByRole("button", { name: "Privacy settings" }).click();
  await page
    .getByRole("dialog", { name: "Privacy settings" })
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("atlas.analytics-preference.v1");
        return raw ? (JSON.parse(raw) as { decision?: string }).decision : null;
      })
    )
    .toBe("denied");
  expect(
    (await new AxeBuilder({ page }).include("footer").analyze()).violations
  ).toEqual([]);
});

test("redirected analytical aliases keep a single professional footer", async ({
  page,
}) => {
  await fulfillCompletedStartingView(page);
  for (const route of ["/overview", "/geographic_explorer", "/investigate"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const footer = page.locator("footer.ux-reset-trust-footer");
    await expect(footer).toHaveCount(1);
    await expect(
      page.getByText(/Independent Caraway Labs prototype/)
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Back to Atlas ↑" })
    ).toHaveCount(0);
    await expect(
      footer.getByRole("link", { name: "Privacy settings" })
    ).toHaveAttribute("href", "/app/settings");
    await expect(
      footer.getByRole("button", { name: "Privacy settings" })
    ).toHaveCount(0);
  }
});

test("public and workspace footers stay single and unchanged", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/privacy",
    "/ai-ethics",
    "/about/caraway-labs",
    "/data-provenance",
  ]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.locator("footer.ux-reset-trust-footer")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Back to Atlas ↑" })
    ).toHaveCount(0);
  }

  await fulfillCompletedStartingView(page);
  for (const route of [
    "/app/review",
    "/app/settings",
    "/askatlas",
    "/explore",
    "/compare",
  ]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const footer = page.locator(
      ".ux-reset-pro-app footer.ux-reset-trust-footer"
    );
    await expect(footer).toHaveCount(1);
    await expect(
      footer.getByRole("link", { name: "AI / Responsible Use" })
    ).toHaveAttribute("href", "/ai-ethics");
  }
});
