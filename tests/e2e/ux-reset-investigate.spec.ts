import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  INVESTIGATE_CASES_LIMITATION,
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
  type InvestigateScenario,
} from "../fixtures/investigate-api-fixtures";

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
    await expect(page.getByTestId("investigate-next-return")).toHaveAttribute(
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("99999");

    await page.goto("/app/investigate?county=08014&scope=CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("08014");
    await expect(page.getByTestId("investigate-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    await expect(page.getByTestId("investigate-evidence")).toHaveCount(0);
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
});
