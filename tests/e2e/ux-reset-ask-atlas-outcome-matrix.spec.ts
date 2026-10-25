import { accessSync, constants, copyFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";

import {
  ASK_ATLAS_OUTCOME_MATRIX,
  CORPUS_GAP_HEADING,
  LIMITED_CLAIM_SCOPE,
  OMITTED_LIMITED_CLAIM,
  recoverySingleStudyResponse,
  SINGLE_STUDY_ANSWER,
  type OutcomeMatrixCase,
  type OutcomeMatrixControl,
} from "../fixtures/ask-atlas-outcome-matrix";
import {
  EXPLORE_CASES_MEASURE_ID,
  exploreGeometryFixture,
  exploreMeasuresEnvelope,
  exploreMetadataFixture,
  exploreObservationsEnvelope,
  exploreScoresFixture,
} from "../fixtures/explore-api-fixtures";

const WORKSPACE_URL = "/askatlas";
const OPTIONAL_ARTIFACT_DIRECTORY = "/opt/cursor/artifacts";

/** Required images go to the Playwright output dir. Artifact copies are optional. */
async function saveOutcomeScreenshot(
  root: Locator,
  testInfo: TestInfo,
  filename: string
) {
  const outputPath = testInfo.outputPath(filename);
  await root.screenshot({ path: outputPath });
  try {
    accessSync(OPTIONAL_ARTIFACT_DIRECTORY, constants.W_OK);
    copyFileSync(outputPath, join(OPTIONAL_ARTIFACT_DIRECTORY, filename));
  } catch {
    // CI checkouts have no writable /opt/cursor/artifacts directory.
  }
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ json: body, status });
}

async function installExploreMocks(page: Page) {
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

async function installOutcomeRoute(page: Page, outcome: OutcomeMatrixCase) {
  const messages: string[] = [];
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    const posted = route.request().postDataJSON() as { message?: string };
    messages.push(posted.message ?? "");
    if (messages.length > 1) {
      await fulfillJson(route, recoverySingleStudyResponse());
      return;
    }
    if (outcome.transport === "network") {
      await route.abort("failed");
      return;
    }
    await fulfillJson(route, outcome.body, outcome.status);
  });
  return messages;
}

async function ask(page: Page, question: string) {
  const root = page.getByTestId("ask-atlas-workspace");
  const input = root.getByLabel("Your research question");
  await input.fill(question);
  await root.getByRole("button", { name: "Ask", exact: true }).click();
}

function controlButton(root: Locator, control: OutcomeMatrixControl) {
  switch (control) {
    case "edit": {
      return root.getByRole("button", { name: "Edit question" });
    }
    case "none": {
      return null;
    }
    case "retry": {
      return root.getByRole("button", { name: "Retry", exact: true });
    }
    case "retry-later": {
      return root.getByRole("button", { name: "Retry later" });
    }
    default: {
      const unhandled: never = control;
      return unhandled;
    }
  }
}

async function expectControls(root: Locator, control: OutcomeMatrixControl) {
  const retry = root.getByRole("button", { name: "Retry", exact: true });
  const later = root.getByRole("button", { name: "Retry later" });
  const edit = root.getByRole("button", { name: "Edit question" });
  switch (control) {
    case "edit": {
      await expect(edit).toHaveCount(1);
      await expect(retry).toHaveCount(0);
      await expect(later).toHaveCount(0);
      return;
    }
    case "none": {
      await expect(edit).toHaveCount(0);
      await expect(retry).toHaveCount(0);
      await expect(later).toHaveCount(0);
      return;
    }
    case "retry": {
      await expect(retry).toHaveCount(1);
      await expect(later).toHaveCount(0);
      await expect(edit).toHaveCount(0);
      return;
    }
    case "retry-later": {
      await expect(later).toHaveCount(1);
      await expect(retry).toHaveCount(0);
      await expect(edit).toHaveCount(0);
      return;
    }
    default: {
      const unhandled: never = control;
      throw new Error(unhandled);
    }
  }
}

async function expectSettledFocus(root: Locator, outcome: OutcomeMatrixCase) {
  const composer = root.getByLabel("Your research question");
  switch (outcome.focus) {
    case "alert": {
      await expect(
        root.locator(`[data-assistant-state='${outcome.state}']`)
      ).toBeFocused();
      return;
    }
    case "composer": {
      await expect(composer).toBeFocused();
      return;
    }
    case "retry": {
      await expect(
        root.getByRole("button", { name: "Retry", exact: true })
      ).toBeFocused();
      return;
    }
    default: {
      const unhandled: never = outcome.focus;
      throw new Error(unhandled);
    }
  }
}

