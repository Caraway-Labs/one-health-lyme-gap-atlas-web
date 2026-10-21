import { expect, test, type Page } from "@playwright/test";

import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import autauga from "../fixtures/review-al-v11-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-v11-01003.json" with { type: "json" };
import barbour from "../fixtures/review-al-v11-01005.json" with { type: "json" };
import { buildStateReview } from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeScoresFixture } from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";

const release = baldwin.release.release_id;
const rowLabels = [
  "Published Lyme case data",
  "Tick presence",
  "Borrelia burgdorferi detection",
  "Social vulnerability",
  "Health insurance coverage",
  "Rurality",
];

async function installPublishedReview(page: Page) {
  await fulfillCompletedStartingView(page);
  await page.route("**/v1/atlas/metadata**", (route) =>
    route.fulfill({ json: { ...baldwin.release, release_id: release } })
  );
  await page.route("**/v1/atlas/scores**", (route) =>
    route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        release_id: release,
        counties: identities.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          ...entry,
          state_name: entry.stateName,
        })),
      },
    })
  );
  await page.route("**/v1/states/*/review**", (route) => {
    const review = buildStateReview({
      resultState: "unsupported",
      state: "AL",
    });
    review.data_release_version = release;
    review.coverage.assessed_counties = 67;
    return route.fulfill({ json: review });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: { features: [], type: "FeatureCollection" },
    })
  );
  await page.route("**/v1/counties/*", (route) => {
    const url = route.request().url();
    if (url.includes("/availability") || url.includes("/tier1-")) {
      return route.fallback();
    }
    const fips = new URL(url).pathname.split("/").at(-1);
    const detail = [autauga, baldwin, barbour].find(
      (entry) => entry.fips === fips
    );
    return detail
      ? route.fulfill({ json: detail })
      : route.fulfill({ status: 404, json: { detail: "No published record" } });
  });
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Catalog unavailable in this fixture" },
    })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ status: 404, json: { detail: "No matching priority" } })
  );
  await page.route("**/v1/geographies/county/*/availability", (route) =>
    route.fulfill({
      json: {
        availability: "UNAVAILABLE",
        data: null,
        limitations: [
          "Canonical geography identity delivery is not published by this API capability.",
        ],
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
        release_id: release,
      },
      status: 200,
    })
  );
}

async function expectFollowUpInView(page: Page) {
  await expect
    .poll(async () =>
      page.locator("#explorer-map-follow-up").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const visibleHeight =
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        return (
          visibleHeight > 0 && rect.top < window.innerHeight && rect.top <= 80
        );
      })
    )
    .toBe(true);
}

async function expectActionLayout(
  page: Page,
  preview: ReturnType<Page["getByTestId"]>
) {
  const layout = await preview
    .locator(".ux-reset-review-preview-actions")
    .evaluate((actions) => {
      const followUp = actions.querySelector(
        "[data-testid='review-view-county-follow-up']"
      );
      const compare = actions.querySelector("[data-testid='review-compare']");
      if (
        !(followUp instanceof HTMLElement && compare instanceof HTMLElement)
      ) {
        return null;
      }
      const followBox = followUp.getBoundingClientRect();
      const compareBox = compare.getBoundingClientRect();
      const width = actions.getBoundingClientRect().width;
      const sideBySide = width >= 11.5 * 16 * 2 + 8;
      return {
        compareX: compareBox.x,
        compareY: compareBox.y,
        followX: followBox.x,
        followY: followBox.y,
        sideBySide,
      };
    });
  expect(layout).not.toBeNull();
  if (!layout) {
    return;
  }
  if (layout.sideBySide) {
    expect(Math.abs(layout.followY - layout.compareY)).toBeLessThan(4);
    expect(layout.compareX).toBeGreaterThan(layout.followX);
    return;
  }
  expect(layout.compareY).toBeGreaterThan(layout.followY);
}

function availabilityHits(page: Page): string[] {
  const hits: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/geographies/county/") &&
      request.url().includes("/availability")
    ) {
      hits.push(request.url());
    }
  });
  return hits;
}

