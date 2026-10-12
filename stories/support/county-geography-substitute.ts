import type { CountyDisplayGeometryFeatureCollection } from "../../src/lib/county-geography";

export {
  COUNTY_DISPLAY_GEOMETRY_API_PATH,
  CountyDisplayGeometryContractError,
  FORBIDDEN_COUNTY_ANALYSIS_GEOMETRY_PATH_PATTERNS,
  assertApprovedCountyDisplayGeometryPath,
  countyDisplayGeometryQueryKey,
  countyFipsFromGeographyIdentity,
  indexCountyContextByFips,
  isCountyFips,
  joinCountyScoresWithContextByFips,
  parseCountyDisplayGeometry,
} from "../../src/lib/county-geography";

export type {
  CountyContextByFips,
  CountyDisplayGeometryFeatureCollection,
  CountyDisplayGeometryQueryScope,
  CountyFips,
} from "../../src/lib/county-geography";

export const storyGeometryModes = [
  "ready",
  "empty",
  "error",
  "pending",
] as const;

export type StoryGeometryMode = (typeof storyGeometryModes)[number];

const ADAMS_COUNTY_FIPS = "08001";

let mode: StoryGeometryMode = "ready";

/** Storybook-only geometry mode. Each iframe has its own copy. */
export function setStoryGeometryMode(next: StoryGeometryMode): void {
  mode = next;
}

function readyGeometry(): CountyDisplayGeometryFeatureCollection {
  return {
    features: [
      {
        geometry: {
          coordinates: [
            [
              [-105.1, 39.9],
              [-104.8, 39.9],
              [-104.8, 39.7],
              [-105.1, 39.7],
              [-105.1, 39.9],
            ],
          ],
          type: "Polygon",
        },
        properties: { fips: ADAMS_COUNTY_FIPS },
        type: "Feature",
      },
    ],
    type: "FeatureCollection",
  };
}

/**
 * Storybook stand-in for county display geometry.
 * It never calls `/v1/atlas/geometry`.
 */
export async function fetchCountyDisplayGeometry(): Promise<CountyDisplayGeometryFeatureCollection> {
  switch (mode) {
    case "ready": {
      return readyGeometry();
    }
    case "empty": {
      return { features: [], type: "FeatureCollection" };
    }
    case "error": {
      throw new Error("Synthetic county geometry is unavailable.");
    }
    case "pending": {
      return Promise.withResolvers<CountyDisplayGeometryFeatureCollection>()
        .promise;
    }
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