async function exerciseKeyboard(
  page: Page,
  root: Locator,
  outcome: OutcomeMatrixCase,
  messages: string[]
) {
  const composer = root.getByLabel("Your research question");
  if (outcome.focus === "composer" && outcome.control !== "none") {
    await page.keyboard.press("Shift+Tab");
  }
  if (outcome.focus === "alert") {
    await expect(
      root.getByRole("button", { name: "Retry", exact: true })
    ).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(outcome.question);
    expect(messages).toHaveLength(1);
    return;
  }
  const button = controlButton(root, outcome.control);
  if (!button) {
    return;
  }
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  if (outcome.control === "edit") {
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(outcome.question);
    expect(messages).toHaveLength(1);
    return;
  }
  await expect(root.getByText("Evidence: Single-study evidence")).toBeVisible();
  await expect(root.getByText(SINGLE_STUDY_ANSWER)).toBeVisible();
  await expect(root.getByText(outcome.heading)).toHaveCount(0);
  expect(messages).toEqual([outcome.question, outcome.question]);
}

for (const outcome of ASK_ATLAS_OUTCOME_MATRIX) {
  test(`Ask Atlas outcome ${outcome.id} keeps its state, controls, and question`, async ({
    page,
  }, testInfo) => {
    await installExploreMocks(page);
    const messages = await installOutcomeRoute(page, outcome);
    await page.goto(WORKSPACE_URL);
    const root = page.getByTestId("ask-atlas-workspace");
    await expect(root).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What would you like to explore?" })
    ).toBeVisible();
    if (outcome.id === "answered-single-study") {
      await saveOutcomeScreenshot(
        root,
        testInfo,
        "ask-atlas-outcome-before-empty.png"
      );
    }
    await ask(page, outcome.question);

    const state = root.locator(`[data-assistant-state='${outcome.state}']`);
    await expect(state).toBeVisible();
    await expect(state).toContainText(outcome.heading);
    if (outcome.evidenceState) {
      await expect(state).toHaveAttribute(
        "data-evidence-state",
        outcome.evidenceState
      );
    }
    if (outcome.denial) {
      await expect(state).toContainText(outcome.denial);
    }
    if (outcome.forbidsCorpusGap) {
      await expect(root.getByText(CORPUS_GAP_HEADING)).toHaveCount(0);
      await expect(
        root.getByText(
          "does not contain reviewed evidence that supports an answer"
        )
      ).toHaveCount(0);
    }
    if (outcome.forbidsTimeout) {
      await expect(root.getByText("Request timed out.")).toHaveCount(0);
      await expect(
        root.locator("[data-assistant-state='timeout']")
      ).toHaveCount(0);
    }
    if (outcome.id === "answered-limited-fewer-claims") {
      await expect(root.getByText(LIMITED_CLAIM_SCOPE)).toBeVisible();
      await expect(root.locator(".chat-claim")).toHaveCount(1);
      await expect(root.getByText(OMITTED_LIMITED_CLAIM)).toHaveCount(0);
    }
    if (outcome.id === "answered-single-study") {
      await expect(root.getByText("1 source for this answer")).toBeVisible();
    }

    await expectControls(root, outcome.control);
    const composer = root.getByLabel("Your research question");
    await expect(composer).toHaveValue(
      outcome.composer === "retained" ? outcome.question : ""
    );
    const userTurns = root.locator(".chat-turn.user");
    if (outcome.transcriptQuestion) {
      await expect(userTurns).toContainText(outcome.question);
    } else {
      await expect(userTurns).toHaveCount(0);
    }
    await expectSettledFocus(root, outcome);

    const accessibility = await new AxeBuilder({ page })
      .include("[data-testid='ask-atlas-workspace']")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await saveOutcomeScreenshot(
      root,
      testInfo,
      `ask-atlas-outcome-${outcome.id}.png`
    );

    if (outcome.keyboard) {
      await exerciseKeyboard(page, root, outcome, messages);
    }
    expect(messages[0]).toBe(outcome.question);
    expect(JSON.stringify(messages)).not.toMatch(/conversation_token|bearer /i);
  });
}
