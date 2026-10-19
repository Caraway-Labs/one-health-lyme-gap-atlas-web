import { mkdirSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import autauga from "../fixtures/review-al-01001.json" with { type: "json" };
import baldwin from "../fixtures/review-al-01003.json" with { type: "json" };
import identities from "../fixtures/review-al-published-identities.json" with { type: "json" };
import {
  buildStateReview,
  reviewCandidate,
} from "../fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "../fixtures/review-scope-api-fixtures";
import { fulfillCompletedStartingView } from "./completed-starting-view";

const shotDirectory = "/opt/cursor/artifacts";
const reviewedRelease = "alpha-2026";
const publishedRelease = baldwin.release.release_id;

function pdfBytes() {
  return Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

async function fulfillPdf(route: Route, filename: string) {
  await route.fulfill({
    body: pdfBytes(),
    headers: {
      "cache-control": "public, max-age=300",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "application/pdf",
    },
    status: 200,
  });
}

async function installCommonQuietRoutes(page: Page) {
  await fulfillCompletedStartingView(page);
  await page.route("**/v1/measures**", (route) =>
    route.fulfill({
      json: { detail: "Catalog unavailable in this fixture" },
      status: 503,
    })
  );
  await page.route("**/v1/counties/*/tier1-surveillance-priority**", (route) =>
    route.fulfill({ json: { detail: "No matching priority" }, status: 404 })
  );
}

async function installReviewedCounty(page: Page) {
  await installCommonQuietRoutes(page);
  await page.route("**/v1/atlas/metadata**", (route) =>
    route.fulfill({ json: reviewScopeMetadataFixture, status: 200 })
  );
  await page.route("**/v1/atlas/scores**", (route) =>
    route.fulfill({
      json: { ...reviewScopeScoresFixture, release_id: reviewedRelease },
      status: 200,
    })
  );
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: { detail: "display geometry unavailable" },
      status: 503,
    })
  );
  await page.route("**/v1/states/*/review**", (route) => {
    const state =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "CO";
    return route.fulfill({
      json: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Adams",
            fips: "08001",
            reasonText: "Adams was returned by the method.",
          }),
        ],
        resultState: "candidates_found",
        state,
      }),
      status: 200,
    });
  });
}

async function installPublishedCounties(page: Page) {
  await installCommonQuietRoutes(page);
  await page.route("**/v1/atlas/metadata**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      publishedRelease;
    return route.fulfill({
      json: { ...baldwin.release, release_id: dataset },
      status: 200,
    });
  });
  await page.route("**/v1/atlas/scores**", (route) => {
    const dataset =
      new URL(route.request().url()).searchParams.get("dataset_version") ??
      publishedRelease;
    return route.fulfill({
      json: {
        ...reviewScopeScoresFixture,
        counties: identities.map((entry) => ({
          ...reviewScopeScoresFixture.counties[0],
          ...entry,
          state_name: entry.stateName,
        })),
        release_id: dataset,
      },
      status: 200,
    });
  });
  await page.route("**/v1/states/*/review**", (route) => {
    const url = new URL(route.request().url());
    const state = url.pathname.split("/").at(-2) ?? "AL";
    const review = buildStateReview({ resultState: "unsupported", state });
    review.data_release_version =
      url.searchParams.get("dataset_version") ?? publishedRelease;
    return route.fulfill({ json: review, status: 200 });
  });
  await page.route("**/v1/atlas/geometry**", (route) =>
    route.fulfill({
      json: { features: [], type: "FeatureCollection" },
      status: 200,
    })
  );
  await page.route("**/v1/counties/*", (route) => {
    const fips = new URL(route.request().url()).pathname.split("/").at(-1);
    const detail = [autauga, baldwin].find((entry) => entry.fips === fips);
    return detail
      ? route.fulfill({ json: detail, status: 200 })
      : route.fulfill({ json: { detail: "No published record" }, status: 404 });
  });
}

async function shootButton(page: Page, name: string) {
  mkdirSync(shotDirectory, { recursive: true });
  const button = page.getByTestId("explore-download-pdf");
  await button.scrollIntoViewIfNeeded();
  const control = await button.boundingBox();
  if (!control) {
    throw new Error("The Download PDF action is not visible.");
  }
  const empty = page.getByTestId("explorer-preview-empty");
  const paragraph =
    (await empty.count()) > 0 ? await empty.boundingBox() : null;
  const top = paragraph
    ? Math.max(0, paragraph.y - 12)
    : Math.max(0, control.y - 210);
  const left = Math.max(0, Math.min(paragraph?.x ?? control.x, control.x) - 12);
  await page.screenshot({
    clip: {
      height: control.y + control.height - top + 48,
      width: Math.max(paragraph?.width ?? 0, control.width) + 24,
      x: left,
      y: top,
    },
    path: `${shotDirectory}/download-pdf-${name}.png`,
  });
}

