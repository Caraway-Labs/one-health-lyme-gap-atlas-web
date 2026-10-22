import { describe, expect, it } from "vitest";

import {
  explorerLegendAboutPlainText,
  explorerLegendAboutSections,
  factualSourceYear,
  GAP_NO_SCORE_INFO,
  GAP_REVIEW_INFO_ROWS,
  plainLegendPeriod,
} from "@/features/ux-reset/review/explorer-legend-info-copy";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import type { ExplorerMapNumericRow } from "@/features/ux-reset/review/explorer-map-observation";
import type { CountyScoreSummary } from "@/generated/models";
import { ValueState } from "@/generated/models";

const REMOVED = [
  "This load",
  "Published integer",
  "Not recomputed in the browser",
  "The county list stays the review ranking",
  "Palette anchors",
  "How to read this layer",
  "Period and sources",
  "Darker teal means more components are available",
  "Select a county to see which components are available",
];

function county(fips: string): CountyScoreSummary {
  return {
    burgdorferi_status: "Present",
    color: "#55a8a3",
    county: "Adams",
    evidence_completeness: 67,
    fips,
    scoring_methodology_version: "surveillance-gap-score-v1.1",
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
      score: 21,
      svi_signal: 1,
      tick_signal: 1,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "Reported",
  };
}

function row(
  fips: string,
  valueState: ValueState,
  numeric: number | null,
  raw: string | null,
  categoryLabel: string | null = null
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
      measureId: "measure",
      methodology: null,
      methodologyId: null,
      methodologyVersion: "semantic_county_assembly_v1",
      observationId: `obs-${fips}`,
      periodEnd: null,
      periodStart: null,
      provenanceRef: "prov",
      publishedValue: raw,
      releaseId: "release-1",
      semanticVersion: "2.0.0",
      sourceId: "source",
      sourceLabel: "Published source",
      sourcePublishedAt: null,
      sourceUrl: null,
      sourceVintage: null,
      temporalGrain: "YEAR",
      unit: "per 100,000",
    },
    raw,
    valueState,
  };
}

function aboutText(paint: ReturnType<typeof paintExplorerMapLayer>): string {
  return explorerLegendAboutPlainText(explorerLegendAboutSections(paint));
}

