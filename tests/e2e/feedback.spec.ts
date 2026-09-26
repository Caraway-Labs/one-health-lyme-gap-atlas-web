import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const feedbackId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type FeedbackMock = (route: Route) => Promise<void>;

async function mockAtlasApi(page: Page, onFeedback: FeedbackMock) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/feedback") {
      await onFeedback(route);
      return;
    }
    if (url.pathname.endsWith("/metadata")) {
      await route.fulfill({
        json: {
          bundle_sha256: "a".repeat(64),
          generated_at: "2026-08-06T05:37:16Z",
          limitations: "Not individual risk.",
          loaded_at: "2026-08-15T00:00:00Z",
          methodology_version: "alpha-0.2.0",
          release_id: "alpha-2026-08-06",
          schema_version: "0.2.0",
          scope: "United States counties",
          score_defaults: {},
          sources: [],
          states: [{ code: "CO", name: "Colorado" }],
        },
      });
      return;
    }
    if (url.pathname.endsWith("/scores")) {
      await route.fulfill({
        json: {
          counties: [],
          generated_at: "2026-08-06T05:37:16Z",
          release_id: "alpha-2026-08-06",
          settings: {
            ecological_share: 65,
            low_incidence_breakpoint: 10,
            missing_human_weakness: 75,
          },
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });
}

async function openFeedback(page: Page) {
  const trigger = page.getByRole("button", { name: "Feedback", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Send feedback" })
  ).toBeVisible();
}

test.describe("in-product feedback dialog", () => {
  test.describe.configure({ retries: 1 });

  test("submits the happy path with a mocked API", async ({ page }) => {
    let submitCount = 0;
    await mockAtlasApi(page, async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 200,
        json: {
          feedback_id: feedbackId,
          received_at: "2026-09-26T18:00:00Z",
          replayed: false,
        },
      });
    });

    await page.goto("/");
    await openFeedback(page);
    await page
      .getByLabel(/^Message/)
      .fill("The overview ranking looks incomplete for Colorado.");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Thanks"
    );
    await expect(page.getByLabel("Feedback reference id")).toHaveValue(
      feedbackId
    );
    expect(submitCount).toBe(1);
  });

  test("supports keyboard open and validation messaging", async ({ page }) => {
    await mockAtlasApi(page, async (route) => {
      await route.fulfill({
        status: 500,
        json: { detail: "unused" },
      });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Feedback", exact: true })
      .press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel(/^Message/).fill("short");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "at least 10"
    );
  });

  test("keeps the draft on 429 and 503 responses", async ({ page }) => {
    let attempt = 0;
    await mockAtlasApi(page, async (route) => {
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({
          status: 429,
          headers: { "Retry-After": "30", "Content-Type": "application/json" },
          json: { detail: "throttled" },
        });
        return;
      }
      await route.fulfill({
        status: 503,
        json: { detail: "unavailable" },
      });
    });

    await page.goto("/");
    await openFeedback(page);
    const message = "Please keep this draft through temporary API failures.";
    await page.getByLabel(/^Message/).fill(message);
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      /Too many feedback/i
    );
    await expect(page.getByLabel(/^Message/)).toHaveValue(message);

    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      /could not save/i
    );
    await expect(page.getByLabel(/^Message/)).toHaveValue(message);
  });

  test("ignores a second click while submitting", async ({ page }) => {
    let submitCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockAtlasApi(page, async (route) => {
      submitCount += 1;
      await gate;
      await route.fulfill({
        status: 200,
        json: {
          feedback_id: feedbackId,
          received_at: "2026-09-26T18:00:00Z",
          replayed: false,
        },
      });
    });

    await page.goto("/");
    await openFeedback(page);
    await page
      .getByLabel(/^Message/)
      .fill("Duplicate clicks should not create a second request.");
    const send = page.getByRole("button", { name: /Send feedback|Sending/ });
    await send.click();
    await expect(send).toBeDisabled();
    await send.click({ force: true }).catch(() => undefined);
    expect(submitCount).toBe(1);
    release();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Thanks"
    );
  });

  test("works on a mobile viewport with accessible dialog chrome", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAtlasApi(page, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          feedback_id: feedbackId,
          received_at: "2026-09-26T18:00:00Z",
          replayed: false,
        },
      });
    });

    await page.goto("/");
    const feedback = page.getByRole("button", {
      name: "Feedback",
      exact: true,
    });
    await expect(feedback).toBeVisible();
    await feedback.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page
      .getByLabel(/^Message/)
      .fill("Mobile footer feedback should remain usable.");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Thanks"
    );
  });
});
