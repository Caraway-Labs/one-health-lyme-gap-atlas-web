import { describe, expect, it } from "vitest";

import {
  mixExplorerRampColor,
  SVI_NO_DATA_COLOR,
  SVI_RAMP,
  UNINSURED_POPULATION_MISSING_COLOR,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
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
      measureId: "uninsured_percent_2022",
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
      unit: "percent",
    },
    raw,
    valueState,
  };
}

describe("Uninsured population palette", () => {
  it("keeps the approved anchors on equal steps of the 0 to 100 percent scale", () => {
    expect(
      UNINSURED_POPULATION_RAMP.map((_, index) =>
        mixExplorerRampColor(
          UNINSURED_POPULATION_RAMP,
          index / (UNINSURED_POPULATION_RAMP.length - 1)
        )
      )
    ).toStrictEqual([...UNINSURED_POPULATION_RAMP]);
  });

  it("keeps a monotonic pale-rose-to-burgundy lightness ramp", () => {
    const samples = Array.from({ length: 21 }, (_, index) =>
      lightness(mixExplorerRampColor(UNINSURED_POPULATION_RAMP, index / 20))
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

  it("paints percent anchors and keeps missing gray distinct from other states", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "uninsured",
      observation: {
        omitted: 0,
        period: "Vintage 2022.",
        rows: [
          row("01001", ValueState.ZERO, 0),
          row("01003", ValueState.OBSERVED, 25),
          row("01005", ValueState.OBSERVED, 50),
          row("01007", ValueState.OBSERVED, 75),
          row("01009", ValueState.OBSERVED, 100),
          row("01011", ValueState.MISSING, null),
          row("01013", ValueState.SUPPRESSED, null),
          row("01015", ValueState.UNAVAILABLE, null),
          row("01017", ValueState.NO_RECORDS, null),
          row("01019", ValueState.NO_COUNTY_LINKED_RECORD, null),
        ],
        sourceLabel: "CDC/ATSDR Social Vulnerability Index",
        status: "ready",
        unit: "percent",
      },
      scoresStatus: "ready",
    });
    const colors = [
      paint.colorsByFips.get("01001"),
      paint.colorsByFips.get("01003"),
      paint.colorsByFips.get("01005"),
      paint.colorsByFips.get("01007"),
      paint.colorsByFips.get("01009"),
      paint.colorsByFips.get("01011"),
      paint.colorsByFips.get("01013"),
      paint.colorsByFips.get("01015"),
      paint.colorsByFips.get("01017"),
      paint.colorsByFips.get("01019"),
    ];
    expect({
      colors,
      distinct: new Set(colors).size,
      missingLabel: paint.entries.some((entry) =>
        entry.label.includes("Missing")
      ),
      note: paint.note,
      ramp: paint.ramp,
      unit: paint.unit,
    }).toStrictEqual({
      colors: [
        "#FCE4EC",
        "#F7B6CF",
        "#E66A9A",
        "#BA3167",
        "#740D3D",
        UNINSURED_POPULATION_MISSING_COLOR,
        "var(--navy-2)",
        "var(--atlas-muted-text)",
        "hsl(200, 10%, 62%)",
        "hsl(28, 18%, 46%)",
      ],
      distinct: 10,
      missingLabel: true,
      note: expect.stringMatching(
        /civilian, noninstitutionalized population[\s\S]*does not show whether residents can obtain care/
      ),
      ramp: UNINSURED_POPULATION_RAMP,
      unit: "percent",
    });
  });

  it("leaves social vulnerability and the six gap-score colors unchanged", () => {
    expect(REVIEW_SCORE_RAMP_COLORS).toStrictEqual([
      "#a9d2db",
      "#55a8a3",
      "#87b982",
      "#efc64a",
      "#f49a32",
      "#e9602b",
    ]);
    const svi = paintExplorerMapLayer({
      counties: [],
      layerId: "svi",
      observation: {
        omitted: 0,
        period: "Vintage 2022.",
        rows: [
          row("08001", ValueState.ZERO, 0),
          row("08013", ValueState.OBSERVED, 1),
          row("08014", ValueState.MISSING, null),
        ],
        sourceLabel: "CDC/ATSDR Social Vulnerability Index",
        status: "ready",
        unit: "percentile",
      },
      scoresStatus: "ready",
    });
    expect({
      high: svi.colorsByFips.get("08013"),
      low: svi.colorsByFips.get("08001"),
      missing: svi.colorsByFips.get("08014"),
      ramp: svi.ramp,
    }).toStrictEqual({
      high: SVI_RAMP.at(-1),
      low: SVI_RAMP[0],
      missing: SVI_NO_DATA_COLOR,
      ramp: SVI_RAMP,
    });
    const gap = paintExplorerMapLayer({
      counties: [
        {
          burgdorferi_status: "No records",
          color: "#e9602b",
          county: "Adams",
          evidence_completeness: 40,
          fips: "08001",
          scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    expect(gap.colorsByFips.get("08001")).toBe("#e9602b");
  });
});
