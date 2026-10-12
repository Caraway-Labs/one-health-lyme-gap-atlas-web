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
    expect(paint.title).toBe("Atlas gap score");
    expect(paint.colorsByFips.get("08001")).toBe("#123456");
    expect(paint.colorsByFips.has("08013")).toBeFalsy();
    expect(paint.note).toMatch(/not zero/);
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
    expect(paint.colorsByFips.get("08001")).not.toBe("#123456");
    expect(paint.entries.map((entry) => entry.label)).toContain(
      "No records (not zero)"
    );
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
