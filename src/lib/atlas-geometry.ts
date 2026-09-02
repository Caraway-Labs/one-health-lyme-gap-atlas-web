const EXCLUDED_MAP_STATE_FIPS = new Set(["02", "15"]);

/** The initial viewport intentionally frames the contiguous U.S. only. */
export const CONTIGUOUS_US_INITIAL_VIEW = {
  center: [-96.5, 38.5] as [number, number],
  zoom: 3.05,
};

export function isContiguousUsCounty(fips: string): boolean {
  return !EXCLUDED_MAP_STATE_FIPS.has(fips.slice(0, 2));
}

export function contiguousUsGeometry(
  geometry: GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips: string }>
): GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips: string }> {
  return {
    ...geometry,
    features: geometry.features.filter((feature) =>
      isContiguousUsCounty(feature.properties.fips)
    ),
  };
}
