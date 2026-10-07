import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  EXPLORE_CASES_MEASURE_ID,
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsEnvelope,
  exploreScoresFixture,
} from "../fixtures/explore-api-fixtures";

const EXPLORE_URL =
  "/app/explore?county=08001&dataset=alpha-2026&metric=reported-cases&scope=ALL";
const WORKSPACE_URL =
  "/app/assistant?county=08001&dataset=alpha-2026&metric=reported-cases&scope=ALL";

function literatureAnswer(answer: string, requestId: string) {
  return {
    answer,
    assistant_policy_version: "test-v1",
    citations: [
      {
        citation_id: "c1",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        source_label: "Reported corpus",
        title: "Source paper",
      },
    ],
    claims: [{ citation_ids: ["c1"], claim_id: "claim-1", text: answer }],
    configuration_version: "test-v1",
    conversation_id: "conversation-1",
    conversation_token: "must-not-persist",
    evidence_state: "limited",
    request_id: requestId,
    source_used: "literature_evidence",
    status: "answered",
  };
}

function chatBody(message: string, requestId: string): unknown {
  switch (message) {
    case "Literature question": {
      return literatureAnswer("Reviewed studies describe exposure.", requestId);
    }
    case "Compare question": {
      return {
        ...literatureAnswer("The sources cannot be compared.", requestId),
        evidence_state: "insufficient_to_compare",
      };
    }
    case "Corpus question": {
      return {
        ...literatureAnswer("No passages matched this question.", requestId),
        citations: [],
        claims: [],
        evidence_state: "no_relevant_corpus_evidence",
        status: "no_evidence",
      };
    }
    case "Refusal question": {
      return {
        ...literatureAnswer(
          "I cannot give individual medical advice.",
          requestId
        ),
        citations: [],
        claims: [],
        evidence_state: "not_applicable",
        status: "safety_refusal",
      };
    }
    case "Missing citation question": {
      return {
        ...literatureAnswer("This answer has no citation.", requestId),
        citations: [],
        claims: [],
      };
    }
    case "Mismatched source question": {
      const payload = literatureAnswer("Mismatched source answer.", requestId);
      payload.citations[0].claim_ids = ["other-claim"];
      return payload;
    }
    case "Partial question": {
      return { answer: "Partial only", status: "answered" };
    }
    case "Aligned question": {
      return {
        ...literatureAnswer("These sources are aligned.", requestId),
        cross_source_state: "aligned",
        evidence_state: "aligned",
      };
    }
    case "Both question": {
      return {
        ...literatureAnswer(
          "Structured and literature both answered.",
          requestId
        ),
        actual_sources_used: ["structured_atlas", "literature_evidence"],
        requested_source_mode: "Both",
      };
    }
    case "Capacity question": {
      return {
        ...literatureAnswer("The assistant is at capacity.", requestId),
        citations: [],
        claims: [],
        evidence_state: "not_applicable",
        status: "capacity_limited",
      };
    }
    default: {
      return literatureAnswer("Reviewed studies describe exposure.", requestId);
    }
  }
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

async function installChat(page: Page) {
  let calls = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    calls += 1;
    const body = route.request().postDataJSON() as { message?: string };
    const message = body.message ?? "";
    if (message === "Timeout question") {
      await fulfillJson(route, { detail: "gateway timeout" }, 504);
      return;
    }
    if (message === "Rate question") {
      await fulfillJson(route, { detail: "Too many requests" }, 429);
      return;
    }
    if (message === "Capacity question") {
      await fulfillJson(route, chatBody(message, `request-${calls}`), 503);
      return;
    }
    await fulfillJson(route, chatBody(message, `request-${calls}`));
  });
}

async function ask(page: Page, question: string) {
  const root = page.locator(
    "#ux-reset-ask-atlas, [data-testid='ask-atlas-workspace']"
  );
  const input = root.getByLabel("Your question");
  await input.fill(question);
  await root.getByRole("button", { name: "Ask", exact: true }).click();
}

