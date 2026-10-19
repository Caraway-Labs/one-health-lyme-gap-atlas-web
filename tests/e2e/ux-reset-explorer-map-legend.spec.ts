import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { RUCC_2023_LABELS } from "@/features/ux-reset/review/review-rationale";
import { ValueState } from "@/generated/models";

import { populationRuralityObservation } from "../fixtures/population-rurality-context";
import { releaseViewportRuns } from "./release-phone-viewport";

const score = (value: number) => ({
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: value,
  svi_signal: 0.5,
  tick_signal: 0.5,
});

const counties = [
  {
    burgdorferi_status: "No records",
    color: "#a9d2db",
    county: "Adams",
    evidence_completeness: 50,
    fips: "08001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(12),
    state: "CO",
    state_name: "Colorado",
    tick_status: "Established",
  },
  {
    burgdorferi_status: "No records",
    color: "#55a8a3",
    county: "Arapahoe",
    evidence_completeness: 40,
    fips: "08005",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(21),
    state: "CO",
    state_name: "Colorado",
    tick_status: "Reported",
  },
  {
    burgdorferi_status: "Present",
    color: "#e9602b",
    county: "Boulder",
    evidence_completeness: 80,
    fips: "08013",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 1 — Investigate",
    score: score(80),
    state: "CO",
    state_name: "Colorado",
    tick_status: "No records",
  },
  {
    burgdorferi_status: "Unknown",
    color: "  ",
    county: "Broomfield",
    evidence_completeness: 0,
    fips: "08014",
    human_status: "no_county_linked_record",
    in_contiguous_tick_scope: true,
    priority: "",
    score: score(0),
    state: "CO",
    state_name: "Colorado",
    tick_status: "Unknown",
  },
  {
    burgdorferi_status: "Present",
    color: "#55a8a3",
    county: "Albany",
    evidence_completeness: 30,
    fips: "36001",
    human_status: "no_county_linked_record",
    in_contiguous_tick_scope: true,
    priority: "Watch — Monitor signals",
    score: score(32),
    state: "NY",
    state_name: "New York",
    tick_status: "Reported",
  },
  {
    burgdorferi_status: "Absent",
    color: "#a9d2db",
    county: "District of Columbia",
    evidence_completeness: 40,
    fips: "11001",
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(4),
    state: "DC",
    state_name: "District of Columbia",
    tick_status: "Established",
  },
];

const scoresBody = {
  counties,
  methodology_version: "semantic-1.0.0",
  release_id: "alpha-2026",
  settings: {
    ecological_share: 65,
    low_incidence_breakpoint: 10,
    missing_human_weakness: 75,
  },
};

const metadata = {
  bundle_sha256: "abc",
  generated_at: "2026-01-01T00:00:00.000Z",
  limitations: "Sample",
  loaded_at: "2026-01-01T00:00:00.000Z",
  methodology_version: "semantic-1.0.0",
  release_id: "alpha-2026",
  schema_version: "1",
  scope: "US",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      note: "A floor is a lower bound.",
      url: "https://www.cdc.gov/",
      vintage: "2023",
    },
    {
      key: "tick",
      label: "CDC ArboNET county tick status",
      note: "No records is not absence.",
      url: "https://www.cdc.gov/",
      vintage: "through 2025-12-31",
    },
    {
      key: "pathogen",
      label: "CDC ArboNET tickborne pathogen status",
      note: "No records is not absence.",
      url: "https://www.cdc.gov/",
      vintage: "through 2025-12-31",
    },
    {
      key: "context_svi",
      label: "CDC/ATSDR Social Vulnerability Index",
      note: "Percentile context.",
      url: "https://www.atsdr.cdc.gov/",
      vintage: "2022",
    },
    {
      key: "context_rucc",
      label: "USDA ERS Rural-Urban Continuum Codes",
      note: "Rurality context.",
      url: "https://www.ers.usda.gov/",
      vintage: "2023",
    },
  ],
  states: [
    { code: "CO", name: "Colorado" },
    { code: "DC", name: "District of Columbia" },
    { code: "NY", name: "New York" },
  ],
};

function box(
  fips: string,
  west: number,
  south: number,
  east: number,
  north: number
) {
  return {
    geometry: {
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
      type: "Polygon" as const,
    },
    properties: { fips },
    type: "Feature" as const,
  };
}

