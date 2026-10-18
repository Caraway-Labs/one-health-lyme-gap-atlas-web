import { describe, expect, it, vi } from "vitest";

import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import {
  environmentalContextQueryKey,
  environmentalCoverageLabel,
  environmentalDateSupport,
  environmentalDisplayValue,
  ENVIRONMENTAL_CONTEXT_WINDOW,
  presentEnvironmentalObservation,
} from "@/features/ux-reset/review/environmental-context";
import { fetchEnvironmentalMeasure } from "@/features/ux-reset/review/load-environmental-context";
import {
  EnvironmentalContextCoverageStatus,
  ValueState,
} from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";

import {
  ENVIRONMENTAL_RELEASE_ID,
  ENVIRONMENTAL_SAMPLE_DATE,
  ENVIRONMENTAL_SAMPLE_FIPS,
  environmentalEnvelope,
  environmentalObservation,
} from "./fixtures/environmental-context";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").observationsV1ObservationsGet>()
);

vi.mock(import("@/generated/atlas"), async () => {
  const actual =
    await vi.importActual<typeof import("@/generated/atlas")>(
      "@/generated/atlas"
    );
  return {
    ...actual,
    observationsV1ObservationsGet: observationsGet,
  };
});

describe("environmental context presentation", () => {
  it("keeps the documented January 2025 window and representative day", () => {
    expect({
      dates: {
        december: environmentalDateSupport("2024-12-31"),
        end: environmentalDateSupport("2025-01-31"),
        february: environmentalDateSupport("2025-02-01"),
        impossible: environmentalDateSupport("2025-01-32"),
        latest: environmentalDateSupport("latest"),
        representative: environmentalDateSupport("2025-01-17"),
        start: environmentalDateSupport("2025-01-01"),
      },
      window: ENVIRONMENTAL_CONTEXT_WINDOW,
    }).toStrictEqual({
      dates: {
        december: "outside_coverage",
        end: "supported",
        february: "outside_coverage",
        impossible: "invalid",
        latest: "invalid",
        representative: "supported",
        start: "supported",
      },
      window: {
        end: "2025-01-31",
        representativeDate: "2025-01-17",
        start: "2025-01-01",
      },
    });
  });

  it("keys the cache by release, county, day, and measure", () => {
    expect(
      environmentalContextQueryKey({
        date: ENVIRONMENTAL_SAMPLE_DATE,
        fips: ENVIRONMENTAL_SAMPLE_FIPS,
        measureId: "nclimgrid_prcp_county_day",
        releaseId: ENVIRONMENTAL_RELEASE_ID,
      })
    ).toStrictEqual([
      "environmental-context",
      ENVIRONMENTAL_RELEASE_ID,
      ENVIRONMENTAL_SAMPLE_FIPS,
      ENVIRONMENTAL_SAMPLE_DATE,
      "nclimgrid_prcp_county_day",
    ]);
  });

  it("shows the revalidated Gonzales County quantities and a real zero", () => {
    const precipitation = environmentalObservation({
      measureId: "nclimgrid_prcp_county_day",
    });
    const minimum = environmentalObservation({
      measureId: "nclimgrid_tmin_county_day",
    });
    const maximum = environmentalObservation({
      measureId: "nclimgrid_tmax_county_day",
    });
    const average = environmentalObservation({
      measureId: "nclimgrid_tavg_county_day",
    });
    expect({
      average: environmentalDisplayValue(average),
      maximum: environmentalDisplayValue(maximum),
      minimum: environmentalDisplayValue(minimum),
      precipitation: environmentalDisplayValue(precipitation),
    }).toStrictEqual({
      average: "7.153611977327104 °C",
      maximum: "16.29939307942125 °C",
      minimum: "-1.992294192037333 °C",
      precipitation: "0.0 mm",
    });
    const presented = presentEnvironmentalObservation({
      claimLabel: "Precipitation",
      observation: precipitation,
    });
    expect({
      availability: presented.evidence.availability,
      day: presented.dayConvention.includes("early morning"),
      displayValue: presented.evidence.displayValue,
      methodVersion: presented.methodVersion,
      productId: presented.productId,
      provenanceRef: presented.provenanceRef.includes(
        "nclimgrid_prcp_county_day"
      ),
      publishedZero: presented.evidence.valueNote?.includes("Published zero"),
      reasonCode: presented.evidence.reasonCode,
      saysLatest: presented.evidence.valueNote?.includes("latest"),
      valueState: presented.valueStateLabel.includes("Value state ZERO"),
    }).toStrictEqual({
      availability: evidenceAvailabilityValues.limited,
      day: true,
      displayValue: "0.0 mm",
      methodVersion: "atlas-nclimgrid-county-day/2",
      productId: "noaa_nclimgrid_daily_202501",
      provenanceRef: true,
      publishedZero: true,
      reasonCode: "MATERIAL_LIMITATION",
      saysLatest: false,
      valueState: true,
    });
  });

  it("does not render null or out-of-coverage as zero", () => {
    const missing = environmentalObservation({
      measureId: "nclimgrid_prcp_county_day",
      value: null,
      valueState: ValueState.UNAVAILABLE,
    });
    const zeroStateWithNull = environmentalObservation({
      measureId: "nclimgrid_prcp_county_day",
      value: null,
      valueState: ValueState.ZERO,
    });
    const unavailableZero = environmentalObservation({
      measureId: "nclimgrid_prcp_county_day",
      value: 0,
      valueState: ValueState.UNAVAILABLE,
    });
    const outside = environmentalObservation({
      coverage: EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE,
      fips: "08001",
      measureId: "nclimgrid_tmin_county_day",
      value: null,
      valueState: ValueState.UNAVAILABLE,
    });
    const sourceMissing = environmentalObservation({
      coverage: EnvironmentalContextCoverageStatus.SOURCE_MISSING,
      measureId: "nclimgrid_tmax_county_day",
      value: null,
      valueState: ValueState.UNAVAILABLE,
    });
    const outsideView = presentEnvironmentalObservation({
      claimLabel: "Minimum temperature",
      observation: outside,
    });
    expect({
      coverageMissing: environmentalCoverageLabel(null),
      missing: environmentalDisplayValue(missing),
      nullNote: presentEnvironmentalObservation({
        claimLabel: "Precipitation",
        observation: zeroStateWithNull,
      }).evidence.valueNote,
      outsideCoverage: outsideView.coverageLabel,
      outsideIncludesZero: outsideView.evidence.displayValue.includes("0"),
      outsideReason: outsideView.evidence.reasonCode,
      outsideValue: outsideView.evidence.displayValue,
      sourceMissing: presentEnvironmentalObservation({
        claimLabel: "Maximum temperature",
        observation: sourceMissing,
      }).evidence.reasonCode,
      unavailableZero: environmentalDisplayValue(unavailableZero),
      zeroStateWithNull: environmentalDisplayValue(zeroStateWithNull),
    }).toStrictEqual({
      coverageMissing: "Coverage metadata was not returned",
      missing: "Unavailable",
      nullNote: expect.stringContaining("Null is not shown as zero"),
      outsideCoverage: "Out of source coverage",
      outsideIncludesZero: false,
      outsideReason: "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE",
      outsideValue: "Unavailable",
      sourceMissing: "ENVIRONMENTAL_SOURCE_MISSING",
      unavailableZero: "Unavailable",
      zeroStateWithNull: "Unavailable",
    });
  });

  it("marks partial coverage as limited without dropping the quantity", () => {
    const partial = presentEnvironmentalObservation({
      claimLabel: "Precipitation",
      observation: environmentalObservation({
        coverage: EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
        measureId: "nclimgrid_prcp_county_day",
        value: "1.25",
        valueState: ValueState.OBSERVED,
      }),
    });
    expect(partial.evidence.displayValue).toBe("1.25 mm");
    expect(partial.evidence.availability).toBe(
      evidenceAvailabilityValues.limited
    );
    expect(partial.coverageLabel).toBe("Partial coverage");
    expect(partial.evidence.provenance.limitations[0]).toBe(
      "Partial coverage."
    );
  });
});

