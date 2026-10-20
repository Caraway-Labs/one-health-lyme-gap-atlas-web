import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import { paintReadyObservationLayer } from "@/features/ux-reset/review/explorer-map-layer-scale";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import {
  acceptExplorerMapObservations,
  EXPLORER_OBSERVATION_SPECS,
  ExplorerMapContractError,
} from "@/features/ux-reset/review/explorer-map-observation";
import {
  loadExplorerMapObservations,
  splitExplorerMapObservationBatches,
} from "@/features/ux-reset/review/load-explorer-map-observations";
import { observationGate } from "@/features/ux-reset/review/use-explorer-map-observations";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect({
      adams: paint.colorsByFips.get("08001"),
      autauga: paint.colorsByFips.get("01001"),
    }).toStrictEqual({
      adams: "#F2F0F7",
      autauga: "#E5E0EF",
    });
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "1. Metro: area population at least 1 million",
      "2. Metro: area population 250,000 to 1 million",
      "3. metro area of fewer than 250,000",
      "4. urban population of 20,000 or more, adjacent to a metro area",
      "5. urban population of 20,000 or more, not adjacent to a metro area",
      "6. urban population of 2,500 to 19,999, adjacent to a metro area",
      "7. urban population of 2,500 to 19,999, not adjacent to a metro area",
      "8. completely rural or less than 2,500 urban population, adjacent to a metro area",
      "9. completely rural or less than 2,500 urban population, not adjacent to a metro area",
    ]);
    expect(paint.period).toMatch(/No observation dates/);
    expect(paint.note).toMatch(
      /not a proportional increase[\s\S]*not a risk gradient/
    );
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

  it("follows one continuation page and keeps a missing value null", async () => {
    const first = dated({ fips: "06037", value: 0.15 });
    const second = dated({
      fips: "01001",
      state: ValueState.MISSING,
      value: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost:8000");
        const token = url.searchParams.get("page_token");
        const body = token
          ? {
              data: [second],
              links: {},
              meta: { next_page_token: null },
            }
          : {
              data: [first],
              links: {},
              meta: { next_page_token: "page-2" },
            };
        return Response.json(body);
      })
    );
    const ready = await loadExplorerMapObservations({
      fips: ["06037", "01001"],
      releaseId: "release-1",
      signal: new AbortController().signal,
      spec: EXPLORER_OBSERVATION_SPECS.incidence_floor,
    });
    expect(ready.rows.map((row) => [row.fips, row.numeric])).toStrictEqual([
      ["06037", 0.15],
      ["01001", null],
    ]);
    expect(ready.omitted).toBe(0);
    expect(ready.rows[0]?.provenance.provenanceRef).toBe("prov");
    expect(ready.rows[0]?.provenance.evidence.resource_id).toBe("resource");
  });

  it("keeps governed limitations and provenance for the selected county", async () => {
    const observed = {
      ...dated({ fips: "08001", value: 1.2 }),
      limitations: ["Counts below 10 are suppressed in the source table."],
      source_published_at: "2024-06-01T00:00:00Z",
    };
    const suppressed = {
      ...dated({ fips: "08005", state: ValueState.SUPPRESSED, value: null }),
      limitations: ["Privacy suppression applies to this county."],
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      methodology_version: "semantic_county_assembly_v1",
    };
    const ready = acceptExplorerMapObservations({
      releaseId: "release-1",
      requestedFips: ["08001", "08005"],
      rows: [observed, suppressed],
      spec: EXPLORER_OBSERVATION_SPECS.incidence_floor,
    });
    const paint = paintReadyObservationLayer({
      layerId: "incidence_floor",
      omitted: ready.omitted,
      period: ready.period,
      rows: ready.rows,
      selectedFips: "08001",
      sourceLabel: ready.sourceLabel,
      unit: ready.unit,
    });
    expect({
      acquired: ready.rows[0]?.provenance.atlasAcquiredAt,
      limitations: ready.rows[0]?.provenance.limitations,
      method: ready.rows[0]?.provenance.methodologyVersion,
      provenance: ready.rows[0]?.provenance.provenanceRef,
      published: ready.rows[0]?.provenance.sourcePublishedAt,
      state: paint.selectionEvidence?.availability,
      reason: paint.selectionEvidence?.reasonCode,
    }).toStrictEqual({
      acquired: null,
      limitations: ["Counts below 10 are suppressed in the source table."],
      method: "semantic_county_assembly_v1",
      provenance: "prov",
      published: "2024-06-01T00:00:00Z",
      state: "limited",
      reason: "MATERIAL_LIMITATION",
    });
    render(createElement(ExplorerMapLegend, { paint }));
    await userEvent.click(
      screen.getByRole("button", { name: "About Lyme incidence floor" })
    );
    const suppressedPaint = paintReadyObservationLayer({
      layerId: "incidence_floor",
      omitted: ready.omitted,
      period: ready.period,
      rows: ready.rows,
      selectedFips: "08005",
      sourceLabel: ready.sourceLabel,
      unit: ready.unit,
    });
    expect({
      availability: screen.getByTestId("ux-reset-evidence-object").dataset
        .evidenceAvailability,
      inspect: screen.getByTestId("evidence-provenance-inspect").textContent,
      limitations: screen.queryByTestId("evidence-provenance-limitations"),
      suppressedAvailability: suppressedPaint.selectionEvidence?.availability,
      suppressedReason: suppressedPaint.selectionEvidence?.reasonCode,
      suppressedRef:
        suppressedPaint.selectionEvidence?.provenance.technical?.provenanceRef,
    }).toStrictEqual({
      availability: "limited",
      inspect: expect.stringContaining("Inspect provenance"),
      limitations: null,
      suppressedAvailability: "limited",
      suppressedReason: ValueState.SUPPRESSED,
      suppressedRef: "prov",
    });
  });

  it("keeps a layer disabled when the collection has no admitted rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [], links: {}, meta: {} }))
    );
    await expect(
      loadExplorerMapObservations({
        fips: ["08001"],
        releaseId: "release-1",
        signal: new AbortController().signal,
        spec: EXPLORER_OBSERVATION_SPECS.incidence_floor,
      })
    ).rejects.toThrow(/no rows/);
    expect(
      observationGate({
        reason: "The observation collection returned no rows.",
        status: "error",
      }).selectable
    ).toBeFalsy();
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
