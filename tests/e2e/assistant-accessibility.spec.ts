import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockApi } from "./geographic-explorer-mock";

const VIEWPORTS = [
  { width: 375, height: 812, name: "375" },
  { width: 768, height: 1024, name: "768" },
  { width: 1280, height: 900, name: "1280" },
  { width: 1600, height: 1000, name: "1600" },
] as const;

function chatResponse(id: number) {
  return {
    request_id: `request-${id}`,
    conversation_id: `conversation-${id}`,
    configuration_version: "test-v1",
    assistant_policy_version: "test-v1",
    status: "answered",
    answer: "Reviewed evidence varies by setting.",
    evidence_state: "limited",
    source_used: "literature_evidence",
    claims: [
      {
        claim_id: "c1",
        citation_ids: ["p1"],
        text: "Reviewed evidence varies by setting.",
      },
    ],
    citations: [
      {
        citation_id: "p1",
        pmid: "12345",
        title: "Source paper",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        claim_ids: ["c1"],
        passage_ids: ["passage-1"],
      },
    ],
  };
}

for (const viewport of VIEWPORTS) {
  test(`assistant workspace passes axe and keyboard landmarks at ${viewport.name}px`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/v1/knowledge-graph/chat", async (route) => {
      calls += 1;
      await route.fulfill({ json: chatResponse(calls) });
    });
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/assistant");
    await expect(
      page.getByRole("region", { name: "Atlas Assistant" })
    ).toHaveCount(1);
    await page.getByLabel("Your question").fill("What does evidence show?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Evidence: Limited evidence")).toBeVisible();

    const recentChats = page.getByRole("button", {
      name: /^Recent chats \(\d+\)$/,
    });
    if (await recentChats.isVisible()) {
      await recentChats.click();
      await expect(recentChats).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("button", { name: "Close recent chats" }).click();
      await expect(recentChats).toBeFocused();
    }

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByLabel("Your question")).toBeFocused();

    const accessibility = await new AxeBuilder({ page })
      .include(".evidence-chat")
      .analyze();
    expect(accessibility.violations).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
  });
}

test("assistant workspace reflows at 200% zoom without horizontal overflow", async ({
  page,
}) => {
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    await route.fulfill({ json: chatResponse(1) });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/assistant");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const composer = page.locator(".chat-composer-dock");
  await composer.scrollIntoViewIfNeeded();
  await page.getByLabel("Your question").fill("Zoom check question");
  await page.locator(".chat-form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByText("Evidence: Limited evidence")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".evidence-chat")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(overflow).toBe(true);
});

test("drawer assistant exposes one dialog landmark and returns focus on close", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/geographic_explorer?state=CA&county=06085");
  const launcher = page.getByRole("button", { name: "Atlas Assistant" });
  await launcher.click();
  await expect(
    page.getByRole("dialog", { name: "Atlas Assistant" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Atlas Assistant" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close Atlas Assistant" }).click();
  await expect(launcher).toBeFocused();
});