describe("Explorer legend INFO copy", () => {
  it("uses Elevated for both intermediate gap categories and keeps Monitor the pattern", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001"), county("08005")],
      layerId: "gap_score",
      releaseId: "alpha-2026",
      scoresStatus: "ready",
      sources: [
        { key: "human", label: "CDC Lyme surveillance", vintage: "2023" },
      ],
    });
    const text = aboutText(paint);
    const model = buildExplorerLegendModel(paint);
    const categories = model.segments
      .map((segment) => segment.disclosure?.category)
      .filter((category): category is string => category !== null);
    expect({
      categories: categories.filter((category) => category === "Elevated"),
      monitorRow: GAP_REVIEW_INFO_ROWS[1],
      noScore: text.includes(
        `${GAP_NO_SCORE_INFO.score} | ${GAP_NO_SCORE_INFO.category} | ${GAP_NO_SCORE_INFO.action}`
      ),
      oldCategory:
        text.includes("| Monitor |") ||
        text.includes("Elevated review priority"),
      release: text.includes("Data release: alpha-2026"),
      row: text.includes("20 to <35 | Elevated | Monitor the pattern."),
      shows: text.includes("What this map shows"),
      verify: text.includes(
        "35 to <50 | Elevated | Verify with local information."
      ),
      verifyRow: GAP_REVIEW_INFO_ROWS[2],
    }).toMatchObject({
      categories: ["Elevated", "Elevated"],
      monitorRow: {
        action: "Monitor the pattern.",
        category: "Elevated",
        score: "20 to <35",
      },
      noScore: true,
      oldCategory: false,
      release: true,
      row: true,
      shows: true,
      verify: true,
      verifyRow: {
        action: "Verify with local information.",
        category: "Elevated",
        score: "35 to <50",
      },
    });
  });

  it("keeps the current completeness explanation and not the future availability text", () => {
    const paint = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "completeness",
      scoresStatus: "ready",
    });
    const text = aboutText(paint);
    expect({
      caveat: text.includes(
        "This measure combines data availability with positive tick and pathogen findings."
      ),
      conditions: text.includes(
        "A minimum reported Lyme case count is available."
      ),
      pathogen: text.includes("B. burgdorferi"),
      percent: text.includes("Published percentages in this view: 67."),
      removed: REMOVED.filter((phrase) => text.includes(phrase)),
    }).toStrictEqual({
      caveat: true,
      conditions: true,
      pathogen: true,
      percent: true,
      removed: [],
    });
  });

  it("writes the other seven layer explanations in the approved words", () => {
    const incidence = paintExplorerMapLayer({
      counties: [],
      layerId: "incidence_floor",
      observation: {
        omitted: 0,
        period: "CDC Lyme surveillance 2023. 2023-01-01 through 2023-12-31.",
        rows: [
          row("08001", ValueState.OBSERVED, 1.2, "1.2"),
          row("08005", ValueState.OBSERVED, 8, "8"),
        ],
        sourceLabel: "CDC Lyme surveillance",
        status: "ready",
        unit: "per 100,000",
      },
      scoresStatus: "ready",
    });
    const undated = paintExplorerMapLayer({
      counties: [],
      layerId: "incidence_floor",
      observation: {
        omitted: 0,
        period: "Published period.",
        rows: [row("08001", ValueState.OBSERVED, 1.2, "1.2")],
        sourceLabel: null,
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
        period: "ACS 2018-01-01 through 2022-12-31. Vintage 2024.",
        rows: [row("08001", ValueState.OBSERVED, 0.2, "0.2")],
        sourceLabel: "CDC/ATSDR",
        status: "ready",
        unit: "percentile",
      },
      scoresStatus: "ready",
    });
    const tick = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "tick_status",
      scoresStatus: "ready",
    });
    const pathogen = paintExplorerMapLayer({
      counties: [county("08001")],
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    const uninsured = paintExplorerMapLayer({
      counties: [],
      layerId: "uninsured",
      observation: {
        omitted: 0,
        period: "Source vintage unavailable.",
        rows: [row("08001", ValueState.ZERO, 0, "0")],
        sourceLabel: null,
        status: "ready",
        unit: "percent",
      },
      scoresStatus: "ready",
    });
    const rurality = paintExplorerMapLayer({
      counties: [],
      layerId: "rurality",
      observation: {
        omitted: 0,
        period: "Vintage 2023.",
        rows: [
          row(
            "08001",
            ValueState.OBSERVED,
            1,
            "1",
            "metro area of 1 million or more"
          ),
        ],
        sourceLabel: "USDA",
        status: "ready",
        unit: "rural-urban code",
      },
      scoresStatus: "ready",
    });
    const layers = [
      aboutText(incidence),
      aboutText(svi),
      aboutText(tick),
      aboutText(pathogen),
      aboutText(uninsured),
      aboutText(rurality),
    ];
    const incidenceText = aboutText(incidence);
    const undatedText = aboutText(undated);
    const sviText = aboutText(svi);
    expect({
      incidenceRange: incidenceText.includes(
        "Published values in this view run from 1.2 to 8 per 100,000."
      ),
      incidenceYear: incidenceText.includes(
        "published 2023 county data. Darker green means higher reported incidence."
      ),
      pathogen: aboutText(pathogen).includes("Borrelia burgdorferi"),
      pathogenLimit: aboutText(pathogen).includes(
        "A documented detection does not indicate what proportion of ticks are infected."
      ),
      removed: layers.flatMap((text) =>
        REMOVED.filter((phrase) => text.includes(phrase))
      ),
      rurality: aboutText(rurality).includes(
        "In a metropolitan area with at least 1 million people"
      ),
      ruralityGray: aboutText(rurality).includes(
        "Gray means a classification is unavailable."
      ),
      sviYear: sviText.includes(
        "the 2024 CDC/ATSDR Social Vulnerability Index"
      ),
      sviYearOld: sviText.includes("the 2022 CDC/ATSDR"),
      tick: aboutText(tick).includes(
        "Ticks have been documented, but records do not meet the criteria for an established population."
      ),
      title: incidence.title,
      undated: undatedText.includes("in the published county data"),
      undatedYear: undatedText.includes("2023"),
      uninsured: aboutText(uninsured).includes("Data year unavailable"),
      uninsuredZero: aboutText(uninsured).includes(
        "0% means a reported uninsured percentage of zero."
      ),
    }).toStrictEqual({
      incidenceRange: true,
      incidenceYear: true,
      pathogen: true,
      pathogenLimit: true,
      removed: [],
      rurality: true,
      ruralityGray: true,
      sviYear: true,
      sviYearOld: false,
      tick: true,
      title: "Minimum reported Lyme incidence",
      undated: true,
      undatedYear: false,
      uninsured: true,
      uninsuredZero: true,
    });
  });

  it("does not treat fixed SVI and uninsured color-scale bounds as published values", () => {
    const svi = paintExplorerMapLayer({
      counties: [],
      layerId: "svi",
      observation: {
        omitted: 0,
        period: "ACS 2018-01-01 through 2022-12-31. Vintage 2024.",
        rows: [row("08001", ValueState.OBSERVED, 0.2, "0.2")],
        sourceLabel: "CDC/ATSDR",
        status: "ready",
        unit: "percentile",
      },
      scoresStatus: "ready",
      selectedFips: "08001",
    });
    const uninsured = paintExplorerMapLayer({
      counties: [],
      layerId: "uninsured",
      observation: {
        omitted: 0,
        period: "ACS 2018-01-01 through 2022-12-31. Vintage 2024.",
        rows: [row("08001", ValueState.OBSERVED, 12, "12")],
        sourceLabel: "ACS",
        status: "ready",
        unit: "percent",
      },
      scoresStatus: "ready",
      selectedFips: "08001",
    });
    const sviText = aboutText(svi);
    const uninsuredText = aboutText(uninsured);
    const endpoint = (
      paint: ReturnType<typeof paintExplorerMapLayer>,
      role: "endpoint-high" | "endpoint-low"
    ) => paint.entries.find((entry) => entry.role === role)?.label ?? "";
    expect({
      sviClaimsScaleAsPublished:
        sviText.includes("Published values in this view run from 0 to 1") ||
        sviText.includes("Published value in this view: 0"),
      sviScale: sviText.includes("Values range from 0 to 1."),
      sviSelected: sviText.includes("Selected county 08001: 0.2 percentile."),
      sviLow: endpoint(svi, "endpoint-low"),
      sviHigh: endpoint(svi, "endpoint-high"),
      uninsuredClaimsScaleAsPublished:
        uninsuredText.includes(
          "Published values in this view run from 0 to 100"
        ) || uninsuredText.includes("Published value in this view: 0"),
      uninsuredSelected: uninsuredText.includes(
        "Selected county 08001: 12 percent."
      ),
      uninsuredLow: endpoint(uninsured, "endpoint-low"),
      uninsuredHigh: endpoint(uninsured, "endpoint-high"),
    }).toStrictEqual({
      sviClaimsScaleAsPublished: false,
      sviScale: true,
      sviSelected: true,
      sviLow: "0 (low end)",
      sviHigh: "1 (scale high end)",
      uninsuredClaimsScaleAsPublished: false,
      uninsuredSelected: true,
      uninsuredLow: "0 (low end)",
      uninsuredHigh: "100 (scale high end)",
    });
  });

  it("coordinates a factual year and relabels shared source wording", () => {
    expect({
      missing: factualSourceYear("Published period.", "2023"),
      period: plainLegendPeriod(
        "Release alpha-2026. Tick status vintage unavailable. Source vintage unavailable."
      ),
      vintage: factualSourceYear("Vintage 2024. 2018 through 2022.", "2022"),
    }).toStrictEqual({
      missing: null,
      period:
        "Data release: alpha-2026. Tick status data year unavailable. Data year unavailable.",
      vintage: "2024",
    });
  });
});
