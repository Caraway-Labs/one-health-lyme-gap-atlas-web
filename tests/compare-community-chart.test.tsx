import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CompareCommunityChart,
  compareChartMarkerLayout,
  compareChartPlotX,
} from "@/features/ux-reset/compare/compare-community-chart";

describe("compare community chart", () => {
  afterEach(() => {
    cleanup();
  });

  describe(compareChartPlotX, () => {
    it("keeps endpoint markers inside the view box", () => {
      expect({
        min: compareChartPlotX(0),
        max: compareChartPlotX(100),
      }).toStrictEqual({ min: 52, max: 588 });
    });
  });

  describe(compareChartMarkerLayout, () => {
    it("staggers value labels and markers when both counties share a value", () => {
      const layout = compareChartMarkerLayout([
        {
          letter: "A",
          point: { name: "Adams County", shown: "73rd", value: 73 },
          position: 73,
          tone: "a",
        },
        {
          letter: "B",
          point: { name: "Adair County", shown: "73rd", value: 73 },
          position: 73,
          tone: "b",
        },
      ]);
      expect({
        markerY: layout.map((entry) => entry.markerY),
        valueLabelY: layout.map((entry) => entry.valueLabelY),
      }).toStrictEqual({
        markerY: [44, 72],
        valueLabelY: [24, 52],
      });
    });

    it("staggers only the B value label when values are close", () => {
      const layout = compareChartMarkerLayout([
        {
          letter: "A",
          point: { name: "Adams County", shown: "10.8%", value: 10.8 },
          position: 54,
          tone: "a",
        },
        {
          letter: "B",
          point: { name: "Adair County", shown: "10.5%", value: 10.5 },
          position: 52.5,
          tone: "b",
        },
      ]);
      expect({
        sharedMarkerY: layout.every((entry) => entry.markerY === 58),
        valueLabelY: layout.map((entry) => entry.valueLabelY),
      }).toStrictEqual({
        sharedMarkerY: true,
        valueLabelY: [38, 22],
      });
    });
  });

  describe(CompareCommunityChart, () => {
    it("renders marker letters inside circles and value labels without prefixes", () => {
      render(
        <CompareCommunityChart
          caption="National county percentile"
          left={{ name: "Adams County", shown: "73rd", value: 73 }}
          max={100}
          meaning="Meaning copy."
          min={0}
          right={{ name: "Adair County", shown: "60th", value: 60 }}
          summary="Adams County: 13 percentile points higher."
          ticks={[0, 50, 100]}
          title="Social vulnerability (percentile)"
          unit="Percentile"
        />
      );
      const chart = screen.getByTestId(
        "compare-chart-Social vulnerability (percentile)"
      );
      expect({
        markers: chart.querySelectorAll(".compare-chart-marker").length,
        letters: chart.querySelectorAll(".compare-chart-marker-letter").length,
        text: chart.textContent ?? "",
      }).toStrictEqual({
        markers: 2,
        letters: 2,
        text: expect.stringMatching(/73rd.*60th/),
      });
      expect(chart.textContent ?? "").not.toMatch(/\bA 73rd\b/);
    });

    it("omits markers when a county value is missing", () => {
      render(
        <CompareCommunityChart
          caption="National county percentile"
          left={{ name: "Adams County", shown: "73rd", value: 73 }}
          max={100}
          meaning="Meaning copy."
          min={0}
          right={{ name: "Adair County", shown: null, value: null }}
          summary="A difference cannot be calculated because a value is unavailable."
          ticks={[0, 50, 100]}
          title="Social vulnerability (percentile) missing"
          unit="Percentile"
        />
      );
      const chart = screen.getByTestId(
        "compare-chart-Social vulnerability (percentile) missing"
      );
      expect({
        markers: chart.querySelectorAll(".compare-chart-marker").length,
        letter: chart.querySelector(".compare-chart-marker-letter")
          ?.textContent,
      }).toStrictEqual({ markers: 1, letter: "A" });
    });
  });
});
