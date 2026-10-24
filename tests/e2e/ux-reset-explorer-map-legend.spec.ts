import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { gapLegendCopyForMinimum } from "@/features/ux-reset/review/explorer-legend-info-copy";
import {
  PATHOGEN_STATUS_EXTRA_COLORS,
  PATHOGEN_STATUS_NO_RECORDS_COLOR,
  PATHOGEN_STATUS_PRESENT_COLOR,
} from "@/features/ux-reset/review/pathogen-status-contract";
import { RUCC_2023_LABELS } from "@/features/ux-reset/review/review-rationale";
import {
  RURALITY_LEGEND_EXPLANATION,
  RURALITY_MORE_RURAL_LABEL,
  RURALITY_MORE_URBAN_LABEL,
} from "@/features/ux-reset/review/rurality-palette";
import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";
import {
  TICK_STATUS_ESTABLISHED_COLOR,
  TICK_STATUS_EXTRA_COLORS,
  TICK_STATUS_NO_RECORDS_COLOR,
  TICK_STATUS_REPORTED_COLOR,
} from "@/features/ux-reset/review/tick-status-contract";
import { ValueState } from "@/generated/models";

import { populationRuralityObservation } from "../fixtures/population-rurality-context";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

function gapScoreRangeTitle(band: (typeof SCORE_COLOR_BANDS)[number]): string {
  if (band.maxExclusive === null) {
    return `Gap review score: ${band.minInclusive} or higher`;
  }
  return `Gap review score: ${band.minInclusive} to <${band.maxExclusive}`;
}

function operationalBandCopy(band: (typeof SCORE_COLOR_BANDS)[number]) {
  const copy = gapLegendCopyForMinimum(band.minInclusive);
  if (!copy) {
    throw new Error(`Missing legend copy for ${band.minInclusive}`);
  }
  return {
    action: copy.action,
    category: copy.category,
    title: gapScoreRangeTitle(band),
  };
}

function bandByMinimum(minimum: number) {
  const band = SCORE_COLOR_BANDS.find(
    (entry) => entry.minInclusive === minimum
  );
  if (!band) {
    throw new Error(`Missing score band starting at ${minimum}`);
  }
  return band;
}

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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(4),
    state: "DC",
    state_name: "District of Columbia",
    tick_status: "Established",
  },
  {
    burgdorferi_status: "Present",
    color: "#a9d2db",
    county: "Denver",
    evidence_completeness: 40,
    fips: "08031",
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(12),
    state: "CO",
    state_name: "Colorado",
    tick_status: "Endemic",
  },
  {
    burgdorferi_status: "Emerging",
    color: "#a9d2db",
    county: "Allegany",
    evidence_completeness: 40,
    fips: "36003",
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: score(12),
    state: "NY",
    state_name: "New York",
    tick_status: "Reported",
  },
];

const scoresBody = {
  counties,
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
  methodology_version: "semantic-1.0.0",
  release_id: "alpha-2026",
  settings: {
    ecological_share: 65,
    smooth_k: 50,
    missing_human_weakness: 75,
  },
};

