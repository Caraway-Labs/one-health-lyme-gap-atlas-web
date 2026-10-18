import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { EXPLORER_COUNTY_EXPORT_NOTE } from "@/features/ux-reset/review/explorer-county-reference";

import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { releaseViewportRuns } from "./release-phone-viewport";

const releaseId = "alpha-2026";

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 40,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

const counties = [
  {
    burgdorferi_status: "Present",
    color: "#245",
    county: "Autauga",
    evidence_completeness: 80,
    fips: "01001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2 — Review",
    score: { ...scoreBreakdown, score: 62 },
    state: "AL",
    state_name: "Alabama",
    tick_status: "Established",
  },
  {
    burgdorferi_status: "Present",
    color: "#245",
    county: "Bullock County",
    evidence_completeness: 80,
    fips: "01011",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2 — Review",
    score: { ...scoreBreakdown, score: 70 },
    state: "AL",
    state_name: "Alabama",
    tick_status: "Established",
  },
  {
    burgdorferi_status: "Present",
    color: "#ccc",
    county: "District of Columbia",
    evidence_completeness: 6,
    fips: "11001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2 — Review",
    score: scoreBreakdown,
    state: "DC",
    state_name: "District of Columbia",
    tick_status: "Reported",
  },
];

async function installExplorer(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({
      json: {
        bundle_sha256: "abc",
        generated_at: "2026-01-01T00:00:00.000Z",
        limitations: "Sample",
        loaded_at: "2026-01-01T00:00:00.000Z",
        methodology_version: "1",
        release_id: releaseId,
        schema_version: "1",
        scope: "US",
        score_defaults: {},
        sources: [],
        states: [
          { code: "AL", name: "Alabama" },
          { code: "DC", name: "District of Columbia" },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        counties,
        methodology_version: "1",
        release_id: releaseId,
        settings: {
          ecological_share: 65,
          low_incidence_breakpoint: 10,
          missing_human_weakness: 75,
        },
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "AL";
    const stateCounties = counties.filter((county) => county.state === state);
    await route.fulfill({
      json: buildStateReview({
        candidates: stateCounties.map((county) =>
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: county.county,
            fips: county.fips,
            reasonText: `${county.county} was returned by the method.`,
          })
        ),
        resultState:
          stateCounties.length > 0 ? "candidates_found" : "none_stand_out",
        state,
      }),
      status: 200,
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/measures" }, meta: {} },
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    await route.fulfill({
      json: { data: [], links: { self: "/v1/observations" }, meta: {} },
      status: 200,
    });
  });
}

async function rankedFips(page: Page) {
  return page
    .locator("button.ux-reset-ranked-row")
    .evaluateAll((rows) =>
      rows.map((row) =>
        row instanceof HTMLElement ? (row.dataset.fips ?? "") : ""
      )
    );
}

async function downloadCountyFips(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("explorer-download-counties").click(),
  ]);
  const csv = await readFile((await download.path()) ?? "", "utf8");
  return [...csv.matchAll(/"(\d{5})"/g)].map((match) => match[1] ?? "");
}

