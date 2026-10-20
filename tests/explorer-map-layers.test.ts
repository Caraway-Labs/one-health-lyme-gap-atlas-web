import { describe, expect, it } from "vitest";

import { mapFeatureCompleteness } from "@/components/atlas-map";
import {
  EXPLORER_MAP_LAYERS,
  explorerMapLayerMenuLabel,
  paintExplorerMapLayer,
  parseExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import { TICK_STATUS_EXTRA_COLORS } from "@/features/ux-reset/review/tick-status-contract";
import type { CountyScoreSummary } from "@/generated/models";
import { ValueState } from "@/generated/models";

function readyObservation(
  layerId: "incidence_floor" | "rurality" | "svi" | "uninsured",
  rows: ExplorerMapNumericRow[],
  omitted: number,
  unit: string
) {
  return paintExplorerMapLayer({
    counties: [],
    layerId,
    observation: {
      omitted,
      period: "Published period.",
      rows,
      sourceLabel: "Published source",
      status: "ready",
      unit,
    },
    scoresStatus: "ready",
  });
}

function neutralKey(
  paint: ReturnType<typeof paintExplorerMapLayer>
): { color: string; detail: string | null } | undefined {
  const entry = paint.entries.find(
    (candidate) => candidate.label === "No published value"
  );
  if (!entry) {
    return undefined;
  }
  return { color: entry.color, detail: entry.detail };
}

function observedZeroColor(
  paint: ReturnType<typeof paintExplorerMapLayer>
): string | undefined {
  return paint.entries.find((entry) => entry.label.includes("observed zero"))
    ?.color;
}

function ruralityRow(fips: string, code: number): ExplorerMapNumericRow {
  return {
    ...observationRow(fips, ValueState.OBSERVED, code, String(code)),
    categoryLabel: "metro area of 1 million or more",
  };
}

function observationRow(
  fips: string,
  valueState: ValueState,
  numeric: number | null,
  raw: string | null
): ExplorerMapNumericRow {
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

function county(
  fips: string,
  patch: Partial<CountyScoreSummary> = {}
): CountyScoreSummary {
  return {
    burgdorferi_status: "Detected",
    color: "#123456",
    county: "Cedar",
    evidence_completeness: 40,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Priority 2",
    score: {
      access_signal: 1,
      community: 1,
      ecological: 1,
      human_weakness: 1,
      pathogen_signal: 1,
      rural_signal: 1,
      score: 10,
      svi_signal: 1,
      tick_signal: 1,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "Established",
    ...patch,
  };
}

const legendSources = [
  {
    key: "human",
    label: "CDC Lyme surveillance",
    vintage: "2023",
  },
  {
    key: "tick",
    label: "CDC ArboNET county tick status",
    vintage: "through 2025-12-31",
  },
  {
    key: "pathogen",
    label: "CDC ArboNET tickborne pathogen status",
    vintage: "through 2025-12-31",
  },
];

describe("Explorer map layers", () => {
  it("renames only the gap-score menu label", () => {
    const gapScore = EXPLORER_MAP_LAYERS.find(
      (layer) => layer.id === "gap_score"
    );
    const otherLayers = EXPLORER_MAP_LAYERS.filter(
      (layer) => layer.id !== "gap_score"
    );
    expect({
      id: gapScore?.id,
      label: gapScore?.label,
      menu: gapScore ? explorerMapLayerMenuLabel(gapScore) : null,
      otherMenus: otherLayers.map((layer) => explorerMapLayerMenuLabel(layer)),
      otherLabels: otherLayers.map((layer) => layer.label),
    }).toStrictEqual({
      id: "gap_score",
      label: "Atlas gap score",
      menu: "Gap review score",
      otherMenus: otherLayers.map((layer) => layer.label),
      otherLabels: otherLayers.map((layer) => layer.label),
    });
  });

  it("keeps governed layer ids in the URL and does not paint them before they validate", () => {
    expect({
      completeness: parseExplorerMapLayerId("completeness"),
      gap: parseExplorerMapLayerId("gap_score"),
      incidence: parseExplorerMapLayerId("incidence_floor"),
      invalid: parseExplorerMapLayerId("not-a-layer"),
      rurality: parseExplorerMapLayerId("rurality"),
      svi: parseExplorerMapLayerId("svi"),
      uninsured: parseExplorerMapLayerId("uninsured"),
    }).toStrictEqual({
      completeness: "completeness",
      gap: "gap_score",
      incidence: "incidence_floor",
      invalid: null,
      rurality: "rurality",
      svi: "svi",
      uninsured: "uninsured",
    });
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "incidence_floor",
      observation: {
        reason:
          "No admitted observations were published for this measure on the current release.",
        status: "error",
      },
      scoresStatus: "ready",
    });
    expect(paint.kind).toBe("unavailable");
    expect(paint.colorsByFips.size).toBe(0);
    expect(paint.note).toMatch(/No admitted observations/);
  });

  it("copies published gap-score colors and skips a blank color", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001"),
        county("08013", { color: "  ", fips: "08013" }),
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    expect({
      color: paint.colorsByFips.get("08001"),
      missing: paint.colorsByFips.has("08013"),
      title: paint.title,
      unit: paint.unit,
    }).toStrictEqual({
      color: "#123456",
      missing: false,
      title: "Atlas gap score",
      unit: "review-priority score",
    });
    expect(paint.note).not.toMatch(/not zero/);
    expect(paint.note).not.toMatch(/not personal disease risk/);
    expect(paint.note).toMatch(/published score colors/);
    expect(paint.entries.map((entry) => entry.label)).toContain(
      "Gap score unavailable"
    );
  });

  it("keeps every painted gap-score color when one priority label spans two colors", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", {
          color: "#a9d2db",
          priority: "Lower Atlas priority — Not a safety finding",
          score: { ...county("08001").score, score: 12 },
        }),
        county("08005", {
          color: "#55a8a3",
          fips: "08005",
          priority: "Lower Atlas priority — Not a safety finding",
          score: { ...county("08005").score, score: 21 },
        }),
        county("36001", {
          color: "#55a8a3",
          fips: "36001",
          priority: "Watch — Monitor signals",
          score: { ...county("36001").score, score: 32 },
          state: "NY",
        }),
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.get("08001")).toBe("#a9d2db");
    expect(paint.colorsByFips.get("08005")).toBe("#55a8a3");
    const labels = paint.entries.map(
      (entry) => `${entry.label} · ${entry.detail}`
    );
    expect(labels).toContain(
      "0 to less than 20 · Lower Atlas priority — Not a safety finding"
    );
    expect(labels).toContain(
      "20 to less than 35 · Lower Atlas priority — Not a safety finding; Watch — Monitor signals"
    );
    expect(
      labels.filter((label) => label.startsWith("0 to less than 20"))
    ).toHaveLength(1);
  });

  it("does not claim a score band when painted scores fall outside it", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", {
          color: "#a9d2db",
          priority: "Priority 2 — Review",
          score: { ...county("08001").score, score: 55 },
        }),
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    const mismatched = paint.entries.find((entry) => entry.color === "#a9d2db");
    expect(mismatched?.label).toBe("Published score 55");
    expect(mismatched?.label).not.toMatch(/less than 20/);
  });

  it("uses the same band for an adjusted scenario color token", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", {
          color: "var(--map-ramp-6)",
          priority: "Adjusted scenario · Priority 1 — Investigate",
          score: { ...county("08001").score, score: 80 },
        }),
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    const band = paint.entries.find(
      (entry) => entry.color === "var(--map-ramp-6)"
    );
    expect(band?.label).toBe("75 or higher");
    expect(paint.entries[0]?.label).toBe("Gap score unavailable");
  });

  it("does not paint a failed gap-score request as that layer", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "gap_score",
      scoresStatus: "error",
    });
    expect(paint.title).toBe("County boundaries");
    expect(paint.colorsByFips.size).toBe(0);
    expect(paint.note).toMatch(/county boundaries only/);
  });

  it("keeps tick status distinct from the numeric score", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", { tick_status: "Established" }),
        county("08013", { fips: "08013", tick_status: "No records" }),
      ],
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    expect({
      established: paint.colorsByFips.get("08001"),
      noRecords: paint.colorsByFips.get("08013"),
      ramp: paint.colorsByFips.get("08001")?.includes("map-ramp") ?? false,
      unit: paint.unit,
    }).toStrictEqual({
      established: "#174B78",
      noRecords: "#DDE4E7",
      ramp: false,
      unit: "published status category",
    });
    expect(paint.entries.map((entry) => entry.label)).toContain(
      "No records (not zero, not confirmed absence)"
    );
    expect(paint.note).toMatch(/not a continuous risk gradient/);
  });

  it("keeps an observed zero distinct from no records", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", { burgdorferi_status: "Absent" }),
        county("08013", {
          burgdorferi_status: "No records",
          fips: "08013",
        }),
        county("11001", {
          burgdorferi_status: "Unknown",
          fips: "11001",
          state: "DC",
        }),
      ],
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.get("08001")).toBe("hsl(16,72%,42%)");
    expect(paint.colorsByFips.get("08013")).toBe("#DDE4E7");
    expect(paint.colorsByFips.get("11001")).toBe("hsl(270,46%,40%)");
    expect(paint.colorsByFips.get("08001")).not.toBe(
      paint.colorsByFips.get("08013")
    );
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "No records (not zero, not confirmed absence)",
      "Absent (observed zero or negative finding)",
      "Unknown",
    ]);
  });

  it("shows only the tick vintage on the tick layer", () => {
    const tick = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "tick_status",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: legendSources,
    });
    expect(tick.period).toContain(
      "CDC ArboNET county tick status through 2025-12-31"
    );
    expect(tick.period).not.toContain("CDC Lyme surveillance");
  });

  it("lists the gap-score input vintages with the release", () => {
    const gap = paintExplorerMapLayer({
      counties: [county("08001", { color: "#a9d2db" })],
      layerId: "gap_score",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: legendSources,
    });
    expect(gap.period).toContain("Release alpha-2026");
    expect(gap.period).toContain("CDC Lyme surveillance 2023");
  });

  it("does not attach an evidence vintage to county boundaries", () => {
    const boundaries = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "boundaries",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: legendSources,
    });
    expect(boundaries.period).toMatch(/not an evidence layer/);
    expect(boundaries.entries).toStrictEqual([
      {
        color: "var(--explorer-boundary)",
        detail: null,
        label: "County boundary",
      },
    ]);
  });

  it("says the source vintage is unavailable instead of inventing one", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    expect(paint.period).toBe("Pathogen status vintage unavailable");
  });

  it("keeps an unavailable vintage for every missing gap-score source", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001", { color: "#a9d2db" })],
      layerId: "gap_score",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: [
        {
          key: "human",
          label: "CDC Lyme surveillance",
          vintage: "2023",
        },
        {
          key: "pathogen",
          label: "CDC ArboNET tickborne pathogen status",
          vintage: "  ",
        },
      ],
    });
    expect(paint.period).toBe(
      "Release alpha-2026. CDC Lyme surveillance 2023 · Tick status vintage unavailable · CDC ArboNET tickborne pathogen status vintage unavailable · Social vulnerability vintage unavailable · Rural-urban codes vintage unavailable"
    );
  });

  it("gives unrecognized categories colors that are not already used", () => {
    const extras = [
      "Detected",
      "Suspect",
      "Possible",
      "Endemic",
      "Emerging",
      "Local",
      "Imported",
      "Widespread",
    ];
    const reserved = new Set([
      "var(--atlas-muted-text)",
      "var(--explorer-boundary)",
      "var(--mint)",
      "var(--navy)",
      "var(--navy-2)",
      "var(--teal)",
      "var(--teal-dark)",
    ]);
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", { tick_status: "Unknown" }),
        county("08005", { tick_status: "No records" }),
        county("08013", { tick_status: "Unavailable" }),
        ...extras.map((status, index) =>
          county(`0802${index}`, { tick_status: status })
        ),
      ],
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    const byLabel = new Map(
      paint.entries.map((entry) => [entry.label, entry.color])
    );
    const extraColors = extras.map((status) => byLabel.get(status) ?? "");
    expect({
      detected: extraColors[0]?.startsWith("hsl(") ?? false,
      distinct: new Set(extraColors).size,
      paintable: extraColors.every(
        (color) => color.startsWith("hsl(") && !color.includes("color-mix")
      ),
      reserved: extraColors.some((color) => reserved.has(color)),
      unknown: byLabel.get("Unknown"),
    }).toStrictEqual({
      detected: true,
      distinct: extras.length,
      paintable: true,
      reserved: false,
      unknown: TICK_STATUS_EXTRA_COLORS.Unknown,
    });
  });

  it("paints the published incidence floor without turning missing into zero", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001", { color: "#e9602b" })],
      layerId: "incidence_floor",
      observation: {
        omitted: 1,
        period: "2023-01-01 through 2023-12-31.",
        rows: [
          observationRow("06037", ValueState.OBSERVED, 0.15, "0.15"),
          observationRow("01001", ValueState.MISSING, null, null),
        ],
        sourceLabel: "CDC Lyme surveillance",
        status: "ready",
        unit: "per 100,000",
      },
      scoresStatus: "ready",
    });
    expect({
      alabama: paint.colorsByFips.get("01001"),
      gap: paint.entries.some((entry) => entry.label.includes("gap")),
      losAngeles: paint.colorsByFips.get("06037"),
      missing: paint.entries.some((entry) =>
        entry.label.includes("Missing (not zero and not a low value)")
      ),
      unpainted: paint.colorsByFips.get("08001"),
    }).toStrictEqual({
      alabama: "#D1D5DB",
      gap: false,
      losAngeles: "#E5F5E0",
      missing: true,
      unpainted: undefined,
    });
    expect(paint.note).toMatch(/minimums/);
    expect(paint.note).toMatch(/not all infections/);
    expect(paint.note).toMatch(/not an exact total incidence/);
    expect(paint.note).toMatch(/review ranking/);
  });

  it("does not invent a numeric endpoint when every published value is missing", () => {
    const missingRows = [
      observationRow("01001", ValueState.MISSING, null, null),
      observationRow("08001", ValueState.MISSING, null, null),
    ];
    const incidence = paintExplorerMapLayer({
      counties: [],
      layerId: "incidence_floor",
      observation: {
        omitted: 0,
        period: "2023-01-01 through 2023-12-31.",
        rows: missingRows,
        sourceLabel: "CDC Lyme surveillance",
        status: "ready",
        unit: "per 100,000",
      },
      scoresStatus: "ready",
    });
    const svi = paintExplorerMapLayer({
      counties: [],
      layerId: "svi",
      observation: {
        omitted: 0,
        period: "Vintage 2022.",
        rows: missingRows,
        sourceLabel: "CDC/ATSDR Social Vulnerability Index",
        status: "ready",
        unit: "percentile",
      },
      scoresStatus: "ready",
    });
    expect({
      incidence: incidence.entries.map((entry) => entry.label),
      svi: svi.entries.map((entry) => entry.label),
    }).toStrictEqual({
      incidence: ["Missing (not zero and not a low value)"],
      svi: ["Missing (not zero and not a low value)"],
    });
    expect(incidence.colorsByFips.get("01001")).toBe("#D1D5DB");
    expect(svi.colorsByFips.get("08001")).toBe("var(--mint)");
  });

  it("drops the previous layer's scale on the next paint", () => {
    const counties = [
      county("08001", { tick_status: "Established" }),
      county("08013", { fips: "08013", tick_status: "No records" }),
    ];
    const tick = paintExplorerMapLayer({
      counties,
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    const gap = paintExplorerMapLayer({
      counties,
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    expect(
      tick.entries.some((entry) => entry.label.startsWith("Established"))
    ).toBeTruthy();
    expect(
      gap.entries.some((entry) => entry.label.startsWith("Established"))
    ).toBeFalsy();
    expect(gap.layerId).toBe("gap_score");
  });

  it("paints published completeness integers and leaves an out-of-range value unpainted", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("01001", { evidence_completeness: 67 }),
        county("08001", { evidence_completeness: 50, fips: "08001" }),
        county("08013", { evidence_completeness: 140, fips: "08013" }),
      ],
      layerId: "completeness",
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.get("01001")).not.toBe(
      paint.colorsByFips.get("08001")
    );
    expect(paint.colorsByFips.has("08013")).toBeFalsy();
    expect(paint.note).toMatch(/does not recompute/);
    expect(paint.note).toMatch(/uninsured percentile/);
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "50",
      "67",
      "No published value",
    ]);
  });

  it("keeps a gray key when incidence, SVI, or uninsured omits a requested county", () => {
    const incidence = readyObservation(
      "incidence_floor",
      [
        observationRow("08001", ValueState.OBSERVED, 3.5, "3.5"),
        observationRow("11001", ValueState.ZERO, 0, "0"),
      ],
      1,
      "per 100,000"
    );
    const svi = readyObservation(
      "svi",
      [
        observationRow("08001", ValueState.OBSERVED, 0.4, "0.4"),
        observationRow("11001", ValueState.ZERO, 0, "0"),
      ],
      1,
      "percentile"
    );
    const uninsured = readyObservation(
      "uninsured",
      [
        observationRow("08001", ValueState.OBSERVED, 12.5, "12.5"),
        observationRow("11001", ValueState.ZERO, 0, "0"),
      ],
      1,
      "percent"
    );
    const boundary = "var(--explorer-boundary)";
    expect({
      incidence: neutralKey(incidence)?.color,
      svi: neutralKey(svi)?.color,
      uninsured: neutralKey(uninsured)?.color,
    }).toStrictEqual({
      incidence: boundary,
      svi: boundary,
      uninsured: boundary,
    });
    expect(neutralKey(incidence)?.detail).toMatch(/Not zero/);
    expect(observedZeroColor(incidence)).not.toBe(boundary);
    expect(observedZeroColor(svi)).not.toBe(boundary);
    expect(observedZeroColor(uninsured)).not.toBe(boundary);
  });

  it("keeps a gray rurality key when a requested county is omitted", () => {
    const paint = readyObservation(
      "rurality",
      [ruralityRow("11001", 1)],
      1,
      "rural-urban code"
    );
    expect(neutralKey(paint)?.color).toBe("var(--explorer-boundary)");
    expect(neutralKey(paint)?.detail).toMatch(/Not zero/);
    expect(
      paint.entries.filter((entry) => entry.role === "class")
    ).toHaveLength(9);
    expect(paint.colorsByFips.get("11001")).toBe("hsl(210, 55%, 42%)");
    expect(paint.colorsByFips.get("11001")).not.toBe(
      "var(--explorer-boundary)"
    );
  });

  it("keeps a missing map completeness value missing", () => {
    expect(mapFeatureCompleteness()).toBeNull();
    expect(mapFeatureCompleteness(null)).toBeNull();
    expect(mapFeatureCompleteness(0)).toBe(0);
    expect(mapFeatureCompleteness(67)).toBe(67);
  });
});
