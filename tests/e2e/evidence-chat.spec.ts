import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function response(
  status: string,
  evidence_state: string,
  answer: string,
  id: number
) {
  return {
    request_id: `request-${id}`,
    conversation_id: `conversation-${id}`,
    conversation_token: "must-not-persist",
    configuration_version: "test-v1",
    assistant_policy_version: "test-v1",
    status,
    answer,
    evidence_state,
    source_used: "literature_evidence",
    claims:
      status === "answered"
        ? [{ claim_id: "c1", text: answer, citation_ids: ["p1"] }]
        : [],
    citations:
      status === "answered"
        ? [
            {
              citation_id: "p1",
              pmid: "12345",
              title: "Source paper",
              pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
              claim_ids: ["c1"],
              passage_ids: ["passage-1"],
              pmcid: "PMC123",
              section_labels: ["Discussion"],
              corpus_rules_version: "secret-version",
            },
          ]
        : [],
  };
}

async function openSavedHistoryIfMobile(page: Page) {
  const recentChats = page.getByRole("button", {
    name: /^Recent chats \(\d+\)$/,
  });
  if (!(await recentChats.isVisible())) {
    return;
  }
  if ((await recentChats.getAttribute("aria-expanded")) !== "true") {
    await recentChats.click();
  }
}

