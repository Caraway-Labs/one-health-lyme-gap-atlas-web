import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const stories: { id: string; text?: string; name?: string }[] = [
  {
    id: "ask-atlas-evidence-chat-conversation--empty",
    text: "Start with a research question",
  },
  {
    id: "ask-atlas-evidence-chat-conversation--grounded",
    text: "Synthetic claim",
  },
  {
    id: "ask-atlas-evidence-chat-conversation--pending",
    text: "Searching reviewed evidence",
  },
  {
    id: "ask-atlas-evidence-chat-conversation--structured-outcome",
    text: "No relevant literature",
  },
  {
    id: "ask-atlas-evidence-chat-conversation--client-failure",
    text: "Connection problem",
  },
  {
    id: "ask-atlas-evidence-chat-conversation--near-limit",
    text: "900/1,000",
  },
  { id: "ask-atlas-answer-sources--one-citation", text: "1 source" },
  { id: "ask-atlas-answer-sources--many-citations", text: "2 sources" },
  { id: "ask-atlas-answer-sources--limited", text: "Limited evidence" },
  {
    id: "ask-atlas-answer-sources--long-citation",
    text: "Synthetic long citation title",
  },
  {
    id: "ask-atlas-answer-sources--unsafe-url",
    text: "Synthetic citation with an unapproved URL",
  },
  {
    id: "ask-atlas-answer-sources--nongrounded",
    text: "No source list",
  },
  {
    id: "ask-atlas-assistant-outcome--corpus-absence",
    text: "No relevant literature",
  },
  {
    id: "ask-atlas-assistant-outcome--service-unavailable",
    text: "Evidence service unavailable",
  },
  {
    id: "ask-atlas-assistant-outcome--capacity",
    text: "Temporarily at capacity",
  },
  {
    id: "ask-atlas-assistant-outcome--refusal",
    text: "Request not answered",
  },
  {
    id: "ask-atlas-assistant-outcome--answered",
    text: "no extra panel",
  },
  { id: "primitives-button--secondary", text: "Review evidence" },
  { id: "primitives-button--icon", name: "Search evidence" },
  { id: "primitives-button--invalid", text: "Review evidence" },
  { id: "primitives-card--composed", text: "Evidence overview" },
  { id: "primitives-input--search", text: "Geography" },
  {
    id: "atlas-status-message--with-action",
    text: "Example request unavailable",
  },
  { id: "primitives-badge--long-label", text: "Synthetic long label" },
  { id: "primitives-dialog--closed", text: "Dialog closed" },
  { id: "primitives-progress--mid", text: "Signal value 40" },
  { id: "primitives-progress--empty-bar", text: "Signal value 0" },
  { id: "primitives-progress--full", text: "Signal value 100" },
  { id: "navigation-and-layout-sidebar--expanded", text: "Active item Review" },
  {
    id: "navigation-and-layout-sidebar--collapsed",
    text: "Active item Review",
  },
  { id: "primitives-table--populated", text: "Adams County" },
  { id: "primitives-table--empty", text: "No rows in this preview" },
  { id: "primitives-tooltip--focus", name: "Review" },
];

function track(page: Page): string[] {
  const blocked: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      host = "";
    }
    const external = host !== "" && host !== "127.0.0.1";
    const service =
      url.includes("/v1/") || url.toLowerCase().includes("amplitude");
    if (external || service) {
      blocked.push(url);
    }
  });
  return blocked;
}

async function openStory(page: Page, id: string): Promise<void> {
  await page.goto(`iframe.html?id=${id}&viewMode=story`);
}

