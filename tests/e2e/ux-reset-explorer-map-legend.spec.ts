import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
        json: { profile: { state_code: "CO" } },
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
    await route.fulfill({ json: {}, status: 404 });
  });
}

async function legendSwatchesFit(
  legend: ReturnType<Page["getByTestId"]>
): Promise<{ clipped: boolean; visible: boolean }> {
  return legend.evaluate((element) => {
    const card = element.closest(".ux-reset-explorer-map");
    if (!card) {
      return { clipped: true, visible: false };
    }
    const cardBox = card.getBoundingClientRect();
    const legendBox = element.getBoundingClientRect();
    const clipped =
      legendBox.top < cardBox.top - 1 || legendBox.bottom > cardBox.bottom + 1;
    const items = [...element.querySelectorAll("li")];
    if (items.length === 0) {
      return { clipped, visible: false };
    }
    element.scrollTop = 0;
    for (const item of items) {
      const before = item.getBoundingClientRect();
      const view = element.getBoundingClientRect();
      if (before.height > view.height + 2) {
        return { clipped, visible: false };
      }
      if (before.top < view.top) {
        element.scrollTop -= view.top - before.top;
      } else if (before.bottom > view.bottom) {
        element.scrollTop += before.bottom - view.bottom;
      }
      const after = item.getBoundingClientRect();
      const scrolled = element.getBoundingClientRect();
      const inside =
        after.top >= scrolled.top - 2 && after.bottom <= scrolled.bottom + 2;
      if (!inside) {
        return { clipped, visible: false };
      }
    }
    return { clipped, visible: true };
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
    await expect(legend).toContainText("CDC Lyme surveillance 2023");
    await expect(legend).toContainText("not personal disease risk");
    await expect(legend).toContainText(
      "0 to less than 20 · Lower Atlas priority — Not a safety finding"
    );
    await expect(legend).toContainText(
      "20 to less than 35 · Lower Atlas priority — Not a safety finding; Watch — Monitor signals"
    );
    await expect(legend).toContainText(
      "75 or higher · Priority 1 — Investigate"
    );
    await expect(legend).toContainText(
      "No published value · Not zero, not low priority, and not confirmed absence"
    );
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, visible: true });

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page).toHaveURL(/scope=CO/);
    await expect(legend).toContainText("0 to less than 20");
    await expect(legend).toContainText("75 or higher");
    await expect(legend).not.toContainText("Watch — Monitor signals");
    await expect(legend).toContainText("No published value");
    await expect(page.getByTestId("review-state-map-region")).toHaveAttribute(
      "data-map-colors",
      /08014:/
    );

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "United States" }).click();
    await expect(page).toHaveURL(/scope=ALL/);
    await expect(legend).toContainText("Watch — Monitor signals");
    await expect(legend).toContainText("Atlas gap score");

    await chooseLayer(page, "Blacklegged tick status");
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(legend).toContainText("Blacklegged tick status");
    await expect(legend).toContainText("published status category");
    await expect(legend).toContainText(
      "CDC ArboNET county tick status through 2025-12-31"
    );
    await expect(legend).not.toContainText("CDC Lyme surveillance");
    await expect(legend).toContainText("Established");
    await expect(legend).toContainText(
      "No records (not zero, not confirmed absence)"
    );
    await expect(legend).toContainText(
      "Unknown (not zero, not confirmed absence)"
    );
    await expect(legend).not.toContainText("0 to less than 20");
    await expect(legend).not.toContainText("not personal disease risk");
    await expect
      .poll(() => legendSwatchesFit(legend))
      .toEqual({ clipped: false, visible: true });

    await chooseLayer(page, "B. burgdorferi status");
    await expect(legend).toContainText("B. burgdorferi status");
    await expect(legend).toContainText(
      "Absent (observed zero or negative finding)"
    );
    await expect(legend).toContainText("Present");
    await expect(legend).not.toContainText("Established");
    await expect(legend).toContainText("CDC ArboNET tickborne pathogen status");

    await chooseLayer(page, "County boundaries");
    await expect(legend).toContainText("County boundary");
    await expect(legend).toContainText("not an evidence layer");
    await expect(legend).not.toContainText("Present");
    await expect(legend).not.toContainText("75 or higher");

    await chooseLayer(page, "Atlas gap score");
    await expect(legend).toContainText("0 to less than 20");
    await expect(legend).not.toContainText("County boundary");
  });

  test("keeps the latest layer after rapid switches and leaves unsupported layers unpainted", async ({
    page,
  }) => {
    await page.goto("/explore?scope=ALL");
    const legend = page.getByTestId("explorer-map-legend");
    await expect(legend).toContainText("0 to less than 20");
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Blacklegged tick status" }).click();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "B. burgdorferi status" }).click();
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Atlas gap score" }).click();
    await expect
      .poll(async () => legend.innerText())
      .toContain("0 to less than 20");
    await expect(legend).not.toContainText("Established");
    await expect(legend).not.toContainText("Present");

    await chooseLayer(page, "Lyme incidence floor");
    await expect(legend).toContainText(
      "No admitted observations were published for this measure on the current release."
    );
    await expect(legend).toHaveAttribute("data-legend-kind", "unavailable");
    await expect(legend).not.toContainText("lower bound");
    await expect(legend).not.toContainText("per 100,000");
    await page.getByTestId("explorer-map-layer").click();
    await expect(
      page.getByRole("option", { name: "Lyme incidence floor (unavailable)" })
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    await chooseLayer(page, "Atlas gap score");
    await expect(legend).toContainText("Atlas gap score");
    await expect(legend).toContainText("0 to less than 20");
    await expect(legend).not.toContainText(
      "No admitted observations were published for this measure on the current release."
    );

    const results = await new AxeBuilder({ page })
      .include("[data-testid='explorer-map-legend']")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
