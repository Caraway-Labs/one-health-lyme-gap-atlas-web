import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { DOCS_THEME_STORAGE_KEY } from "@/lib/docs-theme";

const DARK_DOCS_BACKGROUND = "rgb(14, 26, 39)";
const LIGHT_DOCS_BACKGROUND = "rgb(251, 252, 251)";

async function storeDocsTheme(
  page: Page,
  theme: "dark" | "light" | "system"
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [DOCS_THEME_STORAGE_KEY, theme] as const
  );
}

function themeSwitch(page: Page, name: "Dark" | "Light" | "System") {
  return page.locator("#nd-subnav").getByRole("button", { name, exact: true });
}

async function expectNoContrastViolations(
  page: Page,
  include: string
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("persists the docs theme and does not flash the other surface", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) == null) localStorage.setItem(key, "dark");
  }, DOCS_THEME_STORAGE_KEY);
  const html = await (await page.request.get("/docs")).text();
  const themeScript = html.indexOf('("class","atlas-docs-theme"');
  const docsRoot = html.indexOf('class="atlas-docs-root"');
  expect(themeScript).toBeGreaterThan(0);
  expect(docsRoot).toBeGreaterThan(themeScript);
  await page.goto("/docs");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator(".atlas-docs-root")).toHaveCSS(
    "background-color",
    DARK_DOCS_BACKGROUND
  );
  await expect(themeSwitch(page, "Dark")).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.reload();
  await expect(page.locator(".atlas-docs-root")).toHaveCSS(
    "background-color",
    DARK_DOCS_BACKGROUND
  );

  await themeSwitch(page, "Light").click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.locator(".atlas-docs-root")).toHaveCSS(
    "background-color",
    LIGHT_DOCS_BACKGROUND
  );
  await expect(themeSwitch(page, "Light")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("uses the system color scheme until a choice is stored", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await storeDocsTheme(page, "system");
  await page.goto("/docs/develop/quickstart");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(themeSwitch(page, "System")).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(page.locator(".atlas-docs-root")).toHaveCSS(
    "background-color",
    LIGHT_DOCS_BACKGROUND
  );
});

test("keeps the signed-in entrance light after a dark docs visit", async ({
  page,
}) => {
  await storeDocsTheme(page, "dark");
  await page.goto("/docs");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page
    .locator(".atlas-anonymous-trust")
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    LIGHT_DOCS_BACKGROUND
  );
  await expect(page.locator(".atlas-docs-root")).toHaveCount(0);
});

test("meets contrast in dark mode on quickstart, reference, and search", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await storeDocsTheme(page, "dark");
  await page.goto("/docs/develop/quickstart");
  await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible();
  await expectNoContrastViolations(page, ".atlas-docs-root");

  await page.goto("/docs/api-reference/observations/listObservations");
  await expect(
    page.getByRole("heading", { name: "Query county observations" })
  ).toBeVisible();
  await expectNoContrastViolations(page, ".atlas-docs-root");

  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectNoContrastViolations(page, "[role='dialog']");
});
