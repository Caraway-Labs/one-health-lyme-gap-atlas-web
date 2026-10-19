import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";
import { responseTierPresentationForColor } from "@/lib/response-tier";

import baldwin from "../fixtures/review-al-01003.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

const release = baldwin.release.release_id;

const hamilton = {
  ...baldwin,
  burgdorferi_status: "Present",
  case_count_floor_2023: null,
  color: "#87b982",
  county: "Hamilton County",
  evidence_completeness: 83,
  fips: "18057",
  human_status: "no_county_linked_record",
  incidence_floor_2023: null,
  pacificus_status: "No records",
  population: 349_527,
  priority: "Watch — Monitor signals",
  rucc_2023: 1,
  scapularis_status: "Established",
  score: {
    access_signal: 8.4,
    community: 4,
    ecological: 100,
    human_weakness: 75,
    pathogen_signal: 100,
    rural_signal: 0,
    score: 49.8,
    svi_signal: 3,
    tick_signal: 100,
  },
  state: "IN",
  state_name: "Indiana",
  svi_percentile: 0.0302,
  tick_status: "Established",
  uninsured_percent: 4.2,
  uninsured_percentile: 0.0837,
};

const marion = {
  ...baldwin,
  burgdorferi_status: "Present",
  case_count_floor_2023: 12,
  color: "#e9602b",
  county: "Marion County",
  evidence_completeness: 100,
  fips: "18097",
  human_status: "published_count_floor",
  incidence_floor_2023: 1.23,
  pacificus_status: "No records",
  population: 971_737,
  priority: "Priority 1 — Investigate",
  rucc_2023: 1,
  scapularis_status: "Established",
  score: {
    access_signal: 58.6,
    community: 58.9,
    ecological: 100,
    human_weakness: 87.7,
    pathogen_signal: 100,
    rural_signal: 0,
    score: 75.1,
    svi_signal: 82.6,
    tick_signal: 100,
  },
  state: "IN",
  state_name: "Indiana",
  svi_percentile: 0.826,
  tick_status: "Established",
  uninsured_percent: 9.5,
  uninsured_percentile: 0.5861,
};

const longName = {
  ...hamilton,
  county: "Prince George's County",
  fips: "24033",
  state: "MD",
  state_name: "Maryland",
};

const counties = [hamilton, marion, longName];

async function installIndiana(page: Page) {
  await fulfillCompletedStartingView(page);
  await page.route("**/v1/atlas/metadata**", (route) =>
    route.fulfill({ json: { ...baldwin.release, release_id: release } })
  );
  await page.route("**/v1/atlas/scores**", (route) =>
    route.fulfill({
      json: {
        counties: counties.map((entry) => ({
          burgdorferi_status: entry.burgdorferi_status,
          color: entry.color,
          county: entry.county,
          evidence_completeness: entry.evidence_completeness,
          fips: entry.fips,
          human_status: entry.human_status,
          in_contiguous_tick_scope: true,
          priority: entry.priority,
          score: entry.score,
          state: entry.state,
          state_name: entry.state_name,
          tick_status: entry.tick_status,
        })),
        methodology_version: baldwin.release.methodology_version,
        release_id: release,
        settings: {
          ecological_share: 65,
          low_incidence_breakpoint: 10,
          missing_human_weakness: 75,
        },
      },
    })
  );
  await page.route("**/v1/states/*/review**", (route) => {
    const state = new URL(route.request().url()).pathname.split("/").at(-2);
    const review = buildStateReview({
      resultState: "unsupported",
      state: state ?? "IN",
    });
    review.data_release_version = release;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({ json: { features: [], type: "FeatureCollection" } })
  );
  await page.route("**/v1/counties/*", (route) => {
    const url = route.request().url();
    if (url.includes("/availability") || url.includes("/tier1-")) {
      return route.fallback();
    }
    const fips = new URL(url).pathname.split("/").at(-1);
    const detail = counties.find((entry) => entry.fips === fips);
    return detail
      ? route.fulfill({ json: detail })
      : route.fulfill({ status: 404, json: { detail: "No published record" } });
  });
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({ json: { detail: "Catalog unavailable" }, status: 503 })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ json: { detail: "No matching priority" }, status: 404 })
  );
  await page.route("**/v1/geographies/county/*/availability", (route) =>
    route.fulfill({
      json: {
        availability: "UNAVAILABLE",
        data: null,
        limitations: [],
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
        release_id: release,
      },
      status: 200,
    })
  );
}

