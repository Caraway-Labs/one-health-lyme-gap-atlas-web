import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";

import {
  COMPARE_CANOPY_MEASURE_ID,
  COMPARE_CASES_MEASURE_ID,
  COMPARE_TICK_MEASURE_ID,
  COMPARE_WASHINGTON_MN,
  COMPARE_WASHINGTON_RI,
  compareMeasuresFixture,
  compareObservationsFor,
  compareScoresFixture,
} from "../fixtures/compare-api-fixtures";
import { investigateMetadataFixture } from "../fixtures/investigate-api-fixtures";

async function installCompareMocks(page: Page, requested: string[]) {
  const fulfill = async (route: Route, body: unknown, status = 200) => {
    await route.fulfill({ json: body, status });
  };
  await page.route("**/v1/me/profile", async (route) => {
    await fulfill(route, { profile: { state_code: "CO" } });
  });
  await page.route("**/v1/atlas/metadata**", async (route) => {
    requested.push(route.request().url());
    await fulfill(route, investigateMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    requested.push(route.request().url());
    await fulfill(route, compareScoresFixture);
  });
  await page.route("**/v1/measures**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.toString());
    if (
      url.searchParams.get("page_token") === "null" ||
      url.searchParams.get("geography_type") === "county"
    ) {
      await fulfill(route, { detail: "invalid catalog request" }, 400);
      return;
    }
    const geography = url.searchParams.get("geography_type");
    await fulfill(route, {
      data: [...compareMeasuresFixture]
        .toReversed()
        .filter((measure) => measure.geography_semantics === geography),
      links: { self: "/v1/measures" },
      meta: {},
    });
  });
  await page.route("**/v1/observations**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.toString());
    const year = url.searchParams.get("year");
    const pageToken = url.searchParams.get("page_token");
    const geographyType = url.searchParams.get("geography_type");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const rejection = compareObservationRequestRejection({
      end_date: endDate ?? undefined,
      geography_id: url.searchParams.getAll("geography_id"),
      geography_type: geographyType === "state" ? "state" : "county",
      measure_id: url.searchParams.get("measure_id") ?? "",
      page_token: pageToken ?? undefined,
      start_date: startDate ?? undefined,
      year: year === null ? undefined : Number(year),
    });
    if (
      pageToken === "null" ||
      pageToken === "" ||
      (geographyType !== "county" && geographyType !== "state")
    ) {
      await fulfill(route, { detail: "invalid observation request" }, 400);
      return;
    }
    if (rejection) {
      await fulfill(
        route,
        { detail: "invalid observation request" },
        rejection
      );
      return;
    }
    await fulfill(route, {
      data: compareObservationsFor({
        fips: url.searchParams.getAll("geography_id"),
        measureId: url.searchParams.get("measure_id") ?? "",
      }),
      links: { self: "/v1/observations" },
      meta: {},
    });
  });
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

async function installOverflowReviewScores(page: Page) {
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({ json: overflowReviewScores() });
  });
}

async function openOverflowCountyCompare(page: Page, fips: string) {
  await page.goto("/app/review?scope=CO&dataset=alpha-2026");
  await page.getByRole("button", { name: "View full county list" }).click();
  await page.locator(`.full-table button[data-fips="${fips}"]`).click();
  await expect(page.getByTestId("review-county-preview")).toHaveAttribute(
    "data-fips",
    fips
  );
  await page.getByTestId("review-compare").click();
  await expect(page).toHaveURL(/\/app\/compare/);
  await expect(page.getByTestId("compare-pair")).toHaveAttribute(
    "data-fips",
    fips
  );
  await page.reload();
  await expect(page.getByTestId("compare-return")).toBeVisible();
}

async function expectOverflowCountyRestored(page: Page, fips: string) {
  const row = page.locator(`.full-table button[data-fips="${fips}"]`);
  await expect(row).toBeVisible();
  await expect(row).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Hide full county list" })
  ).toBeVisible();
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
        const scroller = element.closest(".table-scroll");
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
  await page.goto(`/app/review?scope=CO&dataset=alpha-2026&county=${fips}`);
  await expect(
    page.getByRole("button", { name: "View full county list" })
  ).toBeVisible();
  await expect(
    page.locator(`.full-table button[data-fips="${fips}"]`)
  ).toHaveCount(0);
}

