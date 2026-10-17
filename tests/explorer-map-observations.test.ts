import { describe, expect, it } from "vitest";

import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import {
  acceptExplorerMapObservations,
  EXPLORER_OBSERVATION_SPECS,
  ExplorerMapContractError,
} from "@/features/ux-reset/review/explorer-map-observation";
import { splitExplorerMapObservationBatches } from "@/features/ux-reset/review/load-explorer-map-observations";
import type { CountyContextObservation, Observation } from "@/generated/models";
import { ValueState } from "@/generated/models";

const evidence = {
  provenance_ref: "prov",
  resource_id: "resource",
  resource_type: "observation",
};

function dated(input: {
  fips: string;
  state?: ValueState;
  value: number | null;
}): Observation {
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "x5j9-wybp",
    denominator: null,
    evidence,
    geography: { geography_id: input.fips, geography_type: "county" },
    limitations: [],
    lineage_source_id: "cdc_lyme",
    measure_id: "incidence_floor_2023",
    methodology: "case floor divided by population",
    methodology_id: "human_case_floor_population_incidence_v1",
    methodology_version: "semantic_county_assembly_v1",
    observation_id: `obs-${input.fips}`,
    period_end: "2023-12-31",
    period_start: "2023-01-01",
    provenance_ref: "prov",
    release_id: "release-1",
    release_methodology_version: "semantic-2.0.0",
    semantic_version: "2.0.0",
    source_id: "human",
    source_label: "CDC Lyme surveillance",
    source_published_at: null,
    source_url: "https://data.cdc.gov/resource/x5j9-wybp.json",
    source_vintage: "2023",
    temporal_grain: "YEAR",
    unit: "per 100,000",
    value: input.value,
    value_state: input.state ?? ValueState.OBSERVED,
  };
}

function rucc(input: {
  fips: string;
  label: string;
  periodEnd?: string | null;
  periodStart?: string | null;
  value: number;
}): CountyContextObservation {
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    county_context: {
      allowed_value_states: [ValueState.OBSERVED],
      category_label: input.label,
      contract_version: "atlas-county-context-consumer/1",
      definition: "USDA ERS 2023 rural-urban code.",
      metadata_methodology_version: "2.0.0",
      source_field: "RUCC_2023",
      value_type: "integer",
      vintage_year: 2023,
    },
    dataset_id: "rural-urban-continuum-codes-2023",
    denominator: "NONE",
    evidence,
    geography: { geography_id: input.fips, geography_type: "county" },
    limitations: [],
    lineage_source_id: "usda_ers",
    measure_id: "rucc_2023",
    methodology: "USDA ERS 2023 Rural-Urban Continuum Code.",
    methodology_id: null,
    methodology_version: "semantic_county_assembly_v1",
    observation_id: `rucc-${input.fips}`,
    period_end: input.periodEnd === undefined ? null : input.periodEnd,
    period_start: input.periodStart === undefined ? null : input.periodStart,
    provenance_ref: "prov",
    release_id: "release-1",
    release_methodology_version: "semantic-2.0.0",
    semantic_version: "2.0.0",
    source_id: "context_rucc",
    source_label: "USDA ERS Rural-Urban Continuum Codes",
    source_published_at: null,
    source_url:
      "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
    source_vintage: "2023",
    temporal_grain: "VINTAGE_YEAR",
    unit: "code",
    value: input.value,
    value_state: ValueState.OBSERVED,
  };
}

describe("Explorer map observations", () => {
  it("accepts an incidence floor and keeps a missing row null", () => {
    const ready = acceptExplorerMapObservations({
      releaseId: "release-1",
      requestedFips: ["06037", "01001", "08005"],
      rows: [
        dated({ fips: "06037", value: 0.15 }),
        dated({ fips: "01001", state: ValueState.MISSING, value: null }),
      ],
      spec: EXPLORER_OBSERVATION_SPECS.incidence_floor,
    });
    expect(ready.omitted).toBe(1);
    expect(ready.rows.find((row) => row.fips === "01001")?.numeric).toBeNull();
    expect(ready.rows.find((row) => row.fips === "06037")).toMatchObject({
      numeric: 0.15,
      raw: "0.15",
    });
  });

  it("rejects a missing incidence value that was sent as zero", () => {
    expect(() =>
      acceptExplorerMapObservations({
        releaseId: "release-1",
        requestedFips: ["01001"],
        rows: [dated({ fips: "01001", state: ValueState.MISSING, value: 0 })],
        spec: EXPLORER_OBSERVATION_SPECS.incidence_floor,
      })
    ).toThrow(ExplorerMapContractError);
  });

  it("rejects a rural-urban code that includes a date", () => {
    expect(() =>
      acceptExplorerMapObservations({
        releaseId: "release-1",
        requestedFips: ["01001"],
        rows: [
          rucc({
            fips: "01001",
            label: "Metro: area population 250,000 to 1 million",
            periodEnd: "2023-12-31",
            periodStart: "2023-01-01",
            value: 2,
          }),
        ],
        spec: EXPLORER_OBSERVATION_SPECS.rurality,
      })
    ).toThrow(/does not invent or accept dates/);
  });

  it("paints rural-urban codes with the published label", () => {
    const ready = acceptExplorerMapObservations({
      releaseId: "release-1",
      requestedFips: ["01001", "08001"],
      rows: [
        rucc({
          fips: "01001",
          label: "Metro: area population 250,000 to 1 million",
          value: 2,
        }),
        rucc({
          fips: "08001",
          label: "Metro: area population at least 1 million",
          value: 1,
        }),
      ],
      spec: EXPLORER_OBSERVATION_SPECS.rurality,
    });
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "rurality",
      observation: { ...ready, status: "ready" },
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.get("01001")).not.toBe(
      paint.colorsByFips.get("08001")
    );
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "1. Metro: area population at least 1 million",
      "2. Metro: area population 250,000 to 1 million",
      "No published value",
    ]);
    expect(paint.period).toMatch(/No observation dates/);
    expect(paint.note).toMatch(/not a risk gradient/);
  });

  it("does not manufacture a date for county context passed to a dated consumer", () => {
    expect(() =>
      readDatedObservations([
        rucc({
          fips: "01001",
          label: "Metro: area population 250,000 to 1 million",
          value: 2,
        }),
      ])
    ).toThrow(/does not invent dates/);
  });

  it("splits a national county list into more than one bounded batch", () => {
    const fips = Array.from(
      { length: 800 },
      (_, index) => `08${String(index).padStart(3, "0")}`
    );
    const batches = splitExplorerMapObservationBatches({
      fips,
      spec: EXPLORER_OBSERVATION_SPECS.svi,
    });
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.length).toBeLessThan(fips.length);
    expect(batches.flat()).toStrictEqual(fips);
  });
});
