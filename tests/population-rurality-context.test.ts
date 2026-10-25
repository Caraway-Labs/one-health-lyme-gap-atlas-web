import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import { fetchPopulationRuralityMeasure } from "@/features/ux-reset/review/load-population-rurality-context";
import {
  acceptPopulationRuralityRows,
  populationRuralityMeasureIds,
  populationRuralityQueryKey,
  presentPopulationRuralityObservation,
  POPULATION_RURALITY_ACS_PERIOD,
  type PopulationRuralityMeasureId,
} from "@/features/ux-reset/review/population-rurality-context";
import { ValueState, type CountyContextObservation } from "@/generated/models";
import { ListObservationsResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  POPULATION_RURALITY_RELEASE_ID,
  POPULATION_RURALITY_SAMPLE_FIPS,
  populationRuralityEnvelope,
  populationRuralityObservation,
  type PopulationRuralityFixtureMeasureId,
} from "./fixtures/population-rurality-context";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").listObservations>()
);

vi.mock(import("@/generated/atlas"), async () => {
  const actual =
    await vi.importActual<typeof import("@/generated/atlas")>(
      "@/generated/atlas"
    );
  return {
    ...actual,
    listObservations: observationsGet,
  };
});

function presentMeasure(measureId: PopulationRuralityFixtureMeasureId) {
  const observation = populationRuralityObservation({ measureId });
  return presentPopulationRuralityObservation({
    claimLabel: measureId,
    observation,
  });
}