const metadata = {
  bundle_sha256: "abc",
  generated_at: "2026-01-01T00:00:00.000Z",
  limitations: "Sample",
  loaded_at: "2026-01-01T00:00:00.000Z",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    box("08031", -105.1, 39.6, -104.8, 39.8),
    box("36003", -78.3, 42, -77.7, 42.5),
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
  await fulfillCompletedStartingView(page);
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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

async function tickLegendGeometry(
  legend: ReturnType<Page["getByTestId"]>
): Promise<{
  clipped: boolean;
  overflow: boolean;
  overlap: boolean;
  visible: boolean;
}> {
  return legend.evaluate((element) => {
    const labels = [
      ...element.querySelectorAll<HTMLElement>("[data-legend-visible-line]"),
    ];
    const overflow =
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1;
    const boxes = labels.map((label) => label.getBoundingClientRect());
    let overlap = false;
    for (let index = 0; index < boxes.length; index += 1) {
      const current = boxes[index];
      if (!current) {
        continue;
      }
      for (const other of boxes.slice(index + 1)) {
        const separated =
          current.right <= other.left + 0.5 ||
          other.right <= current.left + 0.5 ||
          current.bottom <= other.top + 0.5 ||
          other.bottom <= current.top + 0.5;
        if (!separated) {
          overlap = true;
        }
      }
    }
    const clipped = labels.some(
      (label) =>
        label.scrollWidth > label.clientWidth + 1 ||
        label.scrollHeight > label.clientHeight + 1
    );
    const visible =
      labels.length >= 4 &&
      labels.every((label) => {
        const box = label.getBoundingClientRect();
        const style = getComputedStyle(label);
        return (
          box.width > 1 &&
          box.height > 1 &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0
        );
      });
    return { clipped, overflow, overlap, visible };
  });
}

async function layerMenuFits(control: Locator) {
  return control.evaluate((trigger) => {
    const value = trigger.querySelector("[data-slot='select-value']");
    const field = trigger.closest(".ux-reset-review-scope-field");
    const label = field?.querySelector("label");
    const triggerRect = trigger.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    const overlapsLabel = labelRect
      ? triggerRect.left < labelRect.right - 1 &&
        triggerRect.right > labelRect.left + 1 &&
        triggerRect.top < labelRect.bottom - 1 &&
        triggerRect.bottom > labelRect.top + 1
      : false;
    const clipped = value
      ? value.scrollWidth > value.clientWidth + 1 ||
        value.scrollHeight > value.clientHeight + 1
      : true;
    return { clipped, overlapsLabel };
  });
}

async function chooseLayer(page: Page, name: string) {
  await page.getByTestId("explorer-map-layer").click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function visibleFocusRing(segment: Locator) {
  return segment.evaluate((element) => {
    if (element instanceof HTMLElement) {
      const focusWithRing = element.focus.bind(element) as (
        options?: FocusOptions & { focusVisible?: boolean }
      ) => void;
      focusWithRing({ focusVisible: true });
    }
    const button = getComputedStyle(element);
    const swatch = element.querySelector("span");
    const swatchStyle = swatch ? getComputedStyle(swatch) : null;
    const width = Number.parseFloat(button.outlineWidth);
    return {
      buttonOpacity: button.opacity,
      outlineColor: button.outlineColor,
      outlineStyle: button.outlineStyle,
      outlineVisible: button.outlineStyle !== "none" && width > 0,
      swatchOpacity: swatchStyle?.opacity ?? "",
    };
  });
}

test.describe("Atlas Explorer layer legends", () => {
  test.beforeEach(async ({ page }) => {
    await installLegendApi(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
  });

  test("shows Lyme disease incidence for the incidence floor layer id", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL&layer=incidence_floor");
    const control = page.getByTestId("explorer-map-layer");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(control).toContainText("Lyme disease incidence");
    await expect(page).toHaveURL(/layer=incidence_floor/);
    await expect(legend).toContainText("Minimum reported Lyme incidence");
    await expect(legend).not.toContainText("Lyme disease incidence");
    await control.click();
    await expect(
      page.getByRole("option", { exact: true, name: "Lyme disease incidence" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", {
        exact: true,
        name: "Minimum reported Lyme incidence",
      })
    ).toHaveCount(0);
  });

  test("spells Borrelia burgdorferi in the layer menu and keeps the legend abbreviation", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL&layer=pathogen_status");
    const control = page.getByTestId("explorer-map-layer");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(control).toContainText("Borrelia burgdorferi status");
    await expect(page).toHaveURL(/layer=pathogen_status/);
    await expect(legend).toHaveAttribute(
      "data-legend-layer",
      "pathogen_status"
    );
    await expect(legend).toContainText("B. burgdorferi status");
    await expect(legend).not.toContainText("Borrelia burgdorferi status");
    await expect
      .poll(() => layerMenuFits(control))
      .toEqual({
        clipped: false,
        overlapsLabel: false,
      });
    await control.click();
    await page
      .getByRole("option", {
        exact: true,
        name: "Borrelia burgdorferi status",
      })
      .click();
    await expect(control).toContainText("Borrelia burgdorferi status");
    await expect(legend).toHaveAttribute(
      "data-legend-layer",
      "pathogen_status"
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(control).toContainText("Borrelia burgdorferi status");
    await expect
      .poll(() => layerMenuFits(control))
      .toEqual({
        clipped: false,
        overlapsLabel: false,
      });
  });

  test("explains every national gap-score color, then stays accurate across state and layer changes", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Gap review score");
    await expect(legend).not.toContainText(/atlas gap score/i);
    await expect(legend).not.toContainText("review-priority score");
    await expect(legend).toContainText("Gap score unavailable");
    await expect(legend).toContainText(">=75");
    await expect(legend).not.toContainText("not personal disease risk");
    await expect(
      legend.getByRole("button", { name: /Gap score unavailable/ })
    ).toHaveAttribute(
      "aria-label",
      "Gap score unavailable. No score available. Insufficient data to calculate a score."
    );
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toHaveAttribute(
      "aria-label",
      `${operationalBandCopy(bandByMinimum(0)).title}. ${operationalBandCopy(bandByMinimum(0)).category}. ${operationalBandCopy(bandByMinimum(0)).action}`
    );
    await expect(
      legend.getByRole("button", { name: /20 to <35/ })
    ).toHaveAttribute(
      "aria-label",
      `${operationalBandCopy(bandByMinimum(20)).title}. ${operationalBandCopy(bandByMinimum(20)).category}. ${operationalBandCopy(bandByMinimum(20)).action}`
    );
    await expect(
      legend.getByRole("button", { name: /75 or higher/ })
    ).toHaveAttribute(
      "aria-label",
      `${operationalBandCopy(bandByMinimum(75)).title}. ${operationalBandCopy(bandByMinimum(75)).category}. ${operationalBandCopy(bandByMinimum(75)).action}`
    );
    await legend
      .getByRole("button", { name: "About Gap review score" })
      .click();
    const about = page.getByRole("dialog", { name: "About Gap review score" });
    await expect(about).toContainText("closer surveillance review");
    await expect(about).not.toContainText(/atlas gap score/i);
    await expect(about).toContainText("What this map shows");
    await expect(about).toContainText("Data sources and years");
    await expect(about).toContainText("What the colors mean");
    await expect(about).toContainText("CDC Lyme surveillance 2023");
    await expect(about).toContainText("Data release:");
    await expect(about).toContainText("Elevated");
    await expect(about).toContainText("Monitor the pattern.");
    await expect(about).not.toContainText("not personal disease risk");
    await expect(about).not.toContainText("Priority 1");
    await expect(about).not.toContainText("This load");
    await expect(about).not.toContainText("Palette anchors");
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
    ).toHaveAttribute(
      "aria-label",
      new RegExp(operationalBandCopy(bandByMinimum(20)).action)
    );
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
    ).toHaveAttribute(
      "aria-label",
      new RegExp(operationalBandCopy(bandByMinimum(35)).action)
    );
    await expect(legend).toContainText("Gap review score");

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
      legend.getByRole("button", { name: "Unknown", exact: true })
    ).toBeVisible();
    await expect(legend.getByText("No records", { exact: true })).toBeVisible();
    await expect(
      legend.getByText("(not zero, not confirmed absence)", { exact: true })
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
      .poll(() => tickLegendGeometry(legend))
      .toEqual({
        clipped: false,
        overflow: false,
        overlap: false,
        visible: true,
      });

    await chooseLayer(page, "Borrelia burgdorferi status");
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

    await page.getByTestId("explorer-map-layer").click();
    await expect(
      page.getByRole("option", { name: "County boundaries" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("option", { name: "Gap review score" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await chooseLayer(page, "Evidence completeness");
    await expect(legend).toContainText("Evidence completeness");
    await expect(
      legend.getByRole("button", { name: "County boundary" })
    ).toHaveCount(0);

    await chooseLayer(page, "Gap review score");
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "County boundary" })
    ).toHaveCount(0);
  });

  test("keeps a visible focus ring on unlabeled legend segments", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    const gapBand = legend.getByRole("button", { name: /0 to <20/ });
    await expect(gapBand).toBeVisible();
    await expect
      .poll(() => visibleFocusRing(gapBand))
      .toMatchObject({
        buttonOpacity: "1",
        outlineStyle: "solid",
        outlineVisible: true,
        swatchOpacity: "0",
      });

    await chooseLayer(page, "Lyme disease incidence");
    const ramp = legend.getByRole("button", {
      name: /Lower published incidence/,
    });
    await expect
      .poll(() => visibleFocusRing(ramp))
      .toMatchObject({
        buttonOpacity: "1",
        outlineStyle: "solid",
        outlineVisible: true,
        swatchOpacity: "0",
      });

    await chooseLayer(page, "Rurality");
    const ruralClass = legend.locator("[data-legend-role='class']").first();
    await expect
      .poll(() => visibleFocusRing(ruralClass))
      .toMatchObject({
        buttonOpacity: "1",
        outlineStyle: "solid",
        outlineVisible: true,
        swatchOpacity: "0",
      });
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
    await page
      .getByRole("option", { name: "Borrelia burgdorferi status" })
      .click();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Gap review score" }).click();
    await expect(
      legend.getByRole("button", { name: /0 to <20/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "Established" })
    ).toHaveCount(0);
    await expect(legend.getByRole("button", { name: "Present" })).toHaveCount(
      0
    );

    await chooseLayer(page, "Lyme disease incidence");
    await expect(legend).toContainText("Minimum reported Lyme incidence");
    await expect(legend).toContainText("per 100,000 residents");
    await expect(legend).toContainText("Lower published incidence");
    await expect(legend).toContainText("Higher published incidence");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(
      legend.getByRole("button", { name: /Missing \(not zero/ })
    ).toBeVisible();
    await expect(
      legend.getByRole("button", {
        name: /Lower published incidence 0 to Higher published incidence 12\.4 per 100,000 residents/,
      })
    ).toBeVisible();
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });

    await chooseLayer(page, "Social vulnerability");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(legend).toContainText("percentile");
    await expect(legend).toContainText("Lower social vulnerability");
    await expect(legend).toContainText("Higher social vulnerability");
    await expect(
      legend.getByRole("button", {
        name: /Lower social vulnerability 0 to Higher social vulnerability 1 percentile/,
      })
    ).toBeVisible();
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });

    await chooseLayer(page, "Uninsured population");
    await expect(legend).toHaveAttribute("data-legend-scale", "gradient");
    await expect(legend).toContainText("percent");
    await expect(legend).toContainText("Lower uninsured percentage");
    await expect(legend).toContainText("Higher uninsured percentage");
    await expect(
      legend.getByRole("button", {
        name: /Lower uninsured percentage 0 to Higher uninsured percentage 100 percent/,
      })
    ).toBeVisible();
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, tall: false, visible: true });

    await chooseLayer(page, "Rurality");
    await expect(legend).toHaveAttribute("data-legend-scale", "segments");
    await expect(legend).toContainText(RURALITY_MORE_URBAN_LABEL);
    await expect(legend).toContainText(RURALITY_MORE_RURAL_LABEL);
    await expect(legend).toContainText(RURALITY_LEGEND_EXPLANATION);
    await expect(legend.locator("[data-legend-role='class']")).toHaveCount(9);
    await expect(
      legend.locator("[data-legend-role='class']").first().locator("span")
    ).toHaveCSS("background-color", "rgb(242, 240, 247)");
    await expect(
      legend.locator("[data-legend-role='class']").last().locator("span")
    ).toHaveCSS("background-color", "rgb(70, 33, 110)");
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

    await chooseLayer(page, "Gap review score");
    await expect(legend).toContainText("Gap review score");
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
    await legend
      .getByRole("button", { name: "About Gap review score" })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("legend-after-gap-about.png"),
    });
    await page.keyboard.press("Escape");
    await chooseLayer(page, "Rurality");
    await expect(legend.locator("[data-legend-role='class']")).toHaveCount(9);
    await expect(legend).toContainText(RURALITY_LEGEND_EXPLANATION);
    await expect(legend).not.toContainText("per 100,000");
    await legend.screenshot({
      path: testInfo.outputPath("legend-after-rucc.png"),
    });
    await chooseLayer(page, "Lyme disease incidence");
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
        action: "Insufficient data to calculate a score.",
        category: "No score available",
        name: /Gap score unavailable/,
        shot: null as string | null,
        title: "Gap score unavailable",
      },
      ...SCORE_COLOR_BANDS.map((band) => {
        const copy = operationalBandCopy(band);
        const fragment =
          band.maxExclusive === null
            ? `${band.minInclusive} or higher`
            : `${band.minInclusive} to <${band.maxExclusive}`;
        let shot: string | null = null;
        if (band.minInclusive === 50) {
          shot = "legend-tooltip-50-to-65.png";
        }
        if (band.minInclusive === 65) {
          shot = "legend-tooltip-65-to-75.png";
        }
        return {
          action: copy.action,
          category: copy.category,
          name: new RegExp(fragment.replaceAll("<", "\\<")),
          shot,
          title: copy.title,
        };
      }),
    ];

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
      const actionOverflows = await dialog
        .locator(".ux-reset-explorer-legend-disclosure-action")
        .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(actionOverflows).toBeFalsy();
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

    await legend
      .getByRole("button", { name: "About Gap review score" })
      .focus();
    await page.keyboard.press("Tab");
    const focused = page.getByRole("dialog", { name: /Gap score unavailable/ });
    await expect(focused).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(focused).toBeHidden();

    await legend.getByRole("button", { name: /50 to <65/ }).click();
    const clicked = page.getByRole("dialog", { name: /50 to <65/ });
    await expect(clicked).toBeVisible();
    await expect(clicked).toContainText(
      operationalBandCopy(bandByMinimum(50)).action
    );
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

