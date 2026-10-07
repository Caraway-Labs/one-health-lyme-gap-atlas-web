import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  INVESTIGATE_CASES_LIMITATION,
  INVESTIGATE_CONTEXT_MEASURE_ID,
  INVESTIGATE_TICK_LIMITATION,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
  type InvestigateScenario,
} from "../fixtures/investigate-api-fixtures";

type ActionControls = {
  delayFips: string | null;
  emptyObservations: boolean;
  metadataStatus: number;
  scenario: InvestigateScenario;
  unavailableOnly: boolean;
};

async function installActionMocks(
  page: Page,
  controls: ActionControls,
  delayed: Promise<void>
) {
  const fulfillJson = async (route: Route, body: unknown, status = 200) => {
    await route.fulfill({ json: body, status });
  };

  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: { state_code: "CO" } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await fulfillJson(
      route,
      controls.metadataStatus === 200
        ? investigateMetadataFixture
        : { detail: "metadata unavailable" },
      controls.metadataStatus
    );
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await fulfillJson(route, investigateScoresFixture);
  });
  await page.route("**/v1/indicators**", async (route) => {
    await fulfillJson(route, {
      data: investigateIndicatorsFixture,
      links: { self: "/v1/indicators" },
      meta: {},
    });
  });
  await page.route("**/v1/measures**", async (route) => {
    const geography = new URL(route.request().url()).searchParams.get(
      "geography_type"
    );
    await fulfillJson(route, {
      data: investigateMeasuresFixture.filter(
        (measure) => measure.geography_semantics === geography
      ),
      links: { self: "/v1/measures" },
      meta: {},
    });
  });
  await page.route("**/v1/geographies/**", async (route) => {
    await fulfillJson(route, { code: "CANONICAL_DATA_UNAVAILABLE" }, 503);
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const fips = url.searchParams.get("geography_id") ?? "";
    const measureId = url.searchParams.get("measure_id") ?? "";
    if (fips === controls.delayFips) {
      await delayed;
    }
    const withhold =
      controls.emptyObservations ||
      (controls.unavailableOnly &&
        measureId !== INVESTIGATE_CONTEXT_MEASURE_ID);
    await fulfillJson(route, {
      data: withhold
        ? []
        : investigateObservationsFor({
            fips,
            measureId,
            scenario: controls.scenario,
          }),
      links: { self: "/v1/observations" },
      meta: {},
    });
  });
}

const MIXED_COUNTY =
  "/app/investigate?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01";