test.describe("Explorer Download PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
  });

  test("downloads the published report for a reviewed county", async ({
    page,
  }) => {
    const reportUrls: string[] = [];
    await installReviewedCounty(page);
    await page.route("**/v1/counties/*/report.pdf**", (route) => {
      reportUrls.push(route.request().url());
      return fulfillPdf(
        route,
        "lyme-gap-atlas-co-adams-county-08001-alpha-2026.pdf"
      );
    });
    await page.goto(
      `/explore?scope=CO&dataset=${reviewedRelease}&county=08001&eco=40&breakpoint=25&missing=40`
    );
    const button = page
      .getByTestId("review-county-preview")
      .getByTestId("explore-download-pdf");
    await expect(button).toBeEnabled();
    await expect(button).toHaveText("Download PDF");
    const evidence = page.getByTestId("review-view-county-evidence");
    const order = await evidence.evaluate((element) => {
      const download = element.parentElement?.querySelector(
        "[data-testid='explore-download-pdf']"
      );
      if (!(download instanceof HTMLElement)) {
        return null;
      }
      return element.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING
        ? "after"
        : "before";
    });
    expect(order).toBe("after");
    await button.focus();
    const downloadPromise = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Adams_CO_AtlasBrief.pdf");
    const saved = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of saved) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
    const reportUrl = new URL(reportUrls[0] ?? "http://invalid");
    expect(reportUrl.pathname).toBe("/v1/counties/08001/report.pdf");
    expect(reportUrl.searchParams.get("dataset_version")).toBe(reviewedRelease);
    expect(reportUrl.searchParams.get("ecological_share")).toBe("65");
    expect(reportUrl.searchParams.get("low_incidence_breakpoint")).toBe("10");
    expect(reportUrl.searchParams.get("missing_human_weakness")).toBe("75");
    expect(reportUrl.searchParams.has("eco")).toBe(false);
    const result = await new AxeBuilder({ page })
      .include("[data-testid='review-county-preview']")
      .analyze();
    expect(result.violations).toEqual([]);
    await shootButton(page, "reviewed-county");
  });

  test("downloads a published county that has no review category", async ({
    page,
  }) => {
    await installPublishedCounties(page);
    await page.route("**/v1/counties/*/report.pdf**", (route) =>
      fulfillPdf(route, "server-name-not-approved.pdf")
    );
    await page.goto(
      `/explore?scope=AL&dataset=${publishedRelease}&county=01003`
    );
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toContainText("Review category unavailable");
    const button = preview.getByTestId("explore-download-pdf");
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      "Baldwin_AL_AtlasBrief.pdf"
    );
    await shootButton(page, "unscored-county");
  });

  test("downloads the selected county from national scope", async ({
    page,
  }) => {
    await installReviewedCounty(page);
    await page.route("**/v1/counties/*", (route) =>
      route.fulfill({
        json: {
          ...baldwin,
          county: "Denver",
          fips: "08001",
          state: "CO",
          state_name: "Colorado",
          release: { ...baldwin.release, release_id: reviewedRelease },
        },
        status: 200,
      })
    );
    await page.route("**/v1/counties/*/report.pdf**", (route) =>
      fulfillPdf(route, "Denver_CO_AtlasBrief.pdf")
    );
    await page.goto(
      `/explore?scope=ALL&dataset=${reviewedRelease}&county=08001`
    );
    const preview = page.getByTestId("review-published-county-preview");
    await expect(preview).toContainText("Denver");
    const button = preview.getByTestId("explore-download-pdf");
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      "Denver_CO_AtlasBrief.pdf"
    );
    await shootButton(page, "national-scope");
  });

  test("keeps Download PDF disabled when no county is selected", async ({
    page,
  }) => {
    await installPublishedCounties(page);
    await page.goto(
      `/explore?scope=AL&dataset=${publishedRelease}&selection=required`
    );
    const button = page.getByTestId("explore-download-pdf");
    await expect(page.getByTestId("explorer-preview-empty")).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveText("Download PDF");
    await shootButton(page, "no-county");
  });

  test("shows a recoverable error and does not keep a failed download", async ({
    page,
  }) => {
    await installReviewedCounty(page);
    await page.route("**/v1/counties/*/report.pdf**", (route) =>
      route.fulfill({
        body: JSON.stringify({ detail: "Renderer unavailable." }),
        contentType: "application/problem+json",
        status: 503,
      })
    );
    await page.goto(
      `/explore?scope=CO&dataset=${reviewedRelease}&county=08001`
    );
    const preview = page.getByTestId("review-county-preview");
    const button = preview.getByTestId("explore-download-pdf");
    await button.click();
    await expect(preview.getByRole("alert")).toContainText("Try again");
    await expect(button).toBeEnabled();
    let downloads = 0;
    page.on("download", () => {
      downloads += 1;
    });
    await button.click();
    await expect(preview.getByRole("alert")).toBeVisible();
    expect(downloads).toBe(0);
  });
});
