import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGeographyV1GeographiesGeographyTypeGeographyIdGetUrl,
  getIndicatorV1IndicatorsIndicatorIdGetUrl,
  getIndicatorsV1IndicatorsGetUrl,
  getMeasureV1MeasuresMeasureIdGetUrl,
  getMeasuresV1MeasuresGetUrl,
  getMethodologyV1MethodologiesMethodologyIdGetUrl,
  getObservationsV1ObservationsGetUrl,
  getSourceV1SourcesSourceIdGetUrl,
  getSourcesV1SourcesGetUrl,
  indicatorV1IndicatorsIndicatorIdGet,
  indicatorsV1IndicatorsGet,
} from "@/generated/atlas";
import { ValueState } from "@/generated/models";
import {
  IndicatorsV1IndicatorsGetResponse,
  ObservationsV1ObservationsGetResponse,
} from "@/generated/zod/atlas";
import { ProblemDetails } from "@/generated/zod/problemDetails.zod";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

describe("canonical Atlas public API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds versioned catalog URLs without legacy atlas route prefixes", () => {
    expect({
      indicators: getIndicatorsV1IndicatorsGetUrl({ page_size: 25 }),
      indicator: getIndicatorV1IndicatorsIndicatorIdGetUrl("lyme-incidence"),
      measures: getMeasuresV1MeasuresGetUrl({ measure_id: "case-rate" }),
      measure: getMeasureV1MeasuresMeasureIdGetUrl("case-rate"),
      sources: getSourcesV1SourcesGetUrl({ page_size: 10 }),
      source: getSourceV1SourcesSourceIdGetUrl("cdc-lyme"),
      methodology: getMethodologyV1MethodologiesMethodologyIdGetUrl(
        "county-aggregation-v1"
      ),
      geography: getGeographyV1GeographiesGeographyTypeGeographyIdGetUrl(
        "county",
        "36061"
      ),
      observations: getObservationsV1ObservationsGetUrl({
        measure_id: "case-rate",
        geography_type: "county",
        geography_id: ["36061", "36005"],
        year: 2023,
      }),
    }).toStrictEqual({
      indicators: "/v1/indicators?page_size=25",
      indicator: "/v1/indicators/lyme-incidence",
      measures: "/v1/measures?measure_id=case-rate",
      measure: "/v1/measures/case-rate",
      sources: "/v1/sources?page_size=10",
      source: "/v1/sources/cdc-lyme",
      methodology: "/v1/methodologies/county-aggregation-v1",
      geography: "/v1/geographies/county/36061",
      observations:
        "/v1/observations?measure_id=case-rate&geography_type=county&geography_id=36061&geography_id=36005&year=2023",
    });
  });

  it("accepts governed value states and provenance fields on observations", () => {
    for (const value_state of Object.values(ValueState)) {
      expect(
        validateApiResponse(
          "Canonical observation",
          ObservationsV1ObservationsGetResponse,
          {
            data: [
              {
                observation_id: `obs-${value_state}`,
                measure_id: "case-rate",
                geography: {
                  geography_type: "county",
                  geography_id: "36061",
                },
                period_start: "2023-01-01",
                period_end: "2023-12-31",
                temporal_grain: "annual",
                value: value_state === ValueState.ZERO ? 0 : null,
                value_state,
                unit: "cases",
                denominator: null,
                source_id: "cdc-lyme",
                methodology_id: "county-aggregation-v1",
                methodology_version: "1.0.0",
                semantic_version: "2023.1",
                release_id: "release-2023",
                provenance_ref: "prov/cdc-lyme/2023",
                limitations: [],
                evidence: {
                  resource_type: "source",
                  resource_id: "cdc-lyme",
                  provenance_ref: "prov/cdc-lyme/2023",
                },
              },
            ],
            meta: { response_at: "2026-01-01T00:00:00Z" },
            links: { self: "/v1/observations" },
          }
        ).data[0]?.value_state
      ).toBe(value_state);
    }
  });

  it("validates RFC 9457 problem payloads from generated schemas", () => {
    const problem = {
      type: "https://api.carawaylabs.com/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Indicator was not found.",
      instance: "/v1/indicators/missing-indicator",
      request_id: "req-canonical-404",
      code: "indicator_not_found",
      errors: [{ field: "indicator_id", message: "Unknown indicator" }],
    };

    expect(
      validateApiResponse("Canonical problem response", ProblemDetails, problem)
    ).toMatchObject(problem);
  });

  it("routes canonical catalog calls through the shared mutator without bearer auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          data: [],
          meta: { response_at: "2026-01-01T00:00:00Z" },
          links: { self: "/v1/indicators" },
        },
        { status: 200 }
      )
    );

    const response = await indicatorsV1IndicatorsGet();

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).get("Authorization")).toBeNull();
    expect(
      validateApiResponse(
        "Indicators collection",
        IndicatorsV1IndicatorsGetResponse,
        response.data
      )
    ).toStrictEqual({
      data: [],
      meta: { response_at: "2026-01-01T00:00:00Z" },
      links: { self: "/v1/indicators" },
    });
  });

  it("surfaces canonical problem responses through AtlasApiError", async () => {
    const problem = {
      type: "https://api.carawaylabs.com/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Indicator was not found.",
      instance: "/v1/indicators/missing-indicator",
      request_id: "req-canonical-404",
      code: "indicator_not_found",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(problem, {
        status: 404,
        headers: { "X-Request-ID": "req-canonical-404" },
      })
    );

    await expect(
      indicatorV1IndicatorsIndicatorIdGet("missing-indicator")
    ).rejects.toMatchObject({
      status: 404,
      requestId: "req-canonical-404",
      responseBody: problem,
    } satisfies Partial<AtlasApiError>);
  });
});
