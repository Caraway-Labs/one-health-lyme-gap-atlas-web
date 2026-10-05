import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { compareObservation } from "../fixtures/compare-api-fixtures";
import {
  EXPLORE_CASES_MEASURE_ID,
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsEnvelope,
  exploreScoresFixture,
} from "../fixtures/explore-api-fixtures";
import {
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
} from "../fixtures/investigate-api-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";

const EXPLORE_URL = "/app/explore?county=08001&metric=reported-cases&scope=ALL";
const QUESTION = "How do reviewed studies describe tick exposure?";

function chatResponse(answer: string, requestId: string) {
  return {
    answer,
    assistant_policy_version: "test-v1",
    citations: [
      {
        citation_id: "p1",
        claim_ids: ["c1"],
        corpus_rules_version: "secret-version",
        passage_ids: ["passage-1"],
        pmcid: "PMC123",
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        section_labels: ["Discussion"],
        title: "Source paper",
      },
    ],
    claims: [{ citation_ids: ["p1"], claim_id: "c1", text: answer }],
    configuration_version: "test-v1",
    conversation_id: requestId,
    conversation_token: "must-not-persist",
    evidence_state: "limited",
    request_id: requestId,
    source_used: "literature_evidence",
    status: "answered",
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ json: body, status });
}

async function installExploreMocks(
  page: Page,
  options: { failObservations?: boolean; holdObservations?: Promise<void> } = {}
) {
  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: null });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await fulfillJson(route, exploreMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await fulfillJson(route, exploreScoresFixture);
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await fulfillJson(route, exploreGeometryFixture);
  });
  await page.route("**/v1/measures**", async (route) => {
    const url = new URL(route.request().url());
    const geography = url.searchParams.get("geography_type");
    await fulfillJson(route, {
      ...exploreMeasuresEnvelope,
      data: exploreMeasuresEnvelope.data.filter(
        (measure) => measure.geography_semantics === geography
      ),
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    if (options.holdObservations) {
      await options.holdObservations;
    }
    if (options.failObservations) {
      await fulfillJson(route, { detail: "observations unavailable" }, 500);
      return;
    }
    const url = new URL(route.request().url());
    const measureId = url.searchParams.get("measure_id");
    const matchesBound =
      measureId === EXPLORE_CASES_MEASURE_ID &&
      url.searchParams.get("year") === "2023";
    await fulfillJson(
      route,
      matchesBound
        ? exploreObservationsEnvelope(measureId)
        : { data: [], links: { self: "/v1/observations" }, meta: {} }
    );
  });
  await page.route("**/v1/indicators**", async (route) => {
    await fulfillJson(route, {
      data: [],
      links: { self: "/v1/indicators" },
      meta: {},
    });
  });
}

async function installReviewMocks(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: null });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await fulfillJson(route, reviewScopeMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await fulfillJson(route, reviewScopeScoresFixture);
  });
}

async function openSidecar(page: Page) {
  const launcher = page.getByTestId("ask-atlas-launcher");
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
  return launcher;
}

function inheritedField(page: Page, field: string) {
  return page.locator(`[data-field="${field}"]`);
}

type LayoutBox = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
};

async function readSidecarLayout(page: Page) {
  return page.evaluate(() => {
    function box(element: Element | null): LayoutBox | null {
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    }
    const ask = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Ask"
    );
    return {
      ask: box(ask ?? null),
      composer: box(document.querySelector("#ux-reset-ask-atlas textarea")),
      panel: box(document.querySelector('[data-testid="ask-atlas-panel"]')),
      transcript: box(
        document.querySelector("#ux-reset-ask-atlas .chat-transcript")
      ),
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  });
}

function expectInsidePanel(
  target: LayoutBox | null,
  panel: LayoutBox | null,
  viewport: { height: number; width: number },
  minimumHeight: number
) {
  expect(target).not.toBeNull();
  expect(panel).not.toBeNull();
  if (!(target && panel)) {
    return;
  }
  const visibleBottom = Math.min(panel.bottom, viewport.height) + 1;
  expect(target.height).toBeGreaterThanOrEqual(minimumHeight);
  expect(target.top).toBeGreaterThanOrEqual(panel.top - 1);
  expect(
    target.bottom,
    `bottom ${target.bottom} panel ${panel.bottom} viewport ${viewport.width}x${viewport.height}`
  ).toBeLessThanOrEqual(visibleBottom);
  expect(target.left).toBeGreaterThanOrEqual(-1);
  expect(target.right).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectComposerVisibleInPanel(page: Page) {
  const layout = await readSidecarLayout(page);
  expectInsidePanel(layout.composer, layout.panel, layout.viewport, 24);
  expectInsidePanel(layout.ask, layout.panel, layout.viewport, 16);
  expectInsidePanel(layout.transcript, layout.panel, layout.viewport, 24);
}

async function installInvestigateMocks(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: { state_code: "CO" } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await fulfillJson(route, investigateMetadataFixture);
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
    const url = new URL(route.request().url());
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
    await fulfillJson(route, { code: "CANONICAL_DATA_UNAVAILABLE" }, 503);
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(route, {
      data: investigateObservationsFor({
        fips: url.searchParams.get("geography_id") ?? "",
        measureId: url.searchParams.get("measure_id") ?? "",
        scenario: "mixed",
      }),
      links: { self: "/v1/observations" },
      meta: {},
    });
  });
}

