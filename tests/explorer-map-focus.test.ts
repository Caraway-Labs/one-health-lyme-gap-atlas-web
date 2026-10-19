import { describe, expect, it } from "vitest";

import {
  explorerFocusCountyMismatch,
  explorerMapDrillAction,
  explorerStateFromCountyFips,
  explorerStateGeometryBounds,
  parseExplorerMapFocus,
} from "@/features/ux-reset/review/explorer-map-focus";

function box(
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

describe("explorer map focus", () => {
  it("accepts a lower-48 or DC postal code and rejects Alaska and Hawaii", () => {
    expect(parseExplorerMapFocus(" id ")).toBe("ID");
    expect(parseExplorerMapFocus("DC")).toBe("DC");
    expect(parseExplorerMapFocus("AK")).toBeNull();
    expect(parseExplorerMapFocus("HI")).toBeNull();
    expect(parseExplorerMapFocus("USA")).toBeNull();
  });

  it("rejects a county that is outside the focused state", () => {
    expect({
      match: explorerFocusCountyMismatch("ID", "16001"),
      missingCounty: explorerFocusCountyMismatch("ID", null),
      missingFocus: explorerFocusCountyMismatch(null, "56039"),
      outside: explorerFocusCountyMismatch("ID", "56039"),
    }).toStrictEqual({
      match: false,
      missingCounty: false,
      missingFocus: false,
      outside: true,
    });
  });

  it("reads the containing state from the county FIPS prefix", () => {
    expect(explorerStateFromCountyFips("16001")).toBe("ID");
    expect(explorerStateFromCountyFips("11001")).toBe("DC");
    expect(explorerStateFromCountyFips("02013")).toBeNull();
    expect(explorerStateFromCountyFips("1600")).toBeNull();
  });

  it("focuses the state on the first click and selects a county on the next", () => {
    expect(
      explorerMapDrillAction({
        clickDetail: 1,
        fips: "16001",
        focusedState: null,
      })
    ).toStrictEqual({ state: "ID", type: "focus-state" });
    expect(
      explorerMapDrillAction({
        clickDetail: 1,
        fips: "16001",
        focusedState: "ID",
      })
    ).toStrictEqual({ fips: "16001", state: "ID", type: "select-county" });
    expect(
      explorerMapDrillAction({
        clickDetail: 1,
        fips: "56039",
        focusedState: "ID",
      })
    ).toStrictEqual({ state: "WY", type: "focus-state" });
  });

  it("does not advance a double-click or a county outside the lower 48", () => {
    expect(
      explorerMapDrillAction({
        clickDetail: 2,
        fips: "16001",
        focusedState: null,
      })
    ).toStrictEqual({ type: "ignore" });
    expect(
      explorerMapDrillAction({
        clickDetail: 2,
        fips: "16001",
        focusedState: "ID",
      })
    ).toStrictEqual({ type: "ignore" });
    expect(
      explorerMapDrillAction({
        clickDetail: 1,
        fips: "02013",
        focusedState: null,
      })
    ).toStrictEqual({ type: "ignore" });
  });

  it("fits state bounds from geometry FIPS, ignoring fill color", () => {
    const geometry: GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { color?: string; fips: string }
    > = {
      features: [
        {
          ...box("16001", -116.8, 43.2, -115.2, 44.2),
          properties: { color: "#ffffff", fips: "16001" },
        },
        {
          ...box("16085", -117.2, 44.2, -111.2, 48.8),
          properties: { color: "#111111", fips: "16085" },
        },
        {
          ...box("56039", -111, 42.5, -109.8, 44.2),
          properties: { color: "#000000", fips: "56039" },
        },
        box("02013", -150, 60, -149, 61),
      ],
      type: "FeatureCollection",
    };

    expect(explorerStateGeometryBounds(geometry, "ID")).toStrictEqual([
      -117.2, 43.2, -111.2, 48.8,
    ]);
    expect(explorerStateGeometryBounds(geometry, "WY")).toStrictEqual([
      -111, 42.5, -109.8, 44.2,
    ]);
    expect(explorerStateGeometryBounds(geometry, "AK")).toBeNull();
    expect(explorerStateGeometryBounds(geometry, "DC")).toBeNull();
  });
});
