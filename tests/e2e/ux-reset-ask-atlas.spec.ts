import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import type { AskAtlasInheritedFieldKey } from "@/features/ux-reset/ask-atlas/inherited-context";
import { readAskAtlasPageReference } from "@/features/ux-reset/ask-atlas/page-reference";

import {
  COMPARE_CASES_MEASURE_ID,
  compareObservation,
} from "../fixtures/compare-api-fixtures";
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
import { releaseViewportRuns } from "./release-phone-viewport";

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
    await fulfillJson(route, {
      profile: { starting_view_version: 1, state_code: null },
    });
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
    await fulfillJson(route, {
      profile: { starting_view_version: 1, state_code: null },
    });
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
    await fulfillJson(route, {
      profile: { starting_view_version: 1, state_code: "CO" },
    });
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
    await fulfillJson(route, {
      profile: { starting_view_version: 1, state_code: "CO" },
    });
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

const HEADER = ".ux-reset-pro-app .app-header";

async function expectHeaderWithoutAskAtlas(page: Page) {
  const header = page.locator(HEADER);
  await expect(header.getByRole("link", { name: "Ask Atlas" })).toHaveCount(0);
  await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
}

function sidebarAskAtlas(page: Page) {
  return page
    .getByRole("navigation", { name: "Professional workspace" })
    .getByRole("link", { name: "Ask Atlas", exact: true });
}

