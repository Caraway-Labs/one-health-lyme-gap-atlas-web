import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countyFeatureBounds,
  countyIsSubstantiallyVisible,
  estimatedFitZoom,
  fitCountyBounds,
  mapCameraDuration,
  type CountyBounds,
  type FitCountyMap,
} from "../src/lib/atlas-map-camera";

const SMALL_COUNTY: CountyBounds = [-105.2, 39.6, -104.7, 40];
const CONTIGUOUS_US_VIEWPORT: CountyBounds = [-125, 24, -66, 50];
const NATIONAL_ZOOM = 3.05;

const adamsPolygon: GeoJSON.Feature = {
  type: "Feature",
  properties: { fips: "08001" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-104.2, 39.7],
        [-103.9, 39.7],
        [-103.9, 40],
        [-104.2, 40],
        [-104.2, 39.7],
      ],
    ],
  },
};

const twoPartMultiPolygon: GeoJSON.Feature = {
  type: "Feature",
  properties: { fips: "06037" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [-118.7, 33.7],
          [-118.4, 33.7],
          [-118.4, 34],
          [-118.7, 34],
          [-118.7, 33.7],
        ],
      ],
      [
        [
          [-118.5, 33.3],
          [-118.3, 33.3],
          [-118.3, 33.5],
          [-118.5, 33.5],
          [-118.5, 33.3],
        ],
      ],
    ],
  },
};

function stubPrefersReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener() {},
    addListener() {},
    dispatchEvent() {
      return false;
    },
    matches: query === "(prefers-reduced-motion: reduce)" && matches,
    media: query,
    onchange: null,
    removeEventListener() {},
    removeListener() {},
  }));
}

describe("polygon and multipolygon bounds", () => {
  it("returns west-south-east-north bounds for a Polygon", () => {
    expect(countyFeatureBounds(adamsPolygon)).toStrictEqual([
      -104.2, 39.7, -103.9, 40,
    ]);
  });

  it("unions MultiPolygon rings into a single bbox", () => {
    expect(countyFeatureBounds(twoPartMultiPolygon)).toStrictEqual([
      -118.7, 33.3, -118.3, 34,
    ]);
  });

  it("returns null for missing, empty, Point, and non-finite geometry", () => {
    expect(countyFeatureBounds(null)).toBeNull();
    expect(
      countyFeatureBounds({
        type: "Feature",
        properties: { fips: "08001" },
        geometry: null,
      })
    ).toBeNull();
    expect(
      countyFeatureBounds({
        type: "Feature",
        properties: { fips: "08001" },
        geometry: { type: "Polygon", coordinates: [] },
      })
    ).toBeNull();
    expect(
      countyFeatureBounds({
        type: "Feature",
        properties: { fips: "08001" },
        geometry: { type: "Point", coordinates: [-104.2, 39.8] },
      })
    ).toBeNull();
  });

  it("returns null when a polygon coordinate is not finite", () => {
    expect(
      countyFeatureBounds({
        type: "Feature",
        properties: { fips: "08001" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [Number.NaN, 39.7],
              [-103.9, 39.7],
              [-103.9, 40],
            ],
          ],
        },
      })
    ).toBeNull();
  });

  it("returns null for Alaska and Hawaii FIPS even with polygon geometry", () => {
    const alaska = {
      ...adamsPolygon,
      properties: { fips: "02013" },
    };
    const hawaii = {
      ...adamsPolygon,
      properties: { fips: "15001" },
    };
    expect(countyFeatureBounds(alaska)).toBeNull();
    expect(countyFeatureBounds(hawaii)).toBeNull();
  });
});

describe("estimated county fit zoom", () => {
  it("maps national-scale spans near minZoom and county-scale spans near maxZoom", () => {
    expect(estimatedFitZoom(CONTIGUOUS_US_VIEWPORT)).toBeGreaterThanOrEqual(2);
    expect(estimatedFitZoom(CONTIGUOUS_US_VIEWPORT)).toBeLessThan(4);
    expect(estimatedFitZoom(SMALL_COUNTY)).toBe(8);
  });
});

describe("substantial county visibility", () => {
  it("does not treat a small county in the national viewport as visible", () => {
    expect(
      countyIsSubstantiallyVisible({
        viewport: CONTIGUOUS_US_VIEWPORT,
        county: SMALL_COUNTY,
        currentZoom: NATIONAL_ZOOM,
      })
    ).toBeFalsy();
  });

  it("counts a zoomed-in matching viewport as visible", () => {
    const fitZoom = estimatedFitZoom(SMALL_COUNTY);
    expect(
      countyIsSubstantiallyVisible({
        viewport: [-105.35, 39.45, -104.55, 40.15],
        county: SMALL_COUNTY,
        currentZoom: fitZoom,
      })
    ).toBeTruthy();
  });

  it("returns false when the county is mostly outside the viewport", () => {
    expect(
      countyIsSubstantiallyVisible({
        viewport: [-122.5, 36.5, -121.5, 37.5],
        county: SMALL_COUNTY,
        currentZoom: estimatedFitZoom(SMALL_COUNTY),
      })
    ).toBeFalsy();
  });
});

describe("fit county bounds helper", () => {
  it("stops the current camera then fits with default padding and maxZoom", () => {
    const calls: string[] = [];
    let recorded: Parameters<FitCountyMap["fitBounds"]> | undefined;
    const map: FitCountyMap = {
      stop: () => {
        calls.push("stop");
      },
      fitBounds: (bounds, options) => {
        calls.push("fitBounds");
        recorded = [bounds, options];
      },
    };

    fitCountyBounds(map, SMALL_COUNTY);

    expect(calls).toStrictEqual(["stop", "fitBounds"]);
    expect(recorded).toStrictEqual([
      SMALL_COUNTY,
      { duration: 450, maxZoom: 8, padding: 48 },
    ]);
  });
});

describe("map camera duration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the animated duration when reduced motion is not preferred", () => {
    stubPrefersReducedMotion(false);
    expect(mapCameraDuration()).toBe(450);
    expect(mapCameraDuration(200)).toBe(200);
  });

  it("returns 0 when matchMedia reports prefers-reduced-motion", () => {
    stubPrefersReducedMotion(true);
    expect(mapCameraDuration()).toBe(0);
    expect(mapCameraDuration(450)).toBe(0);
  });
});
