/**
 * Projects governed county display geometry into the Front Porch illustration.
 *
 * The authenticated map paints `GET /v1/atlas/geometry` (CDC/ATSDR SVI 2022,
 * EPSG:4326) with MapLibre's spherical Mercator (EPSG:3857). This uses that
 * same projection. The EPSG:3857 Earth-radius factor is a uniform scale, so
 * omitting it does not change the shape. Y is flipped for SVG and the result
 * is uniformly contained in the illustration slot below.
 *
 * Vertices are rounded to 0.1 SVG user units. The maximum error is 0.05 per
 * axis, which is finer than the source geometry's 0.001-degree quantization
 * at this drawing size. Rounding does not drop rings or vertices. MapLibre's
 * remaining difference is camera fit (padding and zoom), not another boundary
 * and not further generalization.
 */

export const FRONT_PORCH_MAP_VIEWBOX = {
  height: 480,
  width: 600,
} as const;

/**
 * Axis-aligned slot already occupied by the county drawing in the 600×480
 * viewBox. This is illustration layout, not a second county boundary.
 */
export const FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT = {
  maxX: 439.8,
  maxY: 419.4,
  minX: 147.9,
  minY: 98,
} as const;

export const FRONT_PORCH_SVG_COORDINATE_DECIMALS = 1;

/** Half of the 0.1 user-unit rounding quantum. */
export const FRONT_PORCH_SVG_ROUNDING_TOLERANCE = 0.05;

export const FRONT_PORCH_OUTLINE_PROJECTION =
  "Spherical Mercator (EPSG:3857) with the Earth-radius scale omitted, Y flipped into SVG, uniformly contained in the existing 600x480 illustration slot, rounded to 0.1 user units (maximum error 0.05 per axis). MapLibre uses the same projection; the remaining difference is camera fit, not a second boundary or further generalization.";

export type IllustrationSlot = {
  readonly maxX: number;
  readonly maxY: number;
  readonly minX: number;
  readonly minY: number;
};

export type ProjectedRing = readonly (readonly [number, number])[];

const DEGREES_TO_RADIANS = Math.PI / 180;
const MERCATOR_LATITUDE_LIMIT = 90;

function assertIllustrationSlot(slot: IllustrationSlot): void {
  const insideViewBox =
    slot.minX >= 0 &&
    slot.minY >= 0 &&
    slot.maxX <= FRONT_PORCH_MAP_VIEWBOX.width &&
    slot.maxY <= FRONT_PORCH_MAP_VIEWBOX.height &&
    slot.maxX > slot.minX &&
    slot.maxY > slot.minY;
  if (!insideViewBox) {
    throw new Error(
      "The county illustration slot must sit inside the 600 by 480 viewBox."
    );
  }
}

function assertClosedRing(ring: GeoJSON.Position[], label: string): void {
  const first = ring[0];
  const last = ring.at(-1);
  const closed =
    ring.length >= 4 &&
    first?.[0] === last?.[0] &&
    first?.[1] === last?.[1] &&
    typeof first?.[0] === "number" &&
    typeof first?.[1] === "number";
  if (!closed) {
    throw new Error(`${label} must stay a closed ring.`);
  }
}

function polygonsFromGeometry(
  geometry: GeoJSON.Geometry
): GeoJSON.Position[][][] {
  switch (geometry.type) {
    case "Polygon": {
      return [geometry.coordinates];
    }
    case "MultiPolygon": {
      return geometry.coordinates;
    }
    case "GeometryCollection":
    case "LineString":
    case "MultiLineString":
    case "MultiPoint":
    case "Point": {
      throw new Error(
        `Front Porch county outlines require polygon display geometry, received ${geometry.type}.`
      );
    }
    default: {
      const exhaustive: never = geometry;
      throw new Error(
        `Front Porch county outlines require polygon display geometry, received ${String(exhaustive)}.`
      );
    }
  }
}

function projectMercator(
  position: GeoJSON.Position
): readonly [number, number] {
  const longitude = position[0];
  const latitude = position[1];
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    throw new TypeError(
      "Display geometry positions must include numeric longitude and latitude."
    );
  }
  if (
    latitude <= -MERCATOR_LATITUDE_LIMIT ||
    latitude >= MERCATOR_LATITUDE_LIMIT
  ) {
    throw new Error(
      "Display geometry latitude is outside the Mercator domain."
    );
  }
  const phi = latitude * DEGREES_TO_RADIANS;
  return [
    longitude * DEGREES_TO_RADIANS,
    Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  ];
}

type MercatorBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

function boundsOf(rings: readonly ProjectedRing[]): MercatorBounds {
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }
  }
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY) ||
    maxX === minX ||
    maxY === minY
  ) {
    throw new Error(
      "Display geometry has no area to place in the illustration."
    );
  }
  return { maxX, maxY, minX, minY };
}

function containInSlot(
  rings: readonly ProjectedRing[],
  slot: IllustrationSlot
): ProjectedRing[] {
  const bounds = boundsOf(rings);
  const slotWidth = slot.maxX - slot.minX;
  const slotHeight = slot.maxY - slot.minY;
  const scale = Math.min(
    slotWidth / (bounds.maxX - bounds.minX),
    slotHeight / (bounds.maxY - bounds.minY)
  );
  const drawnWidth = (bounds.maxX - bounds.minX) * scale;
  const drawnHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = slot.minX + (slotWidth - drawnWidth) / 2;
  const offsetY = slot.minY + (slotHeight - drawnHeight) / 2;
  return rings.map((ring) =>
    ring.map(([x, y]) => [
      offsetX + (x - bounds.minX) * scale,
      offsetY + (bounds.maxY - y) * scale,
    ])
  );
}

/**
 * Projects each polygon ring, including holes and disjoint parts, in source
 * order. Closing coordinates are retained.
 */
export function projectCountyDisplayRings(
  geometry: GeoJSON.Geometry,
  slot: IllustrationSlot = FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT
): ProjectedRing[] {
  assertIllustrationSlot(slot);
  const projected = polygonsFromGeometry(geometry).flatMap(
    (polygon, polygonIndex) =>
      polygon.map((ring, ringIndex) => {
        assertClosedRing(
          ring,
          `Polygon ${polygonIndex + 1} ring ${ringIndex + 1}`
        );
        return ring.map((position) => projectMercator(position));
      })
  );
  return containInSlot(projected, slot);
}

export function formatProjectedRingsAsSvgPath(
  rings: readonly ProjectedRing[],
  decimals = FRONT_PORCH_SVG_COORDINATE_DECIMALS
): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("SVG coordinate decimals must be a non-negative integer.");
  }
  if (rings.length === 0) {
    throw new Error("Display geometry did not produce an outline.");
  }
  return rings
    .map((ring) => {
      const commands = ring.map(([x, y], index) => {
        const prefix = index === 0 ? "M" : "L";
        return `${prefix}${x.toFixed(decimals)} ${y.toFixed(decimals)}`;
      });
      return `${commands.join(" ")}Z`;
    })
    .join(" ");
}

export function projectCountyDisplayGeometryToSvgPath(
  geometry: GeoJSON.Geometry,
  slot: IllustrationSlot = FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT,
  decimals = FRONT_PORCH_SVG_COORDINATE_DECIMALS
): string {
  return formatProjectedRingsAsSvgPath(
    projectCountyDisplayRings(geometry, slot),
    decimals
  );
}