const geometry = {
  features: [
    box("08001", -105.1, 39.7, -104.5, 40),
    box("08005", -105, 39.5, -104.6, 39.75),
    box("08013", -105.7, 39.9, -105.05, 40.26),
    box("08014", -105.15, 39.9, -104.95, 40.02),
    box("36001", -74.2, 42.4, -73.7, 42.8),
    box("11001", -77.12, 38.79, -76.91, 38.995),
  ],
  type: "FeatureCollection" as const,
};

function stateReview(state: string) {
  return {
    configuration_sha256:
      "db6df73f7bce474000165fb2b0bad9767390c21aed160a1377be6a4893004d99",
    coverage: {
      abstained_counties: 0,
      assessed_counties: 1,
      eligible_counties: 1,
      evaluated_counties: 1,
      rule_coverage: {
        human_emerging: "disabled",
        human_vector_discordance: "disabled",
        pathogen_present_vector_reported: "disabled",
        vector_transition: "disabled",
      },
    },
    data_gaps: [],
    data_release_version: "alpha-2026",
    effective_observation_context:
      "Current cumulative county status; human snapshot 2023",
    evaluated_at: "2026-10-06T04:57:46.000Z",
    limitations: ["Review is not disease risk."],
    methodology_id: "atlas-county-review",
    methodology_version: "1.0.0",
    requested_observation_context: null,
    requested_state: state,
    result_state: "none_stand_out",
    review_candidates: [],
  };
}

async function installLegendApi(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/v1/me/profile")) {
      await route.fulfill({
        json: { profile: { starting_view_version: 1, state_code: "CO" } },
        status: 200,
      });
      return;
    }
    if (url.includes("/v1/atlas/metadata")) {
      await route.fulfill({ json: metadata, status: 200 });
      return;
    }
    if (url.includes("/v1/atlas/scores")) {
      await route.fulfill({ json: scoresBody, status: 200 });
      return;
    }
    if (url.includes("/v1/atlas/geometry")) {
      await route.fulfill({ json: geometry, status: 200 });
      return;
    }
    if (url.includes("/v1/states/") && url.includes("/review")) {
      const state = new URL(url).pathname.split("/").at(-2) ?? "CO";
      await route.fulfill({ json: stateReview(state), status: 200 });
      return;
    }
    if (url.includes("/v1/observations")) {
      await route.fulfill({
        json: {
          data: observationRows(url),
          links: { self: "/v1/observations" },
          meta: { next_page_token: null },
        },
        status: 200,
      });
      return;
    }
    await route.fulfill({ json: {}, status: 404 });
  });
}

function observationRows(url: string) {
  const request = new URL(url);
  const measureId = request.searchParams.get("measure_id");
  const fips = request.searchParams.getAll("geography_id");
  if (measureId === "rucc_2023") {
    return fips.map((id, index) => {
      const code = (index % 9) + 1;
      return populationRuralityObservation({
        categoryLabel: RUCC_2023_LABELS[code],
        fips: id,
        measureId: "rucc_2023",
        value: code,
      });
    });
  }
  if (measureId === "svi_percentile_2022") {
    return fips.map((id, index) =>
      populationRuralityObservation({
        fips: id,
        measureId: "svi_percentile_2022",
        value: index === 0 ? 0 : "1",
        valueState: index === 0 ? ValueState.ZERO : ValueState.OBSERVED,
      })
    );
  }
  if (measureId === "uninsured_percent_2022") {
    return fips.map((id, index) =>
      populationRuralityObservation({
        fips: id,
        measureId: "uninsured_percent_2022",
        value: index === 0 ? 0 : "18.2",
        valueState: index === 0 ? ValueState.ZERO : ValueState.OBSERVED,
      })
    );
  }
  if (measureId === "incidence_floor_2023") {
    return fips.map((id, index) => incidenceRow(id, index));
  }
  return [];
}

function incidenceRow(fips: string, index: number) {
  const missing = index === 1;
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "x5j9-wybp",
    denominator: null,
    environmental_context: null,
    evidence: {
      provenance_ref: `prov-${fips}`,
      resource_id: `resource-${fips}`,
      resource_type: "observation",
    },
    geography: { geography_id: fips, geography_type: "county" },
    limitations: [],
    lineage_source_id: "cdc_lyme",
    measure_id: "incidence_floor_2023",
    methodology: "case floor divided by population",
    methodology_id: "human_case_floor_population_incidence_v1",
    methodology_version: "semantic_county_assembly_v1",
    observation_id: `obs-${fips}`,
    period_end: "2023-12-31",
    period_start: "2023-01-01",
    provenance_ref: `prov-${fips}`,
    release_id: "alpha-2026",
    release_methodology_version: "semantic-2.0.0",
    semantic_version: "2.0.0",
    source_id: "human",
    source_label: "CDC Lyme surveillance",
    source_published_at: null,
    source_url: "https://data.cdc.gov/resource/x5j9-wybp.json",
    source_vintage: "2023",
    surveillance_context: null,
    temporal_grain: "YEAR",
    unit: "per 100,000",
    value: missing ? null : index === 0 ? 0 : 12.4,
    value_state: missing
      ? ValueState.MISSING
      : index === 0
        ? ValueState.ZERO
        : ValueState.OBSERVED,
  };
}

