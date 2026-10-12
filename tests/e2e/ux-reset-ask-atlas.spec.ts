import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import type { AskAtlasInheritedFieldKey } from "@/features/ux-reset/ask-atlas/inherited-context";
import { readAskAtlasPageReference } from "@/features/ux-reset/ask-atlas/page-reference";

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

async function readLauncher(page: Page) {
  const href = await page
    .getByTestId("ask-atlas-launcher")
    .getAttribute("href");
  const url = new URL(href ?? "", "http://127.0.0.1");
  return {
    state: readAskAtlasPageReference(url.pathname, url.searchParams),
    url,
  };
}

function fieldId(
  state: ReturnType<typeof readAskAtlasPageReference>,
  key: AskAtlasInheritedFieldKey
): string | null {
  if (state.kind !== "validated") {
    return null;
  }
  const field = state.reference.context.fields[key];
  return field.state === "validated" ? field.id : null;
}

function referenceField(page: Page, field: string) {
  return page.locator(
    `[data-testid="ask-atlas-page-reference"] [data-field="${field}"]`
  );
}

test.describe("Ask Atlas dedicated page", () => {
  test("carries Explore context to the page and returns without sending it", async ({
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
    const exploreUrl = page.url();
    await expect(page.getByTestId("explore-measure-select")).toContainText(
      "Reported Lyme cases"
    );
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    const launcher = await readLauncher(page);
    expect(launcher.state.kind).toBe("validated");
    expect({
      measure: fieldId(launcher.state, "measure"),
      period: fieldId(launcher.state, "period"),
      release: fieldId(launcher.state, "release"),
      source: fieldId(launcher.state, "source"),
    }).toStrictEqual({
      measure: "reported-cases",
      period: "2023-01-01",
      release: "alpha-2026",
      source: "reported-cases",
    });
    expect(launcher.url.searchParams.get("period")).toBeNull();
    expect(launcher.url.searchParams.get("compare")).toBeNull();
    await expect(page.getByTestId("ask-atlas-panel")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");

    await page.getByTestId("ask-atlas-launcher").click();
    await expect(page).toHaveURL(/\/app\/assistant/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ask Atlas" })
    ).toBeVisible();
    await expect(page.getByText("Reviewed literature").first()).toBeVisible();
    const reference = page.getByTestId("ask-atlas-page-reference");
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001"
    );
    await expect(reference).toContainText("not literature retrieved");
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
    await expect(
      page.getByText("Ask a research question about reviewed literature.")
    ).toBeVisible();
    await expect(page.getByText("Data supplied by the NCBI.")).toBeVisible();
    const layout =
      (page.viewportSize()?.width ?? 1280) <= 800 ? "compact" : "desktop";
    await page.screenshot({
      path: `/opt/cursor/artifacts/ask-atlas-page-${layout}.png`,
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
    expect(JSON.stringify(requests)).not.toContain("08001");
    expect(JSON.stringify(requests)).not.toContain("must-not-persist");
    const transcript = page.getByRole("region", {
      name: "Conversation transcript",
    });
    await expect(transcript).not.toContainText("08001");
    await expect(transcript).not.toContainText("alpha-2026");
    const axe = await new AxeBuilder({ page })
      .include("[data-testid='ask-atlas-workspace']")
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.getByTestId("ask-atlas-return").click();
    await expect(page).toHaveURL(/\/app\/explore/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("explore-measure-select")).toContainText(
      "Reported Lyme cases"
    );
    expect(new URL(page.url()).searchParams.get("county")).toBe("08001");
    expect(exploreUrl).toContain("/app/explore");
    expect(testInfo.project.name.length).toBeGreaterThan(0);
  });

  test("can remove one field and clear an unverified page reference", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    const launcher = await readLauncher(page);
    await page.goto(`${launcher.url.pathname}${launcher.url.search}`);
    await page.getByRole("link", { name: "Remove geography" }).click();
    await expect(referenceField(page, "geography")).toHaveCount(0);
    await expect(referenceField(page, "release")).toHaveAttribute(
      "data-field-id",
      "alpha-2026"
    );
    await page.getByRole("link", { name: "Clear page reference" }).click();
    await expect(page.getByTestId("ask-atlas-page-reference")).toHaveCount(0);
    await page.goto(
      "/app/assistant?page_ref=not-json&county=08001&dataset=alpha-2026"
    );
    const unverified = page.getByTestId("ask-atlas-page-reference");
    await expect(unverified).toHaveAttribute(
      "data-reference-state",
      "unverified"
    );
    await expect(unverified).toContainText("could not be verified");
    await expect(unverified).not.toContainText("08001");
    await expect(page.locator("[data-assistant-county-state]")).toHaveCount(0);
    await page.getByRole("link", { name: "Clear page reference" }).click();
    await expect(page.getByTestId("ask-atlas-page-reference")).toHaveCount(0);
    await expect(page).not.toHaveURL(/page_ref=/);
  });

  test("keeps an accepted page reference across reload and browser history", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.getByTestId("ask-atlas-launcher").click();
    const reference = page.getByTestId("ask-atlas-page-reference");
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toContainText(
      "Adams, Colorado (08001)"
    );

    await page.reload();
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toContainText(
      "Adams, Colorado (08001)"
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/explore/);
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/assistant/);
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toContainText(
      "Adams, Colorado (08001)"
    );
  });

  test("withholds a page reference until Explore context is validated", async ({
    page,
  }) => {
    const { promise: held, resolve: releaseObservations } =
      Promise.withResolvers<void>();
    await installExploreMocks(page, { holdObservations: held });
    await page.goto(EXPLORE_URL);
    await expect(page.getByTestId("ask-atlas-launcher")).toBeVisible();
    await expect
      .poll(async () => (await readLauncher(page)).state.kind)
      .toBe("absent");
    releaseObservations();
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.unroute("**/v1/observations**");
    await page.route("**/v1/observations**", async (route) => {
      await fulfillJson(route, { detail: "observations unavailable" }, 500);
    });
    await page.goto(
      "/app/explore?county=36001&metric=reported-cases&scope=ALL"
    );
    await expect
      .poll(async () => (await readLauncher(page)).state.kind)
      .toBe("absent");
    const failed = await readLauncher(page);
    expect(failed.url.href).not.toContain("36001,");
    expect(fieldId(failed.state, "geography")).toBeNull();
  });

  test("follows the launcher from the keyboard without a panel", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    const launcher = page.getByTestId("ask-atlas-launcher");
    await expect(launcher).toBeVisible();
    await launcher.focus();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/assistant/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ask Atlas" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ask-atlas-workspace")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByLabel("Your question")).toBeVisible();
  });

  test("drops a late answer after New chat", async ({ page }) => {
    const { promise: firstHeld, resolve: resolveFirst } =
      Promise.withResolvers<void>();
    const { promise: firstSettled, resolve: settleFirst } =
      Promise.withResolvers<void>();
    let calls = 0;
    await installExploreMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      calls += 1;
      const call = calls;
      if (call === 1) {
        await firstHeld;
        try {
          await fulfillJson(
            route,
            chatResponse("First answer must not appear.", `request-${call}`)
          );
        } catch {
          // New chat aborts the fetch, so this response never reaches the page.
        }
        settleFirst();
        return;
      }
      await fulfillJson(
        route,
        chatResponse("Second answer stays.", `request-${call}`)
      );
    });
    await page.goto("/app/assistant");
    await page.getByLabel("Your question").fill("First question");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByLabel("Your question").fill("A later question");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Second answer stays.")).toBeVisible();
    resolveFirst();
    await firstSettled;
    await expect(page.getByText("First answer must not appear.")).toHaveCount(
      0
    );
    await expect(page.getByText("Second answer stays.")).toBeVisible();
  });

  test("shows an operational chat failure and can return to Explore", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      await fulfillJson(route, { detail: "upstream unavailable" }, 503);
    });
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.getByTestId("ask-atlas-launcher").click();
    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const failure = page.locator("[data-assistant-state='network_failure']");
    await expect(failure).toBeVisible();
    await expect(failure).toContainText("not a finding");
    await page.getByTestId("ask-atlas-return").click();
    await expect(page).toHaveURL(/\/app\/explore/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("explore-workspace")).toBeVisible();
  });

  test("reloads Explore without opening a panel", async ({ page }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.reload();
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/metric=reported-cases/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.getByTestId("ask-atlas-launcher")).not.toHaveAttribute(
      "aria-expanded"
    );
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
  });

  test("offers the page from Investigate, Compare, and Action", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto("/app/investigate?county=08001");
    await expect(page.getByTestId("ask-atlas-launcher")).toBeVisible();
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/app/compare?compare=08001,08013");
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveAttribute(
      "href",
      /\/app\/assistant/
    );
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.goto("/app/action");
    await expect(page.getByRole("heading", { name: "Action" })).toBeVisible();
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "release"))
      .toBe("alpha-2026");
    const action = await readLauncher(page);
    expect(fieldId(action.state, "geography")).toBeNull();
    expect(action.state.kind).toBe("validated");
  });

  test("uses the same page on a narrow viewport", async ({ page }) => {
    await installExploreMocks(page);
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.getByTestId("ask-atlas-launcher").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByTestId("ask-atlas-page-reference")).toBeVisible();
    await page.getByLabel("Your question").scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Your question")).toBeInViewport();
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
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "period"))
      .toBe("2023-01-01");
    const investigate = await readLauncher(page);
    expect(investigate.url.href).not.toContain("1999-01-01");
    await page.getByTestId("ask-atlas-launcher").click();
    await expect(referenceField(page, "period")).toHaveAttribute(
      "data-field-id",
      "2023-01-01"
    );
    await expect(referenceField(page, "period")).toContainText("2023");
    await expect(referenceField(page, "period")).not.toContainText("1999");
    await expect(page.getByTestId("ask-atlas-return")).toHaveAttribute(
      "href",
      /\/app\/investigate/
    );
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
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "period"))
      .toBe("2023-01-01");
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001,08013");
    const compare = await readLauncher(page);
    expect(compare.url.searchParams.get("compare")).toBeNull();
    expect(compare.url.searchParams.get("period")).toBeNull();
    if (compare.state.kind === "validated") {
      expect(compare.state.returnHref).toContain("/app/compare?");
      expect(compare.state.returnHref).toContain("compare=08001%2C08013");
      expect(compare.state.returnHref).toContain("period=2023-01-01");
      expect(compare.state.returnHref).not.toContain("1999");
    }
    await page.getByTestId("ask-atlas-launcher").click();
    await expect(page.getByTestId("ask-atlas-page-reference")).toContainText(
      "does not compare these counties"
    );
    await page.getByTestId("ask-atlas-return").click();
    await expect(page).toHaveURL(/\/app\/compare/);
    await expect(page).toHaveURL(/compare=08001/);
    await expect(page).toHaveURL(/period=2023-01-01/);
    await expect(page).not.toHaveURL(/1999/);
  });

  test("recovers from back, forward, and leaving for sign-in", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await installReviewMocks(page);
    await page.goto("/app/settings");
    await page.goto(EXPLORE_URL);
    await expect
      .poll(async () => fieldId((await readLauncher(page)).state, "geography"))
      .toBe("08001");
    await page.getByTestId("ask-atlas-launcher").click();
    await expect(page).toHaveURL(/\/app\/assistant/);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/explore/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert");
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/assistant/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

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
    await sourcePage.waitForURL(/pubmed\.ncbi\.nlm\.nih\.gov/, {
      waitUntil: "commit",
    });
    expect(sourcePage.url()).toMatch(/pubmed\.ncbi\.nlm\.nih\.gov/);
    await sourcePage.close();
    await expect(page.getByTestId("ask-atlas-workspace")).toBeVisible();
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");

    await page.goto("/auth/sign-in");
    await expect(
      page.getByRole("heading", { name: "Sign in or create an account" })
    ).toBeVisible();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);

    await page.goto(EXPLORE_URL);
    await page.getByTestId("ask-atlas-launcher").click();
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Your account" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);
  });
});
