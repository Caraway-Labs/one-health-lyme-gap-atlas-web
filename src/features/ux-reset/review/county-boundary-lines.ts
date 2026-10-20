import { postalCodeForStateFips } from "@/features/ux-reset/review/review-state-fips";

/**
 * State perimeters from county polygons. Census counties do not share identical
 * vertices, so each border is sampled onto a grid of about 1.3 km. An edge
 * that mostly sits in one state and more than one county is an interior county
 * line and is dropped. Coast and interstate borders stay.
 */

const SAMPLE_CELL_DEGREES = 0.012;
// A shared county border usually lands in the same sample cell. Real state
// and coast edges stay near a 0 share. Edges with a modest same-state share
// are interior county borders that the grid only partly matched.
const INTERIOR_SHARE = 0.2;
const MIN_STATE_LINE_DEGREES = 0.08;

export type StateBoundaryProperties = {
  state: string;
};

export type StateBoundaryFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiLineString,
  StateBoundaryProperties
>;

type BoundaryFeature = {
  geometry?: GeoJSON.Geometry | null;
  properties?: { fips?: string } | null;
};

type Point = readonly [number, number];

type SampleCell = {
  countyA: string;
  countyB: string | null;
  stateA: string;
  stateB: string | null;
};

type PreparedEdge = {
  end: GeoJSON.Position;
  endKey: string;
  start: GeoJSON.Position;
  startKey: string;
  state: string;
  steps: number;
};

function ringsFromGeometry(
  geometry: GeoJSON.Geometry | null | undefined
): GeoJSON.Position[][] {
  if (!geometry) {
    return [];
  }
  switch (geometry.type) {
    case "Polygon": {
      return geometry.coordinates;
    }
    case "MultiPolygon": {
      const rings: GeoJSON.Position[][] = [];
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          rings.push(ring);
        }
      }
      return rings;
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
      void exhaustive;
      return [];
    }
  }
}

function cellKey(longitude: number, latitude: number): string {
  const x = Math.round(longitude / SAMPLE_CELL_DEGREES);
  const y = Math.round(latitude / SAMPLE_CELL_DEGREES);
  return `${x}:${y}`;
}

function pointKey(position: GeoJSON.Position): string | null {
  const longitude = position[0];
  const latitude = position[1];
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return null;
  }
  if (!(Number.isFinite(longitude) && Number.isFinite(latitude))) {
    return null;
  }
  return `${longitude},${latitude}`;
}

function rememberPoint(
  points: Map<string, Point>,
  position: GeoJSON.Position,
  key: string
): void {
  if (points.has(key)) {
    return;
  }
  const longitude = position[0];
  const latitude = position[1];
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return;
  }
  points.set(key, [longitude, latitude]);
}

function noteSample(
  cells: Map<string, SampleCell>,
  longitude: number,
  latitude: number,
  state: string,
  fips: string
): void {
  const key = cellKey(longitude, latitude);
  const current = cells.get(key);
  if (!current) {
    cells.set(key, {
      countyA: fips,
      countyB: null,
      stateA: state,
      stateB: null,
    });
    return;
  }
  if (current.stateA !== state && current.stateB === null) {
    current.stateB = state;
  }
  if (current.countyA !== fips && current.countyB === null) {
    current.countyB = fips;
  }
}

function sampleEdge(
  cells: Map<string, SampleCell>,
  start: GeoJSON.Position,
  end: GeoJSON.Position,
  state: string,
  fips: string
): number {
  const startLon = start[0];
  const startLat = start[1];
  const endLon = end[0];
  const endLat = end[1];
  if (
    typeof startLon !== "number" ||
    typeof startLat !== "number" ||
    typeof endLon !== "number" ||
    typeof endLat !== "number"
  ) {
    return 0;
  }
  const steps = Math.max(
    1,
    Math.ceil(
      Math.hypot(endLon - startLon, endLat - startLat) / SAMPLE_CELL_DEGREES
    )
  );
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    noteSample(
      cells,
      startLon + (endLon - startLon) * ratio,
      startLat + (endLat - startLat) * ratio,
      state,
      fips
    );
  }
  return steps;
}

function interiorShare(
  cells: ReadonlyMap<string, SampleCell>,
  start: GeoJSON.Position,
  end: GeoJSON.Position,
  steps: number
): number {
  const startLon = start[0];
  const startLat = start[1];
  const endLon = end[0];
  const endLat = end[1];
  if (
    typeof startLon !== "number" ||
    typeof startLat !== "number" ||
    typeof endLon !== "number" ||
    typeof endLat !== "number"
  ) {
    return 1;
  }
  let interior = 0;
  let total = 0;
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const cell = cells.get(
      cellKey(
        startLon + (endLon - startLon) * ratio,
        startLat + (endLat - startLat) * ratio
      )
    );
    if (!cell) {
      continue;
    }
    total += 1;
    const oneState = cell.stateB === null || cell.stateB === cell.stateA;
    if (oneState && cell.countyB !== null) {
      interior += 1;
    }
  }
  if (total === 0) {
    return 1;
  }
  return interior / total;
}

