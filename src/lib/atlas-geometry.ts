import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

const EXCLUDED_MAP_STATE_FIPS = new Set(["02", "15"]);

/** The initial viewport intentionally frames the contiguous U.S. only. */
export const CONTIGUOUS_US_INITIAL_VIEW = {
  center: [-96.5, 38.5] as [number, number],
  zoom: 3.05,
};

export function isContiguousUsCounty(fips: string): boolean {
  return !EXCLUDED_MAP_STATE_FIPS.has(fips.slice(0, 2));
}

/** Filters display-geometry features to the contiguous U.S. map viewport. */
export function contiguousUsGeometry(
  geometry: CountyDisplayGeometryFeatureCollection
): CountyDisplayGeometryFeatureCollection {
  return {
    ...geometry,
    features: geometry.features.filter((feature) =>
      isContiguousUsCounty(feature.properties.fips)
    ),
  };
}
