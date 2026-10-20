import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LYME_INCIDENCE_RAMP } from "@/features/ux-reset/review/explorer-layer-palettes";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";
import {
  TICK_STATUS_ESTABLISHED_COLOR,
  TICK_STATUS_NO_RECORDS_COLOR,
  TICK_STATUS_REPORTED_COLOR,
} from "@/features/ux-reset/review/tick-status-contract";
import type { CountyScoreSummary } from "@/generated/models";

const NO_RECORDS = "#D1D5DB";
const PRESENT = "#4F46E5";

function county(
  fips: string,
  burgdorferiStatus: string,
  patch: Partial<CountyScoreSummary> = {}
): CountyScoreSummary {
  return {
    burgdorferi_status: burgdorferiStatus,
    color: "#a9d2db",
    county: "County",
    evidence_completeness: 40,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 12,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: "Reported",
    ...patch,
  };
}

function pathogenPaint(counties: readonly CountyScoreSummary[]) {
  return paintExplorerMapLayer({
    counties,
    layerId: "pathogen_status",
    scoresStatus: "ready",
  });
}

function visibleLines(paint: ReturnType<typeof pathogenPaint>) {
  return buildExplorerLegendModel(paint).segments.map(
    (segment) => segment.visibleLines
  );
}

describe("pathogen status color and order contract", () => {
  afterEach(() => {
    cleanup();
  });

  it("paints no records light gray and present as one indigo class", () => {
    const paint = pathogenPaint([
      county("08001", "Present"),
      county("08013", "No records"),
      county("08014", "Unknown"),
    ]);
    const gap = paintExplorerMapLayer({
      counties: [
        county("08013", "No records", {
          color: "#e9602b",
          priority: "Priority 1 — Investigate",
          score: { ...county("08013", "No records").score, score: 80 },
        }),
      ],
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    const presentEntries = paint.entries.filter(
      (entry) => entry.label === "Present"
    );
    const gapColors = new Set(SCORE_COLOR_BANDS.map((band) => band.color));
    expect({
      gapColor: gap.colorsByFips.get("08013"),
      gapContainsNoRecords: gapColors.has(NO_RECORDS),
      gapContainsPresent: gapColors.has(PRESENT),
      incidenceContainsPresent: (
        LYME_INCIDENCE_RAMP as readonly string[]
      ).includes(PRESENT),
      noRecords: paint.colorsByFips.get("08013"),
      present: paint.colorsByFips.get("08001"),
      presentClasses: presentEntries.map((entry) => entry.color),
      scale: paint.scale,
      unknown: paint.colorsByFips.get("08014"),
    }).toStrictEqual({
      gapColor: "#e9602b",
      gapContainsNoRecords: false,
      gapContainsPresent: false,
      incidenceContainsPresent: false,
      noRecords: NO_RECORDS,
      present: PRESENT,
      presentClasses: [PRESENT],
      scale: "segments",
      unknown: "hsl(270,46%,40%)",
    });
  });

  it("orders no records then present before other statuses despite shuffle and frequency", () => {
    const paint = pathogenPaint([
      county("08001", "Present"),
      county("08003", "Present"),
      county("08005", "Unknown"),
      county("08007", "Absent"),
      county("08009", "Emerging"),
      county("08011", "No records"),
      county("08013", "Present"),
      county("36001", "Present", { state: "NY", state_name: "New York" }),
    ]);
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "No records (not zero, not confirmed absence)",
      "Present",
      "Absent (observed zero or negative finding)",
      "Emerging",
      "Unknown",
    ]);
    expect(
      buildExplorerLegendModel(paint).segments.map((segment) => segment.label)
    ).toStrictEqual(paint.entries.map((entry) => entry.label));
    expect(visibleLines(paint)).toStrictEqual([
      ["No records", "(not zero, not confirmed absence)"],
      ["Present"],
      ["Absent"],
      ["Emerging"],
      ["Unknown"],
    ]);
  });

  it("paints each county with the legend swatch for that class", () => {
    const paint = pathogenPaint([
      county("08001", "Present"),
      county("08013", "No records"),
      county("08014", "Unknown"),
      county("11001", "Absent", {
        state: "DC",
        state_name: "District of Columbia",
      }),
      county("36001", "Emerging", { state: "NY", state_name: "New York" }),
    ]);
    const colorFor = (label: string) =>
      paint.entries.find((entry) => entry.label === label)?.color;
    const absent = colorFor("Absent (observed zero or negative finding)");
    const emerging = colorFor("Emerging");
    const unknown = colorFor("Unknown");
    expect({
      absent: paint.colorsByFips.get("11001"),
      emerging: paint.colorsByFips.get("36001"),
      noRecords: paint.colorsByFips.get("08013"),
      present: paint.colorsByFips.get("08001"),
      unknown: paint.colorsByFips.get("08014"),
    }).toStrictEqual({
      absent,
      emerging,
      noRecords: NO_RECORDS,
      present: PRESENT,
      unknown,
    });
    expect(paint.colorsByFips.get("08001")).toBe(colorFor("Present"));
    expect(paint.colorsByFips.get("08013")).toBe(
      colorFor("No records (not zero, not confirmed absence)")
    );
    expect(new Set([NO_RECORDS, PRESENT, absent, emerging, unknown]).size).toBe(
      5
    );
    expect(new Set(paint.entries.map((entry) => entry.color)).size).toBe(
      paint.entries.length
    );
  });

  it("normalizes known casing and outer whitespace and keeps unfamiliar values distinct", () => {
    const paint = pathogenPaint([
      county("08001", "  PRESENT "),
      county("08003", "present"),
      county("08005", "no   records"),
      county("08013", "No records"),
      county("08014", " unknown "),
      county("08015", "Unknown"),
      county("08017", "Not a published status"),
      county("08019", "not a published status"),
      county("11001", "  ABSENT", {
        state: "DC",
        state_name: "District of Columbia",
      }),
    ]);
    const unfamiliar = paint.colorsByFips.get("08017");
    const otherUnfamiliar = paint.colorsByFips.get("08019");
    expect({
      colors: {
        absent: paint.colorsByFips.get("11001"),
        lowerUnknown: paint.colorsByFips.get("08014"),
        noRecords: paint.colorsByFips.get("08005"),
        otherUnfamiliar,
        present: paint.colorsByFips.get("08001"),
        samePresent: paint.colorsByFips.get("08003"),
        sameNoRecords: paint.colorsByFips.get("08013"),
        unfamiliar,
        upperUnknown: paint.colorsByFips.get("08015"),
      },
      distinct: {
        absentFromNoRecords: paint.colorsByFips.get("11001") !== NO_RECORDS,
        absentFromPresent: paint.colorsByFips.get("11001") !== PRESENT,
        unfamiliarFromNoRecords: unfamiliar !== NO_RECORDS,
        unfamiliarFromOther: unfamiliar !== otherUnfamiliar,
        unfamiliarFromPresent: unfamiliar !== PRESENT,
        unknownFromNoRecords: paint.colorsByFips.get("08014") !== NO_RECORDS,
      },
      labels: paint.entries.map((entry) => entry.label),
    }).toStrictEqual({
      colors: {
        absent: paint.colorsByFips.get("11001"),
        lowerUnknown: paint.colorsByFips.get("08015"),
        noRecords: NO_RECORDS,
        otherUnfamiliar,
        present: PRESENT,
        samePresent: PRESENT,
        sameNoRecords: NO_RECORDS,
        unfamiliar,
        upperUnknown: paint.colorsByFips.get("08015"),
      },
      distinct: {
        absentFromNoRecords: true,
        absentFromPresent: true,
        unfamiliarFromNoRecords: true,
        unfamiliarFromOther: true,
        unfamiliarFromPresent: true,
        unknownFromNoRecords: true,
      },
      labels: [
        "No records (not zero, not confirmed absence)",
        "Present",
        "Absent (observed zero or negative finding)",
        "not a published status",
        "Not a published status",
        "Unknown",
      ],
    });
  });

  it("keeps no records distinct from zero, absent, unknown, and an unfamiliar value", () => {
    const paint = pathogenPaint([
      county("08001", "No records"),
      county("08003", "0"),
      county("08005", "Absent"),
      county("08007", "Unknown"),
      county("08009", "Missing"),
      county("08011", "Unavailable"),
      county("08013", "Mystery"),
      county("36001", "Not detected", { state: "NY", state_name: "New York" }),
    ]);
    const noRecords = paint.colorsByFips.get("08001");
    const otherFips = [
      "08003",
      "08005",
      "08007",
      "08009",
      "08011",
      "08013",
      "36001",
    ];
    expect({
      distinct: otherFips.every(
        (fips) => paint.colorsByFips.get(fips) !== noRecords
      ),
      labels: paint.entries.map((entry) => entry.label),
      lines: visibleLines(paint),
      swatches: new Set(paint.colorsByFips.values()).size,
    }).toStrictEqual({
      distinct: true,
      labels: [
        "No records (not zero, not confirmed absence)",
        "0 (observed zero or negative finding)",
        "Absent (observed zero or negative finding)",
        "Missing",
        "Mystery",
        "Not detected (observed zero or negative finding)",
        "Unavailable",
        "Unknown",
      ],
      lines: [
        ["No records", "(not zero, not confirmed absence)"],
        ["0"],
        ["Absent"],
        ["Missing"],
        ["Mystery"],
        ["Not detected"],
        ["Unavailable"],
        ["Unknown"],
      ],
      swatches: 8,
    });
  });

  it("omits a primary key the published rows do not contain", () => {
    const presentOnly = pathogenPaint([
      county("08001", "Present"),
      county("08005", "Unknown"),
    ]);
    const noRecordsOnly = pathogenPaint([
      county("08013", "No records"),
      county("11001", "Absent", {
        state: "DC",
        state_name: "District of Columbia",
      }),
    ]);
    expect(presentOnly.entries.map((entry) => entry.label)).toStrictEqual([
      "Present",
      "Unknown",
    ]);
    expect(noRecordsOnly.entries.map((entry) => entry.label)).toStrictEqual([
      "No records (not zero, not confirmed absence)",
      "Absent (observed zero or negative finding)",
    ]);
    expect(presentOnly.colorsByFips.has("08013")).toBeFalsy();
  });

  it("keeps loading, error, and empty layers free of pathogen swatches", () => {
    const counties = [county("08001", "Present")];
    const loading = paintExplorerMapLayer({
      counties,
      layerId: "pathogen_status",
      scoresStatus: "loading",
    });
    const failed = paintExplorerMapLayer({
      counties: [],
      layerId: "pathogen_status",
      scoresStatus: "error",
    });
    const empty = paintExplorerMapLayer({
      counties: [],
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    expect({
      empty: { entries: empty.entries, kind: empty.kind, title: empty.title },
      failed: {
        entries: failed.entries.length,
        kind: failed.kind,
        title: failed.title,
      },
      loading: {
        colors: loading.colorsByFips.size,
        entries: loading.entries,
        kind: loading.kind,
      },
    }).toStrictEqual({
      empty: {
        entries: [
          {
            color: "var(--explorer-boundary)",
            detail: null,
            label: "County boundary",
          },
        ],
        kind: "unavailable",
        title: "County boundaries",
      },
      failed: { entries: 1, kind: "unavailable", title: "County boundaries" },
      loading: { colors: 0, entries: [], kind: "loading" },
    });
  });

  it("repeats the same colors when the geographic scope changes", () => {
    const national = pathogenPaint([
      county("08001", "Present"),
      county("08013", "No records"),
      county("11001", "Absent", {
        state: "DC",
        state_name: "District of Columbia",
      }),
      county("36001", "Unknown", { state: "NY", state_name: "New York" }),
    ]);
    const colorado = pathogenPaint([
      county("08001", "Present"),
      county("08013", "No records"),
    ]);
    const again = pathogenPaint([
      county("36001", "Unknown", { state: "NY", state_name: "New York" }),
      county("08013", "No records"),
      county("11001", "Absent", {
        state: "DC",
        state_name: "District of Columbia",
      }),
      county("08001", "Present"),
    ]);
    expect({
      colorado: colorado.entries.map((entry) => entry.label),
      present: colorado.colorsByFips.get("08001"),
      repeat: again.colorsByFips.get("08001"),
      sameAbsent: again.colorsByFips.get("11001"),
    }).toStrictEqual({
      colorado: ["No records (not zero, not confirmed absence)", "Present"],
      present: national.colorsByFips.get("08001"),
      repeat: national.colorsByFips.get("08001"),
      sameAbsent: national.colorsByFips.get("11001"),
    });
  });

  it("leaves tick status, gap score, and boundaries on their own scales", () => {
    const counties = [
      county("08001", "Present", {
        color: "#55a8a3",
        tick_status: "Established",
      }),
      county("08005", "No records", {
        color: "#a9d2db",
        tick_status: "Reported",
      }),
      county("08013", "Absent", {
        color: "#e9602b",
        priority: "Priority 1 — Investigate",
        score: {
          ...county("08013", "Absent").score,
          score: 80,
        },
        tick_status: "No records",
      }),
      county("08014", "Unknown", { tick_status: "Unknown" }),
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
    const boundaries = paintExplorerMapLayer({
      counties,
      layerId: "boundaries",
      scoresStatus: "ready",
    });
    expect({
      boundaries: boundaries.entries.map((entry) => entry.label),
      gapColor: gap.colorsByFips.get("08013"),
      gapLabels: gap.entries.some((entry) => entry.label === "Present"),
      tickColors: {
        established: tick.colorsByFips.get("08001"),
        noRecords: tick.colorsByFips.get("08013"),
        reported: tick.colorsByFips.get("08005"),
      },
      tickLabels: tick.entries.map((entry) => entry.label),
    }).toStrictEqual({
      boundaries: ["County fill", "County outline", "State outline"],
      gapColor: "#e9602b",
      gapLabels: false,
      tickColors: {
        established: TICK_STATUS_ESTABLISHED_COLOR,
        noRecords: TICK_STATUS_NO_RECORDS_COLOR,
        reported: TICK_STATUS_REPORTED_COLOR,
      },
      tickLabels: [
        "No records (not zero, not confirmed absence)",
        "Reported",
        "Established",
        "Unknown",
      ],
    });
    expect(TICK_STATUS_REPORTED_COLOR).not.toBe(PRESENT);
    expect(TICK_STATUS_ESTABLISHED_COLOR).not.toBe(PRESENT);
  });

  it("shows pathogen labels without a pointer", () => {
    const paint = pathogenPaint([
      county("08013", "No records"),
      county("08001", "Present"),
      county("08014", "Unknown"),
      county("11001", "Absent", {
        state: "DC",
        state_name: "District of Columbia",
      }),
    ]);
    render(<ExplorerMapLegend paint={paint} />);
    const legend = screen.getByRole("region", {
      name: "B. burgdorferi status map legend",
    });
    const buttons = [...legend.querySelectorAll("[data-legend-segment]")];
    expect({
      layer: legend.dataset.legendLayer,
      lines: buttons.map((button) =>
        [...button.querySelectorAll("[data-legend-visible-line]")].map(
          (line) => line.textContent
        )
      ),
      names: buttons.map((button) => button.getAttribute("aria-label")),
    }).toStrictEqual({
      layer: "pathogen_status",
      lines: [
        ["No records", "(not zero, not confirmed absence)"],
        ["Present"],
        ["Absent"],
        ["Unknown"],
      ],
      names: [
        "No records (not zero, not confirmed absence)",
        "Present",
        "Absent (observed zero or negative finding)",
        "Unknown",
      ],
    });
  });
});
