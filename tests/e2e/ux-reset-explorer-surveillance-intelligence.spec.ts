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
import { tier1LowInsufficientFixture } from "../fixtures/tier1-surveillance-priority";

const SHA = "c".repeat(64);

function situationData(classId: string, className: string) {
  return {
    activated_at: "2026-10-15T00:00:00Z",
    batch_id: "batch",
    batch_version: "batch-v1",
    class_description: `${className} groups published evidence.`,
    class_id: classId,
    class_name: className,
    county_sha256: SHA,
    data_authorization_id: "auth",
    data_publication_authorization: {},
    dictionary_sha256: SHA,
    feature_contract: {},
    fit_git_sha: "abc",
    handoff_approval: {},
    input_bundle_sha256: SHA,
    input_release_id: "governed-2026-10-15-january-climate-prod",
    limitations: ["Not disease risk."],
    model_id: "model",
    model_provenance: {},
    model_version: "situation-v1",
    probabilities: [
      { class_id: "decoy", probability: 0.8 },
      { class_id: classId, probability: 0.2 },
      { class_id: "other-a", probability: 0 },
      { class_id: "other-b", probability: 0 },
    ],
    source_provenance: {
      human: {
        dataset_id: "x5j9-wybp",
        source_id: "cdc_lyme",
        vintage: "2023",
      },
      tick: {
        source_id: "cdc_arbonet_tick_module",
        vintage: "through 2025-12-31",
      },
    },
    staging_attempt: "1",
  };
}

function situationsResponse() {
  const available = (classId: string, className: string) => ({
    availability: "AVAILABLE",
    batch_id: "batch",
    batch_version: "batch-v1",
    compatibility: "EXACT_INPUT",
    data: situationData(classId, className),
    input_release_id: "governed-2026-10-15-january-climate-prod",
    model_id: classId,
    unavailable_reason: null,
  });
  return {
    bundle_sha256: SHA,
    county_fips: "08001",
    four_state: available("class-3", "Pathogen not recorded"),
    release_id: reviewScopeMetadataFixture.release_id,
    tick_pathogen: available("class-0", "Established blacklegged tick"),
  };
}

async function installExplorerMocks(page: Page) {
  await page.route("**/v1/**", async (route) => {
    await route.fulfill({
      json: { detail: "Atlas data service is unavailable." },
      status: 503,
    });
  });
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
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
        release: {
          ...detail.release,
          release_id: reviewScopeMetadataFixture.release_id,
        },
      },
      status: 200,
    });
  });
  await page.route(
    "**/v1/counties/08001/tier1-surveillance-priority**",
    async (route) => {
      await route.fulfill({
        json: {
          ...tier1LowInsufficientFixture,
          county_fips: "08001",
          release_id: reviewScopeMetadataFixture.release_id,
        },
        status: 200,
      });
    }
  );
  await page.route(
    "**/v1/counties/08001/surveillance-situations**",
    async (route) => {
      await route.fulfill({ json: situationsResponse(), status: 200 });
    }
  );
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

test.describe("Explorer county surveillance intelligence", () => {
  test("shows four cards, one details panel, and keeps evidence navigation", async ({
    page,
  }) => {
    await installExplorerMocks(page);
    await page.goto("/explore?scope=CO&county=08001");
    await page.getByTestId("review-view-county-evidence").click();
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page).toHaveURL(/county=08001/);
    const section = page
      .getByTestId("explorer-county-evidence")
      .getByTestId("county-surveillance-intelligence");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { level: 3 })).toHaveCount(4);
    await expect(
      page
        .getByTestId("explorer-county-evidence")
        .getByTestId("tier1-surveillance-priority")
    ).toHaveCount(0);
    await expect(section.getByText("LOW", { exact: true })).toBeVisible();
    await expect(section.getByText("Pathogen not recorded")).toBeVisible();
    await expect(
      section.getByText("Class membership 20.0%").first()
    ).toBeVisible();
    await expect(
      section.getByText(/models agree|composite score/i)
    ).toHaveCount(0);

    const gap = section.getByRole("button", { name: /Surveillance Gap Score/ });
    await gap.focus();
    await page.keyboard.press("Enter");
    const details = page.getByTestId("surveillance-intelligence-details");
    await expect(details).toBeVisible();
    await expect(gap).toHaveAttribute("aria-expanded", "true");
    await expect(details).toContainText("Human/ecological discordance");
    const situation = section.getByRole("button", {
      name: /Surveillance Situation/,
    });
    await situation.focus();
    await page.keyboard.press(" ");
    await expect(situation).toHaveAttribute("aria-expanded", "true");
    await expect(gap).toHaveAttribute("aria-expanded", "false");
    await expect(details).toContainText("Pathogen not recorded");
    await situation.click();
    await expect(details).toHaveCount(0);

    const viewports = [
      { columns: 2, height: 900, width: 768 },
      { columns: 2, height: 900, width: 1440 },
      { columns: 2, height: 900, width: 1728 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      const template = await section
        .getByTestId("surveillance-intelligence-grid")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      const columnCount = template.split(" ").filter(Boolean).length;
      expect(columnCount).toBe(viewport.columns);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(gap).toHaveClass(/motion-reduce:transition-none/);
    const results = await new AxeBuilder({ page })
      .include(
        '[data-testid="explorer-county-evidence"] [data-testid="county-surveillance-intelligence"]'
      )
      .analyze();
    expect(results.violations).toEqual([]);

    await page.getByTestId("explorer-back-to-map").click();
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page.getByTestId("review-state-panel")).toBeVisible();
  });
});
