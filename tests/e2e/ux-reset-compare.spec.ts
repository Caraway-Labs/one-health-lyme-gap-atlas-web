import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";

import {
  COMPARE_WASHINGTON_MN,
  COMPARE_WASHINGTON_RI,
  compareMeasuresFixture,
  compareScoresFixture,
} from "../fixtures/compare-api-fixtures";
import {
  buildStateReview,
  reviewCandidate,
  stateReviewResponseForUrl,
} from "../fixtures/review-operating-picture-fixtures";
import { installCompareMocks } from "./compare-page-mocks";
import { releaseViewportRuns } from "./release-phone-viewport";

async function replaceCountyFromKeyboard(
  page: Page,
  slotName: string,
  query: string
) {
  const input = page.getByRole("combobox", { name: slotName });
  await input.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(query, { delay: 20 });
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
}

async function explorerReturnLink(page: Page) {
  const open = page.getByRole("button", { name: "Open navigation" });
  if (await open.isVisible()) {
    await open.click();
  }
  return page.getByRole("link", { exact: true, name: "Atlas Explorer" });
}

const REVIEW_OVERFLOW_FIPS = "08041";

function overflowReviewScores() {
  const template = compareScoresFixture.counties[0];
  if (!template) {
    throw new Error("Compare scores fixture is empty.");
  }
  return {
    ...compareScoresFixture,
    counties: Array.from({ length: 41 }, (_, index) => ({
      ...template,
      county: `County ${String(index + 1).padStart(2, "0")}`,
      fips: String(8001 + index).padStart(5, "0"),
      in_contiguous_tick_scope: true,
      score: { ...template.score, score: 100 - index },
      state: "CO",
      state_name: "Colorado",
    })),
  };
}

function overflowReview() {
  return buildStateReview({
    candidates: Array.from({ length: 41 }, (_, index) => {
      const fips = String(8001 + index).padStart(5, "0");
      return reviewCandidate({
        caveat: "The review result included a limitation for this county.",
        countyName: `County ${String(index + 1).padStart(2, "0")}`,
        fips,
        reasonText: `County ${index + 1} is included because the review method returned it.`,
      });
    }),
    resultState: "candidates_found",
    state: "CO",
  });
}

async function installOverflowReviewScores(page: Page) {
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: overflowReviewScores() });
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    const state = new URL(route.request().url()).pathname.split("/").at(-2);
    await route.fulfill({
      json:
        state === "CO"
          ? overflowReview()
          : stateReviewResponseForUrl(route.request().url()),
      status: 200,
    });
  });
}

async function openOverflowCountyCompare(page: Page, fips: string) {
  await page.goto("/explore?scope=CO&dataset=alpha-2026");
  await page.locator(`button[data-fips="${fips}"]`).click();
  await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
    "data-fips",
    fips
  );
  await page.getByTestId("review-compare").click();
  await expect(page).toHaveURL(/\/compare/);
  await expect(page.getByTestId("compare-pair")).toHaveAttribute(
    "data-fips",
    fips
  );
  await page.reload();
  await expect(page.getByTestId("compare-return")).toHaveCount(0);
}

async function expectOverflowCountyRestored(page: Page, fips: string) {
  const row = page.locator(`button[data-fips="${fips}"]`);
  await expect(row).toBeVisible();
  await expect(row).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("ux-reset-review-return-focus")
      )
    )
    .toBeNull();
  await expect
    .poll(() =>
      row.evaluate((element) => {
        const scroller = element.closest(".ux-reset-review-candidate-list");
        if (!(scroller instanceof HTMLElement)) {
          return false;
        }
        const rowBox = element.getBoundingClientRect();
        const listBox = scroller.getBoundingClientRect();
        return (
          rowBox.top >= listBox.top - 1 && rowBox.bottom <= listBox.bottom + 1
        );
      })
    )
    .toBe(true);
}

async function expectConsumedReviewReturn(page: Page, fips: string) {
  await page.goto(`/explore?scope=CO&dataset=alpha-2026&county=${fips}`);
  const row = page.locator(`button[data-fips="${fips}"]`);
  await expect(row).toBeVisible();
  await expect(row).not.toBeFocused();
}

function pdfBytes() {
  return Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

async function fulfillPdf(route: Route, filename: string) {
  await route.fulfill({
    body: pdfBytes(),
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "application/pdf",
    },
    status: 200,
  });
}