async function ask(page: Page, question: string) {
  const input = page.getByLabel("Your question");
  const button = page.getByRole("button", { name: "Ask", exact: true });
  await expect(async () => {
    await input.fill("");
    await input.fill(question);
    await expect(button).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await button.click();
}

test("answered evidence, safe citations, local continuation, and history controls", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: response(
        "answered",
        requests.length === 1 ? "limited" : "mixed",
        "Study context matters for interpretation.",
        requests.length
      ),
    });
  });
  await page.goto("/assistant");
  await ask(page, "What does the literature say?");
  await expect(page.getByText("Evidence: Limited evidence")).toBeVisible();
  await expect(page.getByText("Source: Literature evidence")).toBeVisible();
  await expect(page.getByText("1 source for this answer")).toBeVisible();
  const citation = page.getByRole("link", { name: /Source paper/i });
  await expect(citation).toHaveAttribute(
    "href",
    "https://pubmed.ncbi.nlm.nih.gov/12345/"
  );
  await expect(citation).toHaveAttribute("rel", "noopener noreferrer");
  await expect(citation).toHaveAttribute("target", "_blank");
  await expect(page.getByText(/PMC123|secret-version|Discussion/)).toHaveCount(
    0
  );
  await ask(page, "And what about another context?");
  await expect(page.getByText("Evidence: Mixed evidence")).toBeVisible();
  expect(requests[1]).toMatchObject({
    message: "And what about another context?",
    history: [
      { role: "user", content: "What does the literature say?" },
      {
        role: "assistant",
        content: "Study context matters for interpretation.",
      },
    ],
  });
  expect(JSON.stringify(requests)).not.toContain("must-not-persist");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("one-health-lyme-gap-atlas:knowledge-chat:v1")
    )
  ).not.toContain("must-not-persist");
  await page.reload();
  await expect(page.getByText("Evidence: Mixed evidence")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByText("Start with a research question")).toBeVisible();
  await openSavedHistoryIfMobile(page);
  await page
    .getByRole("button", { name: /Delete What does the literature say/ })
    .click();
  await expect(page.getByRole("button", { name: "Clear all" })).toHaveCount(0);
  await expect(
    page.getByText(/saved in this browser for up to 30 days/)
  ).toBeVisible();
  await ask(page, "Another question");
  await expect(page.getByText("Evidence: Mixed evidence")).toBeVisible();
  await openSavedHistoryIfMobile(page);
  await page
    .getByRole("button", { name: "Clear all", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Clear all" })).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include(".evidence-chat")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("corpus availability, conflicting evidence, refusal, unavailable and capacity retry", async ({
  page,
}) => {
  const states = [
    [
      "no_evidence",
      "no_relevant_corpus_evidence",
      "No reviewed passages matched this question.",
      200,
    ],
    ["answered", "conflicting", "Studies disagree across settings.", 200],
    [
      "safety_refusal",
      "not_applicable",
      "I cannot give individual medical advice.",
      200,
    ],
    [
      "evidence_unavailable",
      "evidence_unavailable",
      "Evidence is temporarily unavailable.",
      503,
    ],
    ["answered", "consistent", "Evidence is now available.", 200],
    [
      "capacity_limited",
      "not_applicable",
      "The assistant is at capacity. Please retry.",
      503,
    ],
    ["answered", "single_study", "One study is available.", 200],
  ] as const;
  let index = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    const [status, evidence, answer, httpStatus] =
      states[Math.min(index, states.length - 1)];
    index += 1;
    await route.fulfill({
      status: httpStatus,
      json: response(status, evidence, answer, index),
    });
  });
  await page.goto("/assistant");
  await ask(page, "No evidence?");
  const lastAssistant = page.locator(".chat-turn.assistant").last();
  await expect(lastAssistant).toContainText(
    "No reviewed passages matched this question."
  );
  await expect(lastAssistant).toContainText(
    "Atlas does not currently have relevant reviewed literature in its governed corpus for this question."
  );
  await expect(lastAssistant).toContainText(
    "This does not mean no scientific evidence exists elsewhere."
  );
  await expect(lastAssistant).not.toContainText("PubMed");
  await expect(lastAssistant.locator(".citation-list")).toHaveCount(0);
  await expect(lastAssistant.locator(".chat-answer-sources")).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toHaveValue("No evidence?");
  await expect(page.getByLabel("Your question")).toBeFocused();

  await ask(page, "Conflicts?");
  await expect(page.getByText("Evidence: Conflicting evidence")).toBeVisible();

  await ask(page, "Medical advice?");
  await expect(lastAssistant).toContainText(
    "I cannot give individual medical advice."
  );
  await expect(lastAssistant.locator(".chat-answer-sources")).toHaveCount(0);
  await expect(
    page.getByText("Evidence: Evidence state not applicable")
  ).toHaveCount(0);

  await ask(page, "Unavailable?");
  await expect(lastAssistant).toContainText(
    "Evidence is temporarily unavailable."
  );
  await expect(lastAssistant.locator(".chat-answer-sources")).toHaveCount(0);
  await expect(lastAssistant).toContainText("Evidence service unavailable.");
  await expect(lastAssistant).not.toContainText("governed corpus");
  const unavailableRetry = page.getByRole("button", {
    name: "Retry",
    exact: true,
  });
  await unavailableRetry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Evidence: Consistent evidence")).toBeVisible();
  await expect(page.getByText("Evidence service unavailable.")).toHaveCount(0);
  await expect(page.locator(".chat-turn.user")).toHaveCount(4);

  await ask(page, "Capacity?");
  await expect(lastAssistant).toContainText(
    "The assistant is at capacity. Please retry."
  );
  await expect(lastAssistant).toContainText("Temporarily at capacity.");
  await expect(lastAssistant.locator(".chat-answer-sources")).toHaveCount(0);
  await expect(lastAssistant.locator(".citation-list")).toHaveCount(0);
  const capacityRetry = page.getByRole("button", { name: "Retry later" });
  await capacityRetry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Evidence: Single-study evidence")).toBeVisible();
  await expect(page.getByText("Temporarily at capacity.")).toHaveCount(0);
});

test("network and rate-limit errors preserve the question for retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    calls += 1;
    await route.fulfill(
      calls === 1
        ? { status: 429, json: { detail: "Too many requests" } }
        : {
            json: response(
              "answered",
              "single_study",
              "One study found an association.",
              calls
            ),
          }
    );
  });
  await page.goto("/assistant");
  await ask(page, "Rate limited?");
  await expect(page.locator(".chat-error")).toContainText("busy");
  await expect(page.locator(".chat-error")).toHaveAttribute(
    "data-assistant-state",
    "rate_limited"
  );
  await expect(page.getByText(/governed corpus/)).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toHaveValue("Rate limited?");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Evidence: Single-study evidence")).toBeVisible();
  await expect(page.locator(".chat-turn")).toHaveCount(2);
});

