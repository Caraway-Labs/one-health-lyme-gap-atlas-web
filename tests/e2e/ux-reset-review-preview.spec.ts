import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "../fixtures/investigate-api-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";

const scoreBreakdown = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 80,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

type PreviewCounty = {
  availability?: "available" | "unavailable";
  color?: string;
  county: string;
  fips: string;
  priority?: string;
  score?: number;
  state?: string;
  stateName?: string;
};

function previewCounty(input: PreviewCounty) {
  const unavailable = input.availability === "unavailable";
  return {
    burgdorferi_status: unavailable ? "No records" : "Present",
    color: input.color ?? (unavailable ? "#e9602b" : "#a9d2db"),
    county: input.county,
    evidence_completeness: unavailable ? 20 : 100,
    fips: input.fips,
    human_status: unavailable ? "missing" : "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: input.priority ?? (unavailable ? "Priority 1 — Review" : "Lower"),
    score: { ...scoreBreakdown, score: input.score ?? 80 },
    state: input.state ?? "NY",
    state_name: input.stateName ?? "New York",
    tick_status: unavailable ? "No records" : "Established",
  };
}

function scoresPayload(counties: ReturnType<typeof previewCounty>[]) {
  return {
    counties,
    methodology_version: "1",
    release_id: "alpha-2026",
    settings: {
      ecological_share: 65,
      low_incidence_breakpoint: 10,
      missing_human_weakness: 75,
    },
  };
}

