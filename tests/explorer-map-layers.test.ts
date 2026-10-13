import { describe, expect, it } from "vitest";

import {
  paintExplorerMapLayer,
  parseExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";
import type { CountyScoreSummary } from "@/generated/models";

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
  it("rejects layers the scores collection cannot encode", () => {
    expect(parseExplorerMapLayerId("svi")).toBeNull();
    expect(parseExplorerMapLayerId("incidence_floor")).toBeNull();
    expect(parseExplorerMapLayerId("uninsured")).toBeNull();
    expect(parseExplorerMapLayerId("rurality")).toBeNull();
    expect(parseExplorerMapLayerId("gap_score")).toBe("gap_score");
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
    expect(paint.note).toMatch(/not zero/);
    expect(paint.note).toMatch(/not personal disease risk/);
    expect(paint.entries.map((entry) => entry.label)).toContain(
      "No published value"
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
    expect(paint.entries[0]?.label).toBe("Published score 55");
    expect(paint.entries[0]?.label).not.toMatch(/less than 20/);
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
    expect(paint.entries[0]?.label).toBe("75 or higher");
    expect(paint.entries[0]?.color).toBe("var(--map-ramp-6)");
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
      established: "var(--teal)",
      noRecords: "var(--atlas-muted-text)",
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
    expect(paint.colorsByFips.get("08001")).toBe("var(--teal-dark)");
    expect(paint.colorsByFips.get("08013")).toBe("var(--atlas-muted-text)");
    expect(paint.colorsByFips.get("11001")).toBe("var(--navy-2)");
    expect(paint.colorsByFips.get("08001")).not.toBe(
      paint.colorsByFips.get("08013")
    );
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "Absent (observed zero or negative finding)",
      "No records (not zero, not confirmed absence)",
      "Unknown (not zero, not confirmed absence)",
      "No published value",
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
    expect(paint.period).toBe("Source vintage unavailable.");
  });

  it("does not invent an incidence-floor scale", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "incidence_floor",
      scoresStatus: "ready",
    });
    expect(paint.kind).toBe("unavailable");
    expect(paint.colorsByFips.size).toBe(0);
    expect(paint.entries).toStrictEqual([]);
    expect(paint.note).toMatch(/lower bound/);
    expect(paint.note).not.toMatch(/0 to less than/);
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

  it("does not draw an out-of-range completeness value", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001", { evidence_completeness: 140 })],
      layerId: "completeness",
      scoresStatus: "ready",
    });
    expect(paint.colorsByFips.has("08001")).toBeFalsy();
  });
});
