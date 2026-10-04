import { describe, expect, it } from "vitest";

import { InvestigateContractError } from "@/features/ux-reset/investigate/county-evidence";
import {
  buildInvestigateObservationParams,
  investigateObservationRequestRejection,
} from "@/features/ux-reset/investigate/load-county-evidence";

describe("investigate observation requests", () => {
  it("builds a county year request the public API accepts", () => {
    const params = buildInvestigateObservationParams({
      fips: "08001",
      measureId: "reported-cases",
      timeBound: { handoffPeriod: "2023-01-01", kind: "year", year: 2023 },
    });
    expect({
      geographyId: params.geography_id,
      geographyType: params.geography_type,
      rejection: investigateObservationRequestRejection(params),
      startDate: params.start_date,
      stratification: params.stratification,
      year: params.year,
    }).toStrictEqual({
      geographyId: ["08001"],
      geographyType: "county",
      rejection: null,
      startDate: undefined,
      stratification: undefined,
      year: 2023,
    });
  });

  it("rejects the same combinations the observations API rejects", () => {
    const rejected = [
      investigateObservationRequestRejection({
        geography_id: ["08001"],
        geography_type: "county",
        measure_id: "reported-cases",
      }),
      investigateObservationRequestRejection({
        end_date: "2023-12-31",
        geography_id: ["08001"],
        geography_type: "county",
        measure_id: "reported-cases",
        start_date: "2023-01-01",
        year: 2023,
      }),
      investigateObservationRequestRejection({
        geography_id: ["08001"],
        geography_type: "state",
        measure_id: "reported-cases",
        year: 2023,
      }),
      investigateObservationRequestRejection({
        geography_id: ["12"],
        geography_type: "county",
        measure_id: "reported-cases",
        year: 2023,
      }),
      investigateObservationRequestRejection({
        geography_id: ["08001"],
        geography_type: "county",
        measure_id: "reported-cases",
        page_token: null,
        year: 2023,
      }),
    ];
    expect(rejected).toStrictEqual([400, 400, 400, 400, 400]);
    expect(() =>
      buildInvestigateObservationParams({
        fips: "12",
        measureId: "reported-cases",
        timeBound: { handoffPeriod: "2023-01-01", kind: "year", year: 2023 },
      })
    ).toThrow(InvestigateContractError);
  });
});
