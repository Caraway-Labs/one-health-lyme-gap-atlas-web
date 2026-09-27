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
  await page.goto("/knowledge-graph");
  await ask(page, "What does the literature say?");
  await expect(page.getByText("Evidence: Limited evidence")).toBeVisible();
  await expect(page.getByText("Source: Literature evidence")).toBeVisible();
  const citation = page.getByRole("link", { name: "Source paper" });
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
  await page
    .getByRole("button", { name: /Delete What does the literature say/ })
    .click();
  await expect(page.getByText("No saved conversations yet.")).toBeVisible();
  await ask(page, "Another question");
  await expect(page.getByText("Evidence: Mixed evidence")).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByText("No saved conversations yet.")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".evidence-chat")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("no evidence, conflicting evidence, safety refusal, unavailable response and retry", async ({
  page,
}) => {
  const states = [
    [
      "no_evidence",
      "no_relevant_corpus_evidence",
      "No relevant evidence was found.",
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
  await page.goto("/knowledge-graph");
  for (const [question, indicator] of [
    ["No evidence?", "No relevant corpus evidence"],
    ["Conflicts?", "Conflicting evidence"],
    ["Medical advice?", "Evidence state not applicable"],
    ["Unavailable?", "Evidence unavailable"],
  ]) {
    await ask(page, question);
    await expect(page.getByText(`Evidence: ${indicator}`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Retry question" }).click();
  await expect(page.getByText("Evidence: Consistent evidence")).toBeVisible();
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
  await page.goto("/knowledge-graph");
  await ask(page, "Rate limited?");
  await expect(page.locator(".chat-error")).toContainText("busy");
  await expect(page.getByLabel("Your question")).toHaveValue("Rate limited?");
  await page.getByRole("button", { name: "Retry question" }).click();
  await expect(page.getByText("Evidence: Single study")).toBeVisible();
});
