import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { compareCountyDetail } from "../fixtures/compare-api-fixtures";
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";

async function installExplorerMocks(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({
      json: { detail: "Atlas data service is unavailable." },
      status: 503,
    });
  });
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: reviewScopeScoresFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/counties/08001**", async (route) => {
    const detail = compareCountyDetail("08001");
    await route.fulfill({
      json: {
        ...detail,
        color: "#e9602b",
        county: "Denver",
        priority: "Priority 1 — Investigate",
        release: { ...detail.release, release_id: "alpha-2026" },
      },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    await route.fulfill({
      json: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            nextCheck: "Review the cited source records.",
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        resultState: "candidates_found",
        state,
      }),
      status: 200,
    });
  });
}

test.describe("Atlas Explorer county evidence", () => {
  test("opens evidence in place and returns to the map", async ({
    page,
  }, testInfo) => {
    await installExplorerMocks(page);
    await page.goto("/explore?scope=CO&county=08001");
    await expect(page.getByTestId("review-view-county-evidence")).toBeVisible();
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "href",
      /\/explore\?.*mode=evidence/
    );

    await page.getByTestId("review-view-county-evidence").click();
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("explorer-county-evidence")).toBeVisible();
    await expect(page.getByTestId("explorer-county-heading")).toBeFocused();
    await expect(page.getByTestId("review-state-panel")).toBeHidden();
    await expect(
      page
        .getByTestId("explorer-county-evidence")
        .getByTestId("explorer-follow-up-response")
    ).toContainText("Prioritize targeted follow-up");
    await expect(page.getByTestId("explorer-review-priority")).toContainText(
      "Highest review priority"
    );
    const resource = page
      .locator("summary", {
        hasText: "Questions, partner roles, and official resources",
      })
      .first();
    await resource.focus();
    await page.keyboard.press("Enter");
    await expect(resource).toBeFocused();
    await expect(
      page.getByRole("link", { name: "Lyme surveillance case definition" })
    ).toBeVisible();
    await expect(page.getByTestId("explorer-summary-limitation")).toContainText(
      "Collection dates are unavailable"
    );
    await page.getByRole("link", { name: "Suggested follow-up" }).click();
    await expect(page.locator("#explorer-follow-up")).toBeInViewport();

    const compareHref =
      (await page.getByTestId("explorer-compare").getAttribute("href")) ?? "";
    expect(compareHref).toContain("/compare");
    expect(compareHref).toContain("mode=evidence");
    expect(compareHref).toContain("return=review");
    expect(compareHref).not.toContain("020");
    expect(compareHref).not.toContain("150");

    await page.getByTestId("explorer-back-to-map").click();
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
    await expect(page.getByTestId("review-candidate")).toBeFocused();
    await expect(page).toHaveURL(/county=08001/);

    if (!testInfo.project.name.includes("mobile")) {
      await page.getByTestId("review-view-county-evidence").click();
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("opens suggested follow-up from the URL and restores it from Compare", async ({
    page,
  }) => {
    await installExplorerMocks(page);
    await page.goto("/explore?scope=CO&county=08001&mode=follow-up");
    await expect(
      page.getByRole("heading", { name: "Suggested follow-up" })
    ).toBeFocused();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let previous = -1;
          const settle = () => {
            const top = document.scrollingElement?.scrollTop ?? 0;
            if (top === previous) {
              resolve();
              return;
            }
            previous = top;
            requestAnimationFrame(settle);
          };
          requestAnimationFrame(settle);
        })
    );
    await page.getByTestId("explorer-compare").click();
    await expect(page).toHaveURL(/\/compare/, { timeout: 20_000 });
    await expect(page).toHaveURL(/mode=follow-up/);
    await expect(page).toHaveURL(/return=review/);
    const openNavigation = page.getByRole("button", {
      name: "Open navigation",
    });
    if (await openNavigation.isVisible()) {
      await openNavigation.click();
    }
    await page
      .getByRole("link", { exact: true, name: "Atlas Explorer" })
      .click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/mode=follow-up/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("explorer-county-evidence")).toBeVisible();
  });

  test("does not invent a county for mode without one, and drops an invalid mode", async ({
    page,
  }) => {
    await installExplorerMocks(page);
    await page.goto("/explore?scope=CO&mode=evidence");
    await expect(page.getByTestId("explorer-recovery")).toHaveAttribute(
      "data-recovery",
      "missing"
    );
    await expect(page).not.toHaveURL(/county=/);
    await page.getByTestId("explorer-back-to-map").click();
    await expect(page.getByTestId("review-state-panel")).toBeVisible();

    await page.goto("/explore?scope=CO&mode=tiles&mode=evidence");
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page.getByTestId("review-scope-results")).toBeVisible();
    await expect(page.getByTestId("explorer-county-evidence")).toHaveCount(0);
  });

  test("keeps a failed evidence request distinct from zero or absence", async ({
    page,
  }) => {
    await installExplorerMocks(page);
    await page.goto("/explore?scope=CO&county=08001&mode=evidence");
    await expect(page.getByTestId("explorer-county-heading")).toHaveText(
      "Denver"
    );
    await expect(
      page.locator("[data-atlas-status='error']").first()
    ).toBeVisible();
    const text =
      (await page.getByTestId("explorer-county-evidence").textContent()) ?? "";
    expect(text).not.toMatch(/\b0 cases\b/);
    expect(text.toLowerCase()).not.toContain("pathogen is absent");
    await expect(page.getByTestId("explorer-export-unavailable")).toBeVisible();
  });
});