function preservedFilters(url: string) {
  const parsed = new URL(url, "http://127.0.0.1:3100");
  return {
    county: parsed.searchParams.get("county"),
    dataset: parsed.searchParams.get("dataset"),
    metric: parsed.searchParams.get("metric"),
    pathname: parsed.pathname,
    scope: parsed.searchParams.get("scope"),
  };
}

async function expectAnswerContract(
  page: Page,
  surface: "sidecar" | "workspace"
) {
  const root =
    surface === "sidecar"
      ? page.getByTestId("ask-atlas-panel")
      : page.getByTestId("ask-atlas-workspace");

  await ask(page, "Literature question");
  await expect(
    root.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  await expect(root.getByText("Source: Literature evidence")).toBeVisible();
  await expect(root.getByText("Evidence: Limited evidence")).toBeVisible();
  await expect(root.getByRole("link", { name: /Source paper/ })).toBeVisible();
  await expect(root.getByText("Reported corpus")).toBeVisible();
  await expect(root.getByRole("button", { name: /structured/i })).toHaveCount(
    0
  );
  await expect(root.getByRole("tab", { name: /both/i })).toHaveCount(0);
  if (surface === "workspace") {
    await expect(
      root.getByText("Structured and Both modes are not available.")
    ).toBeVisible();
  }

  const results = await new AxeBuilder({ page })
    .include(
      surface === "sidecar"
        ? "#ux-reset-ask-atlas"
        : "[data-testid='ask-atlas-workspace']"
    )
    .analyze();
  expect(results.violations).toEqual([]);

  await ask(page, "Compare question");
  await expect(
    root.getByText("Evidence: Insufficient evidence to compare")
  ).toBeVisible();
  await expect(root.getByText("Evidence service unavailable.")).toHaveCount(0);

  await ask(page, "Corpus question");
  await expect(
    root.getByText(/governed corpus for this question/)
  ).toBeVisible();
  await expect(root.getByRole("alert")).toHaveCount(0);

  await ask(page, "Refusal question");
  await expect(
    root.getByText("I cannot give individual medical advice.")
  ).toBeVisible();
  await expect(
    root.locator("[data-assistant-state='safety_refusal']")
  ).toBeVisible();

  await ask(page, "Missing citation question");
  const missing = root.locator("[data-close-reason='missing_citation']");
  await expect(missing).toBeVisible();
  await expect(root.getByText("This answer has no citation.")).toHaveCount(0);
  await expect(root.getByText("Reviewed literature source")).toHaveCount(0);

  await ask(page, "Mismatched source question");
  await expect(
    root.locator("[data-close-reason='mismatched_source']")
  ).toBeVisible();
  await expect(root.getByText("Mismatched source answer.")).toHaveCount(0);

  await ask(page, "Partial question");
  await expect(root.locator("[data-close-reason='malformed']")).toBeVisible();
  await expect(root.getByText("Partial only")).toHaveCount(0);

  await ask(page, "Aligned question");
  await expect(
    root.locator("[data-close-reason='unsupported_comparison']")
  ).toBeVisible();
  await expect(
    root
      .locator(".chat-transcript")
      .getByText(/aligned|discordant|partially aligned/i)
  ).toHaveCount(0);
  await expect(root.getByText("These sources are aligned.")).toHaveCount(0);

  await ask(page, "Both question");
  await expect(
    root.locator("[data-close-reason='unsupported_source']")
  ).toBeVisible();
  await expect(root.getByText("Source: Both")).toHaveCount(0);
  await expect(root.getByText("Source: Structured")).toHaveCount(0);

  await ask(page, "Timeout question");
  const timeout = root.locator("[data-assistant-state='timeout']");
  await expect(timeout).toBeVisible();
  await expect(timeout).toContainText("timed out");
  await expect(timeout).not.toContainText("Insufficient");

  await ask(page, "Rate question");
  await expect(
    root.locator("[data-assistant-state='rate_limited']")
  ).toBeVisible();

  await ask(page, "Capacity question");
  await expect(root.getByText("Temporarily at capacity.")).toBeVisible();
  await expect(
    root.locator("[data-assistant-state='capacity_limited']")
  ).toBeVisible();
  await expect(root.getByText(/governed corpus for this question/)).toHaveCount(
    1
  );
}

test("sidecar enforces the answer contract without changing Explore", async ({
  page,
}) => {
  await installExploreMocks(page);
  await installChat(page);
  await page.goto(EXPLORE_URL);
  await expect(page).toHaveURL(/period=2023-01-01/);
  const before = page.url();
  await page.getByTestId("ask-atlas-launcher").click();
  await expect(page.getByTestId("ask-atlas-panel")).toBeVisible();
  await expect(
    page
      .getByTestId("ask-atlas-panel")
      .getByText("Start with a research question")
  ).toBeVisible();
  await expectAnswerContract(page, "sidecar");
  expect(page.url()).toBe(before);
  expect(new URL(page.url()).searchParams.get("conversation")).toBeNull();
  expect(preservedFilters(page.url())).toStrictEqual(
    preservedFilters(EXPLORE_URL)
  );
  await expect(page.getByTestId("explore-workspace")).toBeVisible();
});

test("workspace enforces the same answer contract without changing filters", async ({
  page,
}) => {
  await installExploreMocks(page);
  await installChat(page);
  await page.goto(WORKSPACE_URL);
  await expect(page.getByTestId("ask-atlas-workspace")).toBeVisible();
  await expect(page.getByText("Start with a research question")).toBeVisible();
  await expectAnswerContract(page, "workspace");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/app/assistant");
  expect(preservedFilters(page.url())).toStrictEqual(
    preservedFilters(WORKSPACE_URL)
  );
  expect(url.searchParams.get("conversation")).toBe("conversation-1");
});

test("sidecar and workspace ignore an older in-flight answer", async ({
  page,
}) => {
  await installExploreMocks(page);
  let releaseFirst = () => {};
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    calls += 1;
    if (calls === 1) {
      await firstHeld;
      try {
        await fulfillJson(
          route,
          literatureAnswer("First answer must not appear.", "request-1")
        );
      } catch {
        // The browser already aborted this request when the chat changed.
      }
      return;
    }
    await fulfillJson(
      route,
      literatureAnswer("Second answer stays.", "request-2")
    );
  });

  await page.goto(EXPLORE_URL);
  await page.getByTestId("ask-atlas-launcher").click();
  await ask(page, "First question");
  await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await ask(page, "Second question");
  await expect(page.getByText("Second answer stays.")).toBeVisible();
  releaseFirst();
  await expect(page.getByText("First answer must not appear.")).toHaveCount(0);
  await expect(page.getByText("Second answer stays.")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("county")).toBe("08001");

  await page.goto(WORKSPACE_URL);
  calls = 0;
  let releaseWorkspace = () => {};
  const workspaceHeld = new Promise<void>((resolve) => {
    releaseWorkspace = resolve;
  });
  await page.unroute("**/v1/knowledge-graph/chat");
  let workspaceCalls = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    workspaceCalls += 1;
    if (workspaceCalls === 1) {
      await workspaceHeld;
      try {
        await fulfillJson(
          route,
          literatureAnswer("Workspace first must not appear.", "request-w1")
        );
      } catch {
        // The browser already aborted this request when the chat changed.
      }
      return;
    }
    await fulfillJson(
      route,
      literatureAnswer("Workspace second stays.", "request-w2")
    );
  });
  await ask(page, "Workspace first");
  await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await ask(page, "Workspace second");
  await expect(page.getByText("Workspace second stays.")).toBeVisible();
  releaseWorkspace();
  await expect(page.getByText("Workspace first must not appear.")).toHaveCount(
    0
  );
  expect(new URL(page.url()).searchParams.get("metric")).toBe("reported-cases");
});