test.describe("Blacklegged tick status legend", () => {
  test.beforeEach(async ({ page }) => {
    await installLegendApi(page);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`shows persistent tick labels at ${width}px without hover`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !releaseViewportRuns(testInfo.project.name, width),
        "Phone legend widths run in the mobile project."
      );
      await page.setViewportSize({ height: width < 700 ? 844 : 1000, width });
      await page.goto("/explore?scope=ALL&layer=tick_status");
      const legend = page.getByTestId("explorer-map-legend");
      await expect(legend).toBeVisible();
      await expect(
        legend.getByText("No records", { exact: true })
      ).toBeVisible();
      await expect(
        legend.getByText("(not zero, not confirmed absence)", { exact: true })
      ).toBeVisible();
      await expect(legend.getByText("Reported", { exact: true })).toBeVisible();
      await expect(
        legend.getByText("Established", { exact: true })
      ).toBeVisible();
      await expect(legend.getByText("Unknown", { exact: true })).toBeVisible();
      await expect(legend.getByText("Endemic", { exact: true })).toBeVisible();
      const names = await legend
        .locator("[data-legend-segment]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("aria-label"))
        );
      expect(names).toEqual([
        "No records (not zero, not confirmed absence)",
        "Reported",
        "Established",
        "Endemic",
        "Unknown",
      ]);
      await expect
        .poll(() => tickLegendGeometry(legend))
        .toEqual({
          clipped: false,
          overflow: false,
          overlap: false,
          visible: true,
        });
      await legend.screenshot({
        path: testInfo.outputPath(`tick-legend-${width}.png`),
      });
    });
  }

  test("matches map paint, keeps order across scope and layer changes, and stays operable", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL&layer=tick_status");
    const legend = page.getByTestId("explorer-map-legend");
    const region = page.getByTestId("review-national-map-region");
    await expect(region).toHaveAttribute("data-map-stage", "national");
    const paintAgreement = await page.evaluate(
      ({ endemicLabel, established, noRecords, reported, unknown }) => {
        const normalize = (value: string) => {
          const probe = document.createElement("span");
          probe.style.background = value;
          return probe.style.background;
        };
        const regionColors = new Map<string, string>();
        const raw =
          document
            .querySelector("[data-testid='review-national-map-region']")
            ?.getAttribute("data-map-colors") ?? "";
        for (const pair of raw.split(" ").filter(Boolean)) {
          const separator = pair.indexOf(":");
          regionColors.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
        const swatch = (name: string) => {
          const button = [
            ...document.querySelectorAll<HTMLElement>("[data-legend-segment]"),
          ].find((element) => element.getAttribute("aria-label") === name);
          const painted = button?.querySelector("span");
          return painted ? getComputedStyle(painted).backgroundColor : "";
        };
        const noRecordsSwatch = swatch(
          "No records (not zero, not confirmed absence)"
        );
        const endemicSwatch = swatch(endemicLabel);
        return {
          endemicDistinct: endemicSwatch !== normalize(noRecords),
          endemicMatches:
            endemicSwatch === normalize(regionColors.get("08031") ?? ""),
          established:
            swatch("Established") === normalize(established) &&
            normalize(regionColors.get("08001") ?? "") ===
              normalize(established),
          noRecords:
            noRecordsSwatch === normalize(noRecords) &&
            normalize(regionColors.get("08013") ?? "") === normalize(noRecords),
          reported:
            swatch("Reported") === normalize(reported) &&
            normalize(regionColors.get("08005") ?? "") === normalize(reported),
          unknown:
            swatch("Unknown") === normalize(unknown) &&
            normalize(regionColors.get("08014") ?? "") === normalize(unknown),
        };
      },
      {
        endemicLabel: "Endemic",
        established: TICK_STATUS_ESTABLISHED_COLOR,
        noRecords: TICK_STATUS_NO_RECORDS_COLOR,
        reported: TICK_STATUS_REPORTED_COLOR,
        unknown: TICK_STATUS_EXTRA_COLORS.Unknown,
      }
    );
    expect(paintAgreement).toEqual({
      endemicDistinct: true,
      endemicMatches: true,
      established: true,
      noRecords: true,
      reported: true,
      unknown: true,
    });

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(5);
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
    await expect(page).toHaveURL(/scope=ALL/);

    const reported = legend.getByRole("button", {
      name: "Reported",
      exact: true,
    });
    await reported.focus();
    await page.keyboard.press("Enter");
    const tip = page.getByRole("dialog", { name: /Reported/ });
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Reported");
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await reported.click();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();

    await chooseLayer(page, "Borrelia burgdorferi status");
    await expect(legend).toHaveAttribute(
      "data-legend-layer",
      "pathogen_status"
    );
    await expect(legend.getByText("No records", { exact: true })).toBeVisible();
    await expect(
      legend.getByText("(not zero, not confirmed absence)", { exact: true })
    ).toBeVisible();
    await expect(legend.getByText("Present", { exact: true })).toBeVisible();
    await expect(legend.getByText("Absent", { exact: true })).toBeVisible();
    await expect(legend.getByText("Emerging", { exact: true })).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "Established" })
    ).toHaveCount(0);
    await chooseLayer(page, "Blacklegged tick status");
    await expect(legend).toHaveAttribute("data-legend-layer", "tick_status");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(legend.getByText("No records", { exact: true })).toBeVisible();
    await expect(
      legend.getByText("(not zero, not confirmed absence)", { exact: true })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include("[data-testid='explorer-map-legend']")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("B. burgdorferi status legend", () => {
  test.beforeEach(async ({ page }) => {
    await installLegendApi(page);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`shows persistent pathogen labels at ${width}px without hover`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !releaseViewportRuns(testInfo.project.name, width),
        "Phone legend widths run in the mobile project."
      );
      await page.setViewportSize({ height: width < 700 ? 844 : 1000, width });
      await page.goto("/explore?scope=ALL&layer=pathogen_status");
      const legend = page.getByTestId("explorer-map-legend");
      await expect(legend).toBeVisible();
      await expect(
        legend.getByText("No records", { exact: true })
      ).toBeVisible();
      await expect(
        legend.getByText("(not zero, not confirmed absence)", { exact: true })
      ).toBeVisible();
      await expect(legend.getByText("Present", { exact: true })).toBeVisible();
      await expect(legend.getByText("Absent", { exact: true })).toBeVisible();
      await expect(legend.getByText("Unknown", { exact: true })).toBeVisible();
      await expect(legend.getByText("Emerging", { exact: true })).toBeVisible();
      const names = await legend
        .locator("[data-legend-segment]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("aria-label"))
        );
      expect(names).toEqual([
        "No records (not zero, not confirmed absence)",
        "Present",
        "Absent (observed zero or negative finding)",
        "Emerging",
        "Unknown",
      ]);
      await expect
        .poll(() => tickLegendGeometry(legend))
        .toEqual({
          clipped: false,
          overflow: false,
          overlap: false,
          visible: true,
        });
      const present = legend.getByRole("button", {
        name: "Present",
        exact: true,
      });
      await present.click();
      await expect(page.getByRole("dialog", { name: /Present/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await legend.screenshot({
        path: testInfo.outputPath(`pathogen-legend-${width}.png`),
      });
    });
  }

  test("matches map paint, keeps order across scope and layer changes, and stays operable", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/explore?scope=ALL&layer=pathogen_status");
    const legend = page.getByTestId("explorer-map-legend");
    const region = page.getByTestId("review-national-map-region");
    await expect(region).toHaveAttribute("data-map-stage", "national");
    const paintAgreement = await page.evaluate(
      ({ absent, emerging, noRecords, present, unknown }) => {
        const normalize = (value: string) => {
          const probe = document.createElement("span");
          probe.style.background = value;
          return probe.style.background;
        };
        const regionColors = new Map<string, string>();
        const raw =
          document
            .querySelector("[data-testid='review-national-map-region']")
            ?.getAttribute("data-map-colors") ?? "";
        for (const pair of raw.split(" ").filter(Boolean)) {
          const separator = pair.indexOf(":");
          regionColors.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
        const swatch = (name: string) => {
          const button = [
            ...document.querySelectorAll<HTMLElement>("[data-legend-segment]"),
          ].find((element) => element.getAttribute("aria-label") === name);
          const painted = button?.querySelector("span");
          return painted ? getComputedStyle(painted).backgroundColor : "";
        };
        const noRecordsSwatch = swatch(
          "No records (not zero, not confirmed absence)"
        );
        return {
          absent:
            swatch("Absent (observed zero or negative finding)") ===
              normalize(absent) &&
            normalize(regionColors.get("11001") ?? "") === normalize(absent),
          emerging:
            swatch("Emerging") === normalize(emerging) &&
            normalize(regionColors.get("36003") ?? "") ===
              normalize(emerging) &&
            normalize(emerging) !== noRecordsSwatch,
          noRecords:
            noRecordsSwatch === normalize(noRecords) &&
            normalize(regionColors.get("08001") ?? "") === normalize(noRecords),
          present:
            swatch("Present") === normalize(present) &&
            normalize(regionColors.get("08013") ?? "") === normalize(present),
          unknown:
            swatch("Unknown") === normalize(unknown) &&
            normalize(regionColors.get("08014") ?? "") === normalize(unknown) &&
            normalize(unknown) !== noRecordsSwatch,
        };
      },
      {
        absent: PATHOGEN_STATUS_EXTRA_COLORS.Absent,
        emerging: "hsl(262,46%,42%)",
        noRecords: PATHOGEN_STATUS_NO_RECORDS_COLOR,
        present: PATHOGEN_STATUS_PRESENT_COLOR,
        unknown: PATHOGEN_STATUS_EXTRA_COLORS.Unknown,
      }
    );
    expect(paintAgreement).toEqual({
      absent: true,
      emerging: true,
      noRecords: true,
      present: true,
      unknown: true,
    });

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(legend.locator("[data-legend-segment]")).toHaveCount(3);
    const coloradoNames = await legend
      .locator("[data-legend-segment]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label"))
      );
    expect(coloradoNames).toEqual([
      "No records (not zero, not confirmed absence)",
      "Present",
      "Unknown",
    ]);

    await page.goto("/explore?scope=CO&county=08013&layer=pathogen_status");
    await expect(page).toHaveURL(/county=08013/);
    await expect(legend.getByText("Present", { exact: true })).toBeVisible();
    await expect(legend.getByText("Absent", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("region", {
        name: "Published county preview for Boulder, Colorado",
      })
    ).toBeVisible();

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(legend.getByText("Absent", { exact: true })).toBeVisible();
    await expect(legend.getByText("Emerging", { exact: true })).toBeVisible();

    const present = legend.getByRole("button", {
      name: "Present",
      exact: true,
    });
    await present.focus();
    await page.keyboard.press("Enter");
    const tip = page.getByRole("dialog", { name: /Present/ });
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Present");
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await present.focus();
    await page.keyboard.press(" ");
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await present.hover();
    await expect(tip).toBeVisible();
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();

    await chooseLayer(page, "Blacklegged tick status");
    await expect(legend).toHaveAttribute("data-legend-layer", "tick_status");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(legend.getByText("Reported", { exact: true })).toBeVisible();
    await expect(
      legend.getByText("Established", { exact: true })
    ).toBeVisible();
    await expect(legend.getByText("Present", { exact: true })).toHaveCount(0);
    const tickSwatch = await legend
      .getByRole("button", { name: "Established", exact: true })
      .locator("span")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const presentProbe = await page.evaluate((color) => {
      const probe = document.createElement("span");
      probe.style.background = color;
      return probe.style.background;
    }, PATHOGEN_STATUS_PRESENT_COLOR);
    expect(tickSwatch).not.toBe(presentProbe);

    await chooseLayer(page, "Borrelia burgdorferi status");
    await expect(legend).toHaveAttribute(
      "data-legend-layer",
      "pathogen_status"
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(legend.getByText("No records", { exact: true })).toBeVisible();
    await expect(
      legend.getByText("(not zero, not confirmed absence)", { exact: true })
    ).toBeVisible();
    await expect(legend.getByText("Established", { exact: true })).toHaveCount(
      0
    );
    await expect(legend.getByText("Reported", { exact: true })).toHaveCount(0);

    const results = await new AxeBuilder({ page })
      .include("[data-testid='explorer-map-legend']")
      .analyze();
    expect(results.violations).toEqual([]);
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
