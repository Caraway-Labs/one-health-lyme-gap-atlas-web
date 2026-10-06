import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsEnvelope,
  exploreScoresFixture,
  EXPLORE_CASES_MEASURE_ID,
} from "../fixtures/explore-api-fixtures";

const EXPLORE_URL =
  "/app/explore?county=08001&dataset=alpha-2026&metric=reported-cases&scope=ALL";
const QUESTION = "How do reviewed studies describe tick exposure?";

function chatResponse(
  answer: string,
  requestId: string,
  conversationId = requestId
) {
  return {
    answer,
    assistant_policy_version: "test-v1",
    citations: [
      {
        citation_id: "p1",
        claim_ids: ["c1"],
        passage_ids: ["passage-1"],
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        title: "Source paper",
      },
    ],
    claims: [{ citation_ids: ["p1"], claim_id: "c1", text: answer }],
    configuration_version: "test-v1",
    conversation_id: conversationId,
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

async function installExploreMocks(page: Page) {
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

async function openSidecar(page: Page) {
  await page.getByTestId("ask-atlas-launcher").click();
  await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
}

test("continues one sidecar request in the research workspace", async ({
  page,
}, testInfo) => {
  const requests: Record<string, unknown>[] = [];
  await installExploreMocks(page);
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await fulfillJson(
      route,
      chatResponse(
        "Reviewed studies describe exposure.",
        "request-1",
        "conversation-1"
      )
    );
  });
  await page.goto(EXPLORE_URL);
  await openSidecar(page);
  await page.getByLabel("Your question").fill(QUESTION);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const panel = page.getByTestId("ask-atlas-panel");
  await expect(
    panel.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  await panel.getByRole("link", { name: "Open full workspace" }).click();
  await expect(page).toHaveURL(
    /\/app\/assistant\?county=08001&dataset=alpha-2026&conversation=conversation-1/
  );
  await expect(
    page.getByRole("heading", { name: "Atlas Assistant" })
  ).toBeVisible();
  await expect(
    page.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  await expect(
    page.locator("[data-assistant-county-state='identified']")
  ).toContainText("Adams");
  await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(Object.keys(requests[0] ?? {}).toSorted()).toEqual([
    "history",
    "message",
  ]);
  expect(JSON.stringify(requests)).not.toContain("must-not-persist");

  await page.reload();
  await expect(
    page.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  expect(requests).toHaveLength(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/explore/);
  await expect(page.getByTestId("ask-atlas-launcher")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/assistant\?/);
  await expect(
    page.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  expect(requests).toHaveLength(1);

  const stored = await page.evaluate(() =>
    localStorage.getItem("one-health-lyme-gap-atlas:knowledge-chat:v1")
  );
  expect(stored).toContain("conversation-1");
  expect(stored).not.toContain("must-not-persist");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(testInfo.project.name).toMatch(/desktop|mobile/);
});

test("recovers an unknown conversation, a cleared history, and a failed request", async ({
  page,
}) => {
  await installExploreMocks(page);
  let chatCalls = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    chatCalls += 1;
    if (chatCalls === 1) {
      await fulfillJson(route, { detail: "chat unavailable" }, 500);
      return;
    }
    await fulfillJson(
      route,
      chatResponse(
        "Recovered after retry.",
        "request-retry",
        "conversation-retry"
      )
    );
  });

  await page.goto("/app/assistant?conversation=missing-id");
  await expect(
    page.getByText("Conversation not found in this browser.")
  ).toBeVisible();
  await expect(page.getByLabel("Your question")).toBeEnabled();
  expect(chatCalls).toBe(0);
  const missing = await new AxeBuilder({ page }).analyze();
  expect(missing.violations).toEqual([]);

  await page.getByLabel("Your question").fill("Question during an outage");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByTestId("ask-atlas-workspace").getByRole("alert")
  ).toBeVisible();
  await expect(page.locator(".citation-list")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Recovered after retry.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Source paper/ })).toBeVisible();

  const desktopClear = page.locator(
    ".chat-history-desktop .chat-history-clear"
  );
  if (await desktopClear.isVisible()) {
    await desktopClear.click();
  } else {
    await page.getByRole("button", { name: /Recent chats/ }).click();
    await page
      .locator(".chat-history-mobile-sheet .chat-history-clear")
      .click();
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear all" })
    .click();
  await expect(page.getByText("Start with a research question")).toBeVisible();
  await expect(page).not.toHaveURL(/conversation=/);

  await page.evaluate(() => {
    localStorage.removeItem("one-health-lyme-gap-atlas:knowledge-chat:v1");
  });
  await page.goto("/app/assistant?conversation=conversation-retry");
  await expect(
    page.getByText("Conversation not found in this browser.")
  ).toBeVisible();
  await expect(page.getByText("Recovered after retry.")).toHaveCount(0);
});

test("keeps a county missing from the release out of the literature request", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await installExploreMocks(page);
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await fulfillJson(
      route,
      chatResponse("Literature only.", "request-stale", "conversation-stale")
    );
  });
  await page.goto("/app/assistant?county=99999&dataset=alpha-2026");
  await expect(
    page.getByText("County unavailable in this release.")
  ).toBeVisible();
  await expect(page.getByText("99999")).toBeVisible();
  await page
    .getByLabel("Your question")
    .fill("Question without county evidence");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Literature only.")).toBeVisible();
  expect(requests[0]).toStrictEqual({
    history: [],
    message: "Question without county evidence",
  });
  await expect(page.getByRole("button", { name: /Structured/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Both/ })).toHaveCount(0);
});

test("ignores a late answer after a newer question is saved", async ({
  page,
}) => {
  const pending: { resolve: (value: unknown) => void }[] = [];
  await installExploreMocks(page);
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    const body = route.request().postDataJSON() as { message: string };
    await new Promise((resolve) => {
      pending.push({ resolve });
    });
    const id = body.message.includes("Old") ? "old" : "new";
    await fulfillJson(
      route,
      chatResponse(
        id === "old"
          ? "Old answer must not replace history."
          : "New answer stays.",
        `request-${id}`,
        `conversation-${id}`
      )
    );
  });
  await page.goto("/app/assistant");
  await page.getByLabel("Your question").fill("Old question");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).first().click();
  await expect(page.getByText("Searching reviewed evidence…")).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toBeEnabled();
  await page.getByLabel("Your question").fill("New question");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  pending[1]?.resolve(undefined);
  await expect(page.getByText("New answer stays.")).toBeVisible();
  pending[0]?.resolve(undefined);
  await expect(
    page.getByText("Old answer must not replace history.")
  ).toHaveCount(0);
  await expect(page.getByText("New answer stays.")).toBeVisible();
});
