import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const TAGS = ["Product", "Guide", "Reference", "MCP"] as const;

async function openSearch(page: Page): Promise<Locator> {
  await page.goto("/docs");
  await expect(page.locator("[data-search-full]")).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("Search")).toBeVisible();
  return dialog;
}

test("filters docs search by tag from the keyboard", async ({ page }) => {
  const dialog = await openSearch(page);
  const filters = dialog.getByRole("group", { name: "Filter by tag" });
  await expect(filters).toBeVisible();
  for (const tag of TAGS) {
    await expect(
      filters.getByRole("button", { name: tag, exact: true })
    ).toBeVisible();
    await expect(
      filters.getByRole("button", { name: tag, exact: true })
    ).toHaveAttribute("aria-pressed", "false");
  }

  const product = filters.getByRole("button", { name: "Product", exact: true });
  await product.focus();
  await expect(product).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const guide = filters.getByRole("button", { name: "Guide", exact: true });
  await expect(guide).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(guide).toHaveAttribute("aria-pressed", "true");

  const searchResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/search" &&
      url.searchParams.get("query") === "page_token" &&
      url.searchParams.get("tag") === "Guide"
    );
  });
  await dialog.getByPlaceholder("Search").fill("page_token");
  expect((await searchResponse).ok()).toBeTruthy();
  await expect(
    dialog.getByRole("button", { name: /page_token/ }).first()
  ).toBeVisible({ timeout: 15_000 });

  await filters.getByRole("button", { name: "Reference", exact: true }).click();
  await expect(
    filters.getByRole("button", { name: "Reference", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByPlaceholder("Search").fill("provenance");
  await expect(
    dialog.getByRole("button", { name: /API reference/ }).first()
  ).toBeVisible({ timeout: 15_000 });

  const results = await new AxeBuilder({ page })
    .include("[role='dialog']")
    // Fumadocs result rows are buttons with aria-selected, outside a listbox.
    // That markup is the bundled dialog and stays as shipped.
    .disableRules(["aria-allowed-attr"])
    .analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);

  await page.screenshot({
    path: "/opt/cursor/artifacts/search-dialog-after-tags.png",
  });
});
