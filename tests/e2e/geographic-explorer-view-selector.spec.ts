import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { mockApi } from "./geographic-explorer-mock";

const VIEW_BUTTONS = [
  "Geographic tiles",
  "Small multiples",
  "Evidence matrix",
  "Ranked dot plot",
  "Side-by-side maps",
  "Map + scatterplot",
  "County comparison",
  "Release trends",
] as const;

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("view selector exposes task groups, prerequisites, and shareable view URLs", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?county=08001");
  const nav = page.getByRole("navigation", { name: "Visualization views" });
  await expect(nav).toContainText("Place overview");
  await expect(nav).toContainText("County evidence");
  await expect(nav).toContainText("Compare counties");
  await expect(nav).toContainText("Map interaction");
  await expect(nav).toContainText("Release change");
  await expect(nav.getByText("Needs release history")).toBeVisible();
  await expect(nav).toContainText(
    /Comparable release history is not available yet/
  );

  for (const label of VIEW_BUTTONS) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expectViewParam(page, labelToParam(label));
    await expect(
      page.getByRole("heading", { name: label, exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Selected county" })
    ).toContainText("Adams, CO");
    await expect(page.getByRole("table")).toBeVisible();
  }

  await page.reload();
  await expect(page).toHaveURL(/view=trends/);
  await expect(
    page.getByRole("heading", {
      name: "Comparable release history is not available yet",
    })
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard activation reaches every view without hiding county results", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?county=08001");
  const nav = page.getByRole("navigation", { name: "Visualization views" });
  for (const label of VIEW_BUTTONS) {
    const button = nav.getByRole("button", { name: label, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Selected county" })
    ).toContainText("Adams, CO");
  }
});

for (const width of [375, 768, 1280, 1600]) {
  test(`view selector layout at ${width}px keeps county evidence reachable`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/geographic_explorer?county=08001&view=maps");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Visualization views" })
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`geo-view-selector-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true);
  });
}

async function expectViewParam(page: Page, param: string) {
  if (param === "tiles") {
    const view = new URL(page.url()).searchParams.get("view");
    expect(view === null || view === "tiles").toBeTruthy();
    return;
  }
  await expect(page).toHaveURL(new RegExp(`view=${param}`));
}

function labelToParam(label: (typeof VIEW_BUTTONS)[number]) {
  switch (label) {
    case "Geographic tiles":
      return "tiles";
    case "Small multiples":
      return "multiples";
    case "Evidence matrix":
      return "matrix";
    case "Ranked dot plot":
      return "ranking";
    case "Side-by-side maps":
      return "maps";
    case "Map + scatterplot":
      return "scatter";
    case "County comparison":
      return "compare";
    case "Release trends":
      return "trends";
    default: {
      const exhaustive: never = label;
      return exhaustive;
    }
  }
}
