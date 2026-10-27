import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  mixedInsufficientToCompare,
  mixedLiteratureOnly,
  structuredAnswered,
  structuredClarification,
  structuredInsufficient,
} from "../fixtures/ask-atlas-governed-responses";
import { matrixChatResponse } from "../fixtures/ask-atlas-outcome-matrix";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    headers: { "X-Request-ID": "playwright-request" },
    json: body,
    status,
  });
}

async function openAskAtlas(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await fulfillJson(route, {
      profile: { starting_view_version: 1, state_code: null },
    });
  });
  await page.goto("/askatlas");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ask Atlas" })
  ).toBeVisible();
}

test("offers Literature, Structured, and Both on the Ask Atlas page", async ({
  page,
}) => {
  await openAskAtlas(page);
  const group = page.getByRole("group", { name: "Evidence to ask" });
  await expect(group.getByRole("radio", { name: "Literature" })).toBeChecked();
  await expect(group.getByRole("radio", { name: "Structured" })).toBeEnabled();
  await expect(group.getByRole("radio", { name: "Both" })).toBeEnabled();
  await expect(group.getByRole("radio", { name: "Automatic" })).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .include(".ask-atlas-source-modes")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("keeps a literature question on the literature endpoint", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route("**/v1/assistant/**", async (route) => {
    calls.push(route.request().url());
    await fulfillJson(route, {}, 500);
  });
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    await fulfillJson(
      route,
      matrixChatResponse({
        answer: "Reviewed studies describe exposure.",
        assistant_policy_version: "test-v1",
        citations: [
          {
            citation_id: "c1",
            claim_ids: ["claim-1"],
            passage_ids: ["passage-1"],
            pmid: "12345",
            pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
            title: "Source paper",
          },
        ],
        claims: [
          {
            citation_ids: ["c1"],
            claim_id: "claim-1",
            text: "Reviewed studies describe exposure.",
          },
        ],
        configuration_version: "test-v1",
        conversation_id: "conversation-1",
        evidence_state: "limited",
        request_id: "literature-request",
        status: "answered",
      })
    );
  });
  await openAskAtlas(page);
  await page
    .getByLabel("Your research question")
    .fill("What can tick surveillance tell us?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByText("Reviewed studies describe exposure.")
  ).toBeVisible();
  expect(calls).toEqual(["/v1/knowledge-graph/chat"]);
});

test("shows a structured answer and its returned sources", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await page.route("**/v1/assistant/structured", async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, structuredAnswered);
  });
  await openAskAtlas(page);
  await page.getByRole("radio", { name: "Structured" }).check();
  await page
    .getByLabel("Your research question")
    .fill("What is the 2023 Lyme case count for county 36027?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("structured_atlas")).toBeVisible();
  await expect(page.getByText("ANSWERED")).toBeVisible();
  await expect(
    page.getByText(
      "Published surveillance values are privacy-protected floors."
    )
  ).toBeVisible();
  await expect(
    page.getByText("release-1", { exact: true }).first()
  ).toBeVisible();
  expect(body).toMatchObject({
    question: "What is the 2023 Lyme case count for county 36027?",
    source_mode: "Structured",
  });
  expect(body).not.toHaveProperty("history");
  expect(body).not.toHaveProperty("context");
});

test("shows structured clarification and insufficient evidence as returned", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/v1/assistant/structured", async (route) => {
    count += 1;
    await fulfillJson(
      route,
      count === 1 ? structuredClarification : structuredInsufficient
    );
  });
  await openAskAtlas(page);
  await page.getByRole("radio", { name: "Structured" }).check();
  const composer = page.getByLabel("Your research question");
  await composer.fill("What is the 2023 Lyme case count for county 09001?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("NEEDS_CLARIFICATION")).toBeVisible();
  await expect(
    page.getByText(
      "Specify a measure, county FIPS, and complete annual period."
    )
  ).toBeVisible();
  await expect(composer).toHaveValue(
    "What is the 2023 Lyme case count for county 09001?"
  );
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("INSUFFICIENT_EVIDENCE")).toBeVisible();
  await expect(page.getByText("actual_sources_used").first()).toBeVisible();
});

test("keeps mixed branches separate and preserves insufficient_to_compare", async ({
  page,
}) => {
  await page.route("**/v1/assistant/mixed", async (route) => {
    await fulfillJson(route, mixedInsufficientToCompare);
  });
  await openAskAtlas(page);
  await page.getByRole("radio", { name: "Both" }).check();
  await page.getByLabel("Your research question").fill("Compare both sources");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.locator("[data-assistant-kind='mixed']");
  await expect(answer).toHaveAttribute(
    "data-cross-source-state",
    "insufficient_to_compare"
  );
  await expect(answer.getByText("insufficient_to_compare")).toBeVisible();
  await expect(answer.getByText("structured_atlas").first()).toBeVisible();
  await expect(answer.getByText("literature_evidence").first()).toBeVisible();
  await expect(answer.getByText("Source paper")).toBeVisible();
  await expect(answer.locator("[data-branch='structured']")).toHaveAttribute(
    "data-branch-present",
    "true"
  );
  await expect(answer.locator("[data-branch='literature']")).toHaveAttribute(
    "data-branch-present",
    "true"
  );
  await expect(page.getByText("aligned")).toHaveCount(0);
  await expect(page.getByText("discordant")).toHaveCount(0);
});

test("shows a one-branch mixed answer when literature is null", async ({
  page,
}) => {
  await page.route("**/v1/assistant/mixed", async (route) => {
    await fulfillJson(route, {
      ...mixedLiteratureOnly,
      literature: null,
      actual_sources_used: [],
      outcome: "SOURCE_UNAVAILABLE",
    });
  });
  await openAskAtlas(page);
  await page.getByRole("radio", { name: "Both" }).check();
  await page.getByLabel("Your research question").fill("Unavailable branch");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.locator("[data-assistant-kind='mixed']");
  await expect(answer.getByText("SOURCE_UNAVAILABLE")).toBeVisible();
  await expect(answer.locator("[data-branch='structured']")).toHaveAttribute(
    "data-branch-present",
    "false"
  );
  await expect(answer.locator("[data-branch='literature']")).toHaveAttribute(
    "data-branch-present",
    "false"
  );
  await expect(answer).toHaveAttribute("data-cross-source-state", "null");
});

test("shows an unverified state when a structured body is not consumable", async ({
  page,
}) => {
  await page.route("**/v1/assistant/structured", async (route) => {
    await fulfillJson(route, { answer: { outcome: "aligned" } });
  });
  await openAskAtlas(page);
  await page.getByRole("radio", { name: "Structured" }).check();
  await page.getByLabel("Your research question").fill("Bad payload");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Response could not be verified.")).toBeVisible();
});
