import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  INVESTIGATE_CASES_LIMITATION,
  INVESTIGATE_STATE_SOURCE_URL,
  INVESTIGATE_STATE_STALE_LIMITATION,
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
  type InvestigateScenario,
} from "../fixtures/investigate-api-fixtures";
import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";

type InvestigateControls = {
  delayFips: string | null;
  failMeasureId: string | null;
  scenario: InvestigateScenario;
};

function rejectInvalidInvestigateRequest(url: URL): number | null {
  if (url.pathname.endsWith("/v1/measures")) {
    const geography = url.searchParams.get("geography_type");
    if (
      url.searchParams.get("page_token") === "null" ||
      geography === "county" ||
      geography === null
    ) {
      return 400;
    }
  }
  if (url.pathname.endsWith("/v1/indicators")) {
    if (url.searchParams.get("page_token") === "null") {
      return 400;
    }
  }
  if (url.pathname.includes("/v1/geographies/")) {
    const parts = url.pathname.split("/");
    const geographyType = parts.at(-2);
    const geographyId = parts.at(-1) ?? "";
    if (geographyType !== "county" || !/^\d{5}$/.test(geographyId)) {
      return 400;
    }
  }
  if (url.pathname.endsWith("/v1/observations")) {
    const year = url.searchParams.get("year");
    const start = url.searchParams.get("start_date");
    const end = url.searchParams.get("end_date");
    const hasYear = year !== null;
    const hasRange = start !== null && end !== null;
    const ids = url.searchParams.getAll("geography_id");
    if (url.search.length - 1 > 8192) {
      return 414;
    }
    const duplicateIds = new Set(ids).size !== ids.length;
    const reversedRange = Boolean(hasRange && start && end && end < start);
    if (
      url.searchParams.get("page_token") === "null" ||
      url.searchParams.get("geography_type") !== "county" ||
      url.searchParams.has("stratification") ||
      hasYear === hasRange ||
      reversedRange ||
      duplicateIds ||
      ids.length === 0 ||
      ids.some((id) => !/^\d{5}$/.test(id))
    ) {
      return 400;
    }
  }
  return null;
}

async function installInvestigateMocks(
  page: Page,
  controls: InvestigateControls,
  delayed: Promise<void>,
  requestedUrls: string[]
) {
  const fulfillJson = async (route: Route, body: unknown, status = 200) => {
    await route.fulfill({ json: body, status });
  };

  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: { state_code: "CO" } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    requestedUrls.push(route.request().url());
    await fulfillJson(route, investigateMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    requestedUrls.push(route.request().url());
    await fulfillJson(route, investigateScoresFixture);
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    requestedUrls.push(route.request().url());
    await fulfillJson(route, stateReviewResponseForUrl(route.request().url()));
  });
  await page.route("**/v1/indicators**", async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url.toString());
    const rejected = rejectInvalidInvestigateRequest(url);
    if (rejected) {
      await fulfillJson(route, { code: "INVALID_REQUEST" }, rejected);
      return;
    }
    await fulfillJson(route, {
      data: investigateIndicatorsFixture,
      links: { self: "/v1/indicators" },
      meta: {},
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url.toString());
    const rejected = rejectInvalidInvestigateRequest(url);
    if (rejected) {
      await fulfillJson(route, { code: "INVALID_REQUEST" }, rejected);
      return;
    }
    const geography = url.searchParams.get("geography_type");
    await fulfillJson(route, {
      data: investigateMeasuresFixture.filter(
        (measure) => measure.geography_semantics === geography
      ),
      links: { self: "/v1/measures" },
      meta: {},
    });
  });
  await page.route("**/v1/geographies/**", async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url.toString());
    const rejected = rejectInvalidInvestigateRequest(url);
    if (rejected) {
      await fulfillJson(route, { code: "INVALID_REQUEST" }, rejected);
      return;
    }
    await fulfillJson(route, { code: "CANONICAL_DATA_UNAVAILABLE" }, 503);
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url.toString());
    const rejected = rejectInvalidInvestigateRequest(url);
    if (rejected) {
      await fulfillJson(route, { code: "INVALID_REQUEST" }, rejected);
      return;
    }
    const fips = url.searchParams.get("geography_id") ?? "";
    const measureId = url.searchParams.get("measure_id") ?? "";
    if (fips === controls.delayFips) {
      await delayed;
    }
    if (measureId === controls.failMeasureId) {
      await fulfillJson(route, { detail: "observations unavailable" }, 500);
      return;
    }
    await fulfillJson(route, {
      data: investigateObservationsFor({
        fips,
        measureId,
        scenario: controls.scenario,
      }),
      links: { self: "/v1/observations" },
      meta: {},
    });
  });
}

