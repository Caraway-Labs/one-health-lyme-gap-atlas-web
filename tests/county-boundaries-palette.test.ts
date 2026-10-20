import { describe, expect, it } from "vitest";

import { stateBoundaryCollections } from "@/features/ux-reset/review/county-boundaries-lines";
import {
  COUNTY_BOUNDARIES_BACKGROUND,
  COUNTY_BOUNDARIES_COUNTY_STROKE,
  COUNTY_BOUNDARIES_FILL,
  COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
  COUNTY_BOUNDARIES_STATE_STROKE,
  COUNTY_BOUNDARY_COUNTY_LINE_WIDTH,
  COUNTY_BOUNDARY_STATE_LINE_WIDTH,
} from "@/features/ux-reset/review/county-boundaries-palette";
import { buildExplorerLegendModel } from "@/features/ux-reset/review/explorer-legend-model";
import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";

function square(
  fips: string,
  west: number,
  south: number,
  east: number,
  north: number
): GeoJSON.Feature<GeoJSON.Polygon, { fips: string }> {
  return {
    geometry: {
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

function lineLength(
  collection: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>
): number {
  const lines = collection.features[0]?.geometry.coordinates ?? [];
  let length = 0;
  for (const line of lines) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const start = line[index];
      const end = line[index + 1];
      if (!(start && end)) {
        continue;
      }
      length += Math.hypot(
        (end[0] ?? 0) - (start[0] ?? 0),
        (end[1] ?? 0) - (start[1] ?? 0)
      );
    }
  }
  return length;
}

describe("county boundaries palette", () => {
  it("keeps one non-numeric geography swatch", () => {
    const paint = paintExplorerMapLayer({
      counties: [],
      layerId: "boundaries",
      scoresStatus: "ready",
    });
    const model = buildExplorerLegendModel(paint);
    const segment = model.segments[0];
    expect({
      color: segment?.color,
      gradient: model.gradient,
      label: segment?.label,
      leftCaption: model.leftCaption,
      mode: model.mode,
      outline: segment?.outline,
      rightCaption: model.rightCaption,
      title: model.title,
    }).toStrictEqual({
      color: COUNTY_BOUNDARIES_FILL,
      gradient: null,
      label: "County boundary",
      leftCaption: null,
      mode: "segments",
      outline: COUNTY_BOUNDARIES_COUNTY_STROKE,
      rightCaption: null,
      title: "County boundaries",
    });
    expect(segment?.accessibleName).toMatch(/not a missing value/);
    expect(segment?.accessibleName).not.toMatch(/\d+ to </);
  });

  it("drops shared county edges and keeps the selected state perimeter", () => {
    const lines = stateBoundaryCollections(
      [
        square("08001", 0, 0, 1, 1),
        square("08005", 1, 0, 2, 1),
        square("32001", 10, 10, 11, 11),
      ],
      "08"
    );
    const stateLength = lineLength(lines.stateLines);
    const selectedLength = lineLength(lines.selectedStateLines);
    expect(stateLength).toBeCloseTo(10, 5);
    expect(selectedLength).toBeCloseTo(6, 5);
    expect(selectedLength).toBeLessThan(stateLength);
  });

  it("uses the approved colors and keeps county strokes lighter than state strokes", () => {
    expect({
      background: COUNTY_BOUNDARIES_BACKGROUND,
      county: COUNTY_BOUNDARIES_COUNTY_STROKE,
      fill: COUNTY_BOUNDARIES_FILL,
      selected: COUNTY_BOUNDARIES_SELECTED_STATE_STROKE,
      state: COUNTY_BOUNDARIES_STATE_STROKE,
    }).toStrictEqual({
      background: "#F8FAFC",
      county: "#4B5563",
      fill: "#F3F4F6",
      selected: "#000000",
      state: "#1F2937",
    });
    const widths = (expression: readonly unknown[]): number[] => {
      const numbers: number[] = [];
      for (const value of expression) {
        if (typeof value === "number") {
          numbers.push(value);
        }
      }
      return numbers.filter((_, index) => index % 2 === 1);
    };
    const countyWidths = widths(COUNTY_BOUNDARY_COUNTY_LINE_WIDTH);
    const stateWidths = widths(COUNTY_BOUNDARY_STATE_LINE_WIDTH);
    expect(
      countyWidths.every(
        (width, index) =>
          width < (stateWidths[index] ?? Number.POSITIVE_INFINITY)
      )
    ).toBeTruthy();
  });
});
