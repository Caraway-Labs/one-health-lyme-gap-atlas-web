import { COUNTY_BOUNDARY_SHARED_EDGE_DEGREES } from "@/features/ux-reset/review/county-boundaries-palette";

export type CountyBoundaryFeature = {
  geometry?: GeoJSON.Geometry | null;
  properties?: { fips?: string } | null;
};

type Segment = {
  a: GeoJSON.Position;
  b: GeoJSON.Position;
  county: number;
  state: string;
};

const GRID_DEGREES = 0.15;

function exteriorRings(geometry: GeoJSON.Geometry): GeoJSON.Position[][] {
  switch (geometry.type) {
    case "Polygon": {
      const ring = geometry.coordinates[0];
      return ring ? [ring] : [];
    }
    case "MultiPolygon": {
      return geometry.coordinates.flatMap((polygon) => {
        const ring = polygon[0];
        return ring ? [ring] : [];
      });
    }
    case "GeometryCollection":
    case "LineString":
    case "MultiLineString":
    case "MultiPoint":
    case "Point": {
      return [];
    }
    default: {
      const exhaustive: never = geometry;
      return exhaustive;
    }
  }
}

function pointKey(position: GeoJSON.Position): string {
  return `${position[0]},${position[1]}`;
}

function distanceToSegment(
  point: GeoJSON.Position,
  start: GeoJSON.Position,
  end: GeoJSON.Position
): number {
  const dx = (end[0] ?? 0) - (start[0] ?? 0);
  const dy = (end[1] ?? 0) - (start[1] ?? 0);
  const lengthSquared = dx * dx + dy * dy;
  const px = point[0] ?? 0;
  const py = point[1] ?? 0;
  if (lengthSquared === 0) {
    return Math.hypot(px - (start[0] ?? 0), py - (start[1] ?? 0));
  }
  const t = Math.min(
    1,
    Math.max(
      0,
      ((px - (start[0] ?? 0)) * dx + (py - (start[1] ?? 0)) * dy) /
        lengthSquared
    )
  );
  return Math.hypot(
    px - ((start[0] ?? 0) + t * dx),
    py - ((start[1] ?? 0) + t * dy)
  );
}

function indexSegments(segments: readonly Segment[]): Map<string, Segment[]> {
  const grid = new Map<string, Segment[]>();
  for (const segment of segments) {
    const minX = Math.min(segment.a[0] ?? 0, segment.b[0] ?? 0);
    const maxX = Math.max(segment.a[0] ?? 0, segment.b[0] ?? 0);
    const minY = Math.min(segment.a[1] ?? 0, segment.b[1] ?? 0);
    const maxY = Math.max(segment.a[1] ?? 0, segment.b[1] ?? 0);
    for (
      let x = Math.floor(minX / GRID_DEGREES);
      x <= Math.floor(maxX / GRID_DEGREES);
      x += 1
    ) {
      for (
        let y = Math.floor(minY / GRID_DEGREES);
        y <= Math.floor(maxY / GRID_DEGREES);
        y += 1
      ) {
        const key = `${x}:${y}`;
        const bucket = grid.get(key);
        if (bucket) {
          bucket.push(segment);
        } else {
          grid.set(key, [segment]);
        }
      }
    }
  }
  return grid;
}

