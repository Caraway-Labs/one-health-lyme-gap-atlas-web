const MERCATOR_TILE_SIZE_PX = 512;

/** Axis-aligned extent of the lower 48 states and the District of Columbia. */
export const LOWER_48_DC_CAMERA_BOUNDS = {
  east: -66,
  north: 50,
  south: 24,
  west: -125,
} as const;

export const REVIEW_NATIONAL_CAMERA_PADDING_PX = 24;

export type ReviewNationalCamera = {
  center: [number, number];
  zoom: number;
};

function mercatorX(longitude: number): number {
  return (180 + longitude) / 360;
}

function mercatorY(latitude: number): number {
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))) /
    360
  );
}

function longitudeFromMercatorX(x: number): number {
  return x * 360 - 180;
}

function latitudeFromMercatorY(y: number): number {
  const y2 = 180 - y * 360;
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
}

export function reviewNationalNavigationCamera(
  width: number,
  height: number,
  padding = REVIEW_NATIONAL_CAMERA_PADDING_PX
): ReviewNationalCamera | null {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;
  if (!(availableWidth > 0) || !(availableHeight > 0)) {
    return null;
  }
  const west = mercatorX(LOWER_48_DC_CAMERA_BOUNDS.west);
  const east = mercatorX(LOWER_48_DC_CAMERA_BOUNDS.east);
  const north = mercatorY(LOWER_48_DC_CAMERA_BOUNDS.north);
  const south = mercatorY(LOWER_48_DC_CAMERA_BOUNDS.south);
  const zoom = Math.log2(
    Math.min(
      availableWidth / ((east - west) * MERCATOR_TILE_SIZE_PX),
      availableHeight / ((south - north) * MERCATOR_TILE_SIZE_PX)
    )
  );
  if (!Number.isFinite(zoom)) {
    return null;
  }
  return {
    center: [
      longitudeFromMercatorX((west + east) / 2),
      latitudeFromMercatorY((north + south) / 2),
    ],
    zoom,
  };
}

export function reviewNationalCameraPoint(
  camera: ReviewNationalCamera,
  width: number,
  height: number,
  longitude: number,
  latitude: number
): { x: number; y: number } | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(camera.zoom)) {
    return null;
  }
  const worldSize = MERCATOR_TILE_SIZE_PX * 2 ** camera.zoom;
  const x =
    (mercatorX(longitude) - mercatorX(camera.center[0])) * worldSize +
    width / 2;
  const y =
    (mercatorY(latitude) - mercatorY(camera.center[1])) * worldSize +
    height / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

export function reviewNationalCameraContains(
  camera: ReviewNationalCamera,
  width: number,
  height: number,
  longitude: number,
  latitude: number,
  insetPx = 0
): boolean {
  const point = reviewNationalCameraPoint(
    camera,
    width,
    height,
    longitude,
    latitude
  );
  if (!point) {
    return false;
  }
  return (
    point.x >= insetPx &&
    point.x <= width - insetPx &&
    point.y >= insetPx &&
    point.y <= height - insetPx
  );
}
