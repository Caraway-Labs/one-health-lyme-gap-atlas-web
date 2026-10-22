import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const feedbackId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DESKTOP = { height: 900, width: 1440 };
const MOBILE = { height: 844, width: 390 };

function isMobileProject(projectName: string): boolean {
  return projectName.includes("mobile");
}

async function mockAtlasApi(
  page: Page,
  onFeedback: (route: Route) => Promise<void>
) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/feedback") {
      await onFeedback(route);
      return;
    }
    await route.fulfill({ json: {} });
  });
  // Register after the catch-all. Playwright matches the newest route first,
  // so this completed read stays ahead of the empty API fallback.
  await fulfillCompletedStartingView(page);
}

async function openFeedback(page: Page) {
  const trigger = page.getByRole("button", { name: "Give feedback" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Help shape One Health Atlas" })
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
});

test.describe("UX Reset feedback modal", () => {
  test("desktop sidebar, keyboard dismiss, dataset receipt, and problem retry", async ({
    page,
  }, testInfo) => {
    test.skip(
      isMobileProject(testInfo.project.name),
      "Desktop sidebar and modal flow."
    );
    const datasetRequests: string[] = [];
    page.on("request", (request) => {
      datasetRequests.push(request.url());
    });
    let datasetPosts = 0;
    let releaseDataset = () => {};
    const datasetGate = new Promise<void>((resolve) => {
      releaseDataset = resolve;
    });
    let feedbackBody: {
      category?: string;
      contact_email?: string;
      context?: { county_fips?: string };
      message?: string;
    } = {};
    await mockAtlasApi(page, async (route) => {
      feedbackBody = route.request().postDataJSON();
      if (feedbackBody.category === "bug") {
        await route.fulfill({
          body: JSON.stringify({ detail: "slow" }),
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Retry-After",
            "Content-Type": "application/json",
            "Retry-After": "120",
          },
          status: 429,
        });
        return;
      }
      datasetPosts += 1;
      await datasetGate;
      await route.fulfill({
        json: {
          feedback_id: feedbackId,
          received_at: "2026-10-12T00:00:00Z",
          replayed: false,
        },
        status: 200,
      });
    });

    await page.setViewportSize(DESKTOP);
    await page.goto("/explore?scope=CO&county=08031&q=secret-search");
    const trigger = page.getByRole("button", { name: "Give feedback" });
    await expect(trigger.locator("svg")).toHaveClass(/message-square-plus/);

    await page.getByRole("button", { name: "Hide navigation" }).click();
    await expect(trigger).toHaveAccessibleName("Give feedback");
    await page.getByRole("button", { name: "Show navigation" }).click();

    await openFeedback(page);
    await expect(
      page.getByText(
        "Have an idea, a useful dataset, or something we could improve? We'd love to hear it."
      )
    ).toBeVisible();
    const dialog = page.getByRole("dialog", {
      name: "Help shape One Health Atlas",
    });
    const cards = dialog.getByRole("listitem");
    await expect(cards.nth(0)).toContainText("Suggest a dataset");
    await expect(cards.nth(1)).toContainText("Share an idea");
    await expect(cards.nth(2)).toContainText("Expand One Health Atlas");
    await expect(cards.nth(3)).toContainText("Report a problem");

    const emptyResults = await new AxeBuilder({ page })
      .include("[data-slot='dialog-content']")
      .analyze();
    expect(emptyResults.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await openFeedback(page);
    await page.getByRole("button", { name: /Suggest a dataset/ }).click();
    await page.getByLabel("Dataset name or URL").fill("CDC tick file");
    await page.keyboard.press("Escape");
    await expect(page.getByText("Discard this feedback?")).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByLabel("Dataset name or URL")).toHaveValue(
      "CDC tick file"
    );
    await page.getByRole("button", { exact: true, name: "Back" }).click();
    await page.getByRole("button", { name: /Suggest a dataset/ }).click();
    await expect(page.getByLabel("Dataset name or URL")).toHaveValue(
      "CDC tick file"
    );
    await page
      .getByLabel("Why would this be useful?")
      .fill("It fills a county gap for this release.");
    await page
      .locator("summary", { hasText: "Additional details (optional)" })
      .click();
    await page.getByLabel("Geographic coverage").fill("Colorado");
    await page.getByLabel("Contact (optional)").fill("Ada Lovelace, CDC");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("alert")).toContainText("email address");
    await page.getByLabel("Contact (optional)").fill("");
    await page
      .getByLabel("Dataset name or URL")
      .fill("https://feedback-dataset-suggestion.invalid/ticks.csv");
    const send = page.getByRole("button", { name: "Send feedback" });
    await send.click();
    const sending = page.getByRole("button", { name: "Sending…" });
    await expect(sending).toBeDisabled();
    await sending.click({ force: true });
    releaseDataset();
    await expect(page.getByRole("status")).toContainText("Thank you");
    await expect(page.getByLabel("Feedback reference id")).toHaveValue(
      feedbackId
    );
    expect(feedbackBody.category).toBe("general");
    expect(feedbackBody.contact_email).toBeUndefined();
    expect(feedbackBody.context?.county_fips).toBe("08031");
    expect(feedbackBody.message).toContain(
      "https://feedback-dataset-suggestion.invalid/ticks.csv"
    );
    expect(feedbackBody.message).not.toContain("secret-search");
    expect(datasetPosts).toBe(1);
    expect(
      datasetRequests.some((url) =>
        url.includes("feedback-dataset-suggestion.invalid")
      )
    ).toBeFalsy();
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      search: window.location.search,
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain("ticks.csv");
    expect(storage.session).not.toContain("ticks.csv");
    expect(storage.search).not.toContain("ticks.csv");

    await page.getByRole("button", { name: "Done" }).click();
    await openFeedback(page);
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.getByRole("radio", { name: "Something broke" }).check();
    await page
      .getByLabel("What happened?")
      .fill("The map count disagrees with the table.");
    await page
      .getByLabel("What did you expect?")
      .fill("The county total should match the table.");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("alert")).toContainText("120 seconds");
    await expect(
      page.getByRole("button", { name: "Send feedback" })
    ).toBeDisabled();
    expect(await page.getByLabel("What happened?").inputValue()).toContain(
      "map count"
    );
  });

  test("mobile navigation opens the same modal", async ({ page }, testInfo) => {
    test.skip(
      !isMobileProject(testInfo.project.name),
      "Mobile navigation access."
    );
    await mockAtlasApi(page, async (route) => {
      await route.fulfill({ json: {} });
    });
    await page.setViewportSize(MOBILE);
    await page.goto("/app/explore");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const trigger = page.getByRole("button", { name: "Give feedback" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Help shape One Health Atlas" })
    ).toBeVisible();
    await page.getByRole("button", { name: /Expand One Health Atlas/ }).click();
    await expect(
      page.getByText("does not mean Atlas already includes it")
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include("[data-slot='dialog-content']")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