describe("environmental context loading", () => {
  it("requests one county and accepts the governed envelope", async () => {
    observationsGet.mockResolvedValue({
      data: ObservationsV1ObservationsGetResponse.parse(
        environmentalEnvelope([
          environmentalObservation({ measureId: "nclimgrid_prcp_county_day" }),
        ])
      ),
      headers: new Headers(),
      status: 200,
    });
    const loaded = await fetchEnvironmentalMeasure({
      date: ENVIRONMENTAL_SAMPLE_DATE,
      fips: ENVIRONMENTAL_SAMPLE_FIPS,
      measureId: "nclimgrid_prcp_county_day",
      releaseId: ENVIRONMENTAL_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect(loaded.kind).toBe("observation");
    expect(observationsGet).toHaveBeenCalledWith(
      expect.objectContaining({
        end_date: ENVIRONMENTAL_SAMPLE_DATE,
        geography_id: [ENVIRONMENTAL_SAMPLE_FIPS],
        geography_type: "county",
        measure_id: "nclimgrid_prcp_county_day",
        start_date: ENVIRONMENTAL_SAMPLE_DATE,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("treats an empty January day as absence and refuses another release", async () => {
    observationsGet.mockResolvedValueOnce({
      data: ObservationsV1ObservationsGetResponse.parse(
        environmentalEnvelope([])
      ),
      headers: new Headers(),
      status: 200,
    });
    const absent = await fetchEnvironmentalMeasure({
      date: "2025-01-02",
      fips: "08001",
      measureId: "nclimgrid_tavg_county_day",
      releaseId: ENVIRONMENTAL_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect(absent).toStrictEqual({ kind: "absent" });

    observationsGet.mockResolvedValueOnce({
      data: ObservationsV1ObservationsGetResponse.parse(
        environmentalEnvelope([
          environmentalObservation({
            fips: "08001",
            measureId: "nclimgrid_tavg_county_day",
            releaseId: "other-release",
          }),
        ])
      ),
      headers: new Headers(),
      status: 200,
    });
    await expect(
      fetchEnvironmentalMeasure({
        date: ENVIRONMENTAL_SAMPLE_DATE,
        fips: "08001",
        measureId: "nclimgrid_tavg_county_day",
        releaseId: ENVIRONMENTAL_RELEASE_ID,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/release/i);
  });

  it("does not call the API for a day outside January 2025", async () => {
    observationsGet.mockClear();
    await expect(
      fetchEnvironmentalMeasure({
        date: "2024-12-31",
        fips: ENVIRONMENTAL_SAMPLE_FIPS,
        measureId: "nclimgrid_prcp_county_day",
        releaseId: ENVIRONMENTAL_RELEASE_ID,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/January 2025/);
    expect(observationsGet).not.toHaveBeenCalled();
  });

  it("reports a same-day conflict instead of combining rows", async () => {
    const first = environmentalObservation({
      measureId: "nclimgrid_prcp_county_day",
    });
    observationsGet.mockResolvedValue({
      data: ObservationsV1ObservationsGetResponse.parse(
        environmentalEnvelope([
          first,
          {
            ...first,
            observation_id: `${first.observation_id}-second`,
          },
        ])
      ),
      headers: new Headers(),
      status: 200,
    });
    const loaded = await fetchEnvironmentalMeasure({
      date: ENVIRONMENTAL_SAMPLE_DATE,
      fips: ENVIRONMENTAL_SAMPLE_FIPS,
      measureId: "nclimgrid_prcp_county_day",
      releaseId: ENVIRONMENTAL_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect(loaded).toStrictEqual({ count: 2, kind: "conflict" });
  });
});
