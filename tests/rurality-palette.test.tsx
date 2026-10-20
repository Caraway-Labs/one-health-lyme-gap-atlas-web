import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import { RUCC_2023_LABELS } from "@/features/ux-reset/review/review-rationale";
import {
  RURALITY_LEGEND_EXPLANATION,
  RURALITY_MORE_RURAL_LABEL,
  RURALITY_MORE_URBAN_LABEL,
  RURALITY_NO_DATA_COLOR,
  RURALITY_RUCC_FILLS,
  ruralityFillForCode,
} from "@/features/ux-reset/review/rurality-palette";
import { ValueState } from "@/generated/models";

const RUCC_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const RUCC_FILLS: readonly string[] = RUCC_CODES.map(
  (code) => RURALITY_RUCC_FILLS[code]
);

function row(
  fips: string,
  valueState: ValueState,
  numeric: number | null,
  categoryLabel: string | null
): ExplorerMapNumericRow {
  return {
    categoryLabel,
    fips,
    numeric,
    provenance: {
      atlasAcquiredAt: null,
      evidence: {
        provenance_ref: "prov",
        resource_id: "resource",
        resource_type: "observation",
      },
      limitations: [],
      measureId: "rucc_2023",
      methodology: null,
      methodologyId: null,
      methodologyVersion: "semantic_county_assembly_v1",
      observationId: `obs-${fips}`,
      periodEnd: null,
      periodStart: null,
      provenanceRef: "prov",
      publishedValue: numeric,
      releaseId: "release-1",
      semanticVersion: "2.0.0",
      sourceId: "context_rucc",
      sourceLabel: "USDA ERS",
      sourcePublishedAt: null,
      sourceUrl: null,
      sourceVintage: "2023",
      temporalGrain: "VINTAGE_YEAR",
      unit: "code",
    },
    raw: numeric === null ? null : String(numeric),
    valueState,
  };
}

function ruralityPaint(rows: ExplorerMapNumericRow[], omitted = 0) {
  return paintExplorerMapLayer({
    counties: [],
    layerId: "rurality",
    observation: {
      omitted,
      period: "Vintage 2023.",
      rows,
      sourceLabel: "USDA ERS",
      status: "ready",
      unit: "code",
    },
    scoresStatus: "ready",
  });
}

function swatchColor(element: Element | null | undefined): string {
  return element?.querySelector("span")?.getAttribute("style") ?? "";
}