async function toolbarMetrics(page: Page) {
  return page.evaluate(() => {
    const toolbar = document.querySelector(
      "[data-testid='explorer-county-toolbar']"
    );
    if (!(toolbar instanceof HTMLElement)) {
      return null;
    }
    const ids = [
      "review-scope-select",
      "explorer-county-search",
      "explorer-available-data",
      "explorer-download-counties",
      "explorer-download-help",
    ];
    const controls = ids.map((id) => {
      const element = toolbar.querySelector(`[data-testid='${id}']`);
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      const box = element.getBoundingClientRect();
      return { height: box.height, id, top: box.top };
    });
    const toolbarBox = toolbar.getBoundingClientRect();
    return {
      controls,
      height: toolbarBox.height,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
}

test.describe("Explorer county toolbar", () => {
  test("uses one compact row and shows the selected county by name", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL");
    const toolbar = page.getByTestId("explorer-county-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(
      toolbar.getByText("County name or five-digit FIPS")
    ).toHaveCount(0);
    await expect(
      toolbar.getByText("Download county list", { exact: true })
    ).toHaveCount(0);
    const exportNote = page.getByTestId("explorer-county-export-note");
    await expect(exportNote).toHaveClass(/sr-only/);
    const noteBox = await exportNote.boundingBox();
    expect(noteBox?.width ?? 0).toBeLessThanOrEqual(1);
    expect(noteBox?.height ?? 0).toBeLessThanOrEqual(1);

    const search = page.getByTestId("explorer-county-search");
    await search.fill("bull");
    await expect(
      page.getByRole("option", { name: "Bullock County, AL - 01011" })
    ).toBeVisible();
    await search.press("Enter");
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect(page).toHaveURL(/county=01011/);
    await expect(page).toHaveURL(/scope=AL/);
    await expect(page).not.toHaveURL(/Bullock/);

    const metrics = await toolbarMetrics(page);
    expect(metrics).not.toBeNull();
    const controls = metrics?.controls ?? [];
    expect(controls.every((control) => control !== null)).toBeTruthy();
    const heights = controls.map((control) => control?.height ?? 0);
    const tops = controls.map((control) => control?.top ?? 0);
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBe(32);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    expect(metrics?.height ?? 999).toBeLessThan(80);
    expect(metrics?.overflow).toBe(0);

    await toolbar.screenshot({
      path: "/opt/cursor/artifacts/explorer-toolbar-after-1440.png",
    });
    await page.screenshot({
      path: "/opt/cursor/artifacts/explorer-page-after-1440.png",
    });

    const help = page.getByTestId("explorer-download-help");
    const exportTooltip = page.getByTestId("explorer-county-export-tooltip");
    await help.focus();
    await expect(exportTooltip).toContainText(EXPLORER_COUNTY_EXPORT_NOTE);
    await page.keyboard.press("Escape");
    await expect(exportTooltip).toHaveCount(0);
    await help.hover();
    await expect(exportTooltip).toContainText(
      "Columns are five-digit FIPS, county name, and state. Scores are not included."
    );
    await page.keyboard.press("Escape");
    await expect(exportTooltip).toHaveCount(0);
    await help.click();
    await expect(exportTooltip).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("explorer-download-counties").click(),
    ]);
    expect(download.suggestedFilename()).toBe("atlas-explorer-counties-al.csv");
    const csv = await readFile((await download.path()) ?? "", "utf8");
    expect(csv.startsWith("fips,county,state\r\n")).toBe(true);
    expect(csv).toContain('"01011"');
    expect(csv).toContain('"Bullock County"');
    expect(csv).toContain('"AL"');
    expect(csv).not.toContain("score");
    expect(csv).not.toContain('"01001"');
    expect(csv).not.toContain("11001");

    await page.getByTestId("explorer-county-clear").click();
    await expect(search).toHaveValue("");
    await expect(search).toHaveAttribute(
      "placeholder",
      "Search county or FIPS"
    );
    await expect(page).toHaveURL(/selection=required/);
    await expect(page).not.toHaveURL(/[?&]county=/);
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/[?&]county=/);
    await expect(page.locator("[aria-current='true']")).toHaveCount(0);
    await expect(page.getByTestId("review-county-preview")).toHaveCount(0);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toHaveCount(0);
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "data-selected-fips",
      ""
    );

    await page.getByRole("button", { name: /Bullock County, AL/ }).click();
    await expect(page).toHaveURL(/county=01011/);
    await expect(page).not.toHaveURL(/selection=required/);
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect(page.getByTestId("explorer-county-clear")).toBeVisible();
    await expect(
      page.locator("[data-testid='review-candidate'][aria-current='true']")
    ).toHaveAttribute("data-fips", "01011");
    await expect(page.getByTestId("review-county-preview")).toBeVisible();
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "data-selected-fips",
      "01011"
    );

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
    await search.fill("01011");
    await search.press("Enter");
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect(page).toHaveURL(/scope=AL/);
    await expect(page).toHaveURL(/county=01011/);
    await expect(page).not.toHaveURL(/selection=required/);

    const toolbarAxe = await new AxeBuilder({ page })
      .include("[data-testid='explorer-county-toolbar']")
      .analyze();
    expect(toolbarAxe.violations).toEqual([]);
  });

  test("shows the county label for a direct URL, history, and a list click", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL&county=01001");
    const search = page.getByTestId("explorer-county-search");
    await expect(search).toHaveValue("Autauga, AL - 01001");
    await expect(page.getByTestId("explorer-county-clear")).toBeVisible();

    await page.getByRole("button", { name: /Bullock County, AL/ }).click();
    await expect(page).toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect(page.getByTestId("explorer-county-clear")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/county=01001/);
    await expect(page).not.toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Autauga, AL - 01001");
    await expect(page.getByTestId("explorer-county-clear")).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect(page.getByTestId("explorer-county-clear")).toBeVisible();
  });

  test("keeps the list and CSV on the selected county across Back and Forward", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/explore?scope=AL&county=01001");
    const search = page.getByTestId("explorer-county-search");
    await expect(search).toHaveValue("Autauga, AL - 01001");
    await search.fill("Bullock");
    await page
      .getByRole("option", { name: "Bullock County, AL - 01011" })
      .click();
    await expect(page).toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect.poll(() => rankedFips(page)).toEqual(["01011"]);
    expect(await downloadCountyFips(page)).toEqual(["01011"]);

    await page.goBack();
    await expect(page).toHaveURL(/county=01001/);
    await expect(page).not.toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Autauga, AL - 01001");
    await expect.poll(() => rankedFips(page)).toEqual(["01001"]);
    expect(await downloadCountyFips(page)).toEqual(["01001"]);

    await page.goForward();
    await expect(page).toHaveURL(/county=01011/);
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    await expect.poll(() => rankedFips(page)).toEqual(["01011"]);
    expect(await downloadCountyFips(page)).toEqual(["01011"]);
  });

  test("keeps one row at 1280 and wraps at 768 without horizontal scroll", async ({
    page,
  }) => {
    await installExplorer(page);
    await page.setViewportSize({ height: 800, width: 1280 });
    await page.goto("/explore?scope=AL");
    const wide = await toolbarMetrics(page);
    const wideTops = (wide?.controls ?? []).map((control) => control?.top ?? 0);
    expect(Math.max(...wideTops) - Math.min(...wideTops)).toBeLessThanOrEqual(
      1
    );
    expect(wide?.overflow).toBe(0);

    await page.setViewportSize({ height: 900, width: 768 });
    await expect(page.getByTestId("explorer-county-search")).toBeVisible();
    const narrow = await toolbarMetrics(page);
    expect(narrow?.overflow).toBe(0);
    const narrowTops = (narrow?.controls ?? []).map(
      (control) => control?.top ?? 0
    );
    expect(Math.max(...narrowTops) - Math.min(...narrowTops)).toBeGreaterThan(
      8
    );
  });

  test("wraps the toolbar on a phone viewport without horizontal scroll", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Explorer toolbar checks run on the mobile project."
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await installExplorer(page);
    await page.goto("/explore?scope=AL");
    const search = page.getByTestId("explorer-county-search");
    await expect(search).toBeVisible();
    await search.fill("01011");
    await search.press("Enter");
    await expect(search).toHaveValue("Bullock County, AL - 01011");
    const metrics = await toolbarMetrics(page);
    expect(metrics?.overflow).toBe(0);
    await page.getByTestId("explorer-county-toolbar").screenshot({
      path: testInfo.outputPath("explorer-toolbar-phone.png"),
    });
  });
});
