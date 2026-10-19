import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { releaseViewportRuns } from "../e2e/release-phone-viewport";

const evidenceObject = "data-and-evidence-evidence-object";
const evidenceStrip = "data-and-evidence-evidence-state-strip";
const releaseStrip = "data-and-evidence-release-evidence-state-strip";
const provenance = "data-and-evidence-evidence-provenance-inspect";
const tier1 = "surveillance-priority-tier-1-surveillance-priority-panel";
const hierarchy = "county-investigation-investigate-evidence-hierarchy";
const shell = "navigation-and-layout-reset-professional-shell";
const preview = "review-county-preview-panel";

const stories: { id: string; text: string }[] = [
  {
    id: `${evidenceObject}--observed-nonzero`,
    text: "Synthetic daily precipitation",
  },
  { id: `${evidenceObject}--published-zero`, text: "0 mm" },
  { id: `${evidenceObject}--suppressed`, text: "Suppressed" },
  { id: `${evidenceObject}--missing`, text: "Unavailable" },
  {
    id: `${evidenceObject}--precise-caveat`,
    text: "0.123456789012345678901234567890 mm",
  },
  {
    id: `${evidenceStrip}--available-with-vintage`,
    text: "v1.0.0-scaled-202501",
  },
  { id: `${evidenceStrip}--available-without-optional`, text: "Available" },
  { id: `${evidenceStrip}--limited-with-caveat`, text: "Limited" },
  { id: `${evidenceStrip}--unavailable-without-optional`, text: "Unavailable" },
  { id: `${evidenceStrip}--narrow`, text: "Limited" },
  {
    id: `${releaseStrip}--ready-complete`,
    text: "Synthetic release alpha-2026",
  },
  { id: `${releaseStrip}--ready-limited`, text: "Limited" },
  { id: `${releaseStrip}--loading`, text: "Loading governed release context" },
  {
    id: `${releaseStrip}--error-default`,
    text: "Unable to load governed release context",
  },
  {
    id: `${releaseStrip}--error-synthetic`,
    text: "Synthetic release request failed",
  },
  {
    id: `${releaseStrip}--ready-without-context`,
    text: "Release context is not available yet",
  },
  { id: `${releaseStrip}--narrow`, text: "Synthetic limitation" },
  { id: `${provenance}--full-reason`, text: "Inspect provenance" },
  { id: `${provenance}--state-label-missing`, text: "Inspect provenance" },
  { id: `${provenance}--technical-unreadable`, text: "Inspect provenance" },
  { id: `${tier1}--high-sufficient`, text: "HIGH" },
  { id: `${tier1}--medium-sufficient`, text: "MEDIUM" },
  { id: `${tier1}--low-insufficient`, text: "LOW" },
  { id: `${tier1}--not-estimable`, text: "Not returned" },
  { id: `${tier1}--unavailable`, text: "not low priority" },
  { id: `${tier1}--loading`, text: "Loading model-assisted" },
  { id: `${tier1}--failed`, text: "not low priority" },
  { id: `${tier1}--stale`, text: "not low priority" },
  { id: `${tier1}--release-unknown`, text: "not low priority" },
  { id: `${tier1}--release-mismatch`, text: "not low priority" },
  { id: `${hierarchy}--representative`, text: "What we know" },
  { id: `${hierarchy}--zero-suppression`, text: "Suppressed" },
  { id: `${hierarchy}--coverage-limitation`, text: "What we know" },
  { id: `${hierarchy}--same-period-conflict`, text: "stay separate" },
  {
    id: `${hierarchy}--partial-failure`,
    text: "Retry evidence that did not load",
  },
  { id: `${hierarchy}--partial-failure-retrying`, text: "Retrying evidence" },
  { id: `${hierarchy}--county-pending`, text: "What we know" },
  {
    id: `${hierarchy}--county-error`,
    text: "request failure, not zero evidence",
  },
  {
    id: `${hierarchy}--catalog-failure`,
    text: "measure catalog could not be loaded",
  },
  {
    id: `${hierarchy}--refresh-failure`,
    text: "Loaded evidence stays visible",
  },
  { id: `${hierarchy}--with-model`, text: "HIGH" },
  { id: `${shell}--review`, text: "Adams County, Colorado" },
  { id: `${shell}--workspace-overview`, text: "Active catalog route: /app" },
  {
    id: `${shell}--investigate`,
    text: "Active catalog route: /app/investigate",
  },
  { id: `${shell}--collapsed`, text: "Adams County, Colorado" },
  { id: `${preview}--rationale`, text: "Adams County, Colorado" },
  { id: `${preview}--limited-qualification`, text: "Limited" },
  { id: `${preview}--missing-metadata`, text: "Unavailable" },
  {
    id: `${preview}--long-references`,
    text: "Synthetic review candidate for Adams County",
  },
  {
    id: `${preview}--dropped-context`,
    text: "Sort stays on Atlas Explorer browse",
  },
  {
    id: `${preview}--geography-unpublished`,
    text: "Adams County, Colorado",
  },
  {
    id: `${preview}--geography-loading`,
    text: "Adams County, Colorado",
  },
  {
    id: `${preview}--geography-error`,
    text: "Adams County, Colorado",
  },
];