describe("rurality sequential palette", () => {
  afterEach(() => {
    cleanup();
  });

  it("maps each published RUCC code to its stepped purple fill", () => {
    const rows = RUCC_CODES.map((code) =>
      row(`0800${code}`, ValueState.OBSERVED, code, `published ${code}`)
    );
    const paint = ruralityPaint(rows);
    const model = buildExplorerLegendModel(paint);
    expect({
      captions: [model.leftCaption, model.rightCaption],
      classes: paint.entries
        .filter((entry) => entry.role === "class")
        .map((entry) => ({ color: entry.color, label: entry.label })),
      fills: RUCC_CODES.map((code) => ({
        catalog: ruralityFillForCode(code),
        county: paint.colorsByFips.get(`0800${code}`),
      })),
      missing: paint.entries.filter((entry) => entry.label === "No data")
        .length,
      note: paint.note,
      scale: paint.scale,
      segments: model.segments.map((segment) => segment.color),
      uniqueFills: new Set(RUCC_FILLS).size,
    }).toStrictEqual({
      captions: [RURALITY_MORE_URBAN_LABEL, RURALITY_MORE_RURAL_LABEL],
      classes: RUCC_CODES.map((code) => ({
        color: RURALITY_RUCC_FILLS[code],
        label: `${code}. published ${code}`,
      })),
      fills: RUCC_CODES.map((code) => ({
        catalog: RURALITY_RUCC_FILLS[code],
        county: RURALITY_RUCC_FILLS[code],
      })),
      missing: 0,
      note: expect.stringContaining(RURALITY_LEGEND_EXPLANATION),
      scale: "segments",
      segments: RUCC_FILLS,
      uniqueFills: 9,
    });
    expect(paint.note).toMatch(/not a proportional increase/);
  });

  it("keeps the catalog description when a code is absent from the load", () => {
    const paint = ruralityPaint([
      row(
        "08001",
        ValueState.OBSERVED,
        1,
        "Metro: area population at least 1 million"
      ),
    ]);
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "1. Metro: area population at least 1 million",
      ...RUCC_CODES.slice(1).map(
        (code) => `${code}. ${RUCC_2023_LABELS[code]}`
      ),
    ]);
  });

  it("paints missing, suppressed, and omitted counties as gray No data", () => {
    const paint = ruralityPaint(
      [
        row("08001", ValueState.OBSERVED, 9, "completely rural"),
        row("08013", ValueState.MISSING, null, null),
        row("08014", ValueState.SUPPRESSED, null, null),
        row("08015", ValueState.OBSERVED, 4, null),
      ],
      1
    );
    const missing = paint.entries.filter((entry) => entry.role === "missing");
    expect({
      fills: ["08001", "08013", "08014", "08015"].map((fips) =>
        paint.colorsByFips.get(fips)
      ),
      invalid: [ruralityFillForCode(0), ruralityFillForCode(1.5)],
      missing,
      shaded: ["08013", "08014", "08015"].map((fips) =>
        RUCC_FILLS.includes(paint.colorsByFips.get(fips) ?? "")
      ),
    }).toStrictEqual({
      fills: [
        RURALITY_RUCC_FILLS[9],
        RURALITY_NO_DATA_COLOR,
        RURALITY_NO_DATA_COLOR,
        RURALITY_NO_DATA_COLOR,
      ],
      invalid: [null, null],
      missing: [
        {
          color: RURALITY_NO_DATA_COLOR,
          detail:
            "Not a rural-urban code. Not urban, not rural, not zero, and not confirmed absence.",
          label: "No data",
          role: "missing",
          visibleLines: ["No data"],
        },
      ],
      shaded: [false, false, false],
    });
  });

  it("shows the ordered captions, explanation, and separate No data swatch", () => {
    const paint = ruralityPaint([
      row("08001", ValueState.OBSERVED, 1, RUCC_2023_LABELS[1] ?? "metro"),
      row("08013", ValueState.UNAVAILABLE, null, null),
    ]);
    render(<ExplorerMapLegend paint={paint} />);
    const legend = screen.getByRole("region", { name: "Rurality map legend" });
    const classes = [...legend.querySelectorAll("[data-legend-role='class']")];
    const noData = screen.getByRole("button", { name: /No data/ });
    expect({
      classColors: [swatchColor(classes[0]), swatchColor(classes.at(-1))],
      classCount: classes.length,
      explanation: legend.textContent?.includes(RURALITY_LEGEND_EXPLANATION),
      moreRural: legend.textContent?.includes(RURALITY_MORE_RURAL_LABEL),
      moreUrban: legend.textContent?.includes(RURALITY_MORE_URBAN_LABEL),
      noDataOutside: noData.closest(".ux-reset-explorer-legend-strip") === null,
      noDataSwatch: swatchColor(noData),
      scale: legend.dataset.legendScale,
    }).toStrictEqual({
      classColors: [
        "background: rgb(242, 240, 247);",
        "background: rgb(70, 33, 110);",
      ],
      classCount: 9,
      explanation: true,
      moreRural: true,
      moreUrban: true,
      noDataOutside: true,
      noDataSwatch: "background: rgb(209, 213, 219);",
      scale: "segments",
    });
  });

  it("leaves the incidence ramp on its existing blue scale", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "incidence_floor",
      observation: {
        omitted: 0,
        period: "2023.",
        rows: [
          { ...row("08001", ValueState.OBSERVED, 0, null), raw: "0" },
          { ...row("11001", ValueState.OBSERVED, 12, null), raw: "12" },
        ],
        sourceLabel: "CDC",
        status: "ready",
        unit: "per 100,000",
      },
      scoresStatus: "ready",
    });
    expect(paint.entries.map((entry) => entry.color)).toStrictEqual([
      "hsl(204, 45%, 88%)",
      "hsl(210, 72%, 24%)",
    ]);
  });
});