test.describe("Chat and primitive catalog", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The matrix runs on desktop. Mobile coverage is the sidebar and table reflow."
    );
  });

  for (const story of stories) {
    test(`${story.id} renders without a service request`, async ({ page }) => {
      const blocked = track(page);
      await openStory(page, story.id);
      const target = story.name
        ? page.getByRole("button", { name: story.name })
        : page.getByText(story.text ?? "", { exact: false }).first();
      await expect(target).toBeVisible();
      expect(blocked).toEqual([]);
    });
  }

  test("empty chat keeps a starter question in the composer and submits locally", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "ask-atlas-evidence-chat-conversation--empty");
    await page
      .getByRole("button", { name: "Lyme surveillance reporting in studies" })
      .click();
    const field = page.getByRole("textbox", { name: "Your question" });
    await expect(field).toHaveValue(
      "What do peer-reviewed studies report about Lyme disease surveillance and reporting practices?"
    );
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByTestId("chat-story-action")).toContainText(
      "Submitted:"
    );
    await expect(page.getByText("Synthetic claim").first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("pending new chat clears the search state", async ({ page }) => {
    const blocked = track(page);
    await openStory(page, "ask-atlas-evidence-chat-conversation--pending");
    const field = page.getByRole("textbox", { name: "Your question" });
    await expect(page.getByText("Searching reviewed evidence…")).toBeVisible();
    await expect(field).toBeDisabled();
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByText("Searching reviewed evidence…")).toHaveCount(0);
    await expect(field).toBeEnabled();
    expect(blocked).toEqual([]);
  });

  test("answer source docs keep unique request ids", async ({ page }) => {
    await page.goto(
      "iframe.html?id=ask-atlas-answer-sources--docs&viewMode=docs"
    );
    await expect(page.getByText("1 source for this answer")).toBeVisible();
    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")]
        .map((element) => element.id)
        .filter((id) => id.startsWith("sources-"));
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
    await expect(page.locator("[id^='sources-']")).toHaveCount(5);
  });

  test("conversation docs keep the composer id in one frame", async ({
    page,
  }) => {
    await page.goto(
      "iframe.html?id=ask-atlas-evidence-chat-conversation--docs&viewMode=docs"
    );
    await expect(page.locator("#chat-message-drawer")).toHaveCount(0);
    await expect(
      page.frameLocator("iframe").first().locator("#chat-message-drawer")
    ).toHaveCount(1);
  });

  test("client failure retry stays local", async ({ page }) => {
    const blocked = track(page);
    await openStory(
      page,
      "ask-atlas-evidence-chat-conversation--client-failure"
    );
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("chat-story-action")).toHaveText(
      "Retried: What do peer-reviewed studies report about Lyme disease surveillance and reporting practices?"
    );
    expect(blocked).toEqual([]);
  });

  test("unsafe citation is static text", async ({ page }) => {
    await openStory(page, "ask-atlas-answer-sources--unsafe-url");
    await expect(page.getByRole("link", { name: /PubMed/ })).toHaveCount(0);
    await expect(page.getByText("unapproved URL")).toBeVisible();
  });

  test("pending retry is disabled and an answered outcome has no panel", async ({
    page,
  }) => {
    await openStory(page, "ask-atlas-assistant-outcome--pending-retry");
    await expect(page.getByRole("button", { name: "Retry" })).toBeDisabled();
    await openStory(page, "ask-atlas-assistant-outcome--answered");
    await expect(page.locator("[data-assistant-state]")).toHaveCount(0);
  });

  test("button, card, and status actions stay in the preview", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "primitives-button--activation");
    await page.getByRole("button", { name: "Review evidence" }).click();
    await expect(page.getByTestId("button-presses")).toHaveText("Pressed 1");
    await openStory(page, "primitives-card--composed");
    await page.getByRole("button", { name: "Note limitation" }).click();
    await expect(
      page.getByText("Limitation noted in this preview.")
    ).toBeVisible();
    await openStory(page, "atlas-status-message--with-action");
    await page.getByRole("button", { name: "Retry example" }).click();
    await expect(page.getByText("Local retry recorded.")).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test("dialog opens, closes on escape, and opens again", async ({ page }) => {
    await openStory(page, "primitives-dialog--scrolling");
    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText("Synthetic scrolling paragraph 8")
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("dialog-state")).toHaveText("Dialog closed");
    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(page.getByTestId("dialog-state")).toHaveText("Dialog open");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("dialog-state")).toHaveText("Dialog closed");
  });

  test("sidebar selects an item without leaving the preview", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "navigation-and-layout-sidebar--expanded");
    await page.getByRole("link", { name: "Investigate" }).click();
    await expect(page.getByTestId("sidebar-active")).toHaveText(
      "Active item Investigate"
    );
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("[data-slot='sidebar']")).toHaveAttribute(
      "data-mobile-open",
      "true"
    );
    await openStory(page, "navigation-and-layout-sidebar--collapsed");
    await expect(page.locator("[data-slot='sidebar']")).toHaveAttribute(
      "data-state",
      "collapsed"
    );
    expect(blocked).toEqual([]);
  });

  test("search input accepts a local geography", async ({ page }) => {
    const blocked = track(page);
    await openStory(page, "primitives-input--search");
    const field = page.getByRole("searchbox", { name: "Geography" });
    await field.fill("Wake County");
    await expect(field).toHaveValue("Wake County");
    expect(blocked).toEqual([]);
  });

  test("corpus absence edits locally and service retry stays local", async ({
    page,
  }) => {
    const blocked = track(page);
    await openStory(page, "ask-atlas-assistant-outcome--corpus-absence");
    await page.getByRole("button", { name: "Edit question" }).click();
    await expect(page.getByTestId("outcome-action")).toContainText("Editing:");
    await openStory(page, "ask-atlas-assistant-outcome--service-unavailable");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("outcome-action")).toContainText("Retried:");
    expect(blocked).toEqual([]);
  });

  test("tooltip opens from the keyboard", async ({ page }) => {
    await openStory(page, "primitives-tooltip--focus");
    await page.getByRole("button", { name: "Review" }).focus();
    await expect(
      page.getByText("The button name stays available")
    ).toBeVisible();
  });

  test("badge and progress have no accessibility violations", async ({
    page,
  }) => {
    await openStory(page, "primitives-badge--default");
    await expect(page.getByText("Available")).toBeVisible();
    const badge = await new AxeBuilder({ page }).analyze();
    expect(badge.violations).toEqual([]);
    await openStory(page, "primitives-progress--mid");
    await expect(page.getByTestId("progress-value")).toBeVisible();
    const progress = await new AxeBuilder({ page }).analyze();
    expect(progress.violations).toEqual([]);
  });
});

test("mobile sidebar and table reflow without a service request", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Reflow is the mobile project."
  );
  const blocked = track(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, "navigation-and-layout-sidebar--expanded");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("[data-slot='sidebar']")).toHaveAttribute(
    "data-mobile-open",
    "true"
  );
  await openStory(page, "primitives-table--long-cell");
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole("table")).toBeVisible();
  expect(blocked).toEqual([]);
});