function hasSameStateNeighbor(
  segment: Segment,
  grid: ReadonlyMap<string, readonly Segment[]>
): boolean {
  const longitude = ((segment.a[0] ?? 0) + (segment.b[0] ?? 0)) / 2;
  const latitude = ((segment.a[1] ?? 0) + (segment.b[1] ?? 0)) / 2;
  const x = Math.floor(longitude / GRID_DEGREES);
  const y = Math.floor(latitude / GRID_DEGREES);
  const midpoint: GeoJSON.Position = [longitude, latitude];
  for (let ix = x - 1; ix <= x + 1; ix += 1) {
    for (let iy = y - 1; iy <= y + 1; iy += 1) {
      const bucket = grid.get(`${ix}:${iy}`);
      if (!bucket) {
        continue;
      }
      for (const other of bucket) {
        if (other.county === segment.county || other.state !== segment.state) {
          continue;
        }
        if (
          distanceToSegment(midpoint, other.a, other.b) <=
          COUNTY_BOUNDARY_SHARED_EDGE_DEGREES
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function chainSegments(segments: readonly Segment[]): GeoJSON.Position[][] {
  const unused = new Set(segments.map((_, index) => index));
  const starts = new Map<string, number[]>();
  const ends = new Map<string, number[]>();
  for (const [index, segment] of segments.entries()) {
    const start = pointKey(segment.a);
    const end = pointKey(segment.b);
    const startIndexes = starts.get(start) ?? [];
    startIndexes.push(index);
    starts.set(start, startIndexes);
    const endIndexes = ends.get(end) ?? [];
    endIndexes.push(index);
    ends.set(end, endIndexes);
  }
  const lines: GeoJSON.Position[][] = [];
  while (unused.size > 0) {
    const first = unused.values().next().value;
    if (first === undefined) {
      break;
    }
    unused.delete(first);
    const seed = segments[first];
    if (!seed) {
      continue;
    }
    const line = [seed.a, seed.b];
    let guard = 0;
    while (guard < segments.length) {
      guard += 1;
      const tail = line.at(-1);
      if (!tail) {
        break;
      }
      const next = (starts.get(pointKey(tail)) ?? []).find((index) =>
        unused.has(index)
      );
      if (next === undefined) {
        break;
      }
      unused.delete(next);
      const nextSegment = segments[next];
      if (!nextSegment) {
        break;
      }
      line.push(nextSegment.b);
    }
    guard = 0;
    while (guard < segments.length) {
      guard += 1;
      const head = line[0];
      if (!head) {
        break;
      }
      const previous = (ends.get(pointKey(head)) ?? []).find((index) =>
        unused.has(index)
      );
      if (previous === undefined) {
        break;
      }
      unused.delete(previous);
      const previousSegment = segments[previous];
      if (!previousSegment) {
        break;
      }
      line.unshift(previousSegment.a);
    }
    lines.push(line);
  }
  return lines;
}

function lineCollection(
  segments: readonly Segment[]
): GeoJSON.FeatureCollection<GeoJSON.MultiLineString> {
  return {
    features:
      segments.length === 0
        ? []
        : [
            {
              geometry: {
                coordinates: chainSegments(segments),
                type: "MultiLineString",
              },
              properties: {},
              type: "Feature",
            },
          ],
    type: "FeatureCollection",
  };
}

/**
 * State perimeters from county display polygons.
 * Interior county borders are omitted. Coastline and interstate edges remain.
 */
export function stateBoundaryCollections(
  features: readonly CountyBoundaryFeature[],
  selectedStateFips: string | null
): {
  selectedStateLines: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>;
  stateLines: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>;
} {
  const segments: Segment[] = [];
  for (const [county, feature] of features.entries()) {
    const fips = feature.properties?.fips;
    const geometry = feature.geometry;
    if (!fips || fips.length < 2 || !geometry) {
      continue;
    }
    const state = fips.slice(0, 2);
    for (const ring of exteriorRings(geometry)) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const start = ring[index];
        const end = ring[index + 1];
        if (!(start && end)) {
          continue;
        }
        if (pointKey(start) === pointKey(end)) {
          continue;
        }
        segments.push({ a: start, b: end, county, state });
      }
    }
  }
  const grid = indexSegments(segments);
  const outer = segments.filter(
    (segment) => !hasSameStateNeighbor(segment, grid)
  );
  const selected = selectedStateFips
    ? outer.filter((segment) => segment.state === selectedStateFips)
    : [];
  return {
    selectedStateLines: lineCollection(selected),
    stateLines: lineCollection(outer),
  };
}