function observationUrls(urls: readonly string[]): string[] {
  return urls.filter((url) => url.includes("/v1/observations"));
}

async function revealWorkspaceNavigation(page: Page, projectName: string) {
  if (!projectName.includes("mobile")) {
    return;
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
}

test.describe("County Investigate evidence hierarchy", () => {
  test("reads a direct county link after reload without Ask Atlas", async ({
    page,
  }, testInfo) => {
    const requestedUrls: string[] = [];
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      requestedUrls
    );
    await page.goto("/app/investigate?county=08001&scope=CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Denver");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "12 cases"
    );
    await expect(page.getByTestId("investigate-limitation-text")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );
    await expect(
      page.getByTestId("investigate-family-environmental_population")
    ).toContainText("Unavailable");
    await expect(
      page.getByTestId("investigate-family-environmental_population")
    ).not.toContainText("0 percent");
    const returnLink = page.getByTestId("investigate-return");
    await expect(returnLink).toHaveAttribute("href", /\/app\/review/);
    await expect(returnLink).toHaveAttribute("href", /county=08001/);
    await expect(returnLink).toHaveAttribute("href", /scope=CO/);
    await expect(page.getByTestId("investigate-next-steps")).toHaveAttribute(
      "data-county",
      "08001"
    );
    const nextHrefs = await page
      .getByTestId("investigate-next-steps")
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(nextHrefs.some((href) => href?.includes("/assistant"))).toBe(false);
    await revealWorkspaceNavigation(page, testInfo.project.name);
    const reviewNav = page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Review" });
    await expect(reviewNav).toHaveAttribute("href", /county=08001/);
    await expect(reviewNav).toHaveAttribute("href", /dataset=alpha-2026/);
    expect(requestedUrls.some((url) => url.includes("/v1/geographies/"))).toBe(
      false
    );

    await page.reload();
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "12 cases"
    );
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "08001"
    );
    await expect(page.getByTestId("investigate-return")).toHaveAttribute(
      "href",
      /scope=CO/
    );

    for (const url of observationUrls(requestedUrls)) {
      const parsed = new URL(url);
      expect(rejectInvalidInvestigateRequest(parsed)).toBeNull();
    }

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("opens Investigate from the selected Review county", async ({
    page,
  }, testInfo) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    await page.goto("/app/review?scope=CO&county=08013");
    const returned = page.getByTestId("review-investigate");
    await expect(returned).toHaveAttribute("data-county", "08013");
    await expect(page).toHaveURL(/county=08013/);
    await revealWorkspaceNavigation(page, testInfo.project.name);
    const investigateNav = page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Investigate" });
    await expect(investigateNav).toHaveAttribute("href", /county=08013/);

    await page.goto("/app/review?scope=CO");
    const handoff = page.getByTestId("review-investigate");
    await expect(handoff).toHaveAttribute("data-county", "08001");
    await expect(page).toHaveURL(/county=08001/);
    await handoff.click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Denver");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "12 cases"
    );
    await expect(page.getByTestId("investigate-return")).toHaveAttribute(
      "href",
      /\/app\/review\?.*scope=CO/
    );
  });

  test("keeps header, evidence, and next steps on the county selected while the first response is delayed", async ({
    page,
  }) => {
    const controls: InvestigateControls = {
      delayFips: "08001",
      failMeasureId: null,
      scenario: "mixed",
    };
    let releaseDelayed = () => {};
    const delayed = new Promise<void>((resolve) => {
      releaseDelayed = resolve;
    });
    await installInvestigateMocks(page, controls, delayed, []);
    await page.goto("/app/investigate?county=08001&scope=CO");
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "08001"
    );
    await expect(page.getByText("Loading county evidence…")).toBeVisible();
    await expect(page.getByText("Inspect provenance")).toHaveCount(0);
    await expect(page.getByTestId("investigate-finding-text")).toHaveCount(0);

    await page.getByTestId("investigate-county-select").click();
    await page.getByRole("option", { name: "Boulder, Colorado" }).click();
    await expect(page).toHaveURL(/county=08013/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Boulder");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "40 cases"
    );
    await expect(page.getByTestId("investigate-evidence")).toHaveAttribute(
      "data-county",
      "08013"
    );
    await expect(page.getByTestId("investigate-next-steps")).toHaveAttribute(
      "data-county",
      "08013"
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /\/app\/action/
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /county=08013/
    );
    await expect(
      page.getByTestId("investigate-export-context")
    ).toHaveAttribute("data-county", "08013");
    await expect(
      page.getByTestId("investigate-export-context")
    ).toHaveAttribute("data-export-state", "unavailable");
    await expect(page.getByTestId("investigate-return")).toHaveAttribute(
      "href",
      /county=08013/
    );

    releaseDelayed();
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "40 cases"
    );
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "08013"
    );
    await expect(page.getByTestId("investigate-evidence")).not.toContainText(
      "12 cases"
    );
  });

  test("shows sparse evidence, an unavailable domain, and a partial measure failure on the same county", async ({
    page,
  }) => {
    const controls: InvestigateControls = {
      delayFips: null,
      failMeasureId: null,
      scenario: "sparse",
    };
    await installInvestigateMocks(page, controls, Promise.resolve(), []);
    await page.goto("/app/investigate?county=08001&scope=CO");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "7 cases"
    );
    await expect(page.getByTestId("investigate-limitation-text")).toContainText(
      INVESTIGATE_CASES_LIMITATION
    );
    await expect(
      page.getByTestId("investigate-family-vector_pathogen")
    ).toContainText("No governed observations were returned");
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "08001"
    );

    controls.scenario = "mixed";
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    await page.goto("/app/investigate?county=08013&scope=CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Boulder");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "40 cases"
    );
    await expect(page.getByTestId("investigate-partial-failure")).toContainText(
      "Tick pathogen detections"
    );
    await expect(page.getByTestId("investigate-retry-evidence")).toBeVisible();
    await expect(
      page.getByTestId("investigate-family-vector_pathogen")
    ).toHaveAttribute("data-publication", "request_failed");
    await expect(
      page.getByTestId("investigate-family-vector_pathogen")
    ).not.toContainText("Inspect provenance");
    await expect(page.getByTestId("investigate-family-human")).toContainText(
      "Inspect provenance"
    );
    await expect(
      page.getByTestId("investigate-family-environmental_population")
    ).toContainText("Unavailable");
    await expect(page.getByTestId("investigate-evidence")).toHaveAttribute(
      "data-county",
      "08013"
    );
  });

  test("recovers malformed, unknown, and release-unsupported counties without switching", async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      requestedUrls
    );
    await page.goto("/app/investigate?county=12&scope=CO");
    await expect(page.getByTestId("investigate-recovery")).toHaveAttribute(
      "data-recovery",
      "malformed"
    );
    expect(requestedUrls.some((url) => url.includes("/v1/geographies/"))).toBe(
      false
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Choose a county"
    );

    await page.goto("/app/investigate?county=99999&scope=CO");
    await expect(page.getByTestId("investigate-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    await expect(page.getByTestId("investigate-evidence")).toHaveCount(0);
    await expect(page.getByTestId("investigate-compare")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("99999");

    await page.goto("/app/investigate?county=08014&scope=CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("08014");
    await expect(page.getByTestId("investigate-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    await expect(page.getByTestId("investigate-evidence")).toHaveCount(0);
    await expect(page.getByTestId("investigate-compare")).toHaveCount(0);

    await page.goto(
      "/app/investigate?county=99999&scope=CO&compare=08001,08013"
    );
    await expect(page.getByTestId("investigate-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    await expect(page.getByTestId("investigate-compare")).toHaveCount(0);
    await expect(page.getByTestId("investigate-continue")).toHaveAttribute(
      "href",
      /compare=08001(?:%2C|,)08013/
    );
    expect(
      observationUrls(requestedUrls).some((url) => url.includes("08014"))
    ).toBe(false);
  });

  test("keeps both sources when one measure returns more than one observation", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "ambiguous" },
      Promise.resolve(),
      []
    );
    await page.goto("/app/investigate?county=08001&scope=CO");
    const human = page.getByTestId("investigate-family-human");
    await expect(human).toContainText("CDC surveillance");
    await expect(human).toContainText("State health department");
    await expect(human.locator("[data-observation-id]")).toHaveCount(2);
    await expect(page.getByTestId("investigate-header")).toHaveAttribute(
      "data-county",
      "08001"
    );
  });

  test("opens source, period, freshness, method, and limitation disclosure", async ({
    page,
  }, testInfo) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "ambiguous" },
      Promise.resolve(),
      []
    );
    await page.goto("/app/investigate?county=08001&scope=CO");
    const human = page.getByTestId("investigate-family-human");
    const cdc = human.locator("[data-observation-id='obs-cases-08001']");
    const stateSource = human.locator(
      "[data-observation-id='obs-cases-state-08001']"
    );
    const cdcSummary = cdc.locator("summary", {
      hasText: "Inspect provenance",
    });
    const stateSummary = stateSource.locator("summary", {
      hasText: "Inspect provenance",
    });

    await cdcSummary.scrollIntoViewIfNeeded();
    await cdcSummary.focus();
    await page.keyboard.press("Enter");
    await expect(cdc.locator("details").first()).toHaveAttribute("open", "");
    await expect(cdc.getByTestId("evidence-provenance-period")).toContainText(
      "2023"
    );
    await expect(
      cdc.getByTestId("evidence-provenance-freshness")
    ).toContainText("Unavailable");
    await expect(cdc.getByTestId("evidence-provenance-method")).toContainText(
      "Version 1.0.0"
    );
    await expect(cdc.getByTestId("evidence-provenance-state")).toContainText(
      "Available"
    );
    await expect(
      cdc.getByTestId("evidence-provenance-limitations")
    ).toContainText("No governed limitations were returned.");
    await expect(
      cdc.getByRole("link", { name: /Open source reference/ })
    ).toHaveCount(0);

    await stateSummary.scrollIntoViewIfNeeded();
    await stateSummary.focus();
    await page.keyboard.press("Space");
    await expect(stateSource.locator("details").first()).toHaveAttribute(
      "open",
      ""
    );
    await expect(
      stateSource.getByTestId("evidence-provenance-period")
    ).toContainText("June 30, 2023");
    await expect(
      stateSource.getByTestId("evidence-provenance-freshness")
    ).toContainText("Dataset vintage 2022.2");
    await expect(
      stateSource.getByTestId("evidence-provenance-freshness")
    ).not.toContainText(/stale/i);
    await expect(
      stateSource.getByTestId("evidence-provenance-method")
    ).toContainText("State annual case extract");
    await expect(
      stateSource.getByTestId("evidence-provenance-state")
    ).toContainText("Limited");
    await expect(
      stateSource.getByTestId("evidence-provenance-limitations")
    ).toContainText(INVESTIGATE_STATE_STALE_LIMITATION);
    const sourceLink = stateSource.getByRole("link", {
      name: /Open source reference/,
    });
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute(
      "href",
      INVESTIGATE_STATE_SOURCE_URL
    );
    await expect(sourceLink).toHaveAttribute("target", "_blank");
    await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).not.toHaveURL(/source=/);

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("keeps the unavailable PDF explanation after reload", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    await page.goto(
      "/app/investigate?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    const context = page.getByTestId("investigate-export-context");
    await expect(context).toHaveAttribute("data-county", "08001");
    await expect(context).toHaveAttribute("data-release", "alpha-2026");
    await expect(context).toHaveAttribute("data-period", "2023-01-01");
    await expect(context).toHaveAttribute("data-observation-periods", "2023");
    await expect(context).toHaveAttribute("data-export-state", "unavailable");
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      "2023-01-01"
    );
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      "Tick survey"
    );
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(
      0
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /\/app\/action/
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /period=2023-01-01/
    );
    await expect(page.getByTestId("investigate-return")).toHaveAttribute(
      "href",
      /\/app\/review/
    );
    await expect(page.getByTestId("investigate-evidence")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );

    await page.reload();
    await expect(
      page.getByTestId("investigate-export-context")
    ).toHaveAttribute("data-period", "2023-01-01");
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );

    const results = await new AxeBuilder({ page })
      .include('[data-testid="investigate-workspace"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("returns to Compare when the link already names two counties", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    await page.goto(
      "/app/investigate?county=08001&scope=CO&compare=08001,08013&dataset=alpha-2026"
    );
    const compare = page.getByTestId("investigate-continue");
    await expect(compare).toHaveAttribute("data-destination", "compare");
    await expect(compare).toHaveAttribute("href", /\/app\/compare/);
    await expect(compare).toHaveAttribute("href", /08013/);
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /\/app\/action/
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /08013/
    );
    await compare.click();
    await expect(page).toHaveURL(/\/app\/compare/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/08013/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare");
  });

  test("offers Action for a limited county without choosing a neighbor", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "sparse" },
      Promise.resolve(),
      []
    );
    await page.goto(
      "/app/investigate?county=08001&scope=CO&dataset=alpha-2026"
    );
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      INVESTIGATE_CASES_LIMITATION
    );
    await expect(page.getByTestId("investigate-limitation-text")).toContainText(
      INVESTIGATE_CASES_LIMITATION
    );
    await expect(page.getByTestId("investigate-continue")).toHaveCount(0);
    const compareEntry = page.getByTestId("investigate-compare");
    await expect(compareEntry).toHaveAttribute("href", /compare=08001(?!\d)/);
    await expect(compareEntry).toHaveAttribute("href", /return=investigate/);
    await expect(compareEntry).not.toHaveAttribute("href", /08013/);
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /\/app\/action/
    );
    await expect(page.getByTestId("investigate-action")).toHaveAttribute(
      "href",
      /county=08001/
    );
    await expect(page.getByTestId("investigate-action")).not.toHaveAttribute(
      "href",
      /08013/
    );
    await expect(page.getByTestId("investigate-return")).toHaveAttribute(
      "href",
      /\/app\/review/
    );
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(
      0
    );
  });

  test("does not request a report while the visible period and caveat are unmatched", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    const pdfUrls: string[] = [];
    await page.route("**/v1/counties/**/report.pdf**", async (route) => {
      pdfUrls.push(route.request().url());
      await route.fulfill({
        body: "%PDF-1.7 boulder",
        contentType: "application/pdf",
      });
    });
    await page.goto(
      "/app/investigate?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      "2023-01-01"
    );
    await expect(page.getByTestId("investigate-pdf-unavailable")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(
      0
    );
    await expect(
      page.getByTestId("investigate-next-steps").getByRole("alert")
    ).toHaveCount(0);

    await page.getByTestId("investigate-county-select").click();
    await page.getByRole("option", { name: "Boulder, Colorado" }).click();
    await expect(
      page.getByTestId("investigate-export-context")
    ).toHaveAttribute("data-county", "08013");
    await expect(
      page.getByTestId("investigate-export-context")
    ).toHaveAttribute("data-export-state", "unavailable");
    expect(pdfUrls).toEqual([]);
  });

  test("returns from Compare to the same pair after reload and history", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    await page.goto(
      "/app/compare?compare=08001,08013&county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01&metric=score"
    );
    const boulder = page.getByTestId("compare-investigate-08013");
    await expect(page.getByTestId("compare-investigate-08001")).toHaveAttribute(
      "href",
      /compare=08001(?:%2C|,)08013/
    );
    await expect(
      page.getByTestId("compare-investigate-08001")
    ).not.toHaveAttribute("href", /metric=/);
    await expect(boulder).toHaveAttribute("href", /county=08013/);
    await expect(boulder).toHaveAttribute("href", /period=2023-01-01/);
    await expect(boulder).toHaveAttribute("href", /scope=CO/);
    await expect(boulder).toHaveAttribute("href", /dataset=alpha-2026/);
    await boulder.click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08013/);
    await expect(page).toHaveURL(/compare=08001(?:%2C|,)08013/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page).not.toHaveURL(/metric=/);
    await page.reload();
    const returnCompare = page.getByTestId("investigate-continue");
    await expect(returnCompare).toHaveAttribute("data-destination", "compare");
    await expect(page).toHaveURL(/county=08013/);
    await returnCompare.click();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page).toHaveURL(/county=08013/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).toHaveURL(/scope=CO/);
    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08013/);
    await expect(page).toHaveURL(/compare=08001(?:%2C|,)08013/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).toHaveURL(/scope=CO/);
    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page).toHaveURL(/scope=CO/);
  });

  test("opens Compare from one county and restores that Investigate entry", async ({
    page,
  }) => {
    await installInvestigateMocks(
      page,
      { delayFips: null, failMeasureId: null, scenario: "mixed" },
      Promise.resolve(),
      []
    );
    await page.goto(
      "/app/investigate?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    const compare = page.getByTestId("investigate-compare");
    await expect(compare).toHaveText("Compare");
    await expect(compare).toHaveAttribute("href", /compare=08001(?!\d)/);
    await expect(compare).not.toHaveAttribute("href", /08013/);
    await compare.click();
    await expect(page).toHaveURL(/\/app\/compare/);
    await expect(page).toHaveURL(/compare=08001(?!\d)/);
    await expect(page).toHaveURL(/return=investigate/);
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-recovery")).toContainText(
      "second county"
    );
    const returnHref =
      (await page.getByTestId("compare-return").getAttribute("href")) ?? "";
    expect(returnHref).toContain("/app/investigate");
    expect(returnHref).toContain("county=08001");
    expect(returnHref).not.toContain("return=");

    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).not.toHaveURL(/compare=/);
    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.getByTestId("compare-return").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/compare=08001(?!\d)/);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/compare/);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).not.toHaveURL(/compare=/);
  });
});
