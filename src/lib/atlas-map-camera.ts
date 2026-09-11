import { isContiguousUsCounty } from "@/lib/atlas-geometry";

export type CountyBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type FitCountyMap = {
  stop: () => void;
  fitBounds: (
    bounds: CountyBounds,
    options: { duration: number; maxZoom: number; padding: number }
  ) => void;
};

const DEFAULT_CAMERA_DURATION_MS = 450;
const DEFAULT_FIT_MAX_ZOOM = 8;
const DEFAULT_FIT_MIN_ZOOM = 2;
const DEFAULT_FIT_PADDING_PX = 48;
const NEAR_CONTAINMENT_RATIO = 0.9;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SUBSTANTIAL_ZOOM_TOLERANCE = 0.4;
const WORLD_LONGITUDE_SPAN_DEG = 360;

function fipsFromFeature(
  feature: GeoJSON.Feature<GeoJSON.Geometry | null>
): string | undefined {
  const fips = feature.properties?.fips;
  return typeof fips === "string" ? fips : undefined;
}

function positionsFromPolygon(rings: GeoJSON.Position[][]): GeoJSON.Position[] {
  const positions: GeoJSON.Position[] = [];
  for (const ring of rings) {
    for (const position of ring) {
      positions.push(position);
    }
  }
  return positions;
}

function positionsFromGeometry(
  geometry: GeoJSON.Geometry
): GeoJSON.Position[] | null {
  switch (geometry.type) {
    case "Polygon": {
      return positionsFromPolygon(geometry.coordinates);
    }
    case "MultiPolygon": {
      const positions: GeoJSON.Position[] = [];
      for (const polygon of geometry.coordinates) {
        for (const position of positionsFromPolygon(polygon)) {
          positions.push(position);
        }
      }
      return positions;
    }
    case "GeometryCollection":
    case "LineString":
    case "MultiLineString":
    case "MultiPoint":
    case "Point": {
      return null;
    }
    default: {
      const exhaustive: never = geometry;
      return exhaustive;
    }
  }
}

function boundsFromPositions(
  positions: GeoJSON.Position[]
): CountyBounds | null {
  if (positions.length === 0) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const position of positions) {
    const lng = position[0];
    const lat = position[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }

  return [west, south, east, north];
}

function countyOverlapRatio(
  viewport: CountyBounds,
  county: CountyBounds
): number {
  const [viewportWest, viewportSouth, viewportEast, viewportNorth] = viewport;
  const [countyWest, countySouth, countyEast, countyNorth] = county;
  const countyLngSpan = countyEast - countyWest;
  const countyLatSpan = countyNorth - countySouth;
  if (!(countyLngSpan > 0) || !(countyLatSpan > 0)) {
    const inside =
      countyWest >= viewportWest &&
      countyEast <= viewportEast &&
      countySouth >= viewportSouth &&
      countyNorth <= viewportNorth;
    return inside ? 1 : 0;
  }

  const overlapWest = Math.max(viewportWest, countyWest);
  const overlapSouth = Math.max(viewportSouth, countySouth);
  const overlapEast = Math.min(viewportEast, countyEast);
  const overlapNorth = Math.min(viewportNorth, countyNorth);
  const overlapLng = Math.max(0, overlapEast - overlapWest);
  const overlapLat = Math.max(0, overlapNorth - overlapSouth);
  return (overlapLng * overlapLat) / (countyLngSpan * countyLatSpan);
}

export function countyFeatureBounds(
  feature: GeoJSON.Feature<GeoJSON.Geometry | null> | undefined | null
): CountyBounds | null {
  if (!feature?.geometry) {
    return null;
  }

  const fips = fipsFromFeature(feature);
  if (fips !== undefined && !isContiguousUsCounty(fips)) {
    return null;
  }

  const positions = positionsFromGeometry(feature.geometry);
  if (positions === null) {
    return null;
  }
  return boundsFromPositions(positions);
}

export function estimatedFitZoom(
  bounds: CountyBounds,
  maxZoom = DEFAULT_FIT_MAX_ZOOM,
  minZoom = DEFAULT_FIT_MIN_ZOOM
): number {
  const [west, south, east, north] = bounds;
  const span = Math.max(east - west, north - south);
  if (!(span > 0) || !Number.isFinite(span)) {
    return maxZoom;
  }

  const zoom = Math.log2(WORLD_LONGITUDE_SPAN_DEG / span);
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

export function countyIsSubstantiallyVisible(input: {
  viewport: CountyBounds;
  county: CountyBounds;
  currentZoom: number;
  maxZoom?: number;
  minZoom?: number;
}): boolean {
  const {
    viewport,
    county,
    currentZoom,
    maxZoom = DEFAULT_FIT_MAX_ZOOM,
    minZoom = DEFAULT_FIT_MIN_ZOOM,
  } = input;
  if (countyOverlapRatio(viewport, county) < NEAR_CONTAINMENT_RATIO) {
    return false;
  }

  const targetZoom = estimatedFitZoom(county, maxZoom, minZoom);
  return Math.abs(currentZoom - targetZoom) <= SUBSTANTIAL_ZOOM_TOLERANCE;
}

export function fitCountyBounds(
  map: FitCountyMap,
  bounds: CountyBounds,
  options?: {
    duration?: number;
    maxZoom?: number;
    padding?: number;
    stop?: boolean;
  }
): void {
  if (options?.stop !== false) {
    map.stop();
  }
  map.fitBounds(bounds, {
    duration: options?.duration ?? DEFAULT_CAMERA_DURATION_MS,
    maxZoom: options?.maxZoom ?? DEFAULT_FIT_MAX_ZOOM,
    padding: options?.padding ?? DEFAULT_FIT_PADDING_PX,
  });
}

export function mapCameraDuration(
  animatedMs = DEFAULT_CAMERA_DURATION_MS
): number {
  if (typeof window === "undefined") {
    return animatedMs;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches ? 0 : animatedMs;
}
