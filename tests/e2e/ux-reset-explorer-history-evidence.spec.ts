import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { ValueState, type Observation } from "@/generated/models";

import {
  compareCountyDetail,
  compareObservation,
} from "../fixtures/compare-api-fixtures";
import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_CONTEXT_MEASURE_ID,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
} from "../fixtures/investigate-api-fixtures";
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";
import { releaseViewportRuns } from "./release-phone-viewport";

const RELEASE_ID = "alpha-2026";
const PERIOD = "2023-01-01";
const HYDRATION_FLAG = "atlas458HydrationBack";

const DENVER = "08001";
const BOULDER = "08013";
const LATE_A = "08031";
const LATE_B = "08035";
const SUPPRESSED_FIPS = "08041";
const UNAVAILABLE_FIPS = "08059";
const PARTIAL_FIPS = "08069";
const ZERO_FIPS = "08014";
const MISSING_FIPS = "08123";
const ERROR_FIPS = "08019";

const RANK_41_INDEX = 40;

type ScoreCounty = {
  burgdorferi_status: string;
  color: string;
  county: string;
  evidence_completeness: number;
  fips: string;
  scoring_methodology_version?: "surveillance-gap-score-v1.1";
  human_status: string;
  in_contiguous_tick_scope: boolean;
  priority: string;
  score: {
    access_signal: number;
    community: number;
    ecological: number;
    human_weakness: number;
    pathogen_signal: number;
    rural_signal: number;
    score: number;
    svi_signal: number;
    tick_signal: number;
  };
  state: string;
  state_name: string;
  tick_status: string;
};

type CountyCase = {
  completeness: number;
  county: string;
  fips: string;
  human: string;
  pathogen: string;
  score: number;
  state?: string;
  stateName?: string;
  tick: string;
};

function scoreCounty(input: CountyCase): ScoreCounty {
  return {
    burgdorferi_status: input.pathogen,
    color: "#a9d2db",
    county: input.county,
    evidence_completeness: input.completeness,
    fips: input.fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: input.human,
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 10,
      community: 10,
      ecological: 10,
      human_weakness: 10,
      pathogen_signal: 10,
      rural_signal: 10,
      score: input.score,
      svi_signal: 10,
      tick_signal: 10,
    },
    state: input.state ?? "CO",
    state_name: input.stateName ?? "Colorado",
    tick_status: input.tick,
  };
}

function georgiaCounties(): ScoreCounty[] {
  return Array.from({ length: 45 }, (_, index) => {
    const fips = String(13_001 + index * 2).padStart(5, "0");
    return scoreCounty({
      completeness: 80,
      county: `Georgia County ${index + 1}`,
      fips,
      human: "published_count_floor",
      pathogen: "Present",
      score: 100 - index,
      state: "GA",
      stateName: "Georgia",
      tick: "Established",
    });
  });
}

const evidenceCounties: ScoreCounty[] = [
  scoreCounty({
    completeness: 40,
    county: "Suppressed County",
    fips: SUPPRESSED_FIPS,
    human: "suppressed",
    pathogen: "Present",
    score: 70,
    tick: "Established",
  }),
  scoreCounty({
    completeness: 0,
    county: "Unavailable County",
    fips: UNAVAILABLE_FIPS,
    human: "no_county_linked_record",
    pathogen: "No records",
    score: 60,
    tick: "No records",
  }),
  scoreCounty({
    completeness: 40,
    county: "Partial County",
    fips: PARTIAL_FIPS,
    human: "missing",
    pathogen: "No records",
    score: 55,
    tick: "No records",
  }),
  scoreCounty({
    completeness: 80,
    county: "Zero County",
    fips: ZERO_FIPS,
    human: "published_count_floor",
    pathogen: "Present",
    score: 50,
    tick: "Established",
  }),
  scoreCounty({
    completeness: 80,
    county: "Missing County",
    fips: MISSING_FIPS,
    human: "missing",
    pathogen: "Present",
    score: 45,
    tick: "Established",
  }),
  scoreCounty({
    completeness: 80,
    county: "Error County",
    fips: ERROR_FIPS,
    human: "published_count_floor",
    pathogen: "Present",
    score: 44,
    tick: "Established",
  }),
  scoreCounty({
    completeness: 80,
    county: "Late Alpha",
    fips: LATE_A,
    human: "published_count_floor",
    pathogen: "Present",
    score: 43,
    tick: "Established",
  }),
  scoreCounty({
    completeness: 80,
    county: "Late Bravo",
    fips: LATE_B,
    human: "published_count_floor",
    pathogen: "Present",
    score: 42,
    tick: "Established",
  }),
];

