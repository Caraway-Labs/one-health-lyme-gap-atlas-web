import { describe, expect, it } from "vitest";

import { stateBoundaryLines } from "@/features/ux-reset/review/county-boundary-lines";
import {
  COUNTY_BOUNDARIES_BACKGROUND,
  COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS,
  COUNTY_BOUNDARIES_FILL,
  COUNTY_BOUNDARIES_HOVER_STROKE_STOPS,
  COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
  COUNTY_BOUNDARIES_SELECTED_STATE_WIDTH,
  COUNTY_BOUNDARIES_STATE_STROKE,
  COUNTY_BOUNDARIES_STATE_STROKE_STOPS,
  COUNTY_BOUNDARIES_STROKE,
  LYME_INCIDENCE_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { REVIEW_SCORE_RAMP_COLORS } from "@/lib/atlas-ui";

function square(
  fips: string,
  x: number,
  y: number
): GeoJSON.Feature<GeoJSON.Polygon, { fips: string }> {
  return {
    geometry: {
      coordinates: [
        [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
          [x, y],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

function segments(
  feature: GeoJSON.Feature<GeoJSON.MultiLineString> | undefined
): string[] {
  const lines = feature?.geometry.coordinates ?? [];
  const keys: string[] = [];
  for (const line of lines) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const start = line[index];
      const end = line[index + 1];
      if (!(start && end)) {
        continue;
      }
      const left = `${start[0]},${start[1]}`;
      const right = `${end[0]},${end[1]}`;
      keys.push(left < right ? `${left}|${right}` : `${right}|${left}`);
    }
  }
  return keys.toSorted();
}

describe("County boundaries palette", () => {
  it("keeps the approved neutral colors off the score and incidence ramps", () => {
    expect({
      background: COUNTY_BOUNDARIES_BACKGROUND,
      fill: COUNTY_BOUNDARIES_FILL,
      incidence: [...LYME_INCIDENCE_RAMP],
      scores: [...REVIEW_SCORE_RAMP_COLORS],
      selectedState: COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
      selectedWidth: COUNTY_BOUNDARIES_SELECTED_STATE_WIDTH,
      state: COUNTY_BOUNDARIES_STATE_STROKE,
      stroke: COUNTY_BOUNDARIES_STROKE,
    }).toStrictEqual({
      background: "#F8FAFC",
      fill: "#F3F4F6",
      incidence: ["#E5F5E0", "#A1D99B", "#41D65C", "#238B45", "#005A32"],
      scores: [
        "#a9d2db",
        "#55a8a3",
        "#87b982",
        "#efc64a",
        "#f49a32",
        "#e9602b",
      ],
      selectedState: "#000000",
      selectedWidth: 2.5,
      state: "#1F2937",
      stroke: "#4B5563",
    });
    expect(REVIEW_SCORE_RAMP_COLORS).not.toContain(COUNTY_BOUNDARIES_FILL);
    expect(LYME_INCIDENCE_RAMP).not.toContain(COUNTY_BOUNDARIES_STROKE);
  });

  it("thickens county strokes with zoom and keeps state strokes heavier", () => {
    const widthAt = (
      stops: readonly (readonly [number, number])[],
      zoom: number
    ): number => {
      const first = stops[0];
      if (!first || zoom <= first[0]) {
        return first?.[1] ?? 0;
      }
      const last = stops.at(-1) ?? first;
      if (zoom >= last[0]) {
        return last[1];
      }
      for (let index = 1; index < stops.length; index += 1) {
        const end = stops[index];
        const start = stops[index - 1];
        if (!(start && end) || zoom > end[0]) {
          continue;
        }
        const span = end[0] - start[0];
        const ratio = span === 0 ? 0 : (zoom - start[0]) / span;
        return start[1] + (end[1] - start[1]) * ratio;
      }
      return last[1];
    };
    const countyHeavier = COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS.every(
      ([zoom, width], index) => {
        const previous = COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS[index - 1];
        const widerThanPrevious = previous
          ? width > previous[1] || (width === 0 && previous[1] === 0)
          : true;
        return (
          widerThanPrevious &&
          widthAt(COUNTY_BOUNDARIES_STATE_STROKE_STOPS, zoom) > width
        );
      }
    );
    const hoverHeavier = COUNTY_BOUNDARIES_HOVER_STROKE_STOPS.every(
      ([zoom, width]) => {
        const county = COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS.find(
          (stop) => stop[0] === zoom
        );
        if ((county?.[1] ?? 0) === 0) {
          return width === 0;
        }
        return width > (county?.[1] ?? width);
      }
    );
    expect({
      countyHeavier,
      hoverHeavier,
      nationalCountyWidth: widthAt(COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS, 3.2),
      stateCountyWidth: widthAt(COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS, 5.5),
    }).toStrictEqual({
      countyHeavier: true,
      hoverHeavier: true,
      nationalCountyWidth: 0,
      stateCountyWidth: 0.9,
    });
  });

  it("drops shared county edges and keeps a border between states", () => {
    const lines = stateBoundaryLines({
      features: [
        square("08001", 0, 0),
        square("08005", 1, 0),
        square("16001", 3, 0),
      ],
    });
    const touching = stateBoundaryLines({
      features: [square("08005", 1, 0), square("16001", 2, 0)],
    });
    const colorado = lines.features.find(
      (feature) => feature.properties.state === "CO"
    );
    const idaho = lines.features.find(
      (feature) => feature.properties.state === "ID"
    );
    const coloradoTouch = touching.features.find(
      (feature) => feature.properties.state === "CO"
    );
    const idahoTouch = touching.features.find(
      (feature) => feature.properties.state === "ID"
    );
    expect({
      coloradoHasInterior: segments(colorado).includes("1,0|1,1"),
      coloradoKeepsStateBorder: segments(coloradoTouch).includes("2,0|2,1"),
      idahoHasInterior: segments(idaho).includes("1,0|1,1"),
      idahoKeepsStateBorder: segments(idahoTouch).includes("2,0|2,1"),
      states: lines.features.map((feature) => feature.properties.state),
    }).toStrictEqual({
      coloradoHasInterior: false,
      coloradoKeepsStateBorder: true,
      idahoHasInterior: false,
      idahoKeepsStateBorder: true,
      states: ["CO", "ID"],
    });
  });

  it("legend names geography and does not use a numeric scale", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "boundaries",
      scoresStatus: "ready",
    });
    const model = buildExplorerLegendModel(paint);
    const failed = paintExplorerMapLayer({
      counties: [],
      layerId: "gap_score",
      scoresStatus: "error",
    });
    expect({
      failedColor: failed.entries[0]?.color,
      failedLabel: failed.entries[0]?.label,
      gradient: model.gradient,
      labels: model.segments.map((segment) => segment.label),
      left: model.leftCaption,
      mode: model.mode,
      right: model.rightCaption,
      title: model.title,
      unit: model.unitLabel,
    }).toStrictEqual({
      failedColor: "var(--explorer-boundary)",
      failedLabel: "County boundary",
      gradient: null,
      labels: ["County fill", "County outline", "State outline"],
      left: null,
      mode: "segments",
      right: null,
      title: "County boundaries",
      unit: null,
    });
    expect(paint.note).toMatch(/not missing disease data/);
    expect(paint.period).toMatch(/not an evidence layer/);
    expect(paint.note).toMatch(/not colored by Atlas gap score/);
  });
});