test.describe("two-county Compare", () => {
  test("recovers empty, partial, invalid, and duplicate links", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await page.goto("/app/compare");
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-recovery",
      "empty"
    );
    await expect(page.getByTestId("compare-recovery")).toContainText(
      "will not select"
    );

    await page.goto("/app/compare?compare=08001&scope=CO");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-recovery",
      "partial"
    );
    await expect(page.getByTestId("compare-pair")).toContainText("Denver");

    await page.goto("/app/compare?compare=08001,not-a-fips");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-pair-issue",
      "invalid"
    );

    await page.goto("/app/compare?compare=08001,08001");
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
    await page.goto(
      "/app/compare?compare=08001,08013&scope=CO&dataset=alpha-2026"
    );
    const cases = page.getByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    await expect(cases).toHaveAttribute("data-row-index", "0");
    await expect(
      page.getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-08001`)
    ).toContainText("12");
    await expect(
      page.getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-08013`)
    ).toContainText("0");
    const missing = page.getByTestId(
      `compare-cell-${COMPARE_TICK_MEASURE_ID}-08013`
    );
    await expect(missing).toHaveAttribute("data-observation", "missing");
    await expect(missing).not.toContainText("0");
    const withheld = page.getByTestId(
      `compare-relation-${COMPARE_CANOPY_MEASURE_ID}`
    );
    await expect(withheld).toHaveAttribute("data-relation", "withheld");
    await expect(withheld).toContainText("periods differ");
    await expect(withheld).not.toContainText("differ by");
    await expect(page.getByTestId("compare-action")).toHaveAttribute(
      "href",
      /compare=08001(?:%2C|,)08013/
    );

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
      page.getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-08001`)
    ).toContainText("12");

    await page
      .getByRole("button", { name: /Remove Boulder, Colorado/ })
      .click();
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
      page.getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-08013`)
    ).toContainText("0");
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
    await page.goto("/app/compare?compare=08001,08013&scope=CO");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page.getByTestId("compare-pair")).toContainText("Boulder");
    const second = page.getByRole("combobox", { name: "Second county" });
    await second.focus();
    await page.keyboard.type("Albany", { delay: 20 });
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,36001"
    );
    await expect(page).toHaveURL(/36001/);
    await expect(
      page.getByTestId(`compare-cell-${COMPARE_CASES_MEASURE_ID}-36001`)
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

    const clear = page.getByRole("button", { name: "Clear counties" });
    await clear.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      ""
    );

    await page.goto("/app/compare?compare=08001");
    await expect(page.getByTestId("compare-pair")).toContainText("Denver");
    const secondCounty = page.getByRole("combobox", { name: "Second county" });
    await secondCounty.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("Washington, R", { delay: 20 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      `08001,${COMPARE_WASHINGTON_RI}`
    );
    await expect(page.getByTestId("compare-pair")).toContainText(
      "Rhode Island"
    );

    await secondCounty.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("Washington, M", { delay: 20 });
    await page.keyboard.press("Enter");
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
      "/app/review?scope=CO&county=08001&dataset=alpha-2026&sort=score&page=2"
    );
    const compare = page.getByTestId("review-compare");
    await expect(compare).toHaveAttribute("href", /compare=08001(?!\d)/);
    await expect(compare).toHaveAttribute("href", /return=review/);
    await expect(compare).not.toHaveAttribute("href", /08013/);
    await expect(compare).not.toHaveAttribute("href", /sort=/);
    await compare.click();

    await expect(page).toHaveURL(/\/app\/compare/);
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
    await expect(page.getByTestId("compare-return")).toHaveAttribute(
      "href",
      /\/app\/review/
    );
    await expect(page.getByTestId("compare-return")).not.toHaveAttribute(
      "href",
      /compare=/
    );

    await page.getByTestId("compare-slot-1").click();
    await page.getByRole("option", { name: /Boulder, Colorado/ }).click();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
    await expect(page).toHaveURL(/return=review/);
    await expect(page.getByTestId("compare-return")).toHaveAttribute(
      "href",
      /county=08001/
    );
    await expect(page.getByTestId("compare-return")).not.toHaveAttribute(
      "href",
      /08013/
    );

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
    await expect(page).toHaveURL(/\/app\/review/);
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

    await page
      .getByRole("button", { name: /Remove Boulder, Colorado/ })
      .click();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page).toHaveURL(/return=review/);
    await expect(page.getByTestId("compare-return")).toHaveAttribute(
      "href",
      /county=08001/
    );

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
    await page.getByTestId("compare-return").click();
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(new RegExp(`county=${fips}`));
    await expectOverflowCountyRestored(page, fips);
    await expectConsumedReviewReturn(page, fips);

    await openOverflowCountyCompare(page, fips);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(new RegExp(`county=${fips}`));
    await expectOverflowCountyRestored(page, fips);
    await expectConsumedReviewReturn(page, fips);
  });

  test("keeps a direct Compare link usable without a return target", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto("/app/compare?compare=08001,not-a-fips&return=assistant");
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001"
    );
    await expect(page.getByTestId("compare-workspace")).toHaveAttribute(
      "data-pair-issue",
      "invalid"
    );
    await expect(page.getByTestId("compare-return")).toHaveCount(0);
    await page.goto("/app/compare?compare=08001,08013");
    await expect(page.getByTestId("compare-alignment")).toBeVisible();
    await expect(page.getByTestId("compare-return")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      "08001,08013"
    );
  });
});
