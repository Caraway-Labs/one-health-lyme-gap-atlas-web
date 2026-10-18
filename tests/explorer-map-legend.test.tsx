import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

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
  afterEach(() => {
    cleanup();
  });

  it("keeps the gap-score strip thin", () => {
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
    expect(legend.dataset.legendLayer).toBe("gap_score");
    expect(legend.dataset.legendScale).toBe("segments");
    expect(legend.textContent).toContain("review-priority score");
    expect(legend.textContent).toContain("No data");
    expect(legend.textContent).toContain(">=75");
  });

  it("names the gray gap segment first and both crossover labels", () => {
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
    });
    render(<ExplorerMapLegend paint={paint} />);
    const segments = [
      ...screen
        .getByRole("region", { name: "Atlas gap score map legend" })
        .querySelectorAll("[data-legend-segment]"),
    ].map((segment) => segment.getAttribute("aria-label") ?? "");
    expect(segments).toHaveLength(paint.entries.length);
    expect(segments[0]).toMatch(/No published value[\s\S]*Not zero/);
    expect(segments[1]).toMatch(/0 to <20[\s\S]*Not a safety finding/);
    expect(segments[2]).toMatch(
      /20 to <35[\s\S]*Lower Atlas priority[\s\S]*Monitor signals/
    );
    expect(segments.at(-1)).toMatch(/>=75[\s\S]*Investigate/);
  });

  it("keeps scientific caveats in the layer info popover", async () => {
    const user = userEvent.setup();
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
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
    expect(
      screen.getByRole("region", { name: "Atlas gap score map legend" })
        .textContent
    ).not.toContain("not personal disease risk");
    await user.click(
      screen.getByRole("button", { name: "About Atlas gap score" })
    );
    const about = screen.getByRole("dialog", { name: "About Atlas gap score" });
    expect(about.textContent).toContain("CDC Lyme surveillance 2023");
    expect(about.textContent).toContain("not personal disease risk");
  });

  it("uses separate status segments instead of the score strip", async () => {
    const user = userEvent.setup();
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
    expect(legend.textContent).not.toContain("0 to <20");
    expect(legend.textContent).not.toContain("not a continuous risk gradient");
    expect(screen.getByRole("button", { name: "Established" })).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "About Blacklegged tick status" })
    );
    expect(
      screen.getByRole("dialog", { name: "About Blacklegged tick status" })
        .textContent
    ).toContain("not a continuous risk gradient");
  });
});
