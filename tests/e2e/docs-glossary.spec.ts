import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { listGlossaryTerms } from "../../src/features/docs/glossary-terms";

async function expectNoPageScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
}

async function openQuickstart(page: Page): Promise<void> {
  await page.goto("/docs/develop/quickstart");
  await expect(
    page.getByRole("heading", { name: "Quickstart", exact: true })
  ).toBeVisible();
}

function valueStateTerm(page: Page) {
  return page
    .locator("main")
    .locator("[data-glossary-term='value_state']")
    .first();
}

test("glossary page is alphabetical, linked, and in the Resources sidebar", async ({
  page,
}) => {
  await page.goto("/docs/glossary");
  await expect(
    page.getByRole("heading", { name: "Glossary", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Glossary" }).first()
  ).toHaveAttribute("href", "/docs/glossary");
  await expect(
    page.getByText("Resources", { exact: true }).first()
  ).toBeVisible();

  const terms = listGlossaryTerms();
  const headings = page.locator("main h2");
  await expect(headings).toHaveCount(terms.length);
  await expect(headings.first()).toHaveText(terms[0]?.label ?? "");
  await expect(headings.last()).toHaveText(
    terms[terms.length - 1]?.label ?? ""
  );
  await page.screenshot({
    path: "/opt/cursor/artifacts/glossary-after-page.png",
  });
  const valueState = page.locator("#value_state");
  await valueState.scrollIntoViewIfNeeded();
  await expect(valueState).toContainText(
    "How to read value. Never treat a null value as zero."
  );
  await expect(
    valueState.getByRole("link", { name: "Value states" })
  ).toHaveAttribute("href", "/docs/develop/errors#value-states");

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blocking = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blocking).toEqual([]);
  await expectNoPageScroll(page);
});

test("search and llms.txt include the glossary page", async ({
  page,
  request,
}) => {
  const index = await (await request.get("/llms.txt")).text();
  expect(index).toContain("https://onehealthatlas.org/docs/glossary");
  const full = await (await request.get("/llms-full.txt")).text();
  expect(full).toContain("## value_state");
  expect(full).toContain("Never treat a `null` value as zero.");

  await page.goto("/docs/glossary");
  await page.locator("[data-search-full]:visible").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Search").fill("Glossary");
  await expect(
    dialog.getByRole("button", {
      name: "One Health Atlas documentation Product guide Resources Glossary",
    })
  ).toBeVisible({ timeout: 15_000 });
});

test("term definition opens from keyboard focus and from a tap", async ({
  browser,
  page,
}) => {
  await openQuickstart(page);
  const term = valueStateTerm(page);
  const trigger = term.getByRole("button", { name: "value_state" });
  const tooltip = term.getByRole("tooltip");
  await term.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Never treat a null value as zero.");
  await page.screenshot({
    path: "/opt/cursor/artifacts/glossary-after-term.png",
  });
  await page.keyboard.press("Tab");
  await expect(tooltip).toBeHidden();

  await trigger.hover();
  await expect(tooltip).toBeVisible();

  const touchPage = await touchPageFor(browser);
  await openQuickstart(touchPage);
  const touchTerm = valueStateTerm(touchPage);
  await touchTerm.getByRole("button", { name: "value_state" }).tap();
  await expect(touchTerm.getByRole("tooltip")).toBeVisible();
  await touchPage.close();
});

test("term text and definition are in the HTML when JavaScript is off", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/docs/develop/quickstart");
  const html = await page.content();
  expect(html).toContain("value_state");
  expect(html).toContain("Never treat a");
  expect(html).toContain("null");
  expect(html).toContain("value as zero.");
  await expect(
    page.locator("[data-glossary-term='value_state']").first()
  ).toContainText("value_state");
  await page.goto("/docs/glossary");
  await expect(page.locator("#fips")).toContainText(
    "Five-digit county FIPS code, with leading zeros."
  );
  await context.close();
});

async function touchPageFor(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { height: 900, width: 1280 },
  });
  return context.newPage();
}
