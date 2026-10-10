import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  buildStateReview,
  reviewCandidate,
  reviewEvidenceReference,
} from "../fixtures/review-operating-picture-fixtures";
import { reviewScopeMetadataFixture } from "../fixtures/review-scope-api-fixtures";

async function installOperatingPicture(
  page: Page,
  reviewForState: (state: string) => unknown
) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({ json: { profile: null }, status: 200 });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", async (route) => {
    await route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    await route.fulfill({ json: reviewForState(state), status: 200 });
  });
}

test.describe("Review operating picture", () => {
  test("shows a candidate reason, basis, caveat, and Investigate path", async ({
    page,
  }, testInfo) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08031",
            detail: "Environmental context stays a data gap.",
          },
        ],
        resultState: "candidates_found",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "candidates_found"
    );
    await expect(page.getByTestId("review-methodology")).toContainText(
      "atlas-county-review 1.0.0"
    );
    await expect(page.getByTestId("review-observed-basis")).toContainText(
      "Borrelia burgdorferi sensu stricto"
    );
    await expect(page.getByTestId("review-county-preview")).toContainText(
      "Collection dates are unavailable"
    );
    await expect(page.getByTestId("review-data-gap")).toHaveAttribute(
      "data-fips",
      "08031"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(1);
    const href =
      (await page.getByTestId("review-investigate").getAttribute("href")) ?? "";
    expect(href).toContain("county=08001");
    expect(href).toContain("/app/investigate");
    await page.getByTestId("review-investigate").click();
    await expect(page).toHaveURL(/\/app\/investigate/);
    await expect(page).toHaveURL(/county=08001/);

    if (!testInfo.project.name.includes("mobile")) {
      await page.goBack();
      await expect(page.getByTestId("review-state-panel")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("keeps an unavailable review request distinct from nothing stands out", async ({
    page,
  }) => {
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      await route.fulfill({
        json: { detail: "Atlas data service is unavailable." },
        status: 503,
      });
    });
    await page.goto("/app/review?scope=CO");
    await expect(page.locator("[data-atlas-status='error']")).toContainText(
      "temporarily unavailable"
    );
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
  });

  test("keeps insufficient evidence distinct from data gaps and nothing stands out", async ({
    page,
  }) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08001",
            detail: "Eligible evidence is missing for this county.",
          },
        ],
        resultState: "insufficient_evidence",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "insufficient_evidence"
    );
    await expect(page.getByTestId("review-result-summary")).toContainText(
      "not enough eligible evidence"
    );
    await expect(page.getByTestId("review-data-gap")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    await expect(page.getByTestId("review-data-gaps")).toContainText(
      "Unavailable"
    );
  });

  test("renders unsupported gaps as data-gap-only", async ({ page }) => {
    await installOperatingPicture(page, (state) =>
      buildStateReview({
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08031",
            detail: "Environmental context stays a data gap.",
          },
        ],
        resultState: "unsupported",
        state,
      })
    );
    await page.goto("/app/review?scope=CO");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "data_gap_only"
    );
    await expect(page.getByTestId("review-result-summary")).toContainText(
      "No review candidate was returned"
    );
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
    await expect(page.getByTestId("review-data-gap")).toHaveCount(1);
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
  });

  test("clears the county when the next result has no candidates", async ({
    page,
  }) => {
    await installOperatingPicture(page, (state) => {
      if (state === "NY") {
        return buildStateReview({
          resultState: "none_stand_out",
          state,
        });
      }
      return buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            reasonText:
              "Denver is included because the review method returned it.",
          }),
        ],
        resultState: "candidates_found",
        state,
      });
    });
    await page.goto("/app/review?scope=CO&county=08001");
    await expect(page.getByTestId("review-investigate")).toHaveAttribute(
      "data-county",
      "08001"
    );
    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "none_stand_out"
    );
    await expect(page).toHaveURL(/scope=NY/);
    await expect(page).not.toHaveURL(/county=/);
    await expect(page.getByTestId("review-candidate")).toHaveCount(0);
  });

  test("shows loading before a review result", async ({ page }) => {
    let releaseReview = () => {};
    const reviewGate = new Promise<void>((resolve) => {
      releaseReview = resolve;
    });
    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      await route.fulfill({ json: reviewScopeMetadataFixture, status: 200 });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      await reviewGate;
      await route.fulfill({
        json: buildStateReview({
          resultState: "none_stand_out",
          state: "CO",
        }),
        status: 200,
      });
    });
    await page.goto("/app/review?scope=CO");
    await expect(page.getByText("Loading review results…")).toBeVisible();
    await expect(page.getByText("Nothing stands out")).toHaveCount(0);
    releaseReview();
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "none_stand_out"
    );
  });

  test("exposes result reproducibility details without mixing scope or release identities", async ({
    page,
  }, testInfo) => {
    const hashFor = (seed: string) => seed.repeat(64);
    const coloradoHash = hashFor("a");
    const newYorkHash = hashFor("b");
    const insufficientHash = hashFor("c");
    const unsupportedHash = hashFor("d");
    const coloradoEvaluatedAt = "2026-10-06T04:57:46.000Z";
    const retrievedAt = "2026-08-15T15:04:05.000Z";
    const sourceAsOf = "2024-06-01";
    const newYorkEvaluatedAt = "2026-02-16T17:31:00.000Z";
    const insufficientEvaluatedAt = "2026-03-17T18:32:00.000Z";
    const unsupportedEvaluatedAt = "2026-04-18T19:33:00.000Z";
    const observationContext =
      "Current cumulative county status; human snapshot 2023";
    const reviewFor = (state: string, dataset: string) => {
      if (dataset === "release-insufficient") {
        return {
          ...buildStateReview({
            gaps: [
              {
                code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
                county_fips: "08031",
                detail: "Eligible evidence is missing for this county.",
              },
            ],
            resultState: "insufficient_evidence",
            state,
          }),
          configuration_sha256: insufficientHash,
          data_release_version: dataset,
          evaluated_at: insufficientEvaluatedAt,
          methodology_version: "2.0.0",
        };
      }
      if (dataset === "release-unsupported") {
        return {
          ...buildStateReview({
            gaps: [
              {
                code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
                county_fips: "08031",
                detail: "Environmental context stays a data gap.",
              },
            ],
            resultState: "unsupported",
            state,
          }),
          configuration_sha256: unsupportedHash,
          data_release_version: dataset,
          evaluated_at: unsupportedEvaluatedAt,
          methodology_version: "2.1.0",
        };
      }
      if (state === "NY") {
        return {
          ...buildStateReview({
            resultState: "none_stand_out",
            state,
          }),
          configuration_sha256: newYorkHash,
          data_release_version: dataset,
          effective_observation_context: "Human snapshot 2022",
          evaluated_at: newYorkEvaluatedAt,
          methodology_version: "1.1.0",
        };
      }
      return {
        ...buildStateReview({
          candidates: [
            {
              ...reviewCandidate({
                caveat: "Collection dates are unavailable for this status.",
                countyName: "Denver",
                fips: "08001",
                reasonText:
                  "Denver is included because the review method returned it.",
              }),
              evidence_references: [
                {
                  ...reviewEvidenceReference("08001"),
                  retrieved_at: retrievedAt,
                  source_as_of: sourceAsOf,
                },
              ],
            },
          ],
          resultState: "candidates_found",
          state,
        }),
        configuration_sha256: coloradoHash,
        data_release_version: dataset,
        effective_observation_context: observationContext,
        evaluated_at: coloradoEvaluatedAt,
      };
    };

    await page.route("**/v1/me/profile", async (route) => {
      await route.fulfill({ json: { profile: null }, status: 200 });
    });
    await page.route("**/v1/atlas/metadata**", async (route) => {
      const dataset =
        new URL(route.request().url()).searchParams.get("dataset_version") ??
        "alpha-2026";
      await route.fulfill({
        json: { ...reviewScopeMetadataFixture, release_id: dataset },
        status: 200,
      });
    });
    await page.route("**/v1/atlas/geometry**", async (route) => {
      await route.fulfill({
        json: { detail: "display geometry unavailable" },
        status: 503,
      });
    });
    await page.route("**/v1/states/*/review**", async (route) => {
      const url = new URL(route.request().url());
      const state = url.pathname.split("/").at(-2) ?? "CO";
      const dataset = url.searchParams.get("dataset_version") ?? "alpha-2026";
      await route.fulfill({
        json: reviewFor(state, dataset),
        status: 200,
      });
    });

    const openResultProvenance = async () => {
      const provenance = page.getByTestId("review-result-provenance");
      const summary = provenance.locator("summary", {
        hasText: "Inspect provenance",
      });
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(provenance.locator("details").first()).toHaveAttribute(
        "open",
        ""
      );
      await summary.focus();
      await page.keyboard.press("Space");
      await expect(provenance.locator("details").first()).not.toHaveAttribute(
        "open",
        ""
      );
      await summary.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      const technical = provenance.locator(
        "details.ux-reset-evidence-provenance-technical"
      );
      await expect(technical.locator("summary")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(technical).toHaveAttribute("open", "");
      return provenance;
    };

    await page.goto("/app/review?scope=CO&dataset=alpha-2026");
    const methodology = page.getByTestId("review-methodology");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "candidates_found"
    );
    await expect(methodology).toContainText("atlas-county-review 1.0.0");
    await expect(methodology).toContainText("Release alpha-2026");
    await expect(methodology).toContainText(observationContext);
    await expect(page.getByText(coloradoHash, { exact: true })).toBeHidden();
    await expect(
      page.getByText(coloradoEvaluatedAt, { exact: false })
    ).toBeHidden();

    const provenance = await openResultProvenance();
    const configuration = provenance.locator("dd", { hasText: coloradoHash });
    const evaluated = provenance.locator("dd", {
      hasText: coloradoEvaluatedAt,
    });
    await expect(configuration).toBeVisible();
    await expect(configuration).toHaveText(coloradoHash);
    await expect(evaluated).toContainText(coloradoEvaluatedAt);
    await expect(evaluated).not.toContainText(retrievedAt);
    await expect(evaluated).not.toContainText(sourceAsOf);
    await expect(evaluated).not.toContainText("snapshot");
    await expect(
      provenance.getByTestId("evidence-provenance-period")
    ).toContainText("Unavailable");
    await expect(
      provenance.getByTestId("evidence-provenance-freshness")
    ).toContainText("Unavailable");
    await expect(
      provenance.getByTestId("evidence-provenance-freshness")
    ).not.toContainText("Source published");
    const selectedHash = await configuration.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return {
        selectable: getComputedStyle(node).userSelect !== "none",
        text: selection?.toString() ?? "",
      };
    });
    expect(selectedHash).toEqual({ selectable: true, text: coloradoHash });
    const selectedEvaluated = await evaluated.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString() ?? "";
    });
    expect(selectedEvaluated).toContain(coloradoEvaluatedAt);

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .include("[data-testid='review-result-provenance']")
        .analyze();
      expect(results.violations).toEqual([]);
    }

    const qualification = page.getByTestId("review-preview-qualification");
    await qualification.getByText("Inspect provenance").click();
    await expect(qualification).toContainText(`source as of ${sourceAsOf}`);
    await expect(qualification).toContainText(`retrieved ${retrievedAt}`);
    await expect(qualification).toContainText("county 08001");
    await expect(qualification).not.toContainText(coloradoEvaluatedAt);
    await expect(qualification).not.toContainText(coloradoHash);

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .include("[data-testid='review-result-provenance'] details[open]")
        .analyze();
      expect(results.violations).toEqual([]);
    }

    await page.getByTestId("review-scope-select").click();
    await page.getByRole("option", { name: "New York (NY)" }).click();
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "none_stand_out"
    );
    await expect(page.getByText(coloradoHash, { exact: true })).toHaveCount(0);
    await expect(page.getByText(coloradoEvaluatedAt)).toHaveCount(0);
    const newYorkProvenance = await openResultProvenance();
    await expect(
      newYorkProvenance.locator("dd", { hasText: newYorkHash })
    ).toHaveText(newYorkHash);
    await expect(newYorkProvenance).toContainText(newYorkEvaluatedAt);
    await expect(newYorkProvenance).not.toContainText(coloradoHash);
    await expect(methodology).toContainText("1.1.0");
    await expect(methodology).toContainText("Human snapshot 2022");

    await page.goto("/app/review?scope=CO&dataset=release-insufficient");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "insufficient_evidence"
    );
    await expect(page.getByText(newYorkHash, { exact: true })).toHaveCount(0);
    const insufficient = await openResultProvenance();
    await expect(
      insufficient.locator("dd", { hasText: insufficientHash })
    ).toHaveText(insufficientHash);
    await expect(insufficient).toContainText(insufficientEvaluatedAt);
    await expect(methodology).toContainText("Release release-insufficient");
    await expect(page.getByTestId("review-data-gap")).toHaveAttribute(
      "data-fips",
      "08031"
    );
    await expect(page.getByTestId("review-data-gaps")).not.toContainText(
      insufficientHash
    );

    await page.goto("/app/review?scope=CO&dataset=release-unsupported");
    await expect(page.getByTestId("review-state-panel")).toHaveAttribute(
      "data-result-state",
      "data_gap_only"
    );
    await expect(page.getByText(insufficientHash, { exact: true })).toHaveCount(
      0
    );
    const unsupported = await openResultProvenance();
    await expect(
      unsupported.locator("dd", { hasText: unsupportedHash })
    ).toHaveText(unsupportedHash);
    await expect(unsupported).toContainText(unsupportedEvaluatedAt);
    await expect(methodology).toContainText("2.1.0");
    await expect(methodology).toContainText("Release release-unsupported");
    await expect(page.getByTestId("review-data-gaps")).not.toContainText(
      unsupportedHash
    );
  });
});
