import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { CountyScoreSummary } from "@/generated/models";

function county(
  fips: string,
  patch: Partial<CountyScoreSummary> = {}
): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#a9d2db",
    county: "Adams",
    evidence_completeness: 40,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 1,
      community: 1,
      ecological: 1,
      human_weakness: 1,
      pathogen_signal: 1,
      rural_signal: 1,
      score: 12,
      svi_signal: 1,
      tick_signal: 1,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "Established",
    ...patch,
  };
}

describe("Explorer map legend", () => {
  it("names the layer, unit, vintage, and every painted color in text", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001"),
        county("08013", { color: " ", fips: "08013" }),
        county("11001", {
          color: "#e9602b",
          fips: "11001",
          priority: "Priority 1 — Investigate",
          score: { ...county("11001").score, score: 80 },
          state: "DC",
          state_name: "District of Columbia",
        }),
      ],
      layerId: "gap_score",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: [
        {
          key: "human",
          label: "CDC Lyme surveillance",
          vintage: "2023",
        },
      ],
    });
    render(<ExplorerMapLegend paint={paint} />);
    const legend = screen.getByRole("region", {
      name: "Atlas gap score map legend",
    });
    const text = legend.textContent ?? "";
    expect({
      higher: text.includes("75 or higher"),
      lower: text.includes("0 to less than 20"),
      missing: text.includes(
        "No published value · Not zero, not low priority, and not confirmed absence"
      ),
      unit: text.includes("review-priority score"),
      vintage: text.includes("CDC Lyme surveillance 2023"),
    }).toStrictEqual({
      higher: true,
      lower: true,
      missing: true,
      unit: true,
      vintage: true,
    });
    expect(legend.querySelectorAll("[aria-hidden='true']")).toHaveLength(
      paint.entries.length
    );
    expect(legend.dataset.legendLayer).toBe("gap_score");
  });

  it("replaces the choropleth scale when the layer is categorical", () => {
    const paint = paintExplorerMapLayer({
      counties: [
        county("08001", { tick_status: "Established" }),
        county("08005", { fips: "08005", tick_status: "Reported" }),
      ],
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    render(<ExplorerMapLegend paint={paint} />);
    const legend = screen.getByRole("region", {
      name: "Blacklegged tick status map legend",
    });
    expect(legend.textContent).toContain("Established");
    expect(legend.textContent).toContain("Reported");
    expect(legend.textContent).not.toContain("0 to less than 20");
    expect(legend.textContent).toContain("not a continuous risk gradient");
  });
});
