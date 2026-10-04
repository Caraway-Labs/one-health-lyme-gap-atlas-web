import { describe, expect, it } from "vitest";

import {
  ExploreContractError,
  type ExploreTimeBound,
} from "@/features/ux-reset/explore/explore-model";
import {
  exploreMeasuresPageParams,
  exploreObservationPageParams,
  maximumObservationPageToken,
  observationQueryByteLength,
  PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT,
  shouldRetryExploreObservation,
  splitExploreObservationBatches,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  getMeasuresV1MeasuresGetUrl,
  getObservationsV1ObservationsGetUrl,
} from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

const YEAR_BOUND: ExploreTimeBound = {
  handoffPeriod: "2023-01-01",
  kind: "year",
  year: 2023,
};

function nationalFips(count: number): string[] {
  const fips: string[] = [];
  for (let index = 0; index < count; index += 1) {
    fips.push(String(index).padStart(5, "0"));
  }
  return fips;
}

describe("Explore generated requests", () => {
  it("serializes a null page token and omits an absent one", () => {
    const withNull = getObservationsV1ObservationsGetUrl({
      geography_id: ["08001"],
      geography_type: "county",
      measure_id: "reported-cases",
      page_token: null,
      year: 2023,
    });
    const omitted = getObservationsV1ObservationsGetUrl(
      exploreObservationPageParams({
        fips: ["08001"],
        measureId: "reported-cases",
        timeBound: YEAR_BOUND,
      })
    );
    expect(withNull).toContain("page_token=null");
    expect(omitted).not.toContain("page_token");
    expect(omitted).toContain("year=2023");
    expect(omitted).not.toContain("start_date");
  });

  it("requests each county discovery semantic instead of the observations enum", () => {
    const published = getMeasuresV1MeasuresGetUrl(
      exploreMeasuresPageParams({ geographySemantics: "COUNTY_FIPS_5" })
    );
    const environmental = getMeasuresV1MeasuresGetUrl(
      exploreMeasuresPageParams({ geographySemantics: "COUNTY" })
    );
    const lowercase = getMeasuresV1MeasuresGetUrl({
      geography_type: "county",
      page_token: null,
    });
    expect(published).toContain("geography_type=COUNTY_FIPS_5");
    expect(published).not.toContain("page_token");
    expect(environmental).toContain("geography_type=COUNTY");
    expect(lowercase).toContain("geography_type=county");
    expect(lowercase).toContain("page_token=null");
  });

  it("sends a governed day as a date range and keeps a continuation token", () => {
    const first = getObservationsV1ObservationsGetUrl(
      exploreObservationPageParams({
        fips: ["08001"],
        measureId: "nclimgrid_prcp_county_day",
        timeBound: {
          date: "2025-01-01",
          handoffPeriod: "2025-01-01",
          kind: "day",
        },
      })
    );
    const next = getObservationsV1ObservationsGetUrl(
      exploreObservationPageParams({
        fips: ["08001"],
        measureId: "nclimgrid_prcp_county_day",
        pageToken: "cursor-1",
        timeBound: {
          date: "2025-01-01",
          handoffPeriod: "2025-01-01",
          kind: "day",
        },
      })
    );
    expect(first).toContain("start_date=2025-01-01");
    expect(first).toContain("end_date=2025-01-01");
    expect(first).not.toContain("year=");
    expect(next).toContain("page_token=cursor-1");
    expect(next).not.toContain("page_token=null");
  });

  it("keeps a national county set under the public query byte limit", () => {
    const fips = nationalFips(3200);
    const oversized = observationQueryByteLength(
      exploreObservationPageParams({
        fips: fips.slice(0, 500),
        measureId: "reported-cases",
        timeBound: YEAR_BOUND,
      })
    );
    const batches = splitExploreObservationBatches({
      fips,
      measureId: "reported-cases",
      timeBound: YEAR_BOUND,
    });
    const continuationFits = batches.every((batch) => {
      const bytes = observationQueryByteLength(
        exploreObservationPageParams({
          fips: batch,
          measureId: "reported-cases",
          pageToken: maximumObservationPageToken(),
          timeBound: YEAR_BOUND,
        })
      );
      return (
        bytes <= PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT && batch.length <= 500
      );
    });
    expect(fips.length).toBeGreaterThan(3000);
    expect(oversized).toBeGreaterThan(PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT);
    expect(batches.length).toBeGreaterThan(1);
    expect(continuationFits).toBeTruthy();
  });

  it("does not retry contract mismatches or client errors", () => {
    const contract = new ExploreContractError("mixes release identities");
    const client = new AtlasApiError("invalid", "/v1/observations", 400, null);
    expect(shouldRetryExploreObservation(0, contract, 2)).toBeFalsy();
    expect(shouldRetryExploreObservation(0, client, 2)).toBeFalsy();
  });

  it("follows the query client retry setting for transient failures", () => {
    const network = new AtlasApiError(
      "unavailable",
      "/v1/observations",
      503,
      null
    );
    expect(shouldRetryExploreObservation(0, network, false)).toBeFalsy();
    expect(shouldRetryExploreObservation(0, network, 2)).toBeTruthy();
    expect(shouldRetryExploreObservation(2, network, 2)).toBeFalsy();
  });
});