function lineLength(line: readonly (readonly number[])[]): number {
  let span = 0;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (!(start && end)) {
      continue;
    }
    const startLon = start[0] ?? 0;
    const startLat = start[1] ?? 0;
    const endLon = end[0] ?? 0;
    const endLat = end[1] ?? 0;
    span += Math.hypot(startLon - endLon, startLat - endLat);
  }
  return span;
}

function link(
  adjacency: Map<string, string[]>,
  left: string,
  right: string
): void {
  const leftNeighbors = adjacency.get(left);
  if (leftNeighbors) {
    if (!leftNeighbors.includes(right)) {
      leftNeighbors.push(right);
    }
  } else {
    adjacency.set(left, [right]);
  }
  const rightNeighbors = adjacency.get(right);
  if (rightNeighbors) {
    if (!rightNeighbors.includes(left)) {
      rightNeighbors.push(left);
    }
  } else {
    adjacency.set(right, [left]);
  }
}

function undirectedKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function traceLines(
  adjacency: ReadonlyMap<string, readonly string[]>,
  points: ReadonlyMap<string, Point>
): number[][][] {
  const unused = new Set<string>();
  for (const [point, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      unused.add(undirectedKey(point, neighbor));
    }
  }
  const lines: number[][][] = [];
  for (const [start, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      const firstKey = undirectedKey(start, neighbor);
      if (!unused.has(firstKey)) {
        continue;
      }
      const line: number[][] = [];
      const startPoint = points.get(start);
      if (startPoint) {
        line.push([startPoint[0], startPoint[1]]);
      }
      unused.delete(firstKey);
      let previous = start;
      let current = neighbor;
      while (line.length < 100_000) {
        const point = points.get(current);
        if (point) {
          line.push([point[0], point[1]]);
        }
        if (current === start) {
          break;
        }
        const nextNeighbors = adjacency.get(current) ?? [];
        let onward: string | null = null;
        for (const candidate of nextNeighbors) {
          if (candidate === previous) {
            continue;
          }
          const key = undirectedKey(current, candidate);
          if (unused.has(key)) {
            onward = candidate;
            unused.delete(key);
            break;
          }
        }
        if (!onward) {
          break;
        }
        previous = current;
        current = onward;
      }
      if (line.length >= 2) {
        lines.push(line);
      }
    }
  }
  return lines;
}

export function stateBoundaryLines(geometry: {
  features: readonly BoundaryFeature[];
}): StateBoundaryFeatureCollection {
  const cells = new Map<string, SampleCell>();
  const prepared: PreparedEdge[] = [];
  for (const feature of geometry.features) {
    const fips = feature.properties?.fips ?? "";
    if (fips.length < 2) {
      continue;
    }
    const state = postalCodeForStateFips(fips.slice(0, 2));
    if (!state) {
      continue;
    }
    for (const ring of ringsFromGeometry(feature.geometry)) {
      if (ring.length < 2) {
        continue;
      }
      const closed = pointKey(ring[0] ?? []) === pointKey(ring.at(-1) ?? []);
      const last = closed ? ring.length - 1 : ring.length;
      for (let index = 0; index < last; index += 1) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        if (!(start && end)) {
          continue;
        }
        const startKey = pointKey(start);
        const endKey = pointKey(end);
        if (!(startKey && endKey) || startKey === endKey) {
          continue;
        }
        prepared.push({
          end,
          endKey,
          start,
          startKey,
          state,
          steps: sampleEdge(cells, start, end, state, fips),
        });
      }
    }
  }

  const byState = new Map<
    string,
    { adjacency: Map<string, string[]>; points: Map<string, Point> }
  >();
  for (const edge of prepared) {
    if (
      interiorShare(cells, edge.start, edge.end, edge.steps) >= INTERIOR_SHARE
    ) {
      continue;
    }
    let group = byState.get(edge.state);
    if (!group) {
      group = { adjacency: new Map(), points: new Map() };
      byState.set(edge.state, group);
    }
    rememberPoint(group.points, edge.start, edge.startKey);
    rememberPoint(group.points, edge.end, edge.endKey);
    link(group.adjacency, edge.startKey, edge.endKey);
  }

  const features: StateBoundaryFeatureCollection["features"] = [];
  for (const [state, group] of byState) {
    const lines = traceLines(group.adjacency, group.points).filter(
      (line) => lineLength(line) >= MIN_STATE_LINE_DEGREES
    );
    if (lines.length === 0) {
      continue;
    }
    features.push({
      geometry: { coordinates: lines, type: "MultiLineString" },
      properties: { state },
      type: "Feature",
    });
  }
  features.sort((left, right) =>
    left.properties.state.localeCompare(right.properties.state)
  );
  return { features, type: "FeatureCollection" };
}
