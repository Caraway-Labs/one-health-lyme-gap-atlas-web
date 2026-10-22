import { expect, type Locator, type Page, test } from "@playwright/test";

import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";

const releaseId = "alpha-2026";
const ramps = [
  "#a9d2db",
  "#55a8a3",
  "#87b982",
  "#efc64a",
  "#f49a32",
  "#e9602b",
];
const featuredNames = new Map<number, string>([
  [1, "Rio Grande"],
  [2, "Kit Carson"],
  [3, "Las Animas"],
  [4, "A County Name That Is Far Too Long To Fit Beside The Score"],
  [100, "Prowers"],
]);

const counties = Array.from({ length: 110 }, (_, index) => {
  const rank = index + 1;
  const fips = `08${String(rank).padStart(3, "0")}`;
  return {
    burgdorferi_status: "observed",
    color: ramps[index % ramps.length],
    county: featuredNames.get(rank) ?? `County ${rank}`,
    evidence_completeness: 40 + (index % 50),
    fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 100 - (rank - 1) * 0.5,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "observed",
  };
});

async function installExplorer(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({ json: {}, status: 200 });
  });
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
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
        methodology_version: "1",
        release_id: releaseId,
        schema_version: "1",
        scope: "US",
        score_defaults: {},
        sources: [],
        states: [{ code: "CO", name: "Colorado" }],
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        counties,
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
        methodology_version: "1",
        release_id: releaseId,
        settings: {
          ecological_share: 65,
          smooth_k: 50,
          missing_human_weakness: 75,
        },
      },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { features: [], type: "FeatureCollection" },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    await route.fulfill({
      json: buildStateReview({
        resultState: "none_stand_out",
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

function countyRow(page: Page, county: string) {
  return page.locator(".ux-reset-ranked-row").filter({
    has: page.locator(".ux-reset-ranked-name", {
      hasText: new RegExp(`^${county}, CO$`),
    }),
  });
}

async function box(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) {
    throw new Error("Missing bounding box");
  }
  return bounds;
}

async function expectRankedIndent(page: Page, threeDigit: boolean) {
  await page.evaluate(() => document.fonts.ready);
  const list = page.locator(".ux-reset-explorer-list");
  const heading = list.getByRole("heading", {
    exact: true,
    name: "Ranked counties",
  });
  const sample = countyRow(page, "Rio Grande");
  await expect(heading).toBeVisible();
  await expect(sample).toBeVisible();

  const styles = await sample.evaluate((node) => {
    const style = getComputedStyle(node);
    const number = node.querySelector(".ux-reset-ranked-number");
    const name = node.querySelector(".ux-reset-ranked-name");
    const score = node.querySelector(".ux-reset-ranked-score");
    return {
      columnGap: style.columnGap,
      minHeight: style.minHeight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      paddingTop: style.paddingTop,
      nameFontSize: name ? getComputedStyle(name).fontSize : "",
      nameTextOverflow: name ? getComputedStyle(name).textOverflow : "",
      nameWhiteSpace: name ? getComputedStyle(name).whiteSpace : "",
      numberFontSize: number ? getComputedStyle(number).fontSize : "",
      scoreHeight: score ? getComputedStyle(score).height : "",
      scoreWidth: score ? getComputedStyle(score).width : "",
    };
  });
  expect(styles).toMatchObject({
    columnGap: "6px",
    minHeight: "54px",
    nameFontSize: "12.8px",
    nameTextOverflow: "ellipsis",
    nameWhiteSpace: "nowrap",
    numberFontSize: "12px",
    paddingBottom: "8.8px",
    paddingLeft: "2.4px",
    paddingRight: "10.4px",
    paddingTop: "8.8px",
    scoreWidth: "40px",
  });
  expect(Math.abs(Number.parseFloat(styles.scoreHeight) - 29.6)).toBeLessThan(
    0.05
  );

  const headingBox = await box(heading);
  const numberBox = await box(sample.locator(".ux-reset-ranked-number"));
  const nameBox = await box(sample.locator(".ux-reset-ranked-name"));
  const scoreBox = await box(sample.locator(".ux-reset-ranked-score"));
  const rowBox = await box(sample);
  expect(Math.abs(numberBox.x - headingBox.x)).toBeLessThan(2);
  expect(
    Math.abs(nameBox.x - (numberBox.x + numberBox.width) - 6)
  ).toBeLessThan(1.5);
  expect(
    Math.abs(rowBox.x + rowBox.width - (scoreBox.x + scoreBox.width) - 10.4)
  ).toBeLessThan(1.5);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(scoreBox.x + 1);

  const nameStarts: number[] = [];
  for (const county of ["Rio Grande", "Kit Carson", "Las Animas"]) {
    const row = countyRow(page, county);
    const name = await box(row.locator(".ux-reset-ranked-name"));
    const rank = await box(row.locator(".ux-reset-ranked-number"));
    nameStarts.push(name.x);
    expect(Math.abs(rank.x - headingBox.x)).toBeLessThan(2);
    const score = await box(row.locator(".ux-reset-ranked-score"));
    expect(name.x + name.width).toBeLessThanOrEqual(score.x + 1);
  }
  const aligned = nameStarts.every(
    (start) => Math.abs(start - nameStarts[0]) < 1.5
  );
  expect(aligned).toBe(true);

  if (threeDigit) {
    const wide = countyRow(page, "Prowers");
    await expect(wide).toHaveAttribute("data-rank", "100");
    const wideRank = wide.locator(".ux-reset-ranked-number");
    const wideName = wide.locator(".ux-reset-ranked-name");
    const rankOverflow = await wideRank.evaluate(
      (node) => node.scrollWidth - node.clientWidth
    );
    expect(rankOverflow).toBeLessThanOrEqual(1);
    const wideNameBox = await box(wideName);
    expect(Math.abs(wideNameBox.x - nameStarts[0])).toBeLessThan(1.5);
    const longName = countyRow(
      page,
      "A County Name That Is Far Too Long To Fit Beside The Score"
    ).locator(".ux-reset-ranked-name");
    const longOverflow = await longName.evaluate(
      (node) => node.scrollWidth - node.clientWidth
    );
    expect(longOverflow).toBeGreaterThan(1);
  }
}

test("shifts ranked county names left without moving score badges", async ({
  page,
}) => {
  await installExplorer(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/explore?scope=CO");
  await expect(page.getByTestId("review-scope-select")).toContainText(
    "Colorado"
  );
  const listBox = await page.locator(".ux-reset-explorer-list").boundingBox();
  const mapBox = await page.locator(".ux-reset-explorer-map").boundingBox();
  const previewBox = await page
    .locator(".ux-reset-explorer-preview")
    .boundingBox();
  expect(listBox && mapBox && previewBox).toBeTruthy();
  if (listBox && mapBox && previewBox) {
    const total = listBox.width + mapBox.width + previewBox.width;
    expect(listBox.width / total).toBeGreaterThan(0.14);
    expect(listBox.width / total).toBeLessThan(0.24);
  }
  await expectRankedIndent(page, true);
  const shot = process.env.RANKED_LIST_SHOT;
  if (shot) {
    await page.locator(".ux-reset-ranked-county-list").evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.locator(".ux-reset-explorer-list").screenshot({ path: shot });
  }

  await page.goto("/explore?scope=ALL");
  await expect(page.getByTestId("review-scope-select")).toContainText(
    "United States",
    { timeout: 15_000 }
  );
  await expectRankedIndent(page, false);
});