describe("population and rurality presentation", () => {
  it("ships only the five API 212 measures and vintages", () => {
    expect(populationRuralityMeasureIds).toStrictEqual([
      "rucc_2023",
      "population_2022",
      "svi_percentile_2022",
      "uninsured_percent_2022",
      "uninsured_percentile_2022",
    ]);
    expect(POPULATION_RURALITY_ACS_PERIOD).toStrictEqual({
      end: "2022-12-31",
      start: "2018-01-01",
    });
  });

  it("keys the cache by release, county, vintage, and measure", () => {
    expect(
      populationRuralityQueryKey({
        fips: POPULATION_RURALITY_SAMPLE_FIPS,
        measureId: "rucc_2023",
        releaseId: POPULATION_RURALITY_RELEASE_ID,
        vintageYear: 2023,
      })
    ).toStrictEqual([
      "population-rurality-context",
      POPULATION_RURALITY_RELEASE_ID,
      POPULATION_RURALITY_SAMPLE_FIPS,
      "2023",
      "rucc_2023",
    ]);
  });

  it("keeps category, people, percentile, and percent labels distinct", () => {
    const rurality = presentPopulationRuralityObservation({
      claimLabel: "Rural-urban classification",
      observation: populationRuralityObservation({
        categoryLabel: "Nonmetro: urban population under 5,000, not adjacent",
        measureId: "rucc_2023",
        value: 9,
      }),
    });
    const population = presentMeasure("population_2022");
    const vulnerability = presentMeasure("svi_percentile_2022");
    const percent = presentMeasure("uninsured_percent_2022");
    const percentile = presentMeasure("uninsured_percentile_2022");
    expect({
      percent: percent.evidence.displayValue,
      percentNote: percent.evidence.valueNote,
      percentile: percentile.evidence.displayValue,
      percentileNote: percentile.evidence.valueNote,
      people: population.evidence.displayValue,
      peoplePeriod: population.referencePeriod,
      rurality: rurality.evidence.displayValue,
      ruralitySourceField: [
        ...(rurality.evidence.provenance.referenceLines ?? []),
      ],
      ruralityVintage: rurality.vintageLabel,
      vulnerability: vulnerability.evidence.displayValue,
      vulnerabilityNote: vulnerability.evidence.valueNote,
    }).toStrictEqual({
      percent: "10.8 percent",
      percentNote: expect.stringContaining("not a percentile"),
      percentile: "0.6742 percentile",
      percentileNote: expect.stringContaining(
        "not a percent of the population"
      ),
      people: "520,149 people",
      peoplePeriod: "2018-01-01 through 2022-12-31",
      rurality: "Nonmetro: urban population under 5,000, not adjacent (code 9)",
      ruralitySourceField: [
        "Source field RUCC_2023.",
        "Denominator No person denominator is published.",
      ],
      ruralityVintage: "2023 classification vintage",
      vulnerability: "0.7264 percentile",
      vulnerabilityNote: expect.stringContaining(
        "not a percent of the population"
      ),
    });
    expect(vulnerability.evidence.displayValue).not.toContain("%");
    expect(percent.evidence.displayValue).not.toContain("percentile");
  });

  it("does not render null or a missing state as zero or as a category", () => {
    const missing = presentPopulationRuralityObservation({
      claimLabel: "Social vulnerability percentile",
      observation: populationRuralityObservation({
        measureId: "svi_percentile_2022",
        value: null,
        valueState: ValueState.MISSING,
      }),
    });
    const zero = presentPopulationRuralityObservation({
      claimLabel: "Uninsured percentage",
      observation: populationRuralityObservation({
        measureId: "uninsured_percent_2022",
        value: 0,
        valueState: ValueState.ZERO,
      }),
    });
    expect({
      missing: missing.evidence.displayValue,
      missingIncludesZero: missing.evidence.displayValue.includes("0"),
      missingNote: missing.evidence.valueNote,
      zero: zero.evidence.displayValue,
      zeroNote: zero.evidence.valueNote,
    }).toStrictEqual({
      missing: "Unavailable",
      missingIncludesZero: false,
      missingNote: expect.stringContaining("Null is not shown as zero"),
      zero: "0 percent",
      zeroNote: expect.stringContaining("Published zero"),
    });
  });

  it("presents the deployed Adams County payload without rescaling it", () => {
    const files = [
      [
        "rucc_2023",
        "08001-rucc_2023.json",
        "Metro: area population at least 1 million (code 1)",
      ],
      ["population_2022", "08001-population_2022.json", "520,149 people"],
      [
        "svi_percentile_2022",
        "08001-svi_percentile_2022.json",
        "0.7264 percentile",
      ],
      [
        "uninsured_percent_2022",
        "08001-uninsured_percent_2022.json",
        "10.8 percent",
      ],
      [
        "uninsured_percentile_2022",
        "08001-uninsured_percentile_2022.json",
        "0.6742 percentile",
      ],
    ] as const;
    const displayed = files.map(([measureId, fileName, expected]) => {
      const parsed = ListObservationsResponse.parse(
        JSON.parse(
          readFileSync(
            `tests/fixtures/live-county-context/${fileName}`,
            "utf-8"
          )
        )
      );
      const row = parsed.data[0];
      if (!row || !("county_context" in row) || row.county_context == null) {
        throw new Error(`${measureId} was not county context.`);
      }
      const view = presentPopulationRuralityObservation({
        claimLabel: measureId,
        observation: row,
      });
      return {
        expected,
        value: view.evidence.displayValue,
        vintage: view.vintageLabel,
      };
    });
    expect(displayed).toStrictEqual([
      {
        expected: "Metro: area population at least 1 million (code 1)",
        value: "Metro: area population at least 1 million (code 1)",
        vintage: "2023 classification vintage",
      },
      {
        expected: "520,149 people",
        value: "520,149 people",
        vintage: "2022 product vintage",
      },
      {
        expected: "0.7264 percentile",
        value: "0.7264 percentile",
        vintage: "2022 product vintage",
      },
      {
        expected: "10.8 percent",
        value: "10.8 percent",
        vintage: "2022 product vintage",
      },
      {
        expected: "0.6742 percentile",
        value: "0.6742 percentile",
        vintage: "2022 product vintage",
      },
    ]);
  });
});