function detailFor(county: ScoreCounty) {
  const base = compareCountyDetail(county.fips);
  const absent = county.human_status !== "published_count_floor";
  const zero = county.fips === ZERO_FIPS;
  return {
    ...base,
    burgdorferi_status: county.burgdorferi_status,
    case_count_floor_2023: zero ? 0 : absent ? null : 12,
    color: county.color,
    county: county.county,
    evidence_completeness: county.evidence_completeness,
    fips: county.fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: county.human_status,
    incidence_floor_2023: zero ? 0 : absent ? null : 4.2,
    pacificus_status: "No records",
    priority: county.priority,
    population: county.fips === UNAVAILABLE_FIPS ? null : base.population,
    rucc_2023: county.fips === UNAVAILABLE_FIPS ? null : 2,
    state_unallocated_records_2023:
      county.fips === UNAVAILABLE_FIPS
        ? null
        : base.state_unallocated_records_2023,
    scapularis_status:
      county.tick_status === "No records" ? "No records" : "Established",
    score: county.score,
    state: county.state,
    state_name: county.state_name,
    svi_percentile: county.fips === UNAVAILABLE_FIPS ? null : 0.42,
    tick_status: county.tick_status,
    uninsured_percent: county.fips === UNAVAILABLE_FIPS ? null : 9.1,
  };
}

function observationFor(input: {
  fips: string;
  measureId: string;
  sourceLabel: string;
  unit: string;
  value: number | null;
  valueState: (typeof ValueState)[keyof typeof ValueState];
}): Observation {
  const row = compareObservation({
    fips: input.fips,
    measureId: input.measureId,
    unit: input.unit,
    value: input.value,
    valueState: input.valueState,
  });
  return {
    ...row,
    source_label: input.sourceLabel,
    source_url: input.sourceLabel ? "https://www.cdc.gov/" : null,
    source_vintage: input.sourceLabel ? "2023" : null,
  };
}

type RouteOptions = {
  candidates?: { county: string; fips: string; state: string }[];
  counties: ScoreCounty[];
  delayFips?: string;
  errorFips?: string;
  observations?: (fips: string, measureId: string) => Observation[];
  onLateArrival?: () => void;
  onLateSettled?: () => void;
  releaseLate?: Promise<void>;
  states?: { code: string; name: string }[];
};

async function installExplorer(page: Page, options: RouteOptions) {
  const metadata = {
    ...reviewScopeMetadataFixture,
    release_id: RELEASE_ID,
    states: options.states ?? [
      { code: "CO", name: "Colorado" },
      { code: "GA", name: "Georgia" },
    ],
  };
  const scores = {
    counties: options.counties,
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    methodology_version: "1",
    release_id: RELEASE_ID,
    settings: {
      ecological_share: 65,
      smooth_k: 50,
      missing_human_weakness: 75,
    },
  };
  await fulfillCompletedStartingView(page);
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({
      json: { detail: "Atlas data service is unavailable." },
      status: 503,
    });
  });
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: metadata, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: scores, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { features: [], type: "FeatureCollection" },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const matches = (options.candidates ?? []).filter(
      (county) => county.state === state
    );
    await route.fulfill({
      json: buildStateReview({
        candidates: matches.map((county) =>
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: county.county,
            fips: county.fips,
            reasonText: `${county.county} is included because the review method returned it.`,
          })
        ),
        resultState: matches.length > 0 ? "candidates_found" : "none_stand_out",
        state,
      }),
      status: 200,
    });
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
    await route.fulfill({
      json: {
        data: investigateMeasuresFixture,
        links: { self: "/v1/measures" },
        meta: {},
      },
      status: 200,
    });
  });
  await page.route("**/v1/counties/*", async (route) => {
    const url = route.request().url();
    if (url.includes("/availability") || url.includes("/tier1-")) {
      await route.fallback();
      return;
    }
    const fips = new URL(url).pathname.split("/").at(-1) ?? "";
    const county = options.counties.find((entry) => entry.fips === fips);
    if (!county) {
      await route.fulfill({
        json: { detail: "No published record" },
        status: 404,
      });
      return;
    }
    await route.fulfill({ json: detailFor(county), status: 200 });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const fips = url.searchParams.get("geography_id") ?? "";
    const measureId = url.searchParams.get("measure_id") ?? "";
    if (
      options.errorFips === fips &&
      measureId === INVESTIGATE_CASES_MEASURE_ID
    ) {
      await route.fulfill({
        json: { detail: "Observation request failed." },
        status: 500,
      });
      return;
    }
    const delayThisResponse = fips === options.delayFips;
    if (delayThisResponse) {
      options.onLateArrival?.();
      if (options.releaseLate) {
        await options.releaseLate;
      }
    }
    const data = options.observations?.(fips, measureId) ?? [];
    await route.fulfill({
      json: { data, links: { self: "/v1/observations" }, meta: {} },
      status: 200,
    });
    if (delayThisResponse) {
      options.onLateSettled?.();
    }
  });
}