async function expectCard(
  page: Page,
  fips: string,
  score: string,
  color: string
) {
  const presentation = responseTierPresentationForColor(color);
  const band = SCORE_COLOR_BANDS.find((entry) => entry.color === color);
  if (!(presentation && band)) {
    throw new Error(`Missing tier for ${color}`);
  }
  const preview = page.getByTestId("review-published-county-preview");
  await expect(preview).toHaveAttribute("data-fips", fips);
  const pills = preview.getByTestId("selected-county-response-tier");
  await expect(pills).toHaveCount(1);
  await expect(preview.locator(".priority-pill")).toHaveCount(0);
  await expect(pills.locator(".response-tier-pill-title")).toHaveText(
    presentation.title
  );
  await expect(pills.locator(".response-tier-pill-detail")).toHaveText(
    presentation.detail
  );
  await expect(pills).toHaveAttribute("data-ramp", band.id);
  await expect(preview.getByTestId("selected-county-gap-score")).toHaveCount(1);
  await expect(preview.getByTestId("selected-county-gap-score")).toContainText(
    score
  );
  await expect(preview.getByTestId("selected-county-gap-score")).toContainText(
    "/100"
  );
  await expect(preview.getByTestId("selected-county-gap-score")).toContainText(
    "Atlas gap score"
  );
  await expect(
    preview.getByRole("heading", { name: "Surveillance evidence" })
  ).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Community context" })
  ).toBeVisible();
  for (const number of [1, 2, 3, 4, 5, 6]) {
    await expect(
      preview.getByTestId(`review-rationale-${number}`)
    ).toBeVisible();
  }
  await expect(preview.getByTestId("ranking-influence")).toBeVisible();
  const header = preview.locator(".ux-reset-selected-county-header");
  await expect(header).not.toContainText("not a disease-risk estimate");
  await expect(header).not.toContainText(
    "not a confirmed Lyme disease risk category"
  );
  await expect(header.locator(".priority-pill")).toHaveCount(0);
  const range =
    band.maxExclusive === null
      ? `${band.minInclusive} or higher`
      : `${band.minInclusive} to <${band.maxExclusive}`;
  const legendButton = page
    .getByTestId("explorer-map-legend")
    .getByRole("button", { name: new RegExp(range.replaceAll("<", "\\<")) });
  await expect(legendButton).toHaveAttribute(
    "aria-label",
    `Atlas gap score: ${range}. ${presentation.title}. ${presentation.detail}`
  );
  const colors = await page.evaluate(
    ({ detail, title }) => {
      const pill = document.querySelector(
        "[data-testid='review-published-county-preview'] [data-testid='selected-county-response-tier']"
      );
      const button = [
        ...document.querySelectorAll(
          "[data-testid='explorer-map-legend'] [data-legend-segment]"
        ),
      ].find((entry) => {
        const label = entry.getAttribute("aria-label") ?? "";
        return label.includes(title) && label.includes(detail);
      });
      const swatch = button?.querySelector("span");
      if (!(pill instanceof HTMLElement) || !(swatch instanceof HTMLElement)) {
        return null;
      }
      const card = pill.closest(
        "[data-testid='review-published-county-preview']"
      );
      const rationale = card?.querySelector("[data-testid='review-rationale']");
      const scoreLockup = card?.querySelector(
        "[data-testid='selected-county-score-lockup']"
      );
      const heading = card?.querySelector("h2");
      const score = card?.querySelector(
        "[data-testid='selected-county-gap-score']"
      );
      if (
        !(card instanceof HTMLElement) ||
        !(rationale instanceof HTMLElement) ||
        !(scoreLockup instanceof HTMLElement) ||
        !(heading instanceof HTMLElement) ||
        !(score instanceof HTMLElement)
      ) {
        return null;
      }
      const style = getComputedStyle(card);
      const contentWidth =
        card.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      const rationaleBox = rationale.getBoundingClientRect();
      const lockupBox = scoreLockup.getBoundingClientRect();
      const pillBox = pill.getBoundingClientRect();
      const scoreBox = score.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      const overlapsHeading = !(
        pillBox.right <= headingBox.left ||
        pillBox.left >= headingBox.right ||
        pillBox.bottom <= headingBox.top ||
        pillBox.top >= headingBox.bottom
      );
      const sameRow =
        lockupBox.top <= headingBox.top + 2 &&
        lockupBox.left >= headingBox.right - 1 &&
        scoreBox.left >= headingBox.right - 1;
      return {
        contentWidth,
        headingClipped: heading.scrollWidth > heading.clientWidth + 1,
        legendLabel: button?.getAttribute("aria-label") ?? "",
        lockupBesideEvidence: lockupBox.bottom > rationaleBox.top + 1,
        overflow: card.scrollWidth > card.clientWidth + 1,
        overlapsHeading,
        pillAboveScore: pillBox.bottom <= scoreBox.top + 2,
        sameRow,
        pillColor: getComputedStyle(pill).backgroundColor,
        pillWidth: pillBox.width,
        rationaleWidth: rationaleBox.width,
        swatchColor: getComputedStyle(swatch).backgroundColor,
      };
    },
    { detail: presentation.detail, title: presentation.title }
  );
  expect(colors?.pillColor).toBe(colors?.swatchColor);
  expect(colors?.legendLabel).toContain(presentation.title);
  expect(colors?.legendLabel).toContain(presentation.detail);
  expect(colors?.overflow).toBe(false);
  expect(colors?.headingClipped).toBe(false);
  expect(colors?.sameRow).toBe(true);
  expect(colors?.overlapsHeading).toBe(false);
  expect(colors?.lockupBesideEvidence).toBe(false);
  expect(colors?.pillAboveScore).toBe(true);
  expect(colors?.rationaleWidth ?? 0).toBeGreaterThan(
    (colors?.contentWidth ?? 0) * 0.9
  );
  expect(colors?.pillWidth ?? 0).toBeLessThan(
    (colors?.contentWidth ?? 1) * 0.95
  );
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const preview = page.getByTestId("review-published-county-preview");
  // Element screenshots of this card are cropped by the Explorer column's
  // overflow. Paint a copy outside that scroller, then capture the copy.
  await preview.evaluate((card) => {
    document.getElementById("selected-county-card-shot")?.remove();
    const host = document.createElement("div");
    host.id = "selected-county-card-shot";
    host.style.position = "absolute";
    host.style.left = "0";
    host.style.top = "0";
    host.style.zIndex = "1000";
    host.style.width = `${card.getBoundingClientRect().width}px`;
    host.style.background = "white";
    const copy = card.cloneNode(true);
    if (copy instanceof HTMLElement) {
      copy.style.width = "100%";
      copy.style.height = "auto";
      copy.style.overflow = "visible";
    }
    host.append(copy);
    document.body.append(host);
  });
  const shot = page.locator("#selected-county-card-shot");
  await shot.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await shot.evaluate((host) => {
    host.remove();
  });
}

