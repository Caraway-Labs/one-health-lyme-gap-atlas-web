import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const brief = "action-evidence-brief";

const stories: { id: string; text: string }[] = [
  { id: `${brief}--ready`, text: "Reported Lyme cases" },
  {
    id: `${brief}--governed-limitation`,
    text: "Synthetic release limitation for Adams County",
  },
  {
    id: `${brief}--blocked-catalog`,
    text: "measure catalog could not be loaded",
  },
  {
    id: `${brief}--blocked-failed`,
    text: "County evidence did not load",
  },
  {
    id: `${brief}--blocked-absent`,
    text: "settled without a bundle",
  },
  {
    id: `${brief}--blocked-not-loaded`,
    text: "County evidence has not loaded",
  },
  {
    id: `${brief}--recovery`,
    text: "does not have a loaded county evidence bundle",
  },
  { id: `${brief}--over-limit`, text: "limited to 1,000 characters" },
  { id: `${brief}--export-pending`, text: "Export PDF" },
  { id: `${brief}--export-failed`, text: "Export PDF" },
];

function track(page: Page): { blocked: string[]; downloads: string[] } {
  const blocked: string[] = [];
  const downloads: string[] = [];
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
  page.on("download", (download) => {
    downloads.push(download.suggestedFilename());
  });
  return { blocked, downloads };
}

async function openStory(page: Page, id: string): Promise<void> {
  await page.goto(`iframe.html?id=${id}&viewMode=story`);
}

test.describe("Action evidence brief", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The full matrix runs on desktop. Mobile coverage is the ready brief reflow."
    );
  });

  for (const story of stories) {
    test(`${story.id} renders without a service request`, async ({ page }) => {
      const traffic = track(page);
      await openStory(page, story.id);
      await expect(
        page.getByText(story.text, { exact: false }).first()
      ).toBeVisible();
      await expect(
        page.getByTestId("action-brief-synthetic-notice")
      ).toContainText("08001");
      expect(traffic.blocked).toEqual([]);
      expect(traffic.downloads).toEqual([]);
    });
  }

  test("ready brief has no accessibility violations", async ({ page }) => {
    await openStory(page, `${brief}--ready`);
    await expect(page.getByTestId("action-brief-finding")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("keeps a typed local note out of governed evidence and the export", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, `${brief}--ready`);
    const field = page.getByTestId("action-brief-local-context");
    await field.fill("LOCAL-NOTE-9F3C");
    await expect(field).toHaveValue("LOCAL-NOTE-9F3C");
    await expect(page.getByTestId("action-brief-governed")).not.toContainText(
      "LOCAL-NOTE-9F3C"
    );
    await expect(page.getByTestId("action-brief-finding")).toHaveText(
      "Reported Lyme cases: 12 cases. Available. Period 2023. Source CDC surveillance."
    );
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(
      page.getByRole("button", { name: "Export PDF" })
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toHaveCount(0);
    await expect(
      page.getByTestId("investigate-export-context")
    ).not.toContainText("LOCAL-NOTE-9F3C");
    expect(traffic.blocked).toEqual([]);
    expect(traffic.downloads).toEqual([]);
  });

  test("shows the 1,000-character validation", async ({ page }) => {
    await openStory(page, `${brief}--over-limit`);
    const field = page.getByTestId("action-brief-local-context");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText("1,000 characters");
    await expect(page.getByTestId("action-brief-finding")).not.toContainText(
      "Synthetic local note."
    );
  });

  test("blocked stories withhold the note and the export", async ({ page }) => {
    await openStory(page, `${brief}--blocked-catalog`);
    await expect(page.getByTestId("action-brief-blocker")).toBeVisible();
    await expect(page.getByTestId("action-brief-local-context")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(
      0
    );
    await openStory(page, `${brief}--recovery`);
    await expect(page.getByTestId("action-brief-blocker")).toContainText(
      "no evidence brief was built"
    );
    await expect(page.getByTestId("action-brief-local-context")).toHaveCount(0);
  });

  test("failed export clears on reset without a download", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, `${brief}--export-failed`);
    const field = page.getByTestId("action-brief-local-context");
    await field.fill("LOCAL-NOTE-9F3C");
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toBeVisible();
    await expect(page.getByText("No file was downloaded.")).toBeVisible();
    await page.getByTestId("action-brief-reset").click();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toHaveCount(0);
    await expect(field).toHaveValue(
      "Synthetic local note for the Adams County preview. Atlas does not save this note."
    );
    expect(traffic.blocked).toEqual([]);
    expect(traffic.downloads).toEqual([]);
  });

  test("pending export stays on Generating PDF", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, `${brief}--export-pending`);
    await page.getByRole("button", { name: "Export PDF" }).click();
    const pending = page.getByRole("button", { name: "Generating PDF…" });
    await expect(pending).toBeDisabled();
    await page.getByTestId("action-brief-reset").click();
    await expect(
      page.getByRole("button", { name: "Export PDF" })
    ).toBeEnabled();
    expect(traffic.blocked).toEqual([]);
    expect(traffic.downloads).toEqual([]);
  });

  test("controls change the preset and the export result", async ({ page }) => {
    await page.goto(`?path=/story/${brief}--ready`);
    const canvas = page.frameLocator("#storybook-preview-iframe");
    await expect(canvas.getByTestId("action-brief-finding")).toBeVisible();
    await page.getByRole("tab", { name: /Controls/ }).click();
    await page.locator("#control-preset").selectOption("blocked-catalog");
    await expect(canvas.getByTestId("action-brief-blocker")).toBeVisible();
    await expect(canvas.getByTestId("action-brief-local-context")).toHaveCount(
      0
    );
    await page.locator("#control-preset").selectOption("ready");
    await page.locator("#control-exportMode").selectOption("fail");
    await canvas.getByRole("button", { name: "Export PDF" }).click();
    await expect(
      canvas.getByRole("heading", { name: "The PDF did not download" })
    ).toBeVisible();
  });

  test("autodocs keeps the local context id inside story frames", async ({
    page,
  }) => {
    await page.goto(`iframe.html?id=${brief}--docs&viewMode=docs`);
    await expect(page.locator("#action-brief-local-context")).toHaveCount(0);
    const frame = page.frameLocator("iframe").first();
    await expect(frame.locator("#action-brief-local-context")).toHaveCount(1);
  });
});

test("mobile ready brief reflows without a service request", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Reflow is the mobile project."
  );
  const traffic = track(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, `${brief}--ready`);
  await expect(page.getByTestId("action-brief-local-context")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByTestId("action-brief-finding")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(traffic.blocked).toEqual([]);
});