const axeStories = [
  `${evidenceObject}--published-zero`,
  `${evidenceStrip}--limited-with-caveat`,
  `${releaseStrip}--ready-complete`,
  `${provenance}--full-reason`,
  `${tier1}--high-sufficient`,
  `${hierarchy}--representative`,
  `${shell}--review`,
  `${preview}--rationale`,
];

function track(page: Page): { blocked: string[]; errors: string[] } {
  const blocked: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  return { blocked, errors };
}

async function openStory(page: Page, id: string): Promise<void> {
  await page.goto(`iframe.html?id=${id}&viewMode=story`);
}

test.describe("P0 evidence catalog", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The full matrix runs on desktop. Mobile coverage is the shell and narrow reflow."
    );
  });

  for (const story of stories) {
    test(`${story.id} renders without a service request`, async ({ page }) => {
      const traffic = track(page);
      await openStory(page, story.id);
      const reveal = async () => {
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
      };
      await reveal();
      await page.reload();
      await reveal();
      expect(traffic.blocked).toEqual([]);
      expect(traffic.errors).toEqual([]);
    });
  }

  for (const id of axeStories) {
    test(`${id} has no accessibility violations`, async ({ page }) => {
      await openStory(page, id);
      await expect(page.locator("body")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("published zero stays distinct from a missing record", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, `${evidenceObject}--published-zero`);
    await expect(page.getByText("0 mm")).toBeVisible();
    await expect(
      page.getByText("Published zero", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Dataset vintage")).toHaveCount(0);
    await openStory(page, `${evidenceObject}--missing`);
    await expect(page.getByTestId("evidence-display-value")).toHaveText(
      "Unavailable"
    );
    await expect(page.getByText("0 mm")).toHaveCount(0);
    await page.getByText("Inspect provenance").press("Enter");
    await expect(page.getByText("Inspect provenance")).toBeVisible();
    expect(traffic.blocked).toEqual([]);
  });

  test("provenance disclosures open from the keyboard without analytics", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, `${provenance}--technical-unreadable`);
    await page.getByText("Inspect provenance").press("Enter");
    await expect(
      page.getByText("Technical reproducibility identifiers")
    ).toBeVisible();
    await page
      .getByText("Technical reproducibility identifiers")
      .press("Enter");
    await expect(page.getByText("Unavailable").first()).toBeVisible();
    await expect(page.getByText("not-a-digest")).toHaveCount(0);
    expect(traffic.blocked).toEqual([]);
  });

  test("state-label provenance does not invent a vintage", async ({ page }) => {
    await openStory(page, `${provenance}--state-label-missing`);
    await page.getByText("Inspect provenance").click();
    await expect(page.getByText("Unavailable").first()).toBeVisible();
    await expect(page.getByText("Dataset vintage")).toHaveCount(0);
    await expect(page.getByText("v1.0.0-scaled-202501")).toHaveCount(0);
  });

  test("release loading and error omit the evidence badge", async ({
    page,
  }) => {
    await openStory(page, `${releaseStrip}--loading`);
    await expect(page.getByRole("status")).toContainText(
      "Loading governed release context"
    );
    await expect(page.getByText("Available")).toHaveCount(0);
    await expect(
      page.getByText("Synthetic release request failed")
    ).toHaveCount(0);
    await openStory(page, `${releaseStrip}--error-default`);
    await expect(page.getByRole("alert")).toContainText(
      "Unable to load governed release context"
    );
    await expect(page.getByText("Available")).toHaveCount(0);
  });

  test("withheld priority is not labeled low", async ({ page }) => {
    await openStory(page, `${tier1}--unavailable`);
    const panel = page.getByTestId("tier1-surveillance-priority");
    await expect(panel).toHaveAttribute("data-state", "unavailable");
    await expect(panel).not.toHaveAttribute("data-tier", "LOW");
    await expect(panel).toContainText("not low priority");
    await openStory(page, `${tier1}--low-insufficient`);
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-tier", "LOW");
  });

  test("hierarchy retry updates local state and keeps a conflict separate", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, `${hierarchy}--partial-failure`);
    await page
      .getByRole("button", { name: "Retry evidence that did not load" })
      .click();
    await expect(page.getByTestId("hierarchy-retry-count")).toHaveText(
      "Retry requests from this preview: 1"
    );
    await openStory(page, `${hierarchy}--same-period-conflict`);
    await expect(
      page.getByText("stay separate", { exact: false })
    ).toBeVisible();
    await openStory(page, `${hierarchy}--catalog-failure`);
    await expect(page.getByTestId("investigate-catalog-notice")).toBeVisible();
    expect(traffic.blocked).toEqual([]);
  });

  test("review actions come from onOpen and keep the synthetic handoff", async ({
    page,
  }) => {
    const traffic = track(page);
    await openStory(page, `${preview}--rationale`);
    await expect(page.getByTestId("preview-action")).toHaveText(
      "Last preview action: None"
    );
    const investigate = page.getByTestId("review-investigate");
    const compare = page.getByTestId("review-compare");
    await expect(investigate).toHaveAttribute("href", /dataset=alpha-2026/);
    await expect(investigate).toHaveAttribute("href", /county=08001/);
    await expect(compare).toHaveAttribute("href", /dataset=alpha-2026/);
    await compare.click();
    await expect(page.getByTestId("preview-action")).toHaveText(
      "Last preview action: Opened county 08001 (1)"
    );
    await investigate.click();
    await expect(page.getByTestId("preview-action")).toHaveText(
      "Last preview action: Opened county 08001 (2)"
    );
    await openStory(page, `${preview}--long-references`);
    await expect(page.getByTestId("preview-action")).toHaveText(
      "Last preview action: None"
    );
    await page.locator("summary", { hasText: "Score and methodology" }).click();
    await page.getByText("Inspect provenance").click();
    const source = page.getByRole("link", { name: "Open source reference" });
    await source.evaluate((anchor) => {
      anchor.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
        },
        { capture: true }
      );
    });
    await source.click();
    await expect(page.getByTestId("preview-action")).toHaveText(
      "Last preview action: None"
    );
    await page.getByText("Model and as-of details").click();
    const details = page.getByTestId("tier1-model-details");
    await expect(details).toContainText("alpha-2026");
    await expect(details).not.toContainText("governed-2026-09-18");
    await openStory(page, `${preview}--dropped-context`);
    await expect(
      page.getByTestId("tier1-surveillance-priority")
    ).toHaveAttribute("data-tier", "HIGH");
    await expect(page.getByText("not low priority")).toHaveCount(0);
    expect(traffic.blocked).toEqual([]);
    expect(traffic.errors).toEqual([]);
  });

  test("county preview availability fixtures stay local", async ({ page }) => {
    const traffic = track(page);
    await openStory(page, `${preview}--rationale`);
    await expect(
      page.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    await expect(page.getByTestId("review-county-preview")).not.toContainText(
      "Canonical geography is not yet published"
    );
    await openStory(page, `${preview}--geography-loading`);
    await expect(
      page.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    await openStory(page, `${preview}--geography-error`);
    await expect(
      page.getByTestId("canonical-geography-availability")
    ).toHaveCount(0);
    await expect(page.getByTestId("review-county-preview")).not.toContainText(
      "Canonical geography publication could not be checked"
    );
    expect(traffic.blocked).toEqual([]);
    expect(traffic.errors).toEqual([]);
  });

  test("normal tier and provenance use alpha-2026 while mismatch stays withheld", async ({
    page,
  }) => {
    await openStory(page, `${tier1}--high-sufficient`);
    await expect(page.getByTestId("tier1-synthetic-notice")).toContainText(
      "relabeled"
    );
    await page.getByText("Model and as-of details").click();
    const details = page.getByTestId("tier1-model-details");
    await expect(details).toContainText("alpha-2026");
    await expect(details).not.toContainText("governed-2026-09-18");
    await openStory(page, `${tier1}--release-mismatch`);
    const mismatch = page.getByTestId("tier1-surveillance-priority");
    await expect(mismatch).toContainText("not low priority");
    await expect(mismatch).not.toHaveAttribute("data-tier", "LOW");
    await openStory(page, `${provenance}--full-reason`);
    await page.getByText("Inspect provenance").click();
    await page.getByText("Technical reproducibility identifiers").click();
    await expect(page.getByText("alpha-2026")).toBeVisible();
    await openStory(page, `${hierarchy}--with-model`);
    await expect(
      page.locator("[data-release='alpha-2026']").first()
    ).toBeVisible();
    await page.getByText("Model and as-of details").click();
    await expect(page.getByTestId("tier1-model-details")).toContainText(
      "alpha-2026"
    );
  });

  test("desktop shell collapses, follows local routes, and keeps Ask Atlas local", async ({
    page,
  }) => {
    const traffic = track(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openStory(page, `${shell}--review`);
    const hide = page.getByRole("button", { name: "Hide navigation" });
    await expect(hide).toBeVisible();
    await hide.click();
    const show = page.getByRole("button", { name: "Show navigation" });
    await expect(show).toBeVisible();
    await page.getByRole("link", { name: "Compare" }).click();
    await expect(
      page.getByText("Active catalog route: /compare")
    ).toBeVisible();
    const askAtlas = page
      .getByRole("navigation", { name: "Professional workspace" })
      .getByRole("link", { name: "Ask Atlas", exact: true });
    await expect(askAtlas).toHaveAttribute("href", /\/askatlas/);
    await expect(page.getByTestId("ask-atlas-launcher")).toHaveCount(0);
    await expect(page.getByTestId("ask-atlas-panel")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const inset = page.locator(".app-inset");
    await expect(inset).not.toHaveAttribute("inert", "");
    await askAtlas.focus();
    await expect(askAtlas).toBeFocused();
    const image = page.locator("img.atlas-brand-mark").first();
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    expect(src ?? "").not.toMatch(/^\/android-chrome/);
    expect(src ?? "").toContain("android-chrome-192x192");
    expect(traffic.blocked).toEqual([]);
  });

  test("controls change the evidence preset and heading", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "Controls live in the desktop manager."
    );
    await page.goto(`?path=/story/${evidenceObject}--observed-nonzero`);
    const canvas = page.frameLocator("#storybook-preview-iframe");
    await expect(
      canvas.getByRole("heading", {
        level: 3,
        name: "Synthetic daily precipitation",
      })
    ).toBeVisible();
    await page.getByRole("tab", { name: /Controls/ }).click();
    await page.locator("#control-preset").selectOption("published-zero");
    await expect(canvas.getByText("0 mm")).toBeVisible();
    await page.locator("#control-heading").selectOption("h5");
    await expect(
      canvas.getByRole("heading", {
        level: 5,
        name: "Synthetic published zero",
      })
    ).toBeVisible();
  });

  test("inline Autodocs keeps unique ids", async ({ page }) => {
    await page.goto(`iframe.html?id=${evidenceObject}--docs&viewMode=docs`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")]
        .map((element) => element.id)
        .filter((id) => id.length > 0);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
  });

  test("shell Autodocs does not repeat the navigation id in one document", async ({
    page,
  }) => {
    await page.goto(`iframe.html?id=${shell}--docs&viewMode=docs`);
    await expect(page.locator("#ux-reset-pro-navigation")).toHaveCount(0);
    const frame = page.frameLocator("iframe").first();
    await expect(frame.locator("#ux-reset-pro-navigation")).toHaveCount(1);
  });

  test("shell docs keep each story's declared sidebar state together", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`iframe.html?id=${shell}--docs&viewMode=docs`);
    const declared = [
      { id: `${shell}--review`, label: "Hide navigation" },
      { id: `${shell}--workspace-overview`, label: "Hide navigation" },
      { id: `${shell}--investigate`, label: "Hide navigation" },
      { id: `${shell}--collapsed`, label: "Show navigation" },
    ] as const;
    await expect
      .poll(
        () =>
          declared.filter((story) =>
            page
              .frames()
              .some((frame) => frame.url().includes(`id=${story.id}`))
          ).length
      )
      .toBe(declared.length);
    for (const story of declared) {
      const frame = page
        .frames()
        .find((item) => item.url().includes(`id=${story.id}`));
      if (!frame) {
        throw new Error(`Missing shell frame for ${story.id}`);
      }
      await expect(
        frame.getByRole("button", { name: story.label })
      ).toBeVisible();
    }
  });
});

test("narrow evidence strips stay within 320px", async ({ page }, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 320),
    "Phone-width evidence strips run on the mobile project."
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await openStory(page, `${evidenceStrip}--narrow`);
  await expect(page.getByText("Limited")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 800 });
  await openStory(page, `${releaseStrip}--narrow`);
  await expect(page.getByText("Synthetic limitation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("mobile shell opens, dismisses, and returns focus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Drawer behavior is the mobile project."
  );
  const traffic = track(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, `${shell}--review`);
  const open = page.getByRole("button", { name: "Open navigation" });
  await expect(open).toBeVisible();
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Professional workspace" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await open.click();
  await page.getByRole("button", { name: "Dismiss navigation" }).click();
  await expect(open).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(open).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(traffic.blocked).toEqual([]);
});
