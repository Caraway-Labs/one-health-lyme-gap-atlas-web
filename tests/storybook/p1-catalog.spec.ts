import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const stories: { id: string; text: string }[] = [
  { id: "action-evidence-brief--ready", text: "Reported Lyme cases" },
  {
    id: "action-evidence-brief--governed-limitation",
    text: "Synthetic release limitation for Adams County",
  },
  {
    id: "action-evidence-brief--blocked-catalog",
    text: "measure catalog could not be loaded",
  },
  {
    id: "action-evidence-brief--over-limit",
    text: "limited to 1,000 characters",
  },
  { id: "action-evidence-brief--export-pending", text: "Export PDF" },
  { id: "action-evidence-brief--export-failed", text: "Export PDF" },
  { id: "review-scope-selector--national", text: "United States" },
  { id: "review-scope-selector--colorado", text: "Colorado (CO)" },
  { id: "review-scope-selector--unlisted", text: "Selected scope WY" },
  { id: "review-state-orientation--ready", text: "CO, Colorado" },
  {
    id: "review-state-orientation--boundary-failed",
    text: "State boundaries are unavailable",
  },
  {
    id: "review-state-orientation--webgl-unavailable",
    text: "The map could not start",
  },
  {
    id: "review-operating-picture--candidates",
    text: "Adams County, CO",
  },
  {
    id: "review-operating-picture--selected-county",
    text: "Selected county 08001",
  },
  {
    id: "review-operating-picture--candidates-and-gaps",
    text: "data gap",
  },
  {
    id: "review-operating-picture--none",
    text: "Nothing stands out",
  },
  {
    id: "review-operating-picture--inconsistent",
    text: "Backend result: Unavailable",
  },
  {
    id: "review-operating-picture--map-unavailable",
    text: "The map is unavailable",
  },
  {
    id: "review-operating-picture--map-error",
    text: "temporarily unavailable",
  },
  {
    id: "county-investigation-county-intelligence-header--resolved",
    text: "Adams County",
  },
  {
    id: "county-investigation-county-intelligence-header--fips-fallback",
    text: "08001",
  },
  {
    id: "county-investigation-county-intelligence-header--no-county",
    text: "Choose a county",
  },
  {
    id: "county-investigation-investigate-next-steps--not-ready",
    text: "without it",
  },
  {
    id: "county-investigation-investigate-next-steps--start-compare",
    text: "Compare",
  },
  {
    id: "county-investigation-investigate-next-steps--return-compare",
    text: "Return to Compare",
  },
  {
    id: "county-investigation-investigate-pdf-export--eligible",
    text: "Reported Lyme cases",
  },
  {
    id: "county-investigation-investigate-pdf-export--unavailable",
    text: "No published measure can be included",
  },
  {
    id: "county-investigation-investigate-pdf-export--export-failed",
    text: "Export PDF",
  },
  {
    id: "ask-atlas-inherited-context-notice--none",
    text: "No validated page context",
  },
  {
    id: "ask-atlas-inherited-context-notice--partial",
    text: "Adams County, Colorado",
  },
  { id: "primitives-select--placeholder", text: "Choose a county" },
  { id: "primitives-select--selected", text: "Boulder County, Colorado" },
  { id: "primitives-select--disabled", text: "Choose a county" },
  {
    id: "navigation-and-layout-professional-trust-footer--desktop",
    text: "One Health Atlas by Caraway Labs",
  },
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

test.describe("P1 Storybook catalog", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The matrix runs on desktop. Mobile coverage is the footer and header reflow."
    );
  });

  for (const story of stories) {
    test(`${story.id} renders without a service request`, async ({ page }) => {
      const traffic = track(page);
      await openStory(page, story.id);
      const target = page.getByText(story.text, { exact: false }).first();
      await target.waitFor({ state: "attached" });
      await target.evaluate((element) => {
        let node = element.parentElement;
        while (node) {
          if (node instanceof HTMLDetailsElement) {
            node.open = true;
          }
          node = node.parentElement;
        }
      });
      await expect(target).toBeVisible();
      expect(traffic.blocked).toEqual([]);
      expect(traffic.downloads).toEqual([]);
    });
  }

  test("ready evidence brief keeps a typed note out of governed evidence", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, "action-evidence-brief--ready");
    const field = page.getByTestId("action-brief-local-context");
    await field.fill("LOCAL-NOTE-9F3C");
    await expect(page.getByTestId("action-brief-governed")).not.toContainText(
      "LOCAL-NOTE-9F3C"
    );
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(
      page.getByRole("button", { name: "Export PDF" })
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toHaveCount(0);
    expect(traffic.blocked).toEqual([]);
    expect(traffic.downloads).toEqual([]);
  });

  test("failed PDF export clears on reset", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, "action-evidence-brief--export-failed");
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toBeVisible();
    await page.getByTestId("action-brief-reset").click();
    await expect(
      page.getByRole("heading", { name: "The PDF did not download" })
    ).toHaveCount(0);
    expect(traffic.downloads).toEqual([]);
  });

  test("controls reset scope and select when the preset changes", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "Controls live in the desktop manager."
    );
    await page.goto("?path=/story/review-scope-selector--national");
    const canvas = page.frameLocator("#storybook-preview-iframe");
    await expect(canvas.getByTestId("review-scope-selected")).toHaveText(
      "Selected scope ALL"
    );
    await page.getByRole("tab", { name: /Controls/ }).click();
    await page.locator("#control-preset").selectOption("unlisted");
    await expect(canvas.getByTestId("review-scope-selected")).toHaveText(
      "Selected scope WY"
    );
    await page.locator("#control-preset").selectOption("long-label");
    await expect(canvas.getByText("District of Columbia (DC)")).toBeVisible();
    await page.goto("?path=/story/primitives-select--placeholder");
    await page.getByRole("tab", { name: /Controls/ }).click();
    await page.locator("#control-preset").selectOption("selected");
    await expect(canvas.getByTestId("select-current")).toHaveText(
      "Selected 08013"
    );
    await page.locator("#control-preset").selectOption("disabled");
    await expect(canvas.getByTestId("select-current")).toHaveText(
      "Selected none"
    );
  });

  test("scope selection updates the controlled value", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, "review-scope-selector--national");
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "Colorado (CO)" }).click();
    await expect(page.getByTestId("review-scope-selected")).toHaveText(
      "Selected scope CO"
    );
    expect(traffic.blocked).toEqual([]);
  });

  test("list activation opens Colorado when the map is unavailable", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, "review-state-orientation--boundary-failed");
    await expect(page.getByTestId("review-state-map-stub")).toHaveCount(0);
    await page.getByRole("button", { name: "CO, Colorado" }).click();
    await expect(page.getByTestId("orientation-opened")).toHaveText(
      "Opened state CO"
    );
    // Clearing focus on the state option shortens the status line and shifts
    // this control up during a center click, so the press misses the button.
    await page
      .getByRole("button", { name: "Retry map" })
      .click({ position: { x: 24, y: 4 } });
    await expect(page.getByTestId("orientation-retries")).toHaveText(
      "Map retries 1"
    );
    expect(traffic.blocked).toEqual([]);
  });

  test("candidate selection and map stub stay local", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, "review-operating-picture--candidates");
    await expect(page.getByTestId("atlas-map-stub")).toBeVisible();
    await page
      .getByRole("button", { name: "Select Adams County on the map stub" })
      .click();
    await expect(page.getByTestId("operating-selected")).toHaveText(
      "Selected county 08001"
    );
    expect(traffic.blocked).toEqual([]);
  });

  test("published selection without candidates stays synthetic and local", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, "review-operating-picture--none");
    await page.locator('button.ux-reset-ranked-row[data-fips="08001"]').click();
    await expect(page.getByTestId("operating-selected")).toHaveText(
      "Selected county 08001"
    );
    await expect(
      page.getByRole("link", { name: /County evidence/ })
    ).toBeVisible();
    await expect(
      page.getByText("Loading published county evidence…")
    ).toHaveCount(0);
    expect(traffic.blocked).toEqual([]);
  });

  test("eligible PDF failure does not download", async ({ page }) => {
    const traffic = track(page);
    await openStory(
      page,
      "county-investigation-investigate-pdf-export--export-failed"
    );
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.getByText("No file was downloaded.")).toBeVisible();
    expect(traffic.blocked).toEqual([]);
    expect(traffic.downloads).toEqual([]);
  });

  test("select chooses a county and escape closes the list", async ({
    page,
  }) => {
    await openStory(page, "primitives-select--placeholder");
    await page.getByRole("combobox", { name: "County" }).click();
    await page.getByRole("option", { name: "Adams County, Colorado" }).click();
    await expect(page.getByTestId("select-current")).toHaveText(
      "Selected 08001"
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("trust footer uses a new tab for the brand and workspace paths otherwise", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(
      page,
      "navigation-and-layout-professional-trust-footer--desktop"
    );
    const brand = page.getByRole("link", {
      name: /One Health Atlas by Caraway Labs/,
    });
    await expect(brand).toHaveAttribute("href", "/about/caraway-labs");
    await expect(brand).toHaveAttribute("target", "_blank");
    await expect(
      page.getByRole("link", { name: "Privacy", exact: true })
    ).toHaveAttribute("href", "/privacy");
    await expect(
      page.getByRole("link", { name: "Privacy settings" })
    ).toHaveAttribute("href", "/app/settings");
    const image = page.locator("img.atlas-brand-mark");
    await expect(image).toBeVisible();
    expect(await image.getAttribute("src")).not.toMatch(/^\/android-chrome/);
    expect(traffic.blocked).toEqual([]);
  });

  for (const id of [
    "action-evidence-brief--ready",
    "review-scope-selector--national",
    "county-investigation-county-intelligence-header--resolved",
    "ask-atlas-inherited-context-notice--complete",
  ]) {
    test(`${id} has no accessibility violations`, async ({ page }) => {
      await openStory(page, id);
      await expect(page.locator("body")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test("mobile header and footer reflow without a service request", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Reflow is the mobile project."
  );
  const traffic = track(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(
    page,
    "county-investigation-county-intelligence-header--long-label"
  );
  await expect(
    page.getByRole("link", { name: "Return to Atlas Explorer" })
  ).toBeVisible();
  await openStory(
    page,
    "navigation-and-layout-professional-trust-footer--desktop"
  );
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(
    page.getByRole("link", { name: "Privacy settings" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(traffic.blocked).toEqual([]);
});