async function legendSwatchesFit(
  legend: ReturnType<Page["getByTestId"]>
): Promise<{ clipped: boolean; tall: boolean; visible: boolean }> {
  return legend.evaluate((element) => {
    const card = element.closest(".ux-reset-explorer-map");
    if (!card) {
      return { clipped: true, tall: true, visible: false };
    }
    const cardBox = card.getBoundingClientRect();
    const legendBox = element.getBoundingClientRect();
    const pageOverflow =
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1;
    const clipped =
      pageOverflow ||
      legendBox.top < cardBox.top - 1 ||
      legendBox.bottom > cardBox.bottom + 1 ||
      legendBox.right > cardBox.right + 1;
    const items = [...element.querySelectorAll("[data-legend-segment]")];
    const visible =
      items.length > 0 &&
      items.every((item) => {
        const box = item.getBoundingClientRect();
        return (
          box.width > 1 && box.height > 1 && box.right <= cardBox.right + 1
        );
      });
    return { clipped, tall: legendBox.height > 96, visible };
  });
}

async function chooseLayer(page: Page, name: string) {
  await page.getByTestId("explorer-map-layer").click();
  await page.getByRole("option", { name, exact: true }).click();
}

test.describe("Atlas Explorer layer legends", () => {
  test.beforeEach(async ({ page }) => {
    await installLegendApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
  });

  test("explains every national gap-score color, then stays accurate across state and layer changes", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Atlas gap score");
    await expect(legend).toContainText("review-priority score");
    await expect(legend).toContainText("Gap score unavailable");
    await expect(legend).toContainText(">=75");
    await expect(legend).not.toContainText("not personal disease risk");
    await expect(
      legend.getByRole("button", { name: /Gap score unavailable/ })
    ).toHaveAttribute(
      "aria-label",
      "Gap score unavailable. Insufficient data to calculate a score"
    );
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toHaveAttribute(
      "aria-label",
      "Atlas gap score: 0 to <20. Lower review priority. Continue routine review"
    );
    await expect(
      legend.getByRole("button", { name: /20 to <35/ })
    ).toHaveAttribute(
      "aria-label",
      "Atlas gap score: 20 to <35. Monitor. Monitor the pattern"
    );
    await expect(
      legend.getByRole("button", { name: /75 or higher/ })
    ).toHaveAttribute(
      "aria-label",
      "Atlas gap score: 75 or higher. Highest. Prioritize targeted follow-up"
    );
    await legend.getByRole("button", { name: "About Atlas gap score" }).click();
    const about = page.getByRole("dialog", { name: "About Atlas gap score" });
    await expect(about).toContainText("CDC Lyme surveillance 2023");
    await expect(about).toContainText("not personal disease risk");
    await expect(about).toContainText("Not zero");
    await expect(about).toContainText("Priority 1 — Investigate");
    await page.keyboard.press("Escape");
    await expect(about).toBeHidden();
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: /75 or higher/ })
    ).toBeVisible();
    await expect(legend).not.toContainText("Monitor signals");
    await expect(
      legend.getByRole("button", { name: /20 to <35/ })
    ).toHaveAttribute("aria-label", /Monitor the pattern/);
    await expect(
      legend.getByRole("button", { name: /Gap score unavailable/ })
    ).toBeVisible();
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "data-map-colors",
      /08014:/
    );

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(
      legend.getByRole("button", { name: /35 to <50/ })
    ).toHaveAttribute("aria-label", /Verify with local information/);
    await expect(legend).toContainText("Atlas gap score");

    await chooseLayer(page, "Blacklegged tick status");
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(legend).toContainText("Blacklegged tick status");
    await expect(legend).toContainText("published status category");
    await expect(legend).not.toContainText("CDC Lyme surveillance");
    await expect(
      legend.getByRole("button", { name: "Established" })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: /No records \(not zero/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: /Unknown \(not zero/ })
    ).toBeVisible();
    await expect(legend.getByRole("button", { name: /0 to <20/ })).toHaveCount(
      0
    );
    await legend
      .getByRole("button", { name: "About Blacklegged tick status" })
      .click();
    const tickAbout = page.getByRole("dialog", {
      name: "About Blacklegged tick status",
    });
    await expect(tickAbout).toContainText(
      "CDC ArboNET county tick status through 2025-12-31"
    );
    await expect(tickAbout).not.toContainText("not personal disease risk");
    await page.keyboard.press("Escape");
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });

    await chooseLayer(page, "B. burgdorferi status");
    await expect(legend).toContainText("B. burgdorferi status");
    await expect(
      legend.getByRole("button", { name: /Absent \(observed zero/ })
    ).toBeVisible();
    await expect(legend.getByRole("button", { name: "Present" })).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "Established" })
    ).toHaveCount(0);
    await legend
      .getByRole("button", { name: "About B. burgdorferi status" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "About B. burgdorferi status" })
    ).toContainText("CDC ArboNET tickborne pathogen status");
    await page.keyboard.press("Escape");

    await chooseLayer(page, "County boundaries");
    await expect(
      legend.getByRole("button", { name: "County boundary" })
    ).toBeVisible();
    await legend
      .getByRole("button", { name: "About County boundaries" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "About County boundaries" })
    ).toContainText("not an evidence layer");
    await expect(legend.getByRole("button", { name: "Present" })).toHaveCount(
      0
    );
    await expect(
      legend.getByRole("button", { name: /75 or higher/ })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await chooseLayer(page, "Atlas gap score");
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "County boundary" })
    ).toHaveCount(0);
  });

  test("keeps the latest layer after rapid switches and leaves unsupported layers unpainted", async ({
    page,
  }, testInfo) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Blacklegged tick status" }).click();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "B. burgdorferi status" }).click();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Atlas gap score" }).click();
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "Established" })
    ).toHaveCount(0);
    await expect(legend.getByRole("button", { name: "Present" })).toHaveCount(
      0
    );

    await chooseLayer(page, "Lyme incidence floor");
    await expect(legend).toContainText("Lyme incidence floor");
    await expect(legend).toContainText("per 100,000");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(
      legend.getByRole("button", { name: /Missing \(not zero/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: /0 to 12\.4 per 100,000/ })
    ).toBeVisible();

    await chooseLayer(page, "Social vulnerability");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(legend).toContainText("percentile");
    await expect(
      legend.getByRole("button", { name: /0 to 1 percentile/ })
    ).toBeVisible();

    await chooseLayer(page, "Uninsured population");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(legend).toContainText("percent");
    await expect(
      legend.getByRole("button", { name: /0 to 100 percent/ })
    ).toBeVisible();

    await chooseLayer(page, "Rurality");
    await expect(legend).toHaveAttribute("data-legend-scale", "segments");
    await expect(legend).toContainText("1");
    await expect(legend).toContainText("9");
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(9);
    await expect(
      legend.getByRole("button", { name: /metro area of 1 million or more/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", {
        name: /not adjacent to a metro area/,
      })
    ).toHaveCount(3);

    await chooseLayer(page, "Evidence completeness");
    await expect(legend).toHaveAttribute("data-legend-scale", "segments");
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(5);

    await chooseLayer(page, "Atlas gap score");
    await expect(legend).toContainText("Atlas gap score");
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(legend).not.toContainText("per 100,000");

    await legend.scrollIntoViewIfNeeded();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("legend-after-gap-national.png"),
    });
    await legend.screenshot({
      path: testInfo.outputPath("legend-after-gap-strip.png"),
    });
    await legend.getByRole("button", { name: "About Atlas gap score" }).click();
    await page.screenshot({
      path: testInfo.outputPath("legend-after-gap-about.png"),
    });
    await page.keyboard.press("Escape");
    await chooseLayer(page, "Rurality");
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(9);
    await legend.screenshot({
      path: testInfo.outputPath("legend-after-rucc.png"),
    });
    await chooseLayer(page, "Lyme incidence floor");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await legend.screenshot({
      path: testInfo.outputPath("legend-after-incidence.png"),
    });

    const results = await new AxeBuilder({ page })
      .include("[data-testid='explorer-map-legend']")
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("opens the seven gap-score disclosures by hover, keyboard, and click", async ({
    page,
  }, testInfo) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(7);
    await legend.scrollIntoViewIfNeeded();
    await legend.screenshot({
      path: testInfo.outputPath("legend-strip-at-rest.png"),
    });

    const disclosures = [
      {
        action: "Insufficient data to calculate a score",
        category: null,
        name: /Gap score unavailable/,
        shot: null,
        title: "Gap score unavailable",
      },
      {
        action: "Continue routine review",
        category: "Lower review priority",
        name: /0 to <20/,
        shot: null,
        title: "Atlas gap score: 0 to <20",
      },
      {
        action: "Monitor the pattern",
        category: "Monitor",
        name: /20 to <35/,
        shot: null,
        title: "Atlas gap score: 20 to <35",
      },
      {
        action: "Verify with local information",
        category: "Monitor",
        name: /35 to <50/,
        shot: null,
        title: "Atlas gap score: 35 to <50",
      },
      {
        action: "Conduct targeted follow-up",
        category: "Moderate",
        name: /50 to <65/,
        shot: "legend-tooltip-50-to-65.png",
        title: "Atlas gap score: 50 to <65",
      },
      {
        action: "Coordinate a local assessment",
        category: "Moderate",
        name: /65 to <75/,
        shot: "legend-tooltip-65-to-75.png",
        title: "Atlas gap score: 65 to <75",
      },
      {
        action: "Prioritize targeted follow-up",
        category: "Highest",
        name: /75 or higher/,
        shot: null,
        title: "Atlas gap score: 75 or higher",
      },
    ] as const;

    for (const disclosure of disclosures) {
      const segment = legend.getByRole("button", { name: disclosure.name });
      await segment.hover();
      const dialog = page.getByRole("dialog", { name: disclosure.name });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(disclosure.title);
      await expect(dialog).toContainText(disclosure.action);
      await expect(dialog).not.toContainText("Priority 1");
      await expect(dialog).not.toContainText("Priority 2");
      if (disclosure.category) {
        await expect(
          dialog.locator(".ux-reset-explorer-legend-disclosure-category")
        ).toHaveText(disclosure.category);
      } else {
        await expect(
          dialog.locator(".ux-reset-explorer-legend-disclosure-category")
        ).toHaveCount(0);
      }
      const swatch = dialog.locator("[data-legend-disclosure-swatch]");
      await expect(swatch).toBeVisible();
      const segmentColor = await segment
        .locator("span")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      const swatchColor = await swatch.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      );
      expect(swatchColor).toBe(segmentColor);
      if (disclosure.shot) {
        await dialog.screenshot({
          path: testInfo.outputPath(disclosure.shot),
        });
      }
      if (disclosure.action === "Coordinate a local assessment") {
        const lines = await dialog
          .locator(".ux-reset-explorer-legend-disclosure-action")
          .evaluate((element) => {
            const lineHeight = Number.parseFloat(
              getComputedStyle(element).lineHeight
            );
            return element.getBoundingClientRect().height / lineHeight;
          });
        expect(lines).toBeGreaterThan(1.4);
      }
      await page.mouse.move(0, 0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }

    const unavailable = legend.getByRole("button", {
      name: /Gap score unavailable/,
    });
    await unavailable.hover();
    const unavailableDialog = page.getByRole("dialog", {
      name: /Gap score unavailable/,
    });
    await expect(unavailableDialog).toBeVisible();
    await unavailableDialog.screenshot({
      path: testInfo.outputPath("legend-tooltip-unavailable.png"),
    });
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");

    await legend.getByRole("button", { name: "About Atlas gap score" }).focus();
    await page.keyboard.press("Tab");
    const focused = page.getByRole("dialog", { name: /Gap score unavailable/ });
    await expect(focused).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(focused).toBeHidden();

    await legend.getByRole("button", { name: /50 to <65/ }).click();
    const clicked = page.getByRole("dialog", { name: /50 to <65/ });
    await expect(clicked).toBeVisible();
    await expect(clicked).toContainText("Conduct targeted follow-up");
    await page.keyboard.press("Escape");

    const openResults = await new AxeBuilder({ page })
      .include("[data-testid='explorer-map-legend']")
      .analyze();
    expect(openResults.violations).toEqual([]);

    await legend.getByRole("button", { name: /50 to <65/ }).click();
    const openTip = page.getByRole("dialog", { name: /50 to <65/ });
    await expect(openTip).toBeVisible();
    const tipResults = await new AxeBuilder({ page })
      .include("[data-slot='popover-content']")
      .analyze();
    expect(tipResults.violations).toEqual([]);
  });
});

test.describe("Atlas Explorer legend phone reflow", () => {
  test("keeps every gap-score segment on a phone width", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone legend reflow runs in the mobile project."
    );
    await installLegendApi(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(7);
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });
    await page.screenshot({
      path: testInfo.outputPath("explore-legend-phone.png"),
    });
  });
});