test("network failure, corpus edit, keyboard focus, and mobile overflow stay distinct", async ({
  page,
}) => {
  let mode: "offline" | "gap" | "answered" = "offline";
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    if (mode === "offline") {
      await route.abort("failed");
      return;
    }
    const gap = mode === "gap";
    await route.fulfill({
      json: response(
        gap ? "no_evidence" : "answered",
        gap ? "no_relevant_corpus_evidence" : "limited",
        gap
          ? "No reviewed passages matched this question."
          : "A narrower question matched one study.",
        gap ? 1 : 2
      ),
    });
  });
  await page.goto("/assistant");
  await ask(page, "Example surveillance question");
  const failure = page.locator(".chat-error");
  await expect(failure).toContainText("Connection problem.");
  await expect(failure).toContainText("could not complete the request");
  await expect(failure).toHaveAttribute(
    "data-assistant-state",
    "network_failure"
  );
  await expect(page.getByText(/governed corpus/)).toHaveCount(0);
  await expect(page.locator(".chat-turn")).toHaveCount(0);
  mode = "gap";
  const retry = page.getByRole("button", { name: "Retry", exact: true });
  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/governed corpus for this question/)
  ).toBeVisible();
  await expect(page.locator(".chat-error")).toHaveCount(0);
  await expect(page.locator(".citation-list")).toHaveCount(0);
  const edit = page.getByRole("button", { name: "Edit question" });
  await edit.focus();
  await page.keyboard.press("Enter");
  const question = page.getByLabel("Your question");
  await expect(question).toBeFocused();
  await expect(question).toHaveValue("Example surveillance question");
  mode = "answered";
  await question.fill("Example surveillance question about Ixodes in Maine");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Evidence: Limited evidence")).toBeVisible();
  await expect(page.locator(".chat-turn.user")).toHaveCount(2);
  await expect(
    page.getByText(/governed corpus for this question/)
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(overflow).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include(".evidence-chat")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("assistant workspace keeps a docked composer and scrollable transcript", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    const payload = route.request().postDataJSON() as { message?: string };
    const index = payload.message?.includes("second") ? 2 : 1;
    await route.fulfill({
      json: response(
        "answered",
        "limited",
        `Answer paragraph ${index}. `.repeat(24),
        index
      ),
    });
  });
  await page.goto("/assistant");
  const composer = page.locator(".chat-composer-dock");
  const transcript = page.locator(".chat-transcript");
  await expect(composer).toBeVisible();
  await expect(transcript).toBeVisible();
  await ask(page, "First long thread question");
  await expect(page.locator(".chat-turn.assistant").first()).toBeVisible();
  await ask(page, "Second long thread question");
  await expect(page.locator(".chat-turn.assistant")).toHaveCount(2);
  const layout = await page.evaluate(() => {
    const dock = document.querySelector(".chat-composer-dock");
    const viewport = document.querySelector(".chat-transcript");
    const assistant = document.querySelector(".chat-turn.assistant");
    const panel = document.querySelector(".chat-panel");
    if (!dock || !viewport || !assistant || !panel) {
      return null;
    }
    const dockBox = dock.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const panelWidth = panel.getBoundingClientRect().width;
    return {
      assistantMeasure: assistant.getBoundingClientRect().width,
      dockVisible: dockBox.top < window.innerHeight && dockBox.bottom > 0,
      panelWidth,
      transcriptScrollable: viewport.scrollHeight > viewport.clientHeight,
      transcriptAboveComposer: viewportBox.bottom <= dockBox.top + 8,
    };
  });
  expect(layout?.dockVisible).toBe(true);
  expect(layout?.transcriptScrollable).toBe(true);
  expect(layout?.transcriptAboveComposer).toBe(true);
  expect(layout?.assistantMeasure).toBeLessThanOrEqual(768);
  expect(layout?.assistantMeasure).toBeLessThan(
    (layout?.panelWidth ?? 0) * 0.9
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(
    composer.getByRole("button", { name: "Ask", exact: true })
  ).toBeVisible();
  await expect(composer).toBeInViewport();
  await expect(transcript).toBeVisible();
});