test.describe("Selected county preview", () => {
  test("uses two actions, keeps six rows, and does not request availability", async ({
    page,
  }) => {
    const hits = availabilityHits(page);
    await installPublishedReview(page);
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByTestId("review-view-county-follow-up")
    ).toHaveText("View County Follow-Up");
    await expect(preview.getByTestId("review-compare")).toHaveText(
      "Compare This County"
    );
    await expect(preview.getByTestId("review-compare")).toHaveAttribute(
      "data-variant",
      "outline"
    );
    await expect(
      preview.getByRole("button", { name: "View County Follow-Up" })
    ).toHaveCount(1);
    await expect(preview.getByRole("link")).toHaveCount(1);
    await expect(preview.getByTestId("review-investigate")).toHaveCount(0);
    await expect(preview.getByTestId("review-ask-atlas")).toHaveCount(0);
    await expect(
      preview.getByTestId("review-view-county-evidence")
    ).toHaveCount(0);
    await expect(preview.getByTestId("review-rationale-1")).toContainText(
      "Minimum reported cases"
    );
    await expect(preview.getByTestId("review-rationale-1")).toContainText(
      "The published data establish a minimum number of reported cases. The actual reported total may be higher."
    );
    await expect(
      preview
        .getByTestId("review-rationale")
        .locator("[data-slot='tooltip-trigger']")
    ).toHaveCount(0);
    await expect(
      preview.getByTestId("review-rationale-1").getByRole("button", {
        name: /Minimum reported/,
      })
    ).toHaveCount(0);
    await expect(preview.getByTestId("review-rationale-1")).not.toContainText(
      "not an exact count"
    );
    for (const [index, label] of rowLabels.entries()) {
      await expect(
        preview.getByTestId(`review-rationale-${index + 1}`).locator("h4")
      ).toHaveText(label);
    }
    await expect(
      preview.getByRole("heading", { name: "Surveillance evidence" })
    ).toBeVisible();
    await expect(
      preview.getByRole("heading", { name: "Community context" })
    ).toBeVisible();
    const influence = preview.getByTestId("ranking-influence");
    await expect(influence).not.toHaveAttribute("open");
    await expect(influence.locator("summary")).toHaveText(
      "What influenced this ranking?"
    );
    expect(hits).toEqual([]);

    await page.locator('button.ux-reset-ranked-row[data-fips="01001"]').click();
    await expect(preview).toHaveAttribute("data-fips", "01001");
    await expect(preview.getByTestId("review-rationale-1")).toContainText(
      "No county-linked 2023 Lyme case record is available."
    );
    expect(hits).toEqual([]);

    await page.getByRole("button", { name: "Clear county" }).click();
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    expect(hits).toEqual([]);
  });

  test("scrolls to suggested follow-up and honors reduced motion", async ({
    page,
  }) => {
    await installPublishedReview(page);
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toBeVisible();
    await expectActionLayout(page, preview);
    await page.setViewportSize({ height: 1000, width: 1920 });
    await expectActionLayout(page, preview);
    await page.getByTestId("review-view-county-follow-up").click();
    await expect(page.locator("#explorer-map-follow-up")).toBeFocused();
    await expectFollowUpInView(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      const calls: Array<ScrollToOptions | boolean | undefined> = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function scrollIntoView(
        options?: ScrollToOptions | boolean
      ) {
        calls.push(options);
        original.call(this, options);
      };
      Object.assign(window, { __followUpScrolls: calls });
    });
    await page.getByTestId("review-view-county-follow-up").click();
    await expect(page.locator("#explorer-map-follow-up")).toBeFocused();
    const reduced = await page.evaluate(
      () =>
        (
          window as Window & {
            __followUpScrolls?: Array<ScrollToOptions | boolean | undefined>;
          }
        ).__followUpScrolls
    );
    expect(reduced?.at(-1)).toMatchObject({ behavior: "auto", block: "start" });

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByTestId("review-view-county-follow-up").click();
    const smooth = await page.evaluate(
      () =>
        (
          window as Window & {
            __followUpScrolls?: Array<ScrollToOptions | boolean | undefined>;
          }
        ).__followUpScrolls
    );
    expect(smooth?.at(-1)).toMatchObject({
      behavior: "smooth",
      block: "start",
    });
  });

  test("does not request availability again after returning from county evidence", async ({
    page,
  }) => {
    const hits = availabilityHits(page);
    await installPublishedReview(page);
    await page.goto(`/explore?scope=AL&dataset=${release}&county=01003`);
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toBeVisible();
    expect(hits).toEqual([]);
    const evidence = new URL(page.url());
    evidence.searchParams.set("mode", "evidence");
    await page.goto(evidence.toString());
    await expect(page.getByTestId("explorer-county-evidence")).toBeVisible();
    await expect
      .poll(() => hits.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const afterEvidence = hits.length;
    await page.getByTestId("explorer-back-to-map").click();
    await expect(
      page.getByTestId("review-published-county-preview")
    ).toBeVisible();
    expect(hits.length).toBe(afterEvidence);
  });
});
