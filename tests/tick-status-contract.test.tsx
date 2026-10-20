import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { CountyScoreSummary } from "@/generated/models";

const NO_RECORDS = "#D1D5DB";
const REPORTED = "#E9B949";
const ESTABLISHED = "#946200";

function county(
  fips: string,
  tickStatus: string,
  patch: Partial<CountyScoreSummary> = {}
): CountyScoreSummary {
  return {
    burgdorferi_status: "Present",
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
    tick_status: tickStatus,
    ...patch,
  };
}

function tickPaint(counties: readonly CountyScoreSummary[]) {
  return paintExplorerMapLayer({
    counties,
    layerId: "tick_status",
    scoresStatus: "ready",
  });
}

describe("tick status color and order contract", () => {
  afterEach(() => {
    cleanup();
  });

  it("paints the approved gray, amber, and ochre statuses and leaves other statuses off those fills", () => {
    const paint = tickPaint([
      county("08001", "No records"),
      county("08003", "Reported"),
      county("08005", "Established"),
      county("08007", "Unknown"),
      county("08009", "Suppressed"),
      county("08011", "Unavailable"),
      county("08013", "Missing"),
      county("08015", "0"),
    ]);
    const primary = new Set([NO_RECORDS, REPORTED, ESTABLISHED]);
    const extraFips = ["08007", "08009", "08011", "08013", "08015"];
    expect({
      colors: {
        established: paint.colorsByFips.get("08005"),
        noRecords: paint.colorsByFips.get("08001"),
        reported: paint.colorsByFips.get("08003"),
      },
      extrasOffPrimary: extraFips.every((fips) => {
        const color = paint.colorsByFips.get(fips);
        return color !== undefined && !primary.has(color);
      }),
      lines: paint.entries
        .filter((entry) => primary.has(entry.color))
        .map((entry) => entry.visibleLines),
    }).toStrictEqual({
      colors: {
        established: ESTABLISHED,
        noRecords: NO_RECORDS,
        reported: REPORTED,
      },
      extrasOffPrimary: true,
      lines: [
        ["No records", "(not zero, not confirmed absence)"],
        ["Reported"],
        ["Established"],
      ],
    });
  });

  it("orders primary categories no records, reported, established despite shuffle and frequency", () => {
    const paint = tickPaint([
      county("08001", "Established"),
      county("08003", "Established"),
      county("08005", "Unknown"),
      county("08007", "Reported"),
      county("08009", "Endemic"),
      county("08011", "No records"),
      county("08013", "Established"),
    ]);
    expect(paint.entries.map((entry) => entry.label)).toStrictEqual([
      "No records (not zero, not confirmed absence)",
      "Reported",
      "Established",
      "Endemic",
      "Unknown",
    ]);
    expect(
      buildExplorerLegendModel(paint).segments.map((segment) => segment.label)
    ).toStrictEqual(paint.entries.map((entry) => entry.label));
  });

  it("paints each county with the legend swatch for that class", () => {
    const paint = tickPaint([
      county("08001", "Established"),
      county("08013", "No records"),
      county("08005", "Reported"),
      county("08014", "Unknown"),
      county("08031", "Endemic"),
    ]);
    const colorFor = (label: string) =>
      paint.entries.find((entry) => entry.label === label)?.color;
    expect({
      endemic: paint.colorsByFips.get("08031"),
      established: paint.colorsByFips.get("08001"),
      noRecords: paint.colorsByFips.get("08013"),
      reported: paint.colorsByFips.get("08005"),
      unknown: paint.colorsByFips.get("08014"),
    }).toStrictEqual({
      endemic: colorFor("Endemic"),
      established: ESTABLISHED,
      noRecords: NO_RECORDS,
      reported: REPORTED,
      unknown: colorFor("Unknown"),
    });
    expect(paint.colorsByFips.get("08001")).toBe(colorFor("Established"));
    expect(paint.colorsByFips.get("08013")).toBe(
      colorFor("No records (not zero, not confirmed absence)")
    );
    expect(new Set(paint.entries.map((entry) => entry.color)).size).toBe(
      paint.entries.length
    );
  });

  it("matches known values after case and whitespace changes without moving other classes", () => {
    const paint = tickPaint([
      county("08001", "  ESTABLISHED "),
      county("08003", "no   records"),
      county("08005", "\tReported\n"),
      county("08013", "No records"),
      county("08014", "unknown"),
      county("08015", "Unknown"),
      county("08017", "Not a published status"),
    ]);
    const unfamiliar = paint.colorsByFips.get("08017");
    expect({
      colors: {
        established: paint.colorsByFips.get("08001"),
        lowerUnknown: paint.colorsByFips.get("08014"),
        noRecords: paint.colorsByFips.get("08003"),
        reported: paint.colorsByFips.get("08005"),
        sameNoRecords: paint.colorsByFips.get("08013"),
        unfamiliar,
        upperUnknown: paint.colorsByFips.get("08015"),
      },
      distinctExtras:
        unfamiliar !== NO_RECORDS &&
        unfamiliar !== ESTABLISHED &&
        unfamiliar !== REPORTED &&
        paint.colorsByFips.get("08014") !== NO_RECORDS &&
        paint.colorsByFips.get("08015") !== NO_RECORDS &&
        paint.colorsByFips.get("08014") !== paint.colorsByFips.get("08015"),
      labels: paint.entries.map((entry) => entry.label),
    }).toStrictEqual({
      colors: {
        established: ESTABLISHED,
        lowerUnknown: paint.colorsByFips.get("08014"),
        noRecords: NO_RECORDS,
        reported: REPORTED,
        sameNoRecords: NO_RECORDS,
        unfamiliar,
        upperUnknown: paint.colorsByFips.get("08015"),
      },
      distinctExtras: true,
      labels: [
        "No records (not zero, not confirmed absence)",
        "Reported",
        "Established",
        "Not a published status",
        "unknown",
        "Unknown",
      ],
    });
  });

  it("keeps no records distinct from zero, unknown, missing, and an unfamiliar value", () => {
    const paint = tickPaint([
      county("08001", "No records"),
      county("08003", "0"),
      county("08005", "Absent"),
      county("08007", "Unknown"),
      county("08009", "Missing"),
      county("08011", "Unavailable"),
      county("08013", "Mystery"),
    ]);
    const noRecords = paint.colorsByFips.get("08001");
    const otherFips = ["08003", "08005", "08007", "08009", "08011", "08013"];
    expect({
      distinct: otherFips.every(
        (fips) => paint.colorsByFips.get(fips) !== noRecords
      ),
      labels: paint.entries.map((entry) => entry.label),
      swatches: new Set(paint.colorsByFips.values()).size,
    }).toStrictEqual({
      distinct: true,
      labels: [
        "No records (not zero, not confirmed absence)",
        "0 (observed zero or negative finding)",
        "Absent (observed zero or negative finding)",
        "Missing",
        "Mystery",
        "Unavailable",
        "Unknown",
      ],
      swatches: 7,
    });
  });

  it("omits a primary or extra key that the published rows do not contain", () => {
    const present = tickPaint([
      county("08001", "Reported"),
      county("08005", "Established"),
    ]);
    const withUnknown = tickPaint([
      county("08001", "Reported"),
      county("08005", "Unknown"),
    ]);
    expect(present.entries.map((entry) => entry.label)).toStrictEqual([
      "Reported",
      "Established",
    ]);
    expect(withUnknown.entries.map((entry) => entry.label)).toStrictEqual([
      "Reported",
      "Unknown",
    ]);
  });

  it("leaves the gap-score ramp unchanged when pathogen uses its own scale", () => {
    const counties = [
      county("08001", "Established", { burgdorferi_status: "Present" }),
      county("08005", "Reported", {
        burgdorferi_status: "No records",
        color: "#55a8a3",
        fips: "08005",
      }),
      county("08013", "No records", {
        burgdorferi_status: "Absent",
        color: "#e9602b",
        fips: "08013",
        priority: "Priority 1 — Investigate",
        score: {
          ...county("08013", "No records").score,
          score: 80,
        },
      }),
      county("08014", "Unknown", {
        burgdorferi_status: "Unknown",
        fips: "08014",
      }),
    ];
    const pathogen = paintExplorerMapLayer({
      counties,
      layerId: "pathogen_status",
      scoresStatus: "ready",
    });
    const gap = paintExplorerMapLayer({
      counties,
      layerId: "gap_score",
      scoresStatus: "ready",
    });
    render(<ExplorerMapLegend paint={pathogen} />);
    expect({
      gapColor: gap.colorsByFips.get("08013"),
      gapHasEstablished: gap.entries.some(
        (entry) => entry.label === "Established"
      ),
      gapHasHigh: gap.entries.some((entry) => entry.label === "75 or higher"),
      pathogenColors: {
        absent: pathogen.colorsByFips.get("08013"),
        noRecords: pathogen.colorsByFips.get("08005"),
        present: pathogen.colorsByFips.get("08001"),
        unknown: pathogen.colorsByFips.get("08014"),
      },
      pathogenLabels: pathogen.entries.map((entry) => entry.label),
      pathogenVisibleLines: screen
        .getByRole("region", { name: "B. burgdorferi status map legend" })
        .querySelector("[data-legend-visible-line]"),
    }).toStrictEqual({
      gapColor: "#e9602b",
      gapHasEstablished: false,
      gapHasHigh: true,
      pathogenColors: {
        absent: "hsl(16,72%,42%)",
        noRecords: "#D1D5DB",
        present: "#4F46E5",
        unknown: "hsl(270,46%,40%)",
      },
      pathogenLabels: [
        "No records (not zero, not confirmed absence)",
        "Present",
        "Absent (observed zero or negative finding)",
        "Unknown",
      ],
      pathogenVisibleLines: expect.any(Element),
    });
  });

  it("shows the tick labels without a pointer", () => {
    const paint = tickPaint([
      county("08013", "No records"),
      county("08005", "Reported"),
      county("08001", "Established"),
      county("08014", "Unknown"),
    ]);
    render(<ExplorerMapLegend paint={paint} />);
    const legend = screen.getByRole("region", {
      name: "Blacklegged tick status map legend",
    });
    const text = legend.textContent ?? "";
    const buttons = screen.getAllByRole("button", {
      name: /No records|Reported|Established|Unknown/,
    });
    expect({
      lines: buttons.map((button) =>
        [...button.querySelectorAll("[data-legend-visible-line]")].map(
          (line) => line.textContent
        )
      ),
      names: buttons.map((button) => button.getAttribute("aria-label")),
      text: {
        established: text.includes("Established"),
        noRecords: text.includes("No records"),
        qualifier: text.includes("(not zero, not confirmed absence)"),
        reported: text.includes("Reported"),
        unknown: text.includes("Unknown"),
      },
    }).toStrictEqual({
      lines: [
        ["No records", "(not zero, not confirmed absence)"],
        ["Reported"],
        ["Established"],
        ["Unknown"],
      ],
      names: [
        "No records (not zero, not confirmed absence)",
        "Reported",
        "Established",
        "Unknown",
      ],
      text: {
        established: true,
        noRecords: true,
        qualifier: true,
        reported: true,
        unknown: true,
      },
    });
  });
});
