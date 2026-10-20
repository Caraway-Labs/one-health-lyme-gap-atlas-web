import type { Page, Route } from "@playwright/test";

import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";

import {
  compareCountyDetail,
  compareMeasuresFixture,
  compareObservationsFor,
  compareScoresFixture,
} from "../fixtures/compare-api-fixtures";
import { investigateMetadataFixture } from "../fixtures/investigate-api-fixtures";
import { stateReviewResponseForUrl } from "../fixtures/review-operating-picture-fixtures";

export async function installCompareMocks(page: Page, requested: string[]) {
  const fulfill = async (route: Route, body: unknown, status = 200) => {
    await route.fulfill({ json: body, status });
  };
  await page.route("**/v1/me/profile", async (route) => {
    await fulfill(route, {
      profile: { starting_view_version: 1, state_code: "CO" },
    });
  });
  await page.route(
    "**/v1/counties/*/tier1-surveillance-priority**",
    async (route) => {
      await fulfill(route, { detail: "missing" }, 404);
    }
  );
  await page.route(
    "**/v1/counties/*/surveillance-situations**",
    async (route) => {
      await fulfill(route, { detail: "missing" }, 404);
    }
  );
  await page.route("**/v1/atlas/metadata**", async (route) => {
    requested.push(route.request().url());
    await fulfill(route, investigateMetadataFixture);
  });
  await page.route("**/v1/atlas/scores**", async (route) => {
    requested.push(route.request().url());
    await fulfill(route, compareScoresFixture);
  });
  await page.route("**/v1/states/*/review**", async (route) => {
    requested.push(route.request().url());
    await fulfill(route, stateReviewResponseForUrl(route.request().url()));
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
  await page.route(/\/v1\/counties\/\d{5}(?:\?|$)/, async (route) => {
    const fips = new URL(route.request().url()).pathname.split("/").at(-1);
    if (!fips) {
      await route.fulfill({ json: { detail: "missing county" }, status: 404 });
      return;
    }
    requested.push(route.request().url());
    await fulfill(route, compareCountyDetail(fips));
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