function polygon(fips: string, west: number, east: number) {
  return {
    geometry: {
      coordinates: [
        [
          [west, 41],
          [east, 41],
          [east, 45],
          [west, 45],
          [west, 41],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

const reviewSequenceCounties = [
  previewCounty({
    county: "Denver",
    fips: "08001",
    score: 70,
    state: "CO",
    stateName: "Colorado",
  }),
  ...Array.from({ length: 24 }, (_, index) =>
    previewCounty({
      availability: index === 23 ? "unavailable" : "available",
      county:
        index === 0
          ? "Albany"
          : index === 23
            ? "Suffolk"
            : `County ${index + 1}`,
      fips: String(36_001 + index).padStart(5, "0"),
      score: 100 - index,
    })
  ),
];

async function installPreviewMocks(
  page: Page,
  counties: ReturnType<typeof previewCounty>[],
  options: { failMeasures?: boolean; geometry?: boolean } = {}
) {
  const geometry =
    options.geometry === false
      ? null
      : {
          features: [polygon("36001", -80, -76), polygon("36003", -76, -72)],
          type: "FeatureCollection",
        };

  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { state_code: "CO" } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scoresPayload(counties), status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    if (!geometry) {
      await route.fulfill({
        json: { detail: "display geometry unavailable" },
        status: 503,
      });
      return;
    }
    await route.fulfill({ json: geometry, status: 200 });
  });
  await page.route("**/v1/indicators**", async (route) => {
    await route.fulfill({
      json: {
        data: investigateIndicatorsFixture,
        links: { self: "/v1/indicators" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    if (options.failMeasures) {
      await route.fulfill({
        json: { detail: "measures unavailable" },
        status: 500,
      });
      return;
    }
    const geography = new URL(route.request().url()).searchParams.get(
      "geography_type"
    );
    await route.fulfill({
      json: {
        data: investigateMeasuresFixture.filter(
          (measure) => measure.geography_semantics === geography
        ),
        links: { self: "/v1/measures" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const fips = url.searchParams.get("geography_id") ?? "";
    const measureId = url.searchParams.get("measure_id") ?? "";
    await route.fulfill({
      json: {
        data: investigateObservationsFor({
          fips,
          measureId,
          scenario: "mixed",
        }),
        links: { self: "/v1/observations" },
        meta: {},
      },
      status: 200,
    });
  });
}

async function rowVisibleInRankList(page: Page, fips: string) {
  return page.locator(`.rank-row[data-fips="${fips}"]`).evaluate((element) => {
    const list = element.closest(".rank-list");
    if (!(list instanceof HTMLElement)) {
      return false;
    }
    const rowBox = element.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    return rowBox.top >= listBox.top - 2 && rowBox.bottom <= listBox.bottom + 2;
  });
}

test.describe("Review county preview and Investigate handoff", () => {
  test("previews counties from the list, opens one, and restores Review with history", async ({
    page,
  }) => {
    await installPreviewMocks(page, reviewSequenceCounties, {
      geometry: false,
    });
    await page.goto(
      "/app/review?period=2023-01-01&dataset=alpha-2026&sort=score&page=2&compare=08001,08013"
    );
    await expect(page.getByTestId("review-scope-results")).toHaveAttribute(
      "data-rendered-scope",
      "CO"
    );

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    const albany = page.getByTestId("review-county-preview");
    await expect(albany).toHaveAttribute("data-fips", "36001");
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).not.toHaveURL(/\/app\/investigate/);
    await expect(albany).toHaveAttribute(
      "data-follow-up",
      "Continue routine review"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).toHaveURL(/sort=score/);
    await expect(page).toHaveURL(/page=2/);

    const suffolkRow = page.locator('.rank-row[data-fips="36024"]');
    await suffolkRow.click();
    const suffolk = page.getByTestId("review-county-preview");
    await expect(suffolk).toHaveAttribute("data-fips", "36024");
    await expect(page).toHaveURL(/\/app\/review\?/);
    await expect(page).not.toHaveURL(/\/app\/investigate/);
    const previewState = await suffolk.evaluate((element) => ({
      availability: element.getAttribute("data-availability"),
      caveat: element.getAttribute("data-caveat"),
      fips: element.getAttribute("data-fips"),
      followUp: element.getAttribute("data-follow-up"),
      target: element.getAttribute("data-target"),
      why: element.getAttribute("data-why"),
    }));
    expect(previewState).toMatchObject({
      availability: "unavailable",
      fips: "36024",
      followUp: "Prioritize targeted follow-up",
    });
    expect(previewState.why).toContain("Highest review priority");
    expect(previewState.why).toContain("unavailable");
    expect(previewState.caveat).toContain("not treated as zero");
    expect(`${previewState.why} ${previewState.caveat}`).not.toMatch(/0 cases/);
    expect(previewState.target).toContain("county=36024");
    expect(previewState.target).toContain("scope=NY");
    expect(previewState.target).toContain("dataset=alpha-2026");
    expect(previewState.target).toContain("period=2023-01-01");
    expect(previewState.target).not.toContain("sort=");
    expect(previewState.target).not.toContain("page=");
    expect(previewState.target).not.toContain("compare=");
    await expect(page.getByTestId("review-preview-dropped")).toContainText(
      "Review sort stays on Review"
    );
    await expect(page.getByTestId("review-preview-guardrail")).toContainText(
      "not a diagnosis"
    );
    expect(await rowVisibleInRankList(page, "36024")).toBe(true);

    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=36024/);
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).not.toHaveURL(/sort=/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page).not.toHaveURL(/compare=/);
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "36024"
    );
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-release",
      "alpha-2026"
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Suffolk");

    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).toHaveURL(/county=36024/);
    await expect(page).toHaveURL(/sort=score/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36024"
    );
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
    await expect(page.getByTestId("review-scope-select")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View full county list" })
    ).toBeVisible();
    await expect.poll(() => rowVisibleInRankList(page, "36024")).toBe(true);
    await expect(page.locator('.rank-row[data-fips="36024"]')).toBeFocused();

    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "36024"
    );

    await page.goBack({ waitUntil: "commit" });
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36024"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).toHaveURL(/sort=score/);
    await expect(page.locator('.rank-row[data-fips="36024"]')).toBeFocused();
  });

  test("opens the same Investigate county from the map and the list", async ({
    page,
  }) => {
    const counties = [
      previewCounty({
        county: "Denver",
        fips: "08001",
        state: "CO",
        stateName: "Colorado",
      }),
      previewCounty({ county: "Albany", fips: "36001", score: 90 }),
      previewCounty({
        availability: "unavailable",
        county: "Orange",
        fips: "36003",
        score: 40,
      }),
    ];
    await installPreviewMocks(page, counties);
    await page.goto(
      "/app/review?scope=NY&dataset=alpha-2026&period=2023-01-01&sort=score"
    );
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36001"
    );
    await page.locator('.rank-row[data-fips="36001"]').click();
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).not.toHaveURL(/\/app\/investigate/);
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /county=36001/
    );

    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    // The state frame shows both counties. Selecting from the list afterwards
    // can zoom the camera onto that county, so the map click happens first.
    await page.waitForTimeout(1500);
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) {
      return;
    }
    const mapPoints = [
      [0.72, 0.5],
      [0.82, 0.46],
      [0.64, 0.58],
    ] as const;
    for (const [xFraction, yFraction] of mapPoints) {
      await page.mouse.click(
        box.x + box.width * xFraction,
        box.y + box.height * yFraction
      );
      const selected = await page
        .getByTestId("review-county-preview")
        .getAttribute("data-fips");
      if (selected === "36003") {
        break;
      }
    }
    const mapPreview = page.getByTestId("review-county-preview");
    await expect(mapPreview).toHaveAttribute("data-fips", "36003");
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).not.toHaveURL(/\/app\/investigate/);
    const mapHref =
      (await page.getByTestId("review-investigate").getAttribute("href")) ?? "";
    expect(mapHref).toContain("county=36003");
    expect(mapHref).toContain("scope=NY");
    expect(mapHref).toContain("dataset=alpha-2026");
    expect(mapHref).toContain("period=2023-01-01");
    expect(mapHref).not.toContain("sort=");

    await page.locator('.rank-row[data-fips="36001"]').click();
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36001"
    );
    await expect(page).not.toHaveURL(/\/app\/investigate/);
    await page.locator('.rank-row[data-fips="36003"]').click();
    const listPreview = page.getByTestId("review-county-preview");
    await expect(listPreview).toHaveAttribute("data-fips", "36003");
    const listHref =
      (await page.getByTestId("review-investigate").getAttribute("href")) ?? "";
    expect(listHref).toBe(mapHref);

    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=36003/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orange");
  });

  test("keeps a direct county link and reload on the preview", async ({
    page,
  }, testInfo) => {
    await installPreviewMocks(page, reviewSequenceCounties, {
      geometry: false,
    });
    await page.goto(
      "/app/review?scope=NY&county=36005&dataset=alpha-2026&period=2023-01-01"
    );
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36005"
    );
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /county=36005/
    );
    await page.reload();
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36005"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .include('[data-testid="review-county-preview"]')
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("keeps duplicate county names distinct by FIPS", async ({ page }) => {
    await installPreviewMocks(
      page,
      [
        previewCounty({ county: "Jefferson", fips: "36045", score: 88 }),
        previewCounty({
          color: "#efc64a",
          county: "Jefferson",
          fips: "36047",
          priority: "Priority 2 — Review",
          score: 70,
        }),
      ],
      { geometry: false }
    );
    await page.goto("/app/review?scope=NY");
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36045"
    );
    await page.locator('.rank-row[data-fips="36047"]').click();
    const preview = page.getByTestId("review-county-preview");
    await expect(preview).toHaveAttribute("data-fips", "36047");
    await expect(preview).toContainText("Jefferson, New York");
    await expect(page.getByTestId("review-preview-identity")).toContainText(
      "FIPS 36047"
    );
    await expect(preview).toHaveAttribute(
      "data-follow-up",
      "Conduct targeted follow-up"
    );
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /county=36047/
    );
    await expect(page).not.toHaveURL(/county=36045/);
  });

  test("returns to the same Review selection when Investigate fails to load", async ({
    page,
  }) => {
    await installPreviewMocks(page, reviewSequenceCounties, {
      failMeasures: true,
      geometry: false,
    });
    await page.goto(
      "/app/review?scope=NY&county=36024&dataset=alpha-2026&period=2023-01-01&sort=score"
    );
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36024"
    );
    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(
      page.getByText("Governed measures could not be loaded.")
    ).toBeVisible();
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "36024"
    );
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(/county=36024/);
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).toHaveURL(/sort=score/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "36024"
    );
    await expect(page.getByTestId("review-scope-status")).toContainText(
      "New York"
    );
  });
});
