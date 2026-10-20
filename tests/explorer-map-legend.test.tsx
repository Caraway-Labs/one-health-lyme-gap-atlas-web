import { Color } from "@maplibre/maplibre-gl-style-spec";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  LYME_INCIDENCE_RAMP,
  mixExplorerRampColor,
  SVI_HIGH_LABEL,
  SVI_LOW_LABEL,
  SVI_RAMP,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";
import type { CountyScoreSummary } from "@/generated/models";
import { ValueState } from "@/generated/models";
import { responseTierPresentationForColor } from "@/lib/response-tier";

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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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

function numericRow(
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

function quantityPaint(
  layerId: "incidence_floor" | "svi" | "uninsured",
  rows: ExplorerMapNumericRow[],
  unit: string
) {
  return paintExplorerMapLayer({
    counties: [],
    layerId,
    observation: {
      omitted: 0,
      period: "Published period.",
      rows,
      sourceLabel: "Published source",
      status: "ready",
      unit,
    },
    scoresStatus: "ready",
  });
}

function swatchStyle(name: RegExp | string): string {
  return (
    screen
      .getByRole("button", { name })
      .querySelector("span")
      ?.getAttribute("style") ?? ""
  );
}

function paintedBackground(name: RegExp | string): string {
  const style = swatchStyle(name);
  const marker = "background:";
  const start = style.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const value = style.slice(start + marker.length);
  const end = value.indexOf(";");
  return (end === -1 ? value : value.slice(0, end)).trim();
}

function gapScoreRangeTitle(band: (typeof SCORE_COLOR_BANDS)[number]): string {
  if (band.maxExclusive === null) {
    return `Atlas gap score: ${band.minInclusive} or higher`;
  }
  return `Atlas gap score: ${band.minInclusive} to <${band.maxExclusive}`;
}

function operationalBandCopy(band: (typeof SCORE_COLOR_BANDS)[number]) {
  const presentation = responseTierPresentationForColor(band.color);
  if (!presentation) {
    throw new Error(`Missing response tier for ${band.color}`);
  }
  return {
    action: presentation.detail,
    category: presentation.title,
    title: gapScoreRangeTitle(band),
  };
}

function sameColor(left: string, right: string): boolean {
  const parsedLeft = Color.parse(left);
  const parsedRight = Color.parse(right);
  if (!(parsedLeft && parsedRight)) {
    return false;
  }
  return (
    Math.abs(parsedLeft.r - parsedRight.r) < 0.002 &&
    Math.abs(parsedLeft.g - parsedRight.g) < 0.002 &&
    Math.abs(parsedLeft.b - parsedRight.b) < 0.002
  );
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
    expect(legend.textContent).toContain("Gap score unavailable");
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
    expect(segments).toStrictEqual([
      "Gap score unavailable. Insufficient data to calculate a score",
      ...SCORE_COLOR_BANDS.map((band) => {
        const copy = operationalBandCopy(band);
        return `${copy.title}. ${copy.category}. ${copy.action}`;
      }),
    ]);
    expect(segments).toHaveLength(paint.entries.length);
  });

  it("matches each colored band tooltip to the operational response", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    const model = buildExplorerLegendModel(paint);
    const colored = model.segments.filter(
      (segment) => segment.disclosure?.category
    );
    const tooltipText = model.segments
      .map((segment) => segment.accessibleName)
      .join("\n");
    expect(
      colored.map((segment) => ({
        action: segment.disclosure?.action,
        category: segment.disclosure?.category,
      }))
    ).toStrictEqual(
      SCORE_COLOR_BANDS.map((band) => ({
        action: operationalBandCopy(band).action,
        category: operationalBandCopy(band).category,
      }))
    );
    expect(tooltipText).toContain("Conduct targeted follow-up");
    expect(tooltipText).toContain("Coordinate a local assessment");
    expect(tooltipText).toContain("Prioritize local investigation");
  });

  it("shows the seven gap-score disclosures without priority phrases", async () => {
    const user = userEvent.setup();
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
      scoresStatus: "ready",
    });
    render(<ExplorerMapLegend paint={paint} />);
    const expected = [
      {
        action: "Insufficient data to calculate a score",
        category: null,
        name: /Gap score unavailable/,
        title: "Gap score unavailable",
      },
      ...SCORE_COLOR_BANDS.map((band) => {
        const copy = operationalBandCopy(band);
        const fragment =
          band.maxExclusive === null
            ? `${band.minInclusive} or higher`
            : `${band.minInclusive} to <${band.maxExclusive}`;
        return {
          action: copy.action,
          category: copy.category,
          name: new RegExp(fragment.replaceAll("<", "\\<")),
          title: copy.title,
        };
      }),
    ];
    const seen: {
      action: string | null | undefined;
      category: string | null;
      priorityPhrases: boolean;
      swatch: boolean;
      title: string | null | undefined;
    }[] = [];
    for (const disclosure of expected) {
      await user.click(screen.getByRole("button", { name: disclosure.name }));
      const dialog = screen.getByRole("dialog", { name: disclosure.name });
      seen.push({
        action: dialog.querySelector(
          ".ux-reset-explorer-legend-disclosure-action"
        )?.textContent,
        category:
          dialog.querySelector(".ux-reset-explorer-legend-disclosure-category")
            ?.textContent ?? null,
        priorityPhrases: /Priority [12]/.test(dialog.textContent ?? ""),
        swatch: Boolean(
          dialog.querySelector("[data-legend-disclosure-swatch]")
        ),
        title: dialog.querySelector(
          ".ux-reset-explorer-legend-disclosure-title"
        )?.textContent,
      });
      await user.keyboard("{Escape}");
    }
    expect(seen).toStrictEqual(
      expected.map((disclosure) => ({
        action: disclosure.action,
        category: disclosure.category,
        priorityPhrases: false,
        swatch: true,
        title: disclosure.title,
      }))
    );
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
    expect(about.textContent).not.toContain("not personal disease risk");
    expect(about.textContent).toContain("Not zero");
    expect(about.textContent).toContain(
      "Lower Atlas priority — Not a safety finding"
    );
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

  it("shows a solid swatch for one nonzero incidence value", () => {
    const paint = quantityPaint(
      "incidence_floor",
      [numericRow("11001", ValueState.OBSERVED, 4.2, "4.2")],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const swatch = screen.getByRole("button", { name: /4\.2 per 100,000/ });
    expect(swatch.dataset.legendRole).toBe("endpoint-low");
    expect(
      sameColor(
        paintedBackground(/4\.2 per 100,000/),
        paint.colorsByFips.get("11001") ?? ""
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Color is mixed/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /No published value/ })
    ).toBeNull();
    expect(swatch.getAttribute("aria-label")).toMatch(
      /Every published number in this load is this value/
    );
  });

  it("shows one solid swatch when every incidence value repeats", () => {
    const paint = quantityPaint(
      "incidence_floor",
      [
        numericRow("11001", ValueState.OBSERVED, 4.2, "4.2"),
        numericRow("08001", ValueState.OBSERVED, 4.2, "4.2"),
      ],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    expect(
      screen.getAllByRole("button", { name: /4\.2 per 100,000/ })
    ).toHaveLength(1);
    expect(paint.colorsByFips.get("11001")).toBe(
      paint.colorsByFips.get("08001")
    );
    expect(
      sameColor(
        paintedBackground(/4\.2 per 100,000/),
        paint.colorsByFips.get("11001") ?? ""
      )
    ).toBeTruthy();
    expect(
      paint.entries.some((entry) => entry.role === "endpoint-high")
    ).toBeFalsy();
  });

  it("explains an all-zero incidence load as observed zero", () => {
    const paint = quantityPaint(
      "incidence_floor",
      [
        numericRow("11001", ValueState.ZERO, 0, "0"),
        numericRow("08001", ValueState.ZERO, 0, "0"),
      ],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const swatch = screen.getByRole("button", { name: /0 per 100,000/ });
    expect(swatch.getAttribute("aria-label")).toMatch(/Observed zero/);
    expect(swatch.getAttribute("aria-label")).toMatch(/not a missing value/);
    expect(
      sameColor(
        paintedBackground(/0 per 100,000/),
        paint.colorsByFips.get("11001") ?? ""
      )
    ).toBeTruthy();
    expect(paint.colorsByFips.get("11001")).not.toBe(
      "var(--explorer-boundary)"
    );
    expect(screen.queryByRole("button", { name: /Color is mixed/ })).toBeNull();
  });

  it("keeps a constant incidence value beside missing rows", () => {
    const paint = quantityPaint(
      "incidence_floor",
      [
        numericRow("11001", ValueState.OBSERVED, 8, "8"),
        numericRow("08001", ValueState.MISSING, null, null),
      ],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const swatch = screen.getByRole("button", { name: /8 per 100,000/ });
    const missing = screen.getByRole("button", { name: /Missing \(not zero/ });
    expect(
      sameColor(
        paintedBackground(/8 per 100,000/),
        paint.colorsByFips.get("11001") ?? ""
      )
    ).toBeTruthy();
    expect(missing.dataset.legendRole).toBe("missing");
    expect(swatchStyle(/Missing \(not zero/)).not.toContain(
      paint.colorsByFips.get("11001") ?? "painted"
    );
    expect(swatch.getAttribute("aria-label")).toMatch(
      /Every published number in this load is this value/
    );
    expect(screen.queryByRole("button", { name: /Color is mixed/ })).toBeNull();
  });

  it("names the open segment popover with the layer and the value", async () => {
    const user = userEvent.setup();
    const paint = quantityPaint(
      "incidence_floor",
      [numericRow("11001", ValueState.OBSERVED, 4.2, "4.2")],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    await user.click(screen.getByRole("button", { name: /4\.2 per 100,000/ }));
    expect(
      screen.getByRole("dialog", {
        name: "Lyme incidence floor: Lower published incidence 4.2 per 100,000 residents. Every published number in this load is this value.",
      })
    ).toBeTruthy();
  });

  it("matches incidence quarter and midpoint colors to the map", () => {
    const paint = quantityPaint(
      "incidence_floor",
      [
        numericRow("08001", ValueState.ZERO, 0, "0"),
        numericRow("08005", ValueState.OBSERVED, 10, "10"),
        numericRow("08013", ValueState.OBSERVED, 20, "20"),
        numericRow("11001", ValueState.OBSERVED, 40, "40"),
      ],
      "per 100,000"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const low = paint.entries.find((entry) => entry.role === "endpoint-low");
    const high = paint.entries.find((entry) => entry.role === "endpoint-high");
    const quarter = paint.colorsByFips.get("08005") ?? "";
    const midpoint = paint.colorsByFips.get("08013") ?? "";
    const style = swatchStyle(/pale green to deep green/);
    expect({
      high: high?.color,
      low: low?.color,
      midpoint,
      quarter,
    }).toStrictEqual({
      high: LYME_INCIDENCE_RAMP.at(-1),
      low: LYME_INCIDENCE_RAMP[0],
      midpoint: mixExplorerRampColor(LYME_INCIDENCE_RAMP, 0.5),
      quarter: mixExplorerRampColor(LYME_INCIDENCE_RAMP, 0.25),
    });
    expect(style).toContain(`${quarter} 25%`);
    expect(style).toContain(`${midpoint} 50%`);
    expect({
      higher: screen.queryByText(/Higher published incidence/) !== null,
      lower: screen.queryByText(/Lower published incidence/) !== null,
      unit: screen.queryByText(/per 100,000 residents/) !== null,
    }).toStrictEqual({ higher: true, lower: true, unit: true });
  });

  it("matches social vulnerability quarter and midpoint colors to the map", () => {
    const paint = quantityPaint(
      "svi",
      [
        numericRow("08001", ValueState.ZERO, 0, "0"),
        numericRow("08005", ValueState.OBSERVED, 0.25, "0.25"),
        numericRow("08013", ValueState.OBSERVED, 0.5, "0.5"),
        numericRow("11001", ValueState.OBSERVED, 1, "1"),
      ],
      "percentile"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const low = paint.entries.find((entry) => entry.role === "endpoint-low");
    const high = paint.entries.find((entry) => entry.role === "endpoint-high");
    const quarter = paint.colorsByFips.get("08005") ?? "";
    const midpoint = paint.colorsByFips.get("08013") ?? "";
    const style = swatchStyle(/Lower social vulnerability/);
    expect({
      high: high?.color,
      low: low?.color,
      midpoint,
      quarter,
    }).toStrictEqual({
      high: SVI_RAMP.at(-1),
      low: SVI_RAMP[0],
      midpoint: mixExplorerRampColor(SVI_RAMP, 0.5),
      quarter: mixExplorerRampColor(SVI_RAMP, 0.25),
    });
    expect({
      high: style.includes(SVI_RAMP.at(-1) ?? ""),
      low: style.includes(SVI_RAMP[0]),
      midpoint: style.includes(`${midpoint} 50%`),
      quarter: style.includes(`${quarter} 25%`),
    }).toStrictEqual({
      high: true,
      low: true,
      midpoint: true,
      quarter: true,
    });
    expect({
      higher: screen.queryByText(new RegExp(SVI_HIGH_LABEL)) !== null,
      lower: screen.queryByText(new RegExp(SVI_LOW_LABEL)) !== null,
      percentOfResidents: screen.queryByText(/percent of residents/) !== null,
      unit: screen.queryByText(/percentile/) !== null,
    }).toStrictEqual({
      higher: true,
      lower: true,
      percentOfResidents: false,
      unit: true,
    });
  });

  it("matches uninsured quarter and midpoint colors to the map", () => {
    const paint = quantityPaint(
      "uninsured",
      [
        numericRow("08001", ValueState.ZERO, 0, "0"),
        numericRow("08005", ValueState.OBSERVED, 25, "25"),
        numericRow("08013", ValueState.OBSERVED, 50, "50"),
        numericRow("11001", ValueState.OBSERVED, 100, "100"),
      ],
      "percent"
    );
    render(<ExplorerMapLegend paint={paint} />);
    const low = paint.entries.find((entry) => entry.role === "endpoint-low");
    const high = paint.entries.find((entry) => entry.role === "endpoint-high");
    const quarter = paint.colorsByFips.get("08005") ?? "";
    const midpoint = paint.colorsByFips.get("08013") ?? "";
    const style = swatchStyle(/pale rose to deep burgundy/);
    expect({
      high: high?.color,
      low: low?.color,
      midpoint,
      quarter,
    }).toStrictEqual({
      high: UNINSURED_POPULATION_RAMP.at(-1),
      low: UNINSURED_POPULATION_RAMP[0],
      midpoint: mixExplorerRampColor(UNINSURED_POPULATION_RAMP, 0.5),
      quarter: mixExplorerRampColor(UNINSURED_POPULATION_RAMP, 0.25),
    });
    expect(style).toContain(`${quarter} 25%`);
    expect(style).toContain(`${midpoint} 50%`);
    expect({
      higher: screen.queryByText(/Higher uninsured percentage/) !== null,
      lower: screen.queryByText(/Lower uninsured percentage/) !== null,
      unit: screen.queryByText(/· percent/) !== null,
    }).toStrictEqual({ higher: true, lower: true, unit: true });
  });

  it("keeps one clipped pill and shortens it as categories drop", () => {
    const pathogen = paintExplorerMapLayer({
      counties: [
        county("08013", { burgdorferi_status: "No records" }),
        county("08001", { burgdorferi_status: "Present" }),
      ],
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    const tick = paintExplorerMapLayer({
      counties: [
        county("08013", { tick_status: "No records" }),
        county("08005", { fips: "08005", tick_status: "Reported" }),
        county("08001", { tick_status: "Established" }),
      ],
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    const gap = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    const incidence = quantityPaint(
      "incidence_floor",
      [
        numericRow("08001", ValueState.OBSERVED, 0, "0"),
        numericRow("08005", ValueState.UNAVAILABLE, null, null),
        numericRow("11001", ValueState.OBSERVED, 12, "12"),
      ],
      "per 100,000"
    );
    render(
      <>
        <ExplorerMapLegend paint={pathogen} />
        <ExplorerMapLegend paint={tick} />
        <ExplorerMapLegend paint={gap} />
        <ExplorerMapLegend paint={incidence} />
      </>
    );
    const shape = (name: string) => {
      const legend = screen.getByRole("region", { name });
      const strip = legend.querySelector<HTMLElement>(
        ".ux-reset-explorer-legend-strip"
      );
      const pill = legend.querySelector<HTMLElement>(
        ".ux-reset-explorer-legend-pill"
      );
      return {
        count: strip?.dataset.legendCount,
        fill: strip?.dataset.legendFill,
        pill: pill?.querySelectorAll("[data-legend-pill-segment]").length,
        width: strip?.style.getPropertyValue("--legend-count"),
      };
    };
    expect({
      gap: shape("Atlas gap score map legend"),
      incidence: shape("Lyme incidence floor map legend"),
      pathogen: shape("B. burgdorferi status map legend"),
      tick: shape("Blacklegged tick status map legend"),
    }).toStrictEqual({
      gap: { count: "7", fill: "count", pill: 7, width: "7" },
      incidence: { count: "2", fill: "full", pill: 2, width: "7" },
      pathogen: { count: "2", fill: "count", pill: 2, width: "2" },
      tick: { count: "3", fill: "count", pill: 3, width: "3" },
    });
    const pathogenLegend = screen.getByRole("region", {
      name: "B. burgdorferi status map legend",
    });
    expect(
      pathogenLegend.textContent?.includes("(not zero, not confirmed absence)")
    ).toBeTruthy();
    const colors = [
      ...pathogenLegend.querySelectorAll<HTMLElement>(
        ".ux-reset-explorer-legend-pill [data-legend-pill-segment]"
      ),
    ].map((segment) => segment.style.background);
    const buttonColors = [
      ...pathogenLegend.querySelectorAll<HTMLElement>("[data-legend-segment]"),
    ].map((segment) => segment.querySelector("span")?.style.background);
    expect(colors).toStrictEqual(buttonColors);
  });
});