test.describe("two-county Compare", () => {
  test("recovers empty, partial, invalid, and duplicate links", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await page.goto("/compare");
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-recovery",
      "empty"
    );
    await expect(page.getByTestId("compare-recovery")).toContainText(
      "will not select"
    );

    await page.goto("/compare?compare=08001&scope=CO");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-recovery",
      "partial"
    );
    await expect(page.getByTestId("compare-pair")).toContainText("Denver");

    await page.goto("/compare?compare=08001,not-a-fips");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-pair-issue",
      "invalid"
    );

    await page.goto("/compare?compare=08001,08001");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-pair-issue",
      "duplicate"
    );
    await expect(page.getByTestId("compare-alignment")).toHaveCount(0);
  });

  test("aligns measures and keeps the pair across reload and history", async ({
    page,
  }, testInfo) => {
    const requested: string[] = [];
    await installCompareMocks(page, requested);
    await page.goto("/compare?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const floorRow = page.getByTestId("compare-profile-row-human_case_floor");
    await expect(floorRow).toBeVisible();
    await expect(floorRow).toHaveAttribute("data-gap", "true");
    await expect(floorRow).not.toContainText("differ by");
    const publishedFloor = page.getByTestId(
      "compare-profile-cell-human_case_floor-08001"
    );
    await expect(publishedFloor).toContainText("12");
    await expect(publishedFloor).toContainText("or more");
    const suppressedFloor = page.getByTestId(
      "compare-profile-cell-human_case_floor-08013"
    );
    await expect(suppressedFloor).toContainText("Suppressed");
    await expect(suppressedFloor).toContainText("Limited");
    await expect(
      suppressedFloor.locator(".ux-reset-compare-vlabel", { hasText: /^0/ })
    ).toHaveCount(0);
    const missing = page.getByTestId(
      "compare-profile-cell-scapularis_status-08013"
    );
    await expect(missing).not.toHaveAttribute("data-observation", "present");
    await expect(
      missing.locator(".ux-reset-compare-vlabel", { hasText: /^0/ })
    ).toHaveCount(0);
    await expect(page.getByTestId("compare-action")).toHaveCount(0);
    await expect(page.getByTestId("compare-investigate-08001")).toHaveAttribute(
      "href",
      /compare=08001(?:%2C|,)08013/
    );
    await expect(page.getByTestId("compare-investigate-08001")).toHaveText(
      "County evidence"
    );
    await expect(page.getByTestId("compare-investigate-08013")).toHaveText(
      "County evidence"
    );
    await expect(page.getByTestId("compare-investigate-08001")).toHaveAttribute(
      "aria-label",
      "View county evidence for the first county"
    );
    await expect(page.getByTestId("compare-investigate-08013")).toHaveAttribute(
      "aria-label",
      "View county evidence for the second county"
    );
    const incidence = page.getByTestId(
      "compare-profile-cell-incidence_floor-08013"
    );
    await expect(incidence).toContainText("Suppressed");
    await expect(
      incidence.locator(".ux-reset-compare-vlabel", { hasText: /^0/ })
    ).toHaveCount(0);
    await expect(page.getByTestId("compare-download-pdfs")).toHaveText(
      "Download Counties as PDF"
    );
    await expect(page.getByTestId("compare-print")).toHaveCount(0);
    await expect(
      page.getByText("Some measures could not be loaded")
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Social vulnerability" })
    ).toBeVisible();
    await expect(
      page.getByTestId("compare-community-summary-svi_percentile_2022")
    ).toBeVisible();
    await expect(
      page.getByTestId("compare-profile-cell-svi_percentile_2022-08013")
    ).toContainText("No record");
    await expect(page.getByTestId("compare-ask-atlas")).toHaveAttribute(
      "href",
      /\/askatlas/
    );
    await expect(page.getByTestId("compare-ask-atlas")).not.toHaveAttribute(
      "href",
      /page_ref=/
    );
    await expect(page.getByTestId("compare-return")).toHaveCount(0);
    await expect(page.getByTestId("compare-at-a-glance")).toBeVisible();
    await expect(page.getByTestId("compare-group-human")).toBeVisible();
    await expect(page.getByTestId("compare-summary")).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      const scrolls = await page
        .getByTestId("compare-profile")
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(scrolls).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
    }

    const observationUrls = requested.filter((url) =>
      url.includes("/v1/observations")
    );
    expect(observationUrls.length).toBeGreaterThan(0);
    for (const url of observationUrls) {
      const parsed = new URL(url);
      expect(parsed.searchParams.getAll("geography_id")).toEqual([
        "08001",
        "08013",
      ]);
      expect(
        compareObservationRequestRejection({
          geography_id: parsed.searchParams.getAll("geography_id"),
          geography_type: "county",
          measure_id: parsed.searchParams.get("measure_id") ?? "",
          year: Number(parsed.searchParams.get("year")),
        })
      ).toBeNull();
    }

    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-08001")
    ).toContainText("12");

    await page.getByRole("button", { name: "Clear second county" }).click();
    await expect(page).toHaveURL(/compare=08001(?!,)/);
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.goBack();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-08013")
    ).toContainText("Suppressed");
    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.goBack();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("edits the pair from the keyboard, including duplicate county names", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await page.goto("/compare?compare=08001,08013&scope=CO");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page.getByTestId("compare-pair")).toContainText("Boulder");
    await expect(
      page.getByRole("combobox", { name: "Filter B by state" })
    ).toBeVisible();
    await replaceCountyFromKeyboard(page, "Second county", "Albany");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,36001"
    );
    await expect(page).toHaveURL(/36001/);
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-36001")
    ).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,36001"
    );

    const clear = page.getByRole("button", { name: "Clear both counties" });
    await clear.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      ""
    );

    await page.goto("/compare?compare=08001");
    await expect(page.getByTestId("compare-pair")).toContainText("Denver");
    await replaceCountyFromKeyboard(page, "Second county", "Washington, R");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      `08001,${COMPARE_WASHINGTON_RI}`
    );
    await expect(page.getByTestId("compare-pair")).toContainText(
      "Rhode Island"
    );

    await replaceCountyFromKeyboard(page, "Second county", "Washington, M");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      `08001,${COMPARE_WASHINGTON_MN}`
    );
    await expect(page.getByTestId("compare-pair")).toContainText("Minnesota");
    await expect(page.getByTestId("compare-pair")).not.toContainText(
      "Rhode Island"
    );
  });

  test("enters from Review with one county and returns without rewriting Review", async ({
    page,
  }, testInfo) => {
    await installCompareMocks(page, []);
    await page.goto(
      "/explore?scope=CO&county=08001&dataset=alpha-2026&sort=score&page=2"
    );
    const compare = page.getByTestId("review-compare");
    await expect(compare).toHaveAttribute("href", /compare=08001(?!\d)/);
    await expect(compare).toHaveAttribute("href", /return=review/);
    await expect(compare).not.toHaveAttribute("href", /08013/);
    await expect(compare).not.toHaveAttribute("href", /sort=/);
    await compare.click();

    await expect(page).toHaveURL(/\/compare/);
    await expect(page).toHaveURL(/compare=08001(?!\d)/);
    await expect(page).toHaveURL(/return=review/);
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-recovery",
      "partial"
    );
    await expect(page.getByTestId("compare-recovery")).toContainText(
      "second county"
    );
    const explorer = await explorerReturnLink(page);
    await expect(explorer).toHaveAttribute("href", /\/explore/);
    await expect(explorer).toHaveAttribute("href", /compare=08001(?!\d)/);
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Close navigation" }).click();
    }

    await replaceCountyFromKeyboard(page, "Second county", "Boulder");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page).toHaveURL(/return=review/);
    const editedExplorer = await explorerReturnLink(page);
    await expect(editedExplorer).toHaveAttribute("href", /county=08001/);
    await expect(editedExplorer).toHaveAttribute("href", /08013/);
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Close navigation" }).click();
    }

    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page).toHaveURL(/return=review/);

    await page.goBack();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/sort=score/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(/compare=/);
    await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
      "data-fips",
      "08001"
    );

    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await page.goForward();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );

    await page.getByRole("button", { name: "Clear second county" }).click();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page).toHaveURL(/return=review/);
    const clearedExplorer = await explorerReturnLink(page);
    await expect(clearedExplorer).toHaveAttribute("href", /county=08001/);
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Close navigation" }).click();
    }

    if (!testInfo.project.name.includes("mobile")) {
      const results = await new AxeBuilder({ page })
        .include('[data-testid="compare-workspace"]')
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

  test("restores a shortlist-overflow Review row after Compare reload", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await installOverflowReviewScores(page);
    const fips = REVIEW_OVERFLOW_FIPS;

    await openOverflowCountyCompare(page, fips);
    await (await explorerReturnLink(page)).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(new RegExp(`county=${fips}`));
    await expectOverflowCountyRestored(page, fips);
    await expectConsumedReviewReturn(page, fips);

    await openOverflowCountyCompare(page, fips);
    await page.goBack();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(new RegExp(`county=${fips}`));
    await expectOverflowCountyRestored(page, fips);
    await expectConsumedReviewReturn(page, fips);
  });

  test("shows loading, then recovers a failed county record", async ({
    page,
  }) => {
    let failCounty = true;
    let released = false;
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    await installCompareMocks(page, []);
    await page.route(/\/v1\/counties\/\d{5}(?:\?|$)/, async (route) => {
      if (!released) {
        await gate;
      }
      if (failCounty) {
        await route.fulfill({
          json: { detail: "unavailable" },
          status: 503,
        });
        return;
      }
      await route.fallback();
    });
    await page.goto("/compare?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await expect(page.getByTestId("compare-loading")).toContainText(
      "published county records"
    );
    await expect(page.getByTestId("compare-profile")).toHaveCount(0);
    released = true;
    releaseGate();
    const alert = page.getByTestId("compare-status").getByRole("alert");
    await expect(alert).toContainText(
      "A county record could not be loaded. Values that were not returned stay blank."
    );
    await expect(
      page.getByTestId("compare-status-error-profile-partial")
    ).toBeVisible();
    await expect(page.getByTestId("compare-retry")).toBeEnabled();
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-08001")
    ).toContainText("Couldn’t load this evidence.");
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-08001")
    ).not.toContainText("12");
    failCounty = false;
    await page.getByTestId("compare-retry").click();
    await expect(
      page.getByTestId("compare-profile-cell-human_case_floor-08001")
    ).toContainText("12");
    await expect(page.getByTestId("compare-profile-section")).toHaveAttribute(
      "data-records-ready",
      "true"
    );
  });

  test("keeps a direct Compare link usable without a return target", async ({
    page,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, 390),
      "Phone-width Compare checks run on the mobile project."
    );
    await installCompareMocks(page, []);
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto("/compare?compare=08001,not-a-fips&return=assistant");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-pair-issue",
      "invalid"
    );
    await expect(page.getByTestId("compare-return")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Return to Explorer" })
    ).toHaveCount(0);
    await page.goto("/compare?compare=08001,08013");
    await expect(page.getByTestId("compare-alignment")).toBeVisible();
    await expect(page.getByTestId("compare-return")).toHaveCount(0);
    await expect(page.getByTestId("compare-at-a-glance")).toBeVisible();
    await expect(page.getByTestId("compare-group-human")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
  });

  test("downloads both county PDFs and requests fallback periods without nclimgrid", async ({
    page,
  }) => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    const requested: string[] = [];
    await installCompareMocks(page, requested, {
      measures: [
        {
          ...base,
          label: "nClimGrid average temperature",
          measure_id: "nclimgrid_tavg_county_day",
        },
        {
          ...base,
          label: "Seasonal canopy",
          measure_id: "unbound-gap",
          temporal_grains: ["CUSTOM"],
          temporal_semantics: "2024-06-01",
        },
      ],
    });
    await page.route("**/v1/observations**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("measure_id") !== "unbound-gap") {
        await route.fallback();
        return;
      }
      requested.push(url.toString());
      const year = url.searchParams.get("year");
      const start = url.searchParams.get("start_date");
      if (year === "2023" || start === "2025-12-31") {
        await route.fulfill({
          json: {
            data: [],
            links: { self: "/v1/observations" },
            meta: {},
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          code: "UNSUPPORTED_FILTER",
          detail: "This time filter is not supported for the measure.",
          status: 400,
        },
        status: 400,
      });
    });
    const reportUrls: string[] = [];
    await page.route("**/v1/counties/*/report.pdf**", async (route) => {
      const url = route.request().url();
      reportUrls.push(url);
      const fips = new URL(url).pathname.split("/")[3];
      await fulfillPdf(
        route,
        fips === "08001"
          ? "Denver_CO_AtlasBrief.pdf"
          : "Boulder_CO_AtlasBrief.pdf"
      );
    });
    await page.goto("/compare?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await expect(
      page.getByTestId("compare-cell-unbound-gap-08001")
    ).toContainText("No published value. This absence is not zero.");
    await expect(page.getByText(/no governed period/i)).toHaveCount(0);
    await expect(page.getByText(/nClimGrid/i)).toHaveCount(0);
    expect(requested.some((url) => url.includes("nclimgrid"))).toBe(false);
    const bounds = requested
      .filter((url) => url.includes("measure_id=unbound-gap"))
      .map((url) => {
        const parsed = new URL(url);
        return (
          parsed.searchParams.get("start_date") ??
          parsed.searchParams.get("year") ??
          ""
        );
      });
    expect(bounds.indexOf("2024-06-01")).toBeGreaterThanOrEqual(0);
    expect(bounds.indexOf("2024-06-01")).toBeLessThan(bounds.indexOf("2023"));
    expect(bounds.indexOf("2023")).toBeLessThan(bounds.indexOf("2025-12-31"));

    const downloads: string[] = [];
    page.on("download", (download) => {
      downloads.push(download.suggestedFilename());
    });
    const button = page.getByTestId("compare-download-pdfs");
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => downloads.toSorted())
      .toEqual(["Boulder_CO_AtlasBrief.pdf", "Denver_CO_AtlasBrief.pdf"]);
    expect(reportUrls.map((url) => new URL(url).pathname).toSorted()).toEqual([
      "/v1/counties/08001/report.pdf",
      "/v1/counties/08013/report.pdf",
    ]);
    await expect(page.getByText("County PDFs downloaded.")).toBeVisible();
  });
});
