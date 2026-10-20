import { describe, expect, it } from "vitest";

import {
  LYME_INCIDENCE_MISSING_COLOR,
  LYME_INCIDENCE_RAMP,
  mixExplorerRampColor,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import { PATHOGEN_STATUS_PRESENT_COLOR } from "@/features/ux-reset/review/pathogen-status-contract";
import { ValueState } from "@/generated/models";
import { REVIEW_SCORE_RAMP_COLORS } from "@/lib/atlas-ui";

function lightness(color: string): number {
  const hsl =
    /^hsl\(\d+, \d+%, (?<lightness>\d+)%\)$/.exec(color) ??
    /^hsl\((?<hue>\d+), (?<saturation>\d+)%, (?<lightness>\d+)%\)$/.exec(color);
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
      measureId: "incidence_floor_2023",
      methodology: null,
      methodologyId: null,
      methodologyVersion: "semantic_county_assembly_v1",
      observationId: `obs-${fips}`,
      periodEnd: "2023-12-31",
      periodStart: "2023-01-01",
      provenanceRef: "prov",
      publishedValue: raw,
      releaseId: "release-1",
      semanticVersion: "2.0.0",
      sourceId: "human",
      sourceLabel: "CDC Lyme surveillance",
      sourcePublishedAt: null,
      sourceUrl: null,
      sourceVintage: "2023",
      temporalGrain: "YEAR",
      unit: "per 100,000",
    },
    raw,
    valueState,
  };
}

describe("Lyme incidence palette", () => {
  it("keeps the approved anchors on equal steps of the existing ratio", () => {
    expect(
      LYME_INCIDENCE_RAMP.map((_, index) =>
        mixExplorerRampColor(
          LYME_INCIDENCE_RAMP,
          index / (LYME_INCIDENCE_RAMP.length - 1)
        )
      )
    ).toStrictEqual([...LYME_INCIDENCE_RAMP]);
  });

  it("keeps a monotonic pale-to-deep lightness ramp", () => {
    const samples = Array.from({ length: 21 }, (_, index) =>
      lightness(mixExplorerRampColor(LYME_INCIDENCE_RAMP, index / 20))
    );
    const decreases = samples.every((current, index) => {
      if (index === 0) {
        return true;
      }
      return current <= (samples[index - 1] ?? current);
    });
    expect({
      decreases,
      high: samples.at(-1),
      low: samples[0],
    }).toStrictEqual({
      decreases: true,
      high: expect.any(Number),
      low: expect.any(Number),
    });
    expect((samples[0] ?? 0) > (samples.at(-1) ?? 0)).toBeTruthy();
  });

  it("keeps valid zero pale green and missing gray distinct from other states", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "incidence_floor",
      observation: {
        omitted: 0,
        period: "2023-01-01 through 2023-12-31.",
        rows: [
          row("09001", ValueState.ZERO, 0),
          row("09003", ValueState.OBSERVED, 50),
          row("09005", ValueState.OBSERVED, 100),
          row("09007", ValueState.MISSING, null),
          row("09009", ValueState.SUPPRESSED, null),
          row("09011", ValueState.UNAVAILABLE, null),
          row("09013", ValueState.NO_RECORDS, null),
          row("09015", ValueState.NO_COUNTY_LINKED_RECORD, null),
        ],
        sourceLabel: "CDC Lyme surveillance",
        status: "ready",
        unit: "per 100,000",
      },
      scoresStatus: "ready",
    });
    const colors = [
      paint.colorsByFips.get("09001"),
      paint.colorsByFips.get("09003"),
      paint.colorsByFips.get("09005"),
      paint.colorsByFips.get("09007"),
      paint.colorsByFips.get("09009"),
      paint.colorsByFips.get("09011"),
      paint.colorsByFips.get("09013"),
      paint.colorsByFips.get("09015"),
    ];
    expect({
      distinct: new Set(colors).size,
      high: colors[2],
      missing: colors[3],
      missingLabel: paint.entries.some((entry) =>
        entry.label.includes("Missing")
      ),
      pathogenPresent: (LYME_INCIDENCE_RAMP as readonly string[]).includes(
        PATHOGEN_STATUS_PRESENT_COLOR
      ),
      ramp: paint.ramp,
      zero: colors[0],
    }).toStrictEqual({
      distinct: colors.length,
      high: "#005A32",
      missing: LYME_INCIDENCE_MISSING_COLOR,
      missingLabel: true,
      pathogenPresent: false,
      ramp: LYME_INCIDENCE_RAMP,
      zero: "#E5F5E0",
    });
  });

  it("leaves the six gap-score colors unchanged", () => {
    expect(REVIEW_SCORE_RAMP_COLORS).toStrictEqual([
      "#a9d2db",
      "#55a8a3",
      "#87b982",
      "#efc64a",
      "#f49a32",
      "#e9602b",
    ]);
    const paint = paintExplorerMapLayer({
      counties: [
        {
          burgdorferi_status: "No records",
          color: "#e9602b",
          county: "Adams",
          evidence_completeness: 40,
          fips: "08001",
          human_status: "published_count_floor",
          in_contiguous_tick_scope: true,
          priority: "Highest review priority",
          score: {
            access_signal: 1,
            community: 1,
            ecological: 1,
            human_weakness: 1,
            pathogen_signal: 1,
            rural_signal: 1,
            score: 80,
            svi_signal: 1,
            tick_signal: 1,
          },
          state: "CO",
          state_name: "Colorado",
          tick_status: "Established",
        },
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.get("08001")).toBe("#e9602b");
    expect(paint.layerId).toBe("gap_score");
  });
});