async function openAskAtlasFromSidebar(page: Page) {
  await expectHeaderWithoutAskAtlas(page);
  const link = sidebarAskAtlas(page);
  if (!(await link.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await link.click();
}

async function readContentAsk(page: Page, testId: string) {
  const href = await page.getByTestId(testId).getAttribute("href");
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

function releaseOnlyBookmark(href: string | null) {
  const url = new URL(href ?? "", "http://127.0.0.1");
  const state = readAskAtlasPageReference(url.pathname, url.searchParams);
  if (state.kind !== "validated") {
    return {
      county: url.searchParams.get("county"),
      geography: null,
      kind: state.kind,
      release: null,
      returnCounty: null,
    };
  }
  const geography = state.reference.context.fields.geography;
  const release = state.reference.context.fields.release;
  return {
    county: url.searchParams.get("county"),
    geography: geography.state === "validated" ? geography.id : null,
    kind: "validated" as const,
    release: release.state === "validated" ? release.id : null,
    returnCounty: new URL(
      state.returnHref,
      "http://127.0.0.1"
    ).searchParams.get("county"),
  };
}

const RELEASE_ONLY_BOOKMARK = {
  county: null,
  geography: null,
  kind: "validated" as const,
  release: "alpha-2026",
  returnCounty: null,
};

test.describe("Ask Atlas dedicated page", () => {
  test("opens Ask Atlas from the sidebar and asks without sending Explore context", async ({
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
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).not.toHaveURL(/metric=/);
    await expect(page).not.toHaveURL(/period=/);
    const exploreUrl = page.url();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore the One Health Atlas",
      })
    ).toBeVisible();
    await expectHeaderWithoutAskAtlas(page);
    await expect(page.getByTestId("ask-atlas-panel")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");

    await expect
      .poll(async () =>
        releaseOnlyBookmark(await sidebarAskAtlas(page).getAttribute("href"))
      )
      .toEqual(RELEASE_ONLY_BOOKMARK);
    await openAskAtlasFromSidebar(page);
    await expect(page).toHaveURL(/\/askatlas/);
    await expect
      .poll(() => releaseOnlyBookmark(page.url()))
      .toEqual(RELEASE_ONLY_BOOKMARK);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ask Atlas" })
    ).toBeVisible();
    await expect(page.getByText("Reviewed literature").first()).toBeVisible();
    const reference = page.getByTestId("ask-atlas-page-reference");
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "release")).toHaveAttribute(
      "data-field-id",
      "alpha-2026"
    );
    await expect(referenceField(page, "geography")).toHaveCount(0);
    await expectHeaderWithoutAskAtlas(page);
    await expect(
      page.getByRole("heading", { name: "What would you like to explore?" })
    ).toBeVisible();
    await expect(page.getByText("Data supplied by the NCBI.")).toBeVisible();
    const layout =
      (page.viewportSize()?.width ?? 1280) <= 800 ? "compact" : "desktop";
    await page.screenshot({
      path: testInfo.outputPath(`ask-atlas-page-${layout}.png`),
    });

    await page.getByLabel("Your research question").fill(QUESTION);
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
    await page.goBack();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).not.toHaveURL(/\/app\/explore/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore the One Health Atlas",
      })
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("county")).toBe("08001");
    await expectHeaderWithoutAskAtlas(page);
    expect(exploreUrl).toContain("/explore");
    expect(testInfo.project.name.length).toBeGreaterThan(0);
  });

  test("can remove one field and clear an unverified page reference", async ({
    page,
  }) => {
    await installUniformCompareMocks(page);
    await page.goto("/compare?compare=08001,08013&scope=CO");
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await expect
      .poll(async () =>
        fieldId(
          (await readContentAsk(page, "compare-ask-atlas")).state,
          "geography"
        )
      )
      .toBe("08001,08013");
    const compareAsk = await readContentAsk(page, "compare-ask-atlas");
    await expectHeaderWithoutAskAtlas(page);
    await page.goto(`${compareAsk.url.pathname}${compareAsk.url.search}`);
    await page.getByRole("link", { name: "Remove geography" }).click();
    await expect(referenceField(page, "geography")).toHaveCount(0);
    await expect(referenceField(page, "release")).toHaveAttribute(
      "data-field-id",
      "alpha-2026"
    );
    await page.getByRole("link", { name: "Clear page reference" }).click();
    await expect(page.getByTestId("ask-atlas-page-reference")).toHaveCount(0);
    await page.goto(
      "/askatlas?page_ref=not-json&county=08001&dataset=alpha-2026"
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
    await installUniformCompareMocks(page);
    await page.goto("/compare?compare=08001,08013&scope=CO");
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await expect
      .poll(async () =>
        fieldId(
          (await readContentAsk(page, "compare-ask-atlas")).state,
          "geography"
        )
      )
      .toBe("08001,08013");
    await expectHeaderWithoutAskAtlas(page);
    await page.getByTestId("compare-ask-atlas").click();
    const reference = page.getByTestId("ask-atlas-page-reference");
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001,08013"
    );

    await page.reload();
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001,08013"
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/compare/);
    await page.goForward();
    await expect(page).toHaveURL(/\/askatlas/);
    await expect(reference).toHaveAttribute(
      "data-reference-state",
      "validated"
    );
    await expect(referenceField(page, "geography")).toHaveAttribute(
      "data-field-id",
      "08001,08013"
    );
  });

  test("does not publish a county from an Explorer browse bookmark", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expect(page).toHaveURL(/\/explore/);
    await expectHeaderWithoutAskAtlas(page);
    await page.goto(
      "/app/explore?county=not-a-county&metric=reported-cases&scope=ALL"
    );
    await expect(page).toHaveURL(/\/explore/);
    const landed = new URL(page.url());
    expect(landed.searchParams.get("county")).toBeNull();
    expect(landed.searchParams.get("metric")).toBeNull();
    expect(landed.searchParams.get("selection")).toBe("required");
    expect(landed.pathname).toBe("/explore");
    await expectHeaderWithoutAskAtlas(page);
    const askHref = await sidebarAskAtlas(page).getAttribute("href");
    expect(askHref ?? "").not.toContain("not-a-county");
  });

  test("follows the sidebar Ask Atlas item from the keyboard without a panel", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expectHeaderWithoutAskAtlas(page);
    const ask = sidebarAskAtlas(page);
    if (!(await ask.isVisible())) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await ask.focus();
    await expect(ask).toBeFocused();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/askatlas/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ask Atlas" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ask-atlas-workspace")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByLabel("Your research question")).toBeVisible();
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
    await page.goto("/askatlas");
    await page.getByLabel("Your research question").fill("First question");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByLabel("Your research question").fill("A later question");
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
    await expect(page).toHaveURL(/\/explore/);
    await openAskAtlasFromSidebar(page);
    await page.getByLabel("Your research question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const failure = page.locator("[data-assistant-state='network_failure']");
    await expect(failure).toBeVisible();
    await expect(failure).toContainText("not a finding");
    await page.goBack();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore the One Health Atlas",
      })
    ).toBeVisible();
  });

  test("reloads Explorer browse without opening a panel", async ({ page }) => {
    await installExploreMocks(page);
    await page.goto(EXPLORE_URL);
    await expect(page).toHaveURL(/\/explore/);
    await page.reload();
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).not.toHaveURL(/metric=/);
    await expect(page).not.toHaveURL(/period=/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expectHeaderWithoutAskAtlas(page);
  });

  test("offers the page from Investigate, Compare, and Action", async ({
    page,
  }) => {
    await installExploreMocks(page);
    await page.goto("/app/investigate?county=08001");
    await expectHeaderWithoutAskAtlas(page);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/compare?compare=08001,08013");
    await expect(page.getByTestId("compare-workspace")).toBeVisible();
    await expect(page.getByTestId("compare-ask-atlas")).toHaveAttribute(
      "href",
      /\/askatlas/
    );
    await expectHeaderWithoutAskAtlas(page);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await page.goto("/app/action");
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole("heading", { name: "Action" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore the One Health Atlas",
      })
    ).toBeVisible();
    await expectHeaderWithoutAskAtlas(page);
  });

  test("uses the same page on a narrow viewport", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Ask Atlas checks run on the mobile project."
    );
    await installExploreMocks(page);
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto(EXPLORE_URL);
    await expect(page).toHaveURL(/\/explore/);
    await expectHeaderWithoutAskAtlas(page);
    await openAskAtlasFromSidebar(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert", "");
    await expect(page.getByTestId("ask-atlas-page-reference")).toHaveCount(0);
    await page.getByLabel("Your research question").scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Your research question")).toBeInViewport();
    await expect(page.getByTestId("ask-atlas-try-asking")).toBeVisible();
    const columns = await page
      .locator(".ux-reset-ask-atlas-workspace .chat-starter-prompts-list")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.split(" ").length).toBe(1);
    await page.screenshot({
      path: testInfo.outputPath("ask-atlas-phone-empty.png"),
    });
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
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("investigate-finding-text")).toHaveCount(0);
    await expectHeaderWithoutAskAtlas(page);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await openAskAtlasFromSidebar(page);
    await expect(page).toHaveURL(/\/askatlas/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Your research question").fill(QUESTION);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Source paper")).toBeVisible();
    expect(Object.keys(chatBodies[0] ?? {}).toSorted()).toEqual([
      "history",
      "message",
    ]);

    await installUniformCompareMocks(page);
    await page.goto("/compare?compare=08001,08013&scope=CO&period=1999-01-01");
    const additional = page.getByTestId("compare-group-additional");
    await expect(additional).toBeVisible();
    const additionalOpen = await additional.evaluate((element) =>
      element instanceof HTMLDetailsElement ? element.open : false
    );
    if (!additionalOpen) {
      await additional.locator("> summary").click();
    }
    await expect(
      additional
        .getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-08001`)
        .getByText("Observation period 2023")
    ).toBeVisible();
    await expect(page.getByTestId("compare-alignment")).toContainText("2023");
    await expect(page.getByTestId("compare-alignment")).not.toContainText(
      "1999"
    );
    await expect
      .poll(async () =>
        fieldId(
          (await readContentAsk(page, "compare-ask-atlas")).state,
          "period"
        )
      )
      .toBe("2023-01-01");
    await expect
      .poll(async () =>
        fieldId(
          (await readContentAsk(page, "compare-ask-atlas")).state,
          "geography"
        )
      )
      .toBe("08001,08013");
    const compare = await readContentAsk(page, "compare-ask-atlas");
    expect(compare.url.searchParams.get("compare")).toBeNull();
    expect(compare.url.searchParams.get("period")).toBeNull();
    if (compare.state.kind === "validated") {
      expect(compare.state.returnHref).toContain("/compare?");
      expect(compare.state.returnHref).toContain("compare=08001%2C08013");
      expect(compare.state.returnHref).toContain("period=2023-01-01");
      expect(compare.state.returnHref).not.toContain("1999");
    }
    await expectHeaderWithoutAskAtlas(page);
    await page.getByTestId("compare-ask-atlas").click();
    await expect(page.getByTestId("ask-atlas-page-reference")).toContainText(
      "does not compare these counties"
    );
    await page.getByTestId("ask-atlas-return").click();
    await expect(page).toHaveURL(/\/compare/);
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
    await expect(page).toHaveURL(/\/explore/);
    await openAskAtlasFromSidebar(page);
    await expect(page).toHaveURL(/\/askatlas/);
    await page.goBack();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator(".app-inset")).not.toHaveAttribute("inert");
    await page.goForward();
    await expect(page).toHaveURL(/\/askatlas/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      await fulfillJson(
        route,
        chatResponse("Reviewed studies describe exposure.", "request-link")
      );
    });
    await page.getByLabel("Your research question").fill(QUESTION);
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
    await openAskAtlasFromSidebar(page);
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Your account" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#ux-reset-ask-atlas")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);
  });
});