test.describe("Action evidence handoff", () => {
  test("carries Investigate evidence through navigation, reload, and return", async ({
    page,
  }, testInfo) => {
    await installActionMocks(
      page,
      {
        delayFips: null,
        emptyObservations: false,
        metadataStatus: 200,
        scenario: "mixed",
        unavailableOnly: false,
      },
      Promise.resolve()
    );
    await page.goto(MIXED_COUNTY);
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "12 cases"
    );
    const originFinding =
      (await page.getByTestId("investigate-finding-text").textContent()) ?? "";
    const originLimitation =
      (await page.getByTestId("investigate-limitation-text").textContent()) ??
      "";
    await page.getByTestId("investigate-action").click();
    await expect(page).toHaveURL(/\/app\/action/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Denver");
    await expect(page.getByTestId("action-finding-text")).toHaveText(
      originFinding
    );
    await expect(page.getByTestId("action-limitation-text")).toHaveText(
      originLimitation
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      "available"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-period-state",
      "matched"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-release",
      "alpha-2026"
    );
    await expect(page.getByTestId("action-limitation-text")).toContainText(
      INVESTIGATE_TICK_LIMITATION
    );
    await expect(
      page.getByRole("link", { name: "Surveillance Planning" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Surveillance Planning|Evidence Brief/ })
    ).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page.getByTestId("investigate-finding-text")).toHaveText(
      originFinding
    );
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/action/);
    await expect(page.getByTestId("action-finding-text")).toHaveText(
      originFinding
    );

    await page.reload();
    await expect(page.getByTestId("action-finding-text")).toHaveText(
      originFinding
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-county",
      "08001"
    );

    await page.getByTestId("action-return").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page.getByTestId("investigate-finding-text")).toHaveText(
      originFinding
    );

    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await expect(page.getByTestId("action-finding-text")).toHaveText(
      originFinding
    );

    const workspace = page.getByTestId("action-workspace");
    const box = await workspace.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      (viewport?.width ?? 0) + 1
    );

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .include('[data-testid="action-workspace"]')
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("recovers missing, invalid, unsupported, stale, and limited context", async ({
    page,
  }) => {
    await installActionMocks(
      page,
      {
        delayFips: null,
        emptyObservations: false,
        metadataStatus: 200,
        scenario: "mixed",
        unavailableOnly: false,
      },
      Promise.resolve()
    );
    await page.goto("/app/action?scope=CO");
    await expect(page.getByTestId("action-recovery")).toHaveAttribute(
      "data-recovery",
      "missing"
    );
    await expect(page.getByTestId("action-evidence")).toHaveCount(0);
    await expect(page.getByTestId("action-return")).toHaveAttribute(
      "href",
      /\/app\/investigate/
    );

    await page.goto("/app/action?county=12&scope=CO");
    await expect(page.getByTestId("action-recovery")).toHaveAttribute(
      "data-recovery",
      "malformed"
    );
    await expect(page.getByTestId("action-evidence")).toHaveCount(0);

    await page.goto("/app/action?county=08014&scope=CO");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("08014");
    await expect(page.getByTestId("action-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    await expect(page.getByTestId("action-evidence")).toHaveCount(0);

    await page.goto("/app/action?county=99999&scope=CO");
    await expect(page.getByTestId("action-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );

    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&period=1999-01-01"
    );
    await expect(page.getByTestId("action-finding-text")).toContainText(
      "Period 2023"
    );
    await expect(page.getByTestId("action-finding-text")).not.toContainText(
      "1999"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-period-state",
      "stale"
    );
    await expect(page.getByTestId("action-stale-period")).toContainText("2023");

    const controls: ActionControls = {
      delayFips: null,
      emptyObservations: false,
      metadataStatus: 200,
      scenario: "sparse",
      unavailableOnly: false,
    };
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await installActionMocks(page, controls, Promise.resolve());
    await page.goto("/app/action?county=08001&scope=CO&dataset=alpha-2026");
    await expect(page.getByTestId("action-finding-text")).toContainText(
      "7 cases"
    );
    await expect(page.getByTestId("action-finding-text")).toContainText(
      "Limited"
    );
    await expect(page.getByTestId("action-limitation-text")).toContainText(
      INVESTIGATE_CASES_LIMITATION
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      "limited"
    );
  });

  test("shows loading, empty, and error states without a working workflow", async ({
    page,
  }) => {
    let releaseDelayed = () => {};
    const delayed = new Promise<void>((resolve) => {
      releaseDelayed = resolve;
    });
    const controls: ActionControls = {
      delayFips: "08001",
      emptyObservations: false,
      metadataStatus: 200,
      scenario: "mixed",
      unavailableOnly: false,
    };
    await installActionMocks(page, controls, delayed);
    await page.goto("/app/action?county=08001&scope=CO");
    await expect(page.getByText("Loading county evidence…")).toBeVisible();
    await expect(page.getByTestId("action-evidence")).toHaveCount(0);
    await expect(page.getByTestId("action-surveillance")).toContainText(
      "not available"
    );
    releaseDelayed();
    await expect(page.getByTestId("action-finding-text")).toContainText(
      "12 cases"
    );

    controls.delayFips = null;
    controls.emptyObservations = true;
    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await expect(page.getByTestId("action-finding-text")).toContainText(
      "No observed or limited finding was returned"
    );
    await expect(page.getByTestId("action-finding-text")).not.toContainText(
      "Unavailable"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      ""
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-period-state",
      "unspecified"
    );
    await expect(page.getByTestId("action-stale-period")).toHaveCount(0);
    await expect(page.getByTestId("ux-reset-evidence-object")).toHaveCount(0);

    controls.emptyObservations = false;
    controls.metadataStatus = 503;
    await page.goto("/app/action?county=08001&dataset=alpha-2026");
    await expect(page.getByRole("alert").first()).toContainText("alpha-2026");
    await expect(page.getByTestId("action-evidence")).toHaveCount(0);

    controls.metadataStatus = 200;
    await page.goto("/app/action?county=08001&scope=CO&plan=surveillance");
    await expect(page.getByTestId("action-workflows")).toHaveAttribute(
      "data-plan",
      "surveillance_unavailable"
    );
    await expect(
      page.getByRole("link", { name: "Surveillance Planning" })
    ).toHaveCount(0);
    await page.goto("/app/action?county=08001&scope=CO&plan=brief");
    await expect(page.getByTestId("action-unsupported-plan")).toContainText(
      "brief"
    );
    await expect(
      page.getByRole("link", { name: /Evidence Brief/ })
    ).toHaveCount(0);
  });

  test("keeps unavailable-only evidence through handoff, reload, and a direct link", async ({
    page,
  }) => {
    const controls: ActionControls = {
      delayFips: null,
      emptyObservations: false,
      metadataStatus: 200,
      scenario: "mixed",
      unavailableOnly: true,
    };
    await installActionMocks(page, controls, Promise.resolve());
    await page.goto(MIXED_COUNTY);
    const investigateObject = page.getByTestId("ux-reset-evidence-object");
    await expect(investigateObject).toHaveCount(1);
    await expect(page.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(investigateObject).toContainText("National land cover");
    await expect(investigateObject).toContainText("2023");
    await expect(investigateObject).not.toContainText("0 percent");
    await page.getByTestId("investigate-action").click();
    await expect(page).toHaveURL(/\/app\/action/);
    await expect(page).toHaveURL(/county=08001/);
    const actionObject = page.getByTestId("ux-reset-evidence-object");
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      "unavailable"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-period-state",
      "matched"
    );
    await expect(page.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(actionObject).toContainText("National land cover");
    await expect(actionObject).toContainText("2023");
    await expect(actionObject).not.toContainText("0 percent");
    await expect(page.getByTestId("action-stale-period")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      "unavailable"
    );
    await expect(page.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(page.getByTestId("ux-reset-evidence-object")).toContainText(
      "National land cover"
    );

    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await expect(page.getByTestId("action-evidence")).toHaveAttribute(
      "data-evidence-state",
      "unavailable"
    );
    await expect(page.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(page.getByTestId("ux-reset-evidence-object")).toContainText(
      "2023"
    );
    await expect(page.getByTestId("action-stale-period")).toHaveCount(0);
  });
});