function exploreHref(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/explore?${search.toString()}`;
}

async function installHydrationBoundary(page: Page) {
  await page.addInitScript((flag: string) => {
    const proto = History.prototype.replaceState;
    let current: typeof proto = proto;
    const trace: { afterBack: string; before: string; write: string }[] = [];
    Object.defineProperty(history, "replaceState", {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (next: typeof proto) => {
        current = function replaceState(this: History, ...args) {
          const data = args[0];
          const record =
            data && typeof data === "object"
              ? (data as Record<string, unknown>)
              : null;
          if (
            window.sessionStorage.getItem(flag) === "hold" &&
            record &&
            Object.hasOwn(record, "__NA")
          ) {
            window.sessionStorage.setItem(flag, "fired");
            const before = window.location.href;
            window.history.back();
            trace.push({
              afterBack: window.location.href,
              before,
              write: args[2] == null ? "" : String(args[2]),
            });
            (
              window as Window & {
                __atlas458Trace?: {
                  afterBack: string;
                  before: string;
                  write: string;
                }[];
              }
            ).__atlas458Trace = trace;
            window.sessionStorage.setItem(
              `${flag}:trace`,
              JSON.stringify(trace)
            );
          }
          return next.apply(this, args as unknown as Parameters<typeof proto>);
        } as typeof proto;
      },
    });
  }, HYDRATION_FLAG);
}

async function expectHydrationSettled(
  page: Page,
  expected: { county: string; fips: string }
) {
  await expect
    .poll(async () => {
      try {
        const flag = await page.evaluate(
          (storageKey) => window.sessionStorage.getItem(storageKey),
          HYDRATION_FLAG
        );
        const url = new URL(page.url());
        return `${flag}|${url.pathname}|${url.searchParams.get("county")}`;
      } catch {
        return "navigating";
      }
    })
    .toBe(`fired|/explore|${expected.fips}`);
  await expectBrowseCounty(page, {
    county: expected.county,
    fips: expected.fips,
    scope: "CO",
  });
}

async function readHydrationTrace(page: Page) {
  return page.evaluate((flag) => {
    const traced = (
      window as Window & {
        __atlas458Trace?: {
          afterBack: string;
          before: string;
          write: string;
        }[];
      }
    ).__atlas458Trace;
    if (traced && traced.length > 0) {
      return traced;
    }
    const stored = window.sessionStorage.getItem(`${flag}:trace`);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as {
      afterBack: string;
      before: string;
      write: string;
    }[];
  }, HYDRATION_FLAG);
}

async function expectBrowseCounty(
  page: Page,
  expected: { county: string; fips: string; scope: string }
) {
  await expect(page.getByTestId("review-scope-results")).toBeVisible();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/explore");
  expect(url.searchParams.get("county")).toBe(expected.fips);
  expect(url.searchParams.get("scope")).toBe(expected.scope);
  expect(url.searchParams.get("dataset")).toBe(RELEASE_ID);
  expect(url.searchParams.get("period")).toBe(PERIOD);
  expect(url.searchParams.get("mode")).toBeNull();
  const preview = page.locator(
    "[data-testid='review-county-preview'], [data-testid='review-published-county-preview']"
  );
  await expect(preview).toHaveAttribute("data-fips", expected.fips);
  await expect(preview.getByRole("heading", { level: 2 })).toContainText(
    expected.county
  );
  await expect(page.getByText(`FIPS ${expected.fips}`).first()).toBeVisible();
  await expect(
    page.locator(`button[data-fips="${expected.fips}"]`)
  ).toHaveAttribute("aria-current", "true");
}

async function stampDocument(page: Page) {
  await page.evaluate(() => {
    (window as Window & { __atlas458Stamp?: number }).__atlas458Stamp = 1;
  });
}

async function expectDocumentStamp(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __atlas458Stamp?: number }).__atlas458Stamp ?? 0
      )
    )
    .toBe(1);
}

function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes("mobile");
}

test.describe("Explorer same-route history during hydration", () => {
  test("keeps the browser-selected county when Back happens before hydration settles", async ({
    page,
  }, testInfo) => {
    test.skip(isMobile(testInfo), "Desktop Chromium owns the hydration race.");
    const counties = [
      scoreCounty({
        completeness: 80,
        county: "Denver",
        fips: DENVER,
        human: "published_count_floor",
        pathogen: "Present",
        score: 80,
        tick: "Established",
      }),
      scoreCounty({
        completeness: 80,
        county: "Boulder",
        fips: BOULDER,
        human: "published_count_floor",
        pathogen: "Present",
        score: 70,
        tick: "Established",
      }),
    ];
    await installHydrationBoundary(page);
    await installExplorer(page, {
      candidates: counties.map((county) => ({
        county: county.county,
        fips: county.fips,
        state: county.state,
      })),
      counties,
    });
    await page.goto(
      exploreHref({
        county: DENVER,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "CO",
      })
    );
    await expectBrowseCounty(page, {
      county: "Denver",
      fips: DENVER,
      scope: "CO",
    });
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Ranked counties" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-county-evidence")).toHaveCount(0);

    await page.locator(`button[data-fips="${BOULDER}"]`).click();
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });
    const boulderUrl = new URL(page.url());
    expect(boulderUrl.pathname).toBe("/explore");
    expect(boulderUrl.search).not.toBe(`?county=${DENVER}`);

    await page.evaluate((flag) => {
      window.sessionStorage.setItem(flag, "hold");
    }, HYDRATION_FLAG);
    await page.reload();
    // Back runs inside the hydration replaceState for the reloaded Boulder
    // document, and the address bar does not move until that traversal is
    // delivered. If it arrives before the App Router listener exists, the
    // guard reloads Denver as a document. If the listener exists first, Next
    // restores Denver in the loaded document. Either path has to leave the
    // browser-selected county on screen. A document request is not required.
    await expectHydrationSettled(page, { county: "Denver", fips: DENVER });
    await expect(page.getByTestId("review-county-preview")).not.toContainText(
      "Boulder"
    );
    const trace = await readHydrationTrace(page);
    expect(trace[0]?.before).toContain(`county=${BOULDER}`);
    expect(trace[0]?.afterBack).toContain(`county=${BOULDER}`);
    expect(trace[0]?.write).toContain(`county=${BOULDER}`);
    await testInfo.attach("hydration-back-trace", {
      body: JSON.stringify(trace, null, 2),
      contentType: "application/json",
    });

    await page.goForward({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });

    await stampDocument(page);
    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Blacklegged tick status" }).click();
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(page).toHaveURL(new RegExp(`county=${BOULDER}`));
    await expectDocumentStamp(page);
    await expect(page.getByTestId("explorer-map-layer")).toContainText(
      "Blacklegged tick status"
    );

    const compare = page.getByTestId("review-compare");
    await compare.click();
    await expect(page).toHaveURL(/\/compare/);
    const compareUrl = new URL(page.url());
    expect(compareUrl.searchParams.get("county")).toBe(BOULDER);
    expect(compareUrl.searchParams.get("scope")).toBe("CO");
    expect(compareUrl.searchParams.get("dataset")).toBe(RELEASE_ID);
    expect(compareUrl.searchParams.get("period")).toBe(PERIOD);
    expect(compareUrl.searchParams.get("layer")).toBeNull();
    expect(compareUrl.searchParams.get("mode")).toBeNull();
    await page.goBack({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });

    await page.getByTestId("review-ask-atlas").click();
    await expect(page).toHaveURL(/\/askatlas/);
    const askUrl = new URL(page.url());
    expect(askUrl.searchParams.get("county")).toBe(BOULDER);
    expect(askUrl.searchParams.get("dataset")).toBe(RELEASE_ID);
    expect(askUrl.searchParams.get("scope")).toBeNull();
    expect(askUrl.searchParams.get("period")).toBeNull();
    expect(askUrl.searchParams.get("layer")).toBeNull();
    expect(askUrl.searchParams.get("mode")).toBeNull();
  });

  test("restores settled Back and Forward after hydration", async ({
    page,
  }, testInfo) => {
    test.skip(
      isMobile(testInfo),
      "The mobile viewport test covers settled history."
    );
    const counties = [
      scoreCounty({
        completeness: 80,
        county: "Denver",
        fips: DENVER,
        human: "published_count_floor",
        pathogen: "Present",
        score: 80,
        tick: "Established",
      }),
      scoreCounty({
        completeness: 80,
        county: "Boulder",
        fips: BOULDER,
        human: "published_count_floor",
        pathogen: "Present",
        score: 70,
        tick: "Established",
      }),
    ];
    await installExplorer(page, {
      candidates: counties.map((county) => ({
        county: county.county,
        fips: county.fips,
        state: county.state,
      })),
      counties,
    });
    await page.goto(
      exploreHref({
        county: DENVER,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "CO",
      })
    );
    await page.locator(`button[data-fips="${BOULDER}"]`).click();
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });
    await page.reload();
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });
    await page.goBack({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: "Denver",
      fips: DENVER,
      scope: "CO",
    });
    await page.goForward({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: "Boulder",
      fips: BOULDER,
      scope: "CO",
    });
  });

  test("keeps a cross-route Back after Compare reloads", async ({
    page,
  }, testInfo) => {
    test.skip(
      isMobile(testInfo),
      "Desktop Chromium owns the reload Back case."
    );
    const counties = [
      scoreCounty({
        completeness: 80,
        county: "Denver",
        fips: DENVER,
        human: "published_count_floor",
        pathogen: "Present",
        score: 80,
        tick: "Established",
      }),
    ];
    await installHydrationBoundary(page);
    await installExplorer(page, {
      candidates: [{ county: "Denver", fips: DENVER, state: "CO" }],
      counties,
    });
    await page.goto(
      exploreHref({
        county: DENVER,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "CO",
      })
    );
    await expectBrowseCounty(page, {
      county: "Denver",
      fips: DENVER,
      scope: "CO",
    });
    await page.getByTestId("review-compare").click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await page.evaluate((flag) => {
      window.sessionStorage.setItem(flag, "hold");
    }, HYDRATION_FLAG);
    await page.reload();
    await expectHydrationSettled(page, { county: "Denver", fips: DENVER });
    await expect(page).not.toHaveURL(/\/compare/);
    const trace = await readHydrationTrace(page);
    await testInfo.attach("compare-reload-back-trace", {
      body: JSON.stringify(trace, null, 2),
      contentType: "application/json",
    });
  });
});

test.describe("Explorer evidence beyond the initial rank window", () => {
  test("opens evidence for rank 41 and returns to that county", async ({
    page,
  }, testInfo) => {
    test.skip(
      isMobile(testInfo),
      "A mobile viewport test covers the same return path."
    );
    const counties = georgiaCounties();
    const rank41 = counties[RANK_41_INDEX];
    if (!rank41) {
      throw new Error("expected a rank 41 county");
    }
    await installExplorer(page, {
      candidates: counties.map((county) => ({
        county: county.county,
        fips: county.fips,
        state: county.state,
      })),
      counties,
    });
    await page.goto(
      exploreHref({
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "GA",
      })
    );
    await expect(page.getByTestId("review-scope-results")).toBeVisible();
    const row = page.locator('button[data-rank="41"]');
    await expect(row).toHaveAttribute("data-fips", rank41.fips);
    await row.click();
    await expectBrowseCounty(page, {
      county: rank41.county,
      fips: rank41.fips,
      scope: "GA",
    });
    await expect(page.getByTestId("explorer-county-evidence")).toHaveCount(0);
    await expect(page.getByTestId("review-view-county-evidence")).toBeVisible();

    await page.getByTestId("explorer-map-layer").click();
    await page.getByRole("option", { name: "Blacklegged tick status" }).click();
    await expect(page).toHaveURL(/layer=tick_status/);

    await page.getByTestId("review-view-county-evidence").click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page).toHaveURL(new RegExp(`county=${rank41.fips}`));
    await expect(page).toHaveURL(/scope=GA/);
    await expect(page).toHaveURL(new RegExp(`dataset=${RELEASE_ID}`));
    await expect(page).toHaveURL(new RegExp(`period=${PERIOD}`));
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(page.getByTestId("explorer-county-evidence")).toHaveAttribute(
      "data-county",
      rank41.fips
    );
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      rank41.county
    );
    await expect(page.getByTestId("explorer-county-heading")).toBeFocused();
    await expect(page.getByTestId("explorer-county-identity")).toContainText(
      `FIPS ${rank41.fips}`
    );
    await expect(page.getByTestId("review-scope-results")).toBeHidden();

    await page.getByTestId("explorer-back-to-map").click();
    await expectBrowseCounty(page, {
      county: rank41.county,
      fips: rank41.fips,
      scope: "GA",
    });
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).toBeFocused();
    await expect(page.locator('button[data-rank="1"]')).not.toHaveAttribute(
      "aria-current",
      "true"
    );

    await page.getByTestId("review-view-county-evidence").click();
    await expect(page).toHaveURL(/mode=evidence/);
    await page.goBack({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: rank41.county,
      fips: rank41.fips,
      scope: "GA",
    });
    await expect(page).toHaveURL(/layer=tick_status/);
    await expect(page.locator('button[data-rank="1"]')).not.toHaveAttribute(
      "aria-current",
      "true"
    );

    await page.getByTestId("review-view-county-evidence").click();
    await expect(page).toHaveURL(/mode=evidence/);
    await page.reload();
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      rank41.county
    );
    await expect(page).toHaveURL(/mode=evidence/);
    await page.goBack({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: rank41.county,
      fips: rank41.fips,
      scope: "GA",
    });
    await page.goForward({ waitUntil: "commit" });
    await expect(page.getByTestId("explorer-county-evidence")).toHaveAttribute(
      "data-county",
      rank41.fips
    );
    await page.goBack({ waitUntil: "commit" });
    await expectBrowseCounty(page, {
      county: rank41.county,
      fips: rank41.fips,
      scope: "GA",
    });

    await page.goto(
      exploreHref({
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "GA",
      })
    );
    await expect(page.getByTestId("review-scope-results")).toBeVisible();
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).not.toHaveAttribute("aria-current", "true");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.sessionStorage.getItem("ux-reset-review-return-focus")
        )
      )
      .toBeNull();
    const fresh = new URL(page.url());
    expect(fresh.searchParams.get("county")).not.toBe(rank41.fips);

    await page.getByTestId("review-compare").click();
    await expect(page).toHaveURL(/\/compare/);
    const compareUrl = new URL(page.url());
    expect(compareUrl.searchParams.get("scope")).toBe("GA");
    expect(compareUrl.searchParams.get("dataset")).toBe(RELEASE_ID);
    expect(compareUrl.searchParams.get("period")).toBe(PERIOD);
    expect(compareUrl.searchParams.get("mode")).toBeNull();
    expect(compareUrl.searchParams.get("layer")).toBeNull();
  });

  test("selects a national county outside the 40-county shortlist from the picker", async ({
    page,
  }) => {
    const counties = georgiaCounties();
    const rank41 = counties[RANK_41_INDEX];
    if (!rank41) {
      throw new Error("expected a rank 41 county");
    }
    await installExplorer(page, { counties });
    await page.goto(
      exploreHref({
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "ALL",
      })
    );
    await expect(
      page.getByTestId("explorer-national-shortlist-note")
    ).toContainText("first 40");
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).toHaveCount(0);
    const search = page.getByTestId("explorer-county-search");
    await search.fill(rank41.fips);
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`county=${rank41.fips}`));
    const selected = page.locator(`button[data-fips="${rank41.fips}"]`);
    await expect(selected).toHaveAttribute("aria-current", "true");
    await expect(selected).toHaveAttribute("data-rank", "41");
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toHaveAttribute("data-fips", rank41.fips);

    await page.goto(
      exploreHref({
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "ALL",
      })
    );
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).toHaveCount(0);
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
  });
});

function evidenceObservations(fips: string, measureId: string): Observation[] {
  if (fips === SUPPRESSED_FIPS && measureId === INVESTIGATE_CASES_MEASURE_ID) {
    return [
      observationFor({
        fips,
        measureId,
        sourceLabel: "Suppressed surveillance extract",
        unit: "cases",
        value: 8,
        valueState: ValueState.SUPPRESSED,
      }),
    ];
  }
  if (fips === ZERO_FIPS && measureId === INVESTIGATE_CASES_MEASURE_ID) {
    return [
      observationFor({
        fips,
        measureId,
        sourceLabel: "Published zero surveillance extract",
        unit: "cases",
        value: 0,
        valueState: ValueState.ZERO,
      }),
    ];
  }
  if (fips === MISSING_FIPS && measureId === INVESTIGATE_CASES_MEASURE_ID) {
    const [row] = [
      observationFor({
        fips,
        measureId,
        sourceLabel: "",
        unit: "cases",
        value: 0,
        valueState: ValueState.MISSING,
      }),
    ];
    if (!row) {
      return [];
    }
    return [
      {
        ...row,
        methodology: null,
        methodology_version: "",
        source_id: "",
        source_label: "",
        source_url: null,
        source_vintage: null,
      },
    ];
  }
  if (fips === LATE_A && measureId === INVESTIGATE_CASES_MEASURE_ID) {
    return [
      observationFor({
        fips,
        measureId,
        sourceLabel: "Late Alpha surveillance extract",
        unit: "cases",
        value: 3,
        valueState: ValueState.OBSERVED,
      }),
    ];
  }
  if (fips === LATE_B && measureId === INVESTIGATE_CASES_MEASURE_ID) {
    return [
      observationFor({
        fips,
        measureId,
        sourceLabel: "Late Bravo surveillance extract",
        unit: "cases",
        value: 9,
        valueState: ValueState.OBSERVED,
      }),
    ];
  }
  if (fips === ERROR_FIPS && measureId === INVESTIGATE_TICK_MEASURE_ID) {
    return [];
  }
  if (fips === PARTIAL_FIPS && measureId === INVESTIGATE_CONTEXT_MEASURE_ID) {
    return [
      observationFor({
        fips,
        measureId,
        sourceLabel: "Partial canopy extract",
        unit: "percent",
        value: 12,
        valueState: ValueState.OBSERVED,
      }),
    ];
  }
  return [];
}

async function openProvenance(
  page: Page,
  name: RegExp | string,
  root: Page | Locator = page
) {
  const summary = root
    .getByRole("group")
    .locator("summary", { hasText: name })
    .first();
  const details = summary.locator("xpath=..");
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(details).not.toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(details).toHaveAttribute("open", "");
  return details;
}

test.describe("Explorer evidence-state accessibility", () => {
  test("shows limited, unavailable, and observed-zero evidence without mixing counties", async ({
    page,
  }, testInfo) => {
    test.skip(
      isMobile(testInfo),
      "A mobile viewport test covers keyboard selection."
    );
    let releaseLate: (value?: void) => void = () => undefined;
    const late = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });
    let lateArrived = false;
    let latePending = 0;
    let lateSettled = 0;
    await installExplorer(page, {
      counties: evidenceCounties,
      delayFips: LATE_A,
      errorFips: ERROR_FIPS,
      observations: evidenceObservations,
      onLateArrival: () => {
        lateArrived = true;
        latePending += 1;
      },
      onLateSettled: () => {
        lateSettled += 1;
      },
      releaseLate: late,
    });

    await page.goto(
      exploreHref({
        county: SUPPRESSED_FIPS,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "CO",
      })
    );
    const suppressed = page.getByTestId("review-published-county-preview");
    await expect(suppressed).toContainText(
      "The 2023 county Lyme case count is suppressed."
    );
    await expect(suppressed).toContainText("Suppressed");
    await expect(suppressed).toContainText("Limited");
    await expect(suppressed).not.toContainText("0 cases");
    await expect(suppressed).not.toContainText("not a diagnosis");
    await expect(suppressed).not.toContainText("not zero evidence");
    const suppressedProvenance = await openProvenance(
      page,
      "Source details",
      suppressed.getByTestId("review-rationale-1")
    );
    await expect(suppressedProvenance).toContainText(
      "Suppressed or privacy-protected"
    );
    await expect(suppressedProvenance).toContainText(
      "CDC published human cases"
    );
    if (!isMobile(testInfo)) {
      const previewAxe = await new AxeBuilder({ page })
        .include("[data-testid='review-published-county-preview']")
        .analyze();
      expect(previewAxe.violations).toEqual([]);
    }

    await page.goto(
      exploreHref({
        county: UNAVAILABLE_FIPS,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "CO",
      })
    );
    const unavailablePreview = page.getByTestId(
      "review-published-county-preview"
    );
    await expect(
      unavailablePreview.getByTestId("review-rationale-1")
    ).toContainText("Unavailable");
    await expect(
      unavailablePreview.getByTestId("review-rationale-2")
    ).toContainText("No records");
    await expect(
      unavailablePreview.getByTestId("review-rationale-3")
    ).toContainText("No records");
    await expect(unavailablePreview).toContainText("Unavailable");
    await expect(unavailablePreview).not.toContainText("0 cases");
    await page.goto(
      exploreHref({
        county: UNAVAILABLE_FIPS,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    const unavailable = page.getByTestId("explorer-county-evidence");
    await expect(unavailable).toContainText("Borrelia burgdorferi status");
    await expect(unavailable).toContainText("Published status: No records.");
    await expect(unavailable).toContainText(
      "Unavailable. No county-linked record."
    );
    await expect(unavailable).toContainText("Published input coverage is 0%.");
    await expect(unavailable).toContainText(
      "A missing count is not zero cases."
    );
    await expect(unavailable).not.toContainText("0 cases");
    await expect(unavailable).not.toContainText("pathogen is absent");
    const pathogen = unavailable
      .getByTestId("ux-reset-evidence-object")
      .filter({ hasText: "Borrelia burgdorferi status" });
    await expect(pathogen).toContainText("Source family");
    await expect(pathogen).toContainText("Unavailable");
    await expect(pathogen).toContainText("Observation period");
    await expect(pathogen).toContainText("Evidence type");
    await expect(unavailable.getByText("Limited", { exact: true })).toHaveCount(
      0
    );

    await page.goto(
      exploreHref({
        county: PARTIAL_FIPS,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    const partial = page.getByTestId("explorer-county-evidence");
    await expect(partial).toContainText("Published status: No records.");
    await expect(partial).toContainText("Published input coverage is 40%.");
    await expect(partial).toContainText("Partial canopy extract");
    await expect(partial).toContainText("Limited");
    await expect(partial).not.toContainText("Published input coverage is 0%.");
    await expect(partial).not.toContainText("pathogen is absent");

    await page.goto(
      exploreHref({
        county: ZERO_FIPS,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    const zero = page.getByTestId("explorer-county-evidence");
    await expect(zero).toContainText("0 cases");
    await expect(zero).toContainText("Published zero surveillance extract");
    const zeroClaim = zero
      .getByTestId("ux-reset-evidence-object")
      .filter({ hasText: "0 cases" });
    await expect(zeroClaim).toContainText("Available");
    await expect(zeroClaim).toContainText("Published zero");
    await expect(zeroClaim.getByTestId("evidence-display-value")).toHaveText(
      "0 cases"
    );
    const zeroProvenance = await openProvenance(page, "Inspect provenance");
    await expect(zeroProvenance).toContainText("Published zero");
    await expect(zeroProvenance).toContainText("2023");
    await expect(zeroClaim).toContainText("Evidence type");
    await expect(zeroClaim).toContainText("Count");
    if (!isMobile(testInfo)) {
      const evidenceAxe = await new AxeBuilder({ page })
        .include("[data-testid='explorer-county-evidence']")
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(evidenceAxe.violations).toEqual([]);
    }

    await page.goto(
      exploreHref({
        county: MISSING_FIPS,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    const missing = page.getByTestId("explorer-county-evidence");
    const missingClaim = missing
      .getByTestId("ux-reset-evidence-object")
      .filter({ hasText: "Reported Lyme cases" });
    await expect(missingClaim.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(missingClaim).toContainText("No county record");
    await expect(missingClaim).toContainText("Unavailable");
    await expect(missingClaim).not.toContainText("0 cases");
    await expect(missing).not.toContainText("0 cases");
    await expect(missing).toContainText("A missing count is not zero cases.");

    await page.goto(
      exploreHref({
        county: ERROR_FIPS,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    const errored = page.getByTestId("explorer-county-evidence");
    await expect(
      errored.getByTestId("investigate-partial-failure")
    ).toContainText("Some measures could not be loaded.");
    await expect(
      errored.getByTestId("investigate-partial-failure")
    ).toContainText("not marked unavailable");
    await expect(errored).toContainText(
      "tick-pathogen. No observations were returned for this county and selected period."
    );
    await expect(errored).toContainText(
      "Reported Lyme cases. This measure could not be loaded."
    );
    await expect(
      errored.locator("[data-atlas-status='error']").first()
    ).toBeVisible();

    await page.goto(
      exploreHref({
        county: LATE_A,
        dataset: RELEASE_ID,
        mode: "evidence",
        period: PERIOD,
        scope: "CO",
      })
    );
    await expect.poll(() => lateArrived).toBe(true);
    const search = page.getByTestId("explorer-county-search");
    await search.fill(LATE_B);
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`county=${LATE_B}`));
    await expect(page.getByTestId("explorer-county-evidence")).toContainText(
      "Late Bravo surveillance extract"
    );
    releaseLate();
    await expect
      .poll(() => latePending > 0 && lateSettled === latePending)
      .toBe(true);
    await expect(page).toHaveURL(new RegExp(`county=${LATE_B}`));
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      "Late Bravo"
    );
    await expect(page.getByTestId("explorer-county-evidence")).toContainText(
      "Late Bravo surveillance extract"
    );
    await expect(
      page.getByTestId("explorer-county-evidence")
    ).not.toContainText("Late Alpha surveillance extract");
  });

  test("keeps mobile county selection and evidence focus usable", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Explorer history checks run on the mobile project."
    );
    await page.setViewportSize({ height: 844, width: 390 });
    const counties = georgiaCounties();
    const first = counties[0];
    const rank41 = counties[RANK_41_INDEX];
    if (!(first && rank41)) {
      throw new Error("expected Georgia counties");
    }
    await installExplorer(page, {
      candidates: counties.map((county) => ({
        county: county.county,
        fips: county.fips,
        state: county.state,
      })),
      counties,
    });
    await page.goto(
      exploreHref({
        county: first.fips,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "GA",
      })
    );
    const search = page.getByTestId("explorer-county-search");
    await search.focus();
    await expect(search).toBeFocused();
    await search.fill(rank41.fips);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      rank41.fips
    );
    await page.getByTestId("review-view-county-evidence").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("explorer-county-heading")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("explorer-county-heading")).not.toBeFocused();
    await page.getByTestId("explorer-back-to-map").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`county=${rank41.fips}`));
    await expect(page).not.toHaveURL(/mode=/);

    await page.goto(
      exploreHref({
        county: first.fips,
        dataset: RELEASE_ID,
        period: PERIOD,
        scope: "GA",
      })
    );
    await page.locator(`button[data-fips="${rank41.fips}"]`).click();
    await page.reload();
    await expect(
      page.locator(`button[data-fips="${rank41.fips}"]`)
    ).toHaveAttribute("aria-current", "true");
    await page.goBack({ waitUntil: "commit" });
    await expect(page).toHaveURL(new RegExp(`county=${first.fips}`));
    await expect(
      page.locator(`button[data-fips="${first.fips}"]`)
    ).toHaveAttribute("aria-current", "true");
  });
});
