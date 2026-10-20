import { describe, expect, it } from "vitest";

import {
  LYME_INCIDENCE_RAMP,
  mixExplorerRampColor,
  SVI_HIGH_LABEL,
  SVI_LOW_LABEL,
  SVI_NO_DATA_COLOR,
  SVI_RAMP,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import { ValueState } from "@/generated/models";
import { REVIEW_SCORE_RAMP_COLORS } from "@/lib/atlas-ui";

function lightness(color: string): number {
  const hsl = /^hsl\(\d+, \d+%, (?<lightness>\d+)%\)$/.exec(color);
  if (hsl?.groups?.lightness) {
    return Number(hsl.groups.lightness);
  }
  const hex = /^#(?<value>[0-9A-Fa-f]{6})$/.exec(color);
  if (!hex?.groups) {
    throw new Error(`Unparsed color ${color}`);
  }
  const channels = [0, 2, 4].map(
    (start) =>
      Number.parseInt(hex.groups?.value.slice(start, start + 2) ?? "", 16) / 255
  );
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  return Math.round(((max + min) / 2) * 100);
}

function row(
  fips: string,
  valueState: ValueState,
  numeric: number | null
): ExplorerMapNumericRow {
  const raw = numeric === null ? null : String(numeric);
  return {
    categoryLabel: null,
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
      measureId: "svi_percentile_2022",
      methodology: null,
      methodologyId: null,
      methodologyVersion: "svi_numeric_projection_v2",
      observationId: `obs-${fips}`,
      periodEnd: "2022-12-31",
      periodStart: "2018-01-01",
      provenanceRef: "prov",
      publishedValue: raw,
      releaseId: "release-1",
      semanticVersion: "1.0.0",
      sourceId: "context_svi",
      sourceLabel: "CDC/ATSDR Social Vulnerability Index",
      sourcePublishedAt: null,
      sourceUrl: null,
      sourceVintage: "2022 (2018-2022 ACS)",
      temporalGrain: "PERIOD",
      unit: "percentile",
    },
    raw,
    valueState,
  };
}