async function installUniformCompareMocks(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, { profile: { state_code: "CO" } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await fulfillJson(route, investigateMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await fulfillJson(route, investigateScoresFixture);
  });
  await page.route("**/v1/measures**", async (route) => {
    const url = new URL(route.request().url());
    const geography = url.searchParams.get("geography_type");
    await fulfillJson(route, {
      data: investigateMeasuresFixture.filter(
        (measure) => measure.geography_semantics === geography
      ),
      links: { self: "/v1/measures" },
      meta: {},
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    const measureId = url.searchParams.get("measure_id") ?? "";
    await fulfillJson(route, {
      data: url.searchParams.getAll("geography_id").map((fips) =>
        compareObservation({
          fips,
          measureId,
          unit: "cases",
          value: 12,
        })
      ),
      links: { self: "/v1/observations" },
      meta: {},
    });
  });
}

test.describe("Ask Atlas contextual sidecar", () => {
  test("asks from Explore through the chat adapter without changing the page", async ({
    page,
  }, testInfo) => {
    const requests: Record<string, unknown>[] = [];
    await installExploreMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      requests.push(route.request().postDataJSON() as Record<string, unknown>);
      await fulfillJson(
        route,
        chatResponse(
          "Reviewed studies describe exposure settings differently.",
          "request-explore-1"
        )
      );
    });
    await page.goto(EXPLORE_URL);
    await expect(page).toHaveURL(/period=2023-01-01/);
    const urlBefore = page.url();
    await expect(page.getByTestId("explore-measure-select")).toContainText(
      "Reported Lyme cases"
    );
    await openSidecar(page);
    await expect(inheritedField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001"
    );
    await expect(inheritedField(page, "measure")).toHaveAttribute(
      "data-field-id",
      "reported-cases"
    );
    await expect(inheritedField(page, "period")).toHaveAttribute(
      "data-field-id",
      "2023-01-01"
    );
    await expect(inheritedField(page, "release")).toHaveAttribute(
      "data-field-id",
      "alpha-2026"
    );
    await expect(inheritedField(page, "source")).toHaveAttribute(
      "data-field-id",
      "reported-cases"
    );
    await expect(page.getByTestId("ask-atlas-inherited-context")).toContainText(
      "did not retrieve this context"
    );
    const layout =
      (page.viewportSize()?.width ?? 1280) <= 800 ? "compact" : "desktop";
    await expectComposerVisibleInPanel(page);
    await page.screenshot({
      path: `/opt/cursor/artifacts/ask-atlas-${layout}.png`,
    });
    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Source paper")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(Object.keys(requests[0] ?? {}).toSorted()).toEqual([
      "history",
      "message",
    ]);
    expect(requests[0]?.message).toBe(QUESTION);
    const transcript = page.getByRole("region", {
      name: "Conversation transcript",
    });
    await expect(transcript).not.toContainText("08001");
    await expect(transcript).not.toContainText("alpha-2026");
    await expect(transcript).not.toContainText("CDC surveillance");
    await expect(page).toHaveURL(urlBefore);
    await expect(page.getByTestId("explore-measure-select")).toContainText(
      "Reported Lyme cases"
    );
    expect(testInfo.project.name.length).toBeGreaterThan(0);
    const axe = await new AxeBuilder({ page })
      .include("#ux-reset-ask-atlas")
      .analyze();
    expect(axe.violations).toEqual([]);
  });

  test("keeps no context, then a validated selection, and ignores a failed page load", async ({
    page,
  }) => {
    const { promise: held, resolve: releaseObservations } =
      Promise.withResolvers<void>();
    await installExploreMocks(page, { holdObservations: held });
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await expect(page.getByTestId("ask-atlas-no-context")).toBeVisible();
    releaseObservations();
    await expect(inheritedField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001"
    );
    await page.getByTestId("ask-atlas-close").click();
    await page.unroute("**/v1/observations**");
    await page.route("**/v1/observations**", async (route) => {
      await fulfillJson(route, { detail: "observations unavailable" }, 500);
    });
    await page.goto(
      "/app/explore?county=36001&metric=reported-cases&scope=ALL"
    );
    await openSidecar(page);
    await expect(page.getByTestId("ask-atlas-no-context")).toBeVisible();
    await expect(
      page.getByTestId("ask-atlas-inherited-context")
    ).not.toContainText("36001");
  });

  test("closes from the keyboard, restores focus, and keeps hidden content out of tab order", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    const launcher = await openSidecar(page);
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.locator("#ux-reset-ask-atlas textarea")).toHaveCount(0);
    await launcher.click();
    await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
  });

  test("drops a late answer after New chat", async ({ page }) => {
    const { promise: firstHeld, resolve: resolveFirst } =
      Promise.withResolvers<void>();
    let calls = 0;
    await installExploreMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      calls += 1;
      const call = calls;
      if (call === 1) {
        await firstHeld;
      }
      await fulfillJson(
        route,
        chatResponse(
          call === 1 ? "First answer must not appear." : "Second answer stays.",
          `request-${call}`
        )
      );
    });
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await page.getByLabel("Your question").fill("First question");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByLabel("Your question").fill("A later question");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Second answer stays.")).toBeVisible();
    const lateResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/v1/knowledge-graph/chat") &&
        (response.request().postData() ?? "").includes("First question")
    );
    resolveFirst();
    await lateResponse;
    await expect(page.getByText("First answer must not appear.")).toHaveCount(
      0
    );
    await expect(page.getByText("Second answer stays.")).toBeVisible();
  });

  test("shows an operational chat failure without changing Explore", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      await fulfillJson(route, { detail: "upstream unavailable" }, 503);
    });
    await page.goto(EXPLORE_URL);
    await expect(page).toHaveURL(/period=2023-01-01/);
    const urlBefore = page.url();
    await openSidecar(page);
    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const failure = page.locator("[data-assistant-state='network_failure']");
    await expect(failure).toBeVisible();
    await expect(failure).toContainText("not a finding");
    await expect(page).toHaveURL(urlBefore);
    await expect(page.getByTestId("explore-workspace")).toBeVisible();
  });

  test("reloads a direct link without keeping the sidecar or changing geography", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await page.reload();
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/metric=reported-cases/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await openSidecar(page);
    await expect(inheritedField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001"
    );
  });

  test("navigates while open and drops stale Explore geography on national Review", async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1280) <= 800,
      "Compact sidecar is modal, so page navigation stays inert until it closes."
    );
    await installExploreMocks(page);
    await installReviewMocks(page);
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await expect(inheritedField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001"
    );
    await page.getByRole("link", { name: "Review", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
    const scope = page.getByTestId("review-scope-select");
    await expect(scope).toBeVisible();
    if (!(await scope.textContent())?.includes("United States")) {
      await scope.click();
      await page.getByRole("option", { name: "United States" }).click();
    }
    await expect(inheritedField(page, "geography")).toHaveAttribute(
      "data-field-state",
      "absent"
    );
    await expect(inheritedField(page, "geography")).not.toHaveAttribute(
      "data-field-id"
    );
    await expect(inheritedField(page, "release")).toHaveAttribute(
      "data-field-state",
      "validated"
    );
    const inset = page.locator(".app-inset");
    await expect(inset).not.toHaveAttribute("inert");
  });

  test("matches modal inert behavior to the compact layout and restores the page", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Resize from the desktop project."
    );
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    const inset = page.locator(".app-inset");
    await expect(inset).not.toHaveAttribute("inert");
    const select = page.getByTestId("explore-measure-select");
    const panel = page.getByTestId("ask-atlas-panel");
    const selectBox = await select.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(selectBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect((selectBox?.x ?? 0) + (selectBox?.width ?? 0)).toBeLessThanOrEqual(
      (panelBox?.x ?? 0) + 1
    );
    await page.setViewportSize({ height: 800, width: 390 });
    await expect(page.getByRole("dialog")).toHaveAttribute(
      "aria-modal",
      "true"
    );
    await expect(inset).toHaveAttribute("inert", "");
    await page.setViewportSize({ height: 720, width: 1280 });
    await expect(page.getByTestId("ask-atlas-panel")).toHaveAttribute(
      "data-ask-atlas-layout",
      "desktop"
    );
    await expect(inset).not.toHaveAttribute("inert");
    await expect(select).toBeVisible();
  });

  test("offers the sidecar on Investigate, Compare, and the Action placeholder", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto("/app/investigate?county=08001");
    const launcher = await openSidecar(page);
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
    await page.goto("/app/compare?compare=08001,08013");
    await openSidecar(page);
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.goto("/app/action");
    await expect(page.getByRole("heading", { name: "Action" })).toBeVisible();
    await openSidecar(page);
    await expect(page.getByTestId("ask-atlas-no-context")).toBeVisible();
    await expect(
      page.getByTestId("ask-atlas-inherited-context")
    ).toHaveAttribute("data-context-state", "none");
  });

  test("keeps the composer inside the panel at short, resized, and keyboard viewports", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Viewport matrix starts from the desktop project."
    );
    await installExploreMocks(page);
    await page.setViewportSize({ height: 720, width: 1280 });
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    const viewports = [
      { height: 720, width: 1280 },
      { height: 800, width: 390 },
      { height: 480, width: 1280 },
      { height: 360, width: 390 },
      { height: 720, width: 1280 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
      await expectComposerVisibleInPanel(page);
    }
  });

  test("inherits the accepted observation period instead of an unvalidated request", async ({
    page,
  }) => {
    const chatBodies: Record<string, unknown>[] = [];
    await installInvestigateMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      chatBodies.push(
        route.request().postDataJSON() as Record<string, unknown>
      );
      await fulfillJson(
        route,
        chatResponse("Reviewed studies differ.", "request-period")
      );
    });
    await page.goto("/app/investigate?county=08001&scope=CO&period=1999-01-01");
    await expect(page.getByTestId("investigate-finding-text")).toContainText(
      "Period 2023"
    );
    await expect(
      page.getByTestId("investigate-finding-text")
    ).not.toContainText("1999");
    await openSidecar(page);
    await expect(inheritedField(page, "period")).toHaveAttribute(
      "data-field-state",
      "validated"
    );
    await expect(inheritedField(page, "period")).toHaveAttribute(
      "data-field-id",
      "2023-01-01"
    );
    await expect(inheritedField(page, "period")).toContainText("2023");
    await expect(inheritedField(page, "period")).not.toContainText("1999");
    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Source paper")).toBeVisible();
    expect(Object.keys(chatBodies[0] ?? {}).toSorted()).toEqual([
      "history",
      "message",
    ]);

    await installUniformCompareMocks(page);
    await page.goto(
      "/app/compare?compare=08001,08013&scope=CO&period=1999-01-01"
    );
    await expect(page.getByText("Observation period").first()).toBeVisible();
    await expect(page.getByTestId("compare-alignment")).toContainText("2023");
    await expect(page.getByTestId("compare-alignment")).not.toContainText(
      "1999"
    );
    await openSidecar(page);
    await expect(inheritedField(page, "period")).toHaveAttribute(
      "data-field-id",
      "2023-01-01"
    );
    await expect(inheritedField(page, "period")).not.toContainText("1999");
  });

  test("recovers from back, forward, sidecar links, and leaving for sign-in", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Compact history recovery is set explicitly."
    );
    await installExploreMocks(page);
    await installReviewMocks(page);
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto("/app/settings");
    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await expect(page.locator(".app-inset")).toHaveAttribute("inert", "");
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert");
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/explore/);
    await expectRecoveredSidecar(page);

    await openSidecar(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      await fulfillJson(
        route,
        chatResponse("Reviewed studies describe exposure.", "request-link")
      );
    });
    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const source = page.getByRole("link", { name: "Source paper" });
    await expect(source).toBeVisible();
    const popup = page.waitForEvent("popup");
    await source.click();
    const sourcePage = await popup;
    // PubMed commit can outlast the 5s expect timeout. Wait for the navigation
    // itself, then assert the same URL without also waiting for the full load.
    await sourcePage.waitForURL(/pubmed\.ncbi\.nlm\.nih\.gov/, {
      waitUntil: "commit",
    });
    expect(sourcePage.url()).toMatch(/pubmed\.ncbi\.nlm\.nih\.gov/);
    await sourcePage.close();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".app-inset")).toHaveAttribute("inert", "");

    await page.goto("/auth/sign-in");
    await expect(
      page.getByRole("heading", { name: "Sign in to Atlas" })
    ).toBeVisible();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);

    await page.goto(EXPLORE_URL);
    await openSidecar(page);
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Your account" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);
  });
});

async function expectRecoveredSidecar(page: Page) {
  const panel = page.locator("#ux-reset-ask-atlas");
  const inset = page.locator(".app-inset");
  if ((await panel.count()) === 0) {
    await expect(inset).not.toHaveAttribute("inert");
    return;
  }
  await expect(panel).toBeVisible();
  await page.getByTestId("ask-atlas-close").click();
  await expect(panel).toHaveCount(0);
  await expect(inset).not.toHaveAttribute("inert");
}