test.describe("selected county summary card", () => {
  test("shows Hamilton and Marion with one legend-matched pill", async ({
    page,
  }, testInfo) => {
    await installIndiana(page);
    await page.setViewportSize({ height: 1100, width: 1440 });
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18057`);
    await expectCard(page, "18057", "49.8", "#87b982");
    await capture(page, testInfo, "hamilton-desktop");
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18097`);
    await expectCard(page, "18097", "75.1", "#e9602b");
    await capture(page, testInfo, "marion-desktop");

    await page.setViewportSize({ height: 1000, width: 800 });
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18057`);
    await expectCard(page, "18057", "49.8", "#87b982");
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18097`);
    await expectCard(page, "18097", "75.1", "#e9602b");

    const results = await new AxeBuilder({ page })
      .include("[data-testid='review-published-county-preview']")
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("keeps Hamilton, Marion, and a long name readable at phone width", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width selected county card checks run on the mobile project."
    );
    await installIndiana(page);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18057`);
    await expectCard(page, "18057", "49.8", "#87b982");
    await capture(page, testInfo, "hamilton-narrow");
    await page.goto(`/explore?scope=IN&dataset=${release}&county=18097`);
    await expectCard(page, "18097", "75.1", "#e9602b");
    await capture(page, testInfo, "marion-narrow");
    await page.goto(`/explore?scope=MD&dataset=${release}&county=24033`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview.getByRole("heading", { level: 2 })).toHaveText(
      "Prince George's County, Maryland"
    );
    await expectCard(page, "24033", "49.8", "#87b982");
    const readable = await preview
      .getByTestId("selected-county-response-tier")
      .evaluate(
        (pill) =>
          pill instanceof HTMLElement &&
          pill.scrollWidth <= pill.clientWidth + 1
      );
    expect(readable).toBe(true);
  });
});
