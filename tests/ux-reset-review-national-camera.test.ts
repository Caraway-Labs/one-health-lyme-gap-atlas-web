import { MercatorCoordinate } from "maplibre-gl";
import { describe, expect, it } from "vitest";

import {
  LOWER_48_DC_CAMERA_BOUNDS,
  REVIEW_NATIONAL_CAMERA_PADDING_PX,
  reviewNationalCameraContains,
  reviewNationalNavigationCamera,
} from "@/features/ux-reset/review/review-national-camera";
import { CONTIGUOUS_US_INITIAL_VIEW } from "@/lib/atlas-geometry";

const NARROW_MAP = { height: 256, width: 390 };
const WIDE_MAP = { height: 448, width: 1440 };
const COASTAL_PLACES = [
  ["California", -124.2, 37],
  ["New York", -74, 43],
  ["District of Columbia", -77.0369, 38.9072],
] as const;

function framedPlaces(
  width: number,
  height: number,
  camera: { center: [number, number]; zoom: number }
) {
  return Object.fromEntries(
    COASTAL_PLACES.map(([name, longitude, latitude]) => [
      name,
      reviewNationalCameraContains(camera, width, height, longitude, latitude),
    ])
  );
}

describe("Review national camera", () => {
  it("frames the lower 48 and DC on a narrow map and a wide map", () => {
    const narrow = reviewNationalNavigationCamera(
      NARROW_MAP.width,
      NARROW_MAP.height
    );
    const wide = reviewNationalNavigationCamera(
      WIDE_MAP.width,
      WIDE_MAP.height
    );
    if (!(narrow && wide)) {
      throw new Error("expected a camera for both container sizes");
    }
    const boundsInsideNarrow = (
      [
        [LOWER_48_DC_CAMERA_BOUNDS.west, LOWER_48_DC_CAMERA_BOUNDS.south],
        [LOWER_48_DC_CAMERA_BOUNDS.west, LOWER_48_DC_CAMERA_BOUNDS.north],
        [LOWER_48_DC_CAMERA_BOUNDS.east, LOWER_48_DC_CAMERA_BOUNDS.south],
        [LOWER_48_DC_CAMERA_BOUNDS.east, LOWER_48_DC_CAMERA_BOUNDS.north],
      ] as const
    ).every(([longitude, latitude]) =>
      reviewNationalCameraContains(
        narrow,
        NARROW_MAP.width,
        NARROW_MAP.height,
        longitude,
        latitude,
        REVIEW_NATIONAL_CAMERA_PADDING_PX - 1
      )
    );
    expect({
      boundsInsideNarrow,
      narrow: framedPlaces(NARROW_MAP.width, NARROW_MAP.height, narrow),
      narrowZoomIsLower: narrow.zoom < wide.zoom,
      wide: framedPlaces(WIDE_MAP.width, WIDE_MAP.height, wide),
    }).toStrictEqual({
      boundsInsideNarrow: true,
      narrow: {
        California: true,
        "District of Columbia": true,
        "New York": true,
      },
      narrowZoomIsLower: true,
      wide: {
        California: true,
        "District of Columbia": true,
        "New York": true,
      },
    });
  });

  it("leaves coastal states outside the fixed national zoom on a narrow map", () => {
    const fixed = {
      center: CONTIGUOUS_US_INITIAL_VIEW.center,
      zoom: CONTIGUOUS_US_INITIAL_VIEW.zoom,
    };
    expect(
      framedPlaces(NARROW_MAP.width, NARROW_MAP.height, fixed)
    ).toStrictEqual({
      California: false,
      "District of Columbia": false,
      "New York": false,
    });
  });

  it("matches MapLibre mercator placement for the fitted camera", () => {
    const camera = reviewNationalNavigationCamera(
      NARROW_MAP.width,
      NARROW_MAP.height
    );
    if (!camera) {
      throw new Error("expected a camera");
    }
    const worldSize = 512 * 2 ** camera.zoom;
    const west = MercatorCoordinate.fromLngLat({
      lat: LOWER_48_DC_CAMERA_BOUNDS.north,
      lng: LOWER_48_DC_CAMERA_BOUNDS.west,
    });
    const east = MercatorCoordinate.fromLngLat({
      lat: LOWER_48_DC_CAMERA_BOUNDS.south,
      lng: LOWER_48_DC_CAMERA_BOUNDS.east,
    });
    const center = MercatorCoordinate.fromLngLat({
      lat: camera.center[1],
      lng: camera.center[0],
    });
    const paddedWidth = (east.x - west.x) * worldSize;
    const paddedHeight = (east.y - west.y) * worldSize;
    const centerMatches =
      Math.abs(center.x - (west.x + east.x) / 2) < 1e-12 &&
      Math.abs(center.y - (west.y + east.y) / 2) < 1e-12;
    expect({
      centerMatches,
      heightFits:
        paddedHeight <=
        NARROW_MAP.height - REVIEW_NATIONAL_CAMERA_PADDING_PX * 2 + 0.01,
      widthFits:
        paddedWidth <=
        NARROW_MAP.width - REVIEW_NATIONAL_CAMERA_PADDING_PX * 2 + 0.01,
    }).toStrictEqual({
      centerMatches: true,
      heightFits: true,
      widthFits: true,
    });
  });

  it("returns no camera when the container has no size", () => {
    expect(reviewNationalNavigationCamera(0, 256)).toBeNull();
  });
});