describe("population and rurality loading", () => {
  it("requests vintage_year and refuses year or date filters", async () => {
    observationsGet.mockResolvedValue({
      data: ListObservationsResponse.parse(
        populationRuralityEnvelope([
          populationRuralityObservation({ measureId: "rucc_2023" }),
        ])
      ),
      headers: new Headers(),
      status: 200,
    });
    const loaded = await fetchPopulationRuralityMeasure({
      fips: POPULATION_RURALITY_SAMPLE_FIPS,
      measureId: "rucc_2023",
      releaseId: POPULATION_RURALITY_RELEASE_ID,
      signal: new AbortController().signal,
      vintageYear: 2023,
    });
    expect(loaded.kind).toBe("observation");
    const params = observationsGet.mock.calls[0]?.[0];
    expect(params).toStrictEqual({
      geography_id: [POPULATION_RURALITY_SAMPLE_FIPS],
      geography_type: "county",
      measure_id: "rucc_2023",
      page_size: 500,
      vintage_year: 2023,
    });
    expect(params).not.toHaveProperty("year");
    expect(params).not.toHaveProperty("start_date");
    expect(params).not.toHaveProperty("end_date");
  });

  it("treats an empty collection and a 404 as absence", async () => {
    observationsGet.mockResolvedValueOnce({
      data: ListObservationsResponse.parse(populationRuralityEnvelope([])),
      headers: new Headers(),
      status: 200,
    });
    const absent = await fetchPopulationRuralityMeasure({
      fips: "08013",
      measureId: "population_2022",
      releaseId: POPULATION_RURALITY_RELEASE_ID,
      signal: new AbortController().signal,
      vintageYear: 2022,
    });
    observationsGet.mockRejectedValueOnce(
      new AtlasApiError("Not found", "/v1/observations", 404, null)
    );
    const missing = await fetchPopulationRuralityMeasure({
      fips: "08013",
      measureId: "svi_percentile_2022",
      releaseId: POPULATION_RURALITY_RELEASE_ID,
      signal: new AbortController().signal,
      vintageYear: 2022,
    });
    expect({ absent, missing }).toStrictEqual({
      absent: { kind: "absent" },
      missing: { kind: "absent" },
    });
  });

  it("refuses another release and a dated row", async () => {
    const wrongRelease = populationRuralityObservation({
      measureId: "population_2022",
      releaseId: "other-release",
    });
    expect(() =>
      acceptPopulationRuralityRows({
        measureId: "population_2022",
        releaseId: POPULATION_RURALITY_RELEASE_ID,
        requestedFips: POPULATION_RURALITY_SAMPLE_FIPS,
        rows: [wrongRelease],
      })
    ).toThrow(/release/i);

    const dated = populationRuralityObservation({
      measureId: "svi_percentile_2022",
    });
    expect(() => readDatedObservations([dated])).toThrow(/county context/i);
    const { county_context: _context, ...datedRow } = dated;
    observationsGet.mockResolvedValueOnce({
      data: ListObservationsResponse.parse(
        populationRuralityEnvelope([datedRow as CountyContextObservation])
      ),
      headers: new Headers(),
      status: 200,
    });
    await expect(
      fetchPopulationRuralityMeasure({
        fips: POPULATION_RURALITY_SAMPLE_FIPS,
        measureId: "svi_percentile_2022",
        releaseId: POPULATION_RURALITY_RELEASE_ID,
        signal: new AbortController().signal,
        vintageYear: 2022,
      })
    ).rejects.toThrow(/dated observation|county context/i);
  });

  it("reports a conflict instead of combining two rows", () => {
    const first = populationRuralityObservation({
      measureId: "uninsured_percent_2022",
    });
    const loaded = acceptPopulationRuralityRows({
      measureId: "uninsured_percent_2022",
      releaseId: POPULATION_RURALITY_RELEASE_ID,
      requestedFips: POPULATION_RURALITY_SAMPLE_FIPS,
      rows: [
        first,
        { ...first, observation_id: `${first.observation_id}-second` },
      ],
    });
    expect(loaded).toStrictEqual({ count: 2, kind: "conflict" });
  });

  it("rejects a rural-urban value outside codes 1 through 9", () => {
    expect(() =>
      acceptPopulationRuralityRows({
        measureId: "rucc_2023" satisfies PopulationRuralityMeasureId,
        releaseId: POPULATION_RURALITY_RELEASE_ID,
        requestedFips: POPULATION_RURALITY_SAMPLE_FIPS,
        rows: [
          populationRuralityObservation({
            measureId: "rucc_2023",
            value: 10,
          }),
        ],
      })
    ).toThrow(/scale|whole number/i);
  });
});