describe("Social vulnerability palette", () => {
  it("keeps the approved anchors on the existing 0 to 1 percentile", () => {
    expect(SVI_RAMP).toStrictEqual([
      "#FEEBE2",
      "#FDC9A9",
      "#FDA06B",
      "#E56B2F",
      "#A63603",
    ]);
    expect(
      SVI_RAMP.map((_, index) =>
        mixExplorerRampColor(SVI_RAMP, index / (SVI_RAMP.length - 1))
      )
    ).toStrictEqual([...SVI_RAMP]);
  });

  it("darkens monotonically from pale peach to burnt orange", () => {
    const samples = Array.from({ length: 21 }, (_, index) =>
      lightness(mixExplorerRampColor(SVI_RAMP, index / 20))
    );
    const decreases = samples.every((current, index) => {
      if (index === 0) {
        return true;
      }
      return current <= (samples[index - 1] ?? current);
    });
    expect(decreases).toBeTruthy();
    expect((samples[0] ?? 0) > (samples.at(-1) ?? 0)).toBeTruthy();
  });

  it("paints percentile steps on the ramp and keeps missing gray off that scale", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "svi",
      observation: {
        omitted: 1,
        period:
          "CDC/ATSDR Social Vulnerability Index 2022 (2018-2022 ACS). ACS 2018-01-01 through 2022-12-31. Vintage 2022.",
        rows: [
          row("08001", ValueState.ZERO, 0),
          row("08005", ValueState.OBSERVED, 0.25),
          row("08013", ValueState.OBSERVED, 0.5),
          row("08031", ValueState.OBSERVED, 0.75),
          row("36001", ValueState.OBSERVED, 1),
          row("08014", ValueState.MISSING, null),
          row("09009", ValueState.SUPPRESSED, null),
          row("09011", ValueState.UNAVAILABLE, null),
          row("09013", ValueState.NO_RECORDS, null),
          row("09015", ValueState.NO_COUNTY_LINKED_RECORD, null),
        ],
        sourceLabel: "CDC/ATSDR Social Vulnerability Index",
        status: "ready",
        unit: "percentile",
      },
      scoresStatus: "ready",
    });
    const labels = paint.entries.map((entry) => entry.label);
    expect({
      high: paint.colorsByFips.get("36001"),
      low: paint.colorsByFips.get("08001"),
      mid: paint.colorsByFips.get("08013"),
      missing: paint.colorsByFips.get("08014"),
      omitted: paint.entries.find(
        (entry) => entry.label === "No published value"
      )?.color,
      quarter: paint.colorsByFips.get("08005"),
      ramp: paint.ramp,
      threeQuarter: paint.colorsByFips.get("08031"),
      unit: paint.unit,
    }).toStrictEqual({
      high: "#A63603",
      low: "#FEEBE2",
      mid: "#FDA06B",
      missing: SVI_NO_DATA_COLOR,
      omitted: SVI_NO_DATA_COLOR,
      quarter: "#FDC9A9",
      ramp: SVI_RAMP,
      threeQuarter: "#E56B2F",
      unit: "percentile",
    });
    expect({
      linked: paint.colorsByFips.get("09015"),
      records: paint.colorsByFips.get("09013"),
      suppressed: paint.colorsByFips.get("09009"),
      unavailable: paint.colorsByFips.get("09011"),
    }).toStrictEqual({
      linked: "hsl(28, 18%, 46%)",
      records: "hsl(200, 10%, 62%)",
      suppressed: "var(--navy-2)",
      unavailable: "var(--atlas-muted-text)",
    });
    expect(labels).toStrictEqual(
      expect.arrayContaining([
        "0 (observed zero)",
        "1 (high end)",
        "Missing (not zero and not a low value)",
        "Suppressed (not zero)",
        "Unavailable (not zero)",
        "No records (not zero and not confirmed absence)",
        "No county-linked record (not zero and not confirmed absence)",
        "No published value",
      ])
    );
    expect([
      paint.note.includes("RPL_THEMES"),
      paint.note.includes("U.S. counties"),
      paint.note.includes("2022"),
      paint.note.includes("not a percent of residents who are vulnerable"),
    ]).toStrictEqual([true, true, true, true]);
    const model = buildExplorerLegendModel(paint);
    expect({
      highStop: model.gradient?.stops.at(-1)?.color,
      left: model.leftCaption,
      lowStop: model.gradient?.stops[0]?.color,
      name: model.gradient?.accessibleName,
      right: model.rightCaption,
      unit: model.unitLabel,
    }).toStrictEqual({
      highStop: "#A63603",
      left: `${SVI_LOW_LABEL}\n0`,
      lowStop: "#FEEBE2",
      name: expect.stringMatching(/0 to[\s\S]*1 percentile/),
      right: `${SVI_HIGH_LABEL}\n1`,
      unit: "percentile",
    });
  });

  it("leaves Lyme incidence and the six gap-score colors unchanged", () => {
    expect({
      high: LYME_INCIDENCE_RAMP.at(-1),
      low: LYME_INCIDENCE_RAMP[0],
      scores: REVIEW_SCORE_RAMP_COLORS,
    }).toStrictEqual({
      high: "#005A32",
      low: "#E5F5E0",
      scores: [
        "#a9d2db",
        "#55a8a3",
        "#87b982",
        "#efc64a",
        "#f49a32",
        "#e9602b",
      ],
    });
    const uninsured = paintExplorerMapLayer({
      counties: [],
      layerId: "uninsured",
      observation: {
        omitted: 0,
        period: "Vintage 2022.",
        rows: [
          row("08001", ValueState.ZERO, 0),
          row("08005", ValueState.OBSERVED, 100),
        ],
        sourceLabel: "ACS",
        status: "ready",
        unit: "percent",
      },
      scoresStatus: "ready",
    });
    expect({
      low: uninsured.colorsByFips.get("08001"),
      missing: SVI_NO_DATA_COLOR,
      ramp: uninsured.ramp,
    }).toStrictEqual({
      low: UNINSURED_POPULATION_RAMP[0],
      missing: "#D1D5DB",
      ramp: UNINSURED_POPULATION_RAMP,
    });
  });
});
