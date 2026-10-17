import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT,
  FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH,
  FRONT_PORCH_DISPLAY_GEOMETRY_RELEASE_ID,
  FRONT_PORCH_MAP_VIEWBOX,
  FRONT_PORCH_SVG_ROUNDING_TOLERANCE,
  MONTGOMERY_COUNTY_FIPS as GENERATOR_FIPS,
  countyDisplayFeatureSha256,
  formatProjectedRingsAsSvgPath,
  frontPorchDisplayGeometryRequests,
  projectCountyDisplayGeometryToSvgPath,
  projectCountyDisplayRings,
  ringPointCounts,
} from "@/features/front-porch/county-outline-path";
import { FrontPorchScrolly } from "@/features/front-porch/front-porch-scrolly";
import {
  MONTGOMERY_COUNTY_FIPS,
  MONTGOMERY_COUNTY_OUTLINE,
  MONTGOMERY_COUNTY_OUTLINE_PROVENANCE,
} from "@/features/front-porch/montgomery-county-outline.generated";
import { COUNTY_DISPLAY_GEOMETRY_API_PATH } from "@/lib/county-geography";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests/fixtures/front-porch-montgomery-51121.geojson"
);
const SCROLLY_PATH = path.join(
  process.cwd(),
  "src/features/front-porch/front-porch-scrolly.tsx"
);
const GENERATOR_PATH = path.join(
  process.cwd(),
  "scripts/generate-front-porch-montgomery-outline.ts"
);

function montgomeryFeature(): GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { fips: string }
> {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    { fips: string }
  >;
}

function sourceRingLengths(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): number[] {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map((ring) => ring.length));
}

function svgSubpaths(outline: string): number[][][] {
  const subpaths = outline.split(/(?=M)/u).filter((part) => part.length > 0);
  return subpaths.map((subpath) => {
    const numbers = subpath.match(/-?\d+\.\d+/gu);
    if (!numbers || numbers.length % 2 !== 0) {
      throw new Error("SVG subpath coordinates are incomplete.");
    }
    const points: number[][] = [];
    for (let index = 0; index < numbers.length; index += 2) {
      const xText = numbers[index];
      const yText = numbers[index + 1];
      if (xText === undefined || yText === undefined) {
        throw new Error("SVG subpath coordinates are incomplete.");
      }
      points.push([Number(xText), Number(yText)]);
    }
    return points;
  });
}

describe("Montgomery County front porch outline", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("identifies the committed feature as governed FIPS 51121 display geometry", () => {
    const feature = montgomeryFeature();
    expect({
      apiPath: FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH,
      featureId: feature.id,
      fips: feature.properties.fips,
      generatorFips: GENERATOR_FIPS,
      provenance: {
        apiBaseUrl: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.apiBaseUrl,
        countyFips: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.countyFips,
        datasetLabel: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.datasetLabel,
        datasetVintage: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.datasetVintage,
        displayGeometryPath:
          MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.displayGeometryPath,
        regenerate: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.regenerate,
        releaseId: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.releaseId,
        sourceCrs: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.sourceCrs,
      },
      sha256: countyDisplayFeatureSha256(feature),
    }).toStrictEqual({
      apiPath: COUNTY_DISPLAY_GEOMETRY_API_PATH,
      featureId: MONTGOMERY_COUNTY_FIPS,
      fips: "51121",
      generatorFips: "51121",
      provenance: {
        apiBaseUrl: "https://api.onehealthatlas.org",
        countyFips: "51121",
        datasetLabel: "CDC/ATSDR Social Vulnerability Index",
        datasetVintage: "2022 (2018-2022 ACS)",
        displayGeometryPath: "/v1/atlas/geometry",
        regenerate: "npm run generate:front-porch-county",
        releaseId: "governed-2026-10-15-january-climate-prod",
        sourceCrs: "EPSG:4326",
      },
      sha256: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.featureSha256,
    });
  });

  it("derives the committed path from that feature without dropping rings", () => {
    const feature = montgomeryFeature();
    const sourceLengths = sourceRingLengths(feature.geometry);
    const committed = svgSubpaths(MONTGOMERY_COUNTY_OUTLINE);
    expect({
      outline: projectCountyDisplayGeometryToSvgPath(feature.geometry),
      ringPointCounts: ringPointCounts(feature.geometry),
      subpathLengths: committed.map((ring) => ring.length),
    }).toStrictEqual({
      outline: MONTGOMERY_COUNTY_OUTLINE,
      ringPointCounts: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.ringPointCounts,
      subpathLengths: sourceLengths,
    });
  });

  it("keeps every source ring inside the illustration slot within rounding tolerance", () => {
    const feature = montgomeryFeature();
    const committed = svgSubpaths(MONTGOMERY_COUNTY_OUTLINE);
    const precise = svgSubpaths(
      formatProjectedRingsAsSvgPath(
        projectCountyDisplayRings(feature.geometry),
        6
      )
    );
    let maxError = 0;
    let insideSlot = true;
    for (const [ringIndex, ring] of committed.entries()) {
      const preciseRing = precise[ringIndex];
      const first = ring[0];
      const last = ring.at(-1);
      if (
        !preciseRing ||
        preciseRing.length !== ring.length ||
        !first ||
        !last
      ) {
        insideSlot = false;
        continue;
      }
      if (first[0] !== last[0] || first[1] !== last[1]) {
        insideSlot = false;
      }
      for (const [pointIndex, point] of ring.entries()) {
        const projected = preciseRing[pointIndex];
        if (!projected) {
          insideSlot = false;
          continue;
        }
        maxError = Math.max(
          maxError,
          Math.abs(point[0] - projected[0]),
          Math.abs(point[1] - projected[1])
        );
        const [x, y] = point;
        insideSlot &&=
          x >=
            FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT.minX -
              FRONT_PORCH_SVG_ROUNDING_TOLERANCE &&
          x <=
            FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT.maxX +
              FRONT_PORCH_SVG_ROUNDING_TOLERANCE &&
          y >=
            FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT.minY -
              FRONT_PORCH_SVG_ROUNDING_TOLERANCE &&
          y <=
            FRONT_PORCH_COUNTY_ILLUSTRATION_SLOT.maxY +
              FRONT_PORCH_SVG_ROUNDING_TOLERANCE &&
          x >= 0 &&
          x <= FRONT_PORCH_MAP_VIEWBOX.width &&
          y >= 0 &&
          y <= FRONT_PORCH_MAP_VIEWBOX.height;
      }
    }
    const disjoint = committed[1] ?? [];
    expect({
      disjointSurvives:
        new Set(disjoint.map((point) => point.join(","))).size > 1,
      insideSlot,
      preciseLengths: precise.map((ring) => ring.length),
      withinTolerance: maxError <= FRONT_PORCH_SVG_ROUNDING_TOLERANCE,
    }).toStrictEqual({
      disjointSurvives: true,
      insideSlot: true,
      preciseLengths: sourceRingLengths(feature.geometry),
      withinTolerance: true,
    });
  });

  it("preserves holes and disjoint polygon parts as separate subpaths", () => {
    const geometry: GeoJSON.MultiPolygon = {
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
          [
            [0.2, 0.2],
            [0.3, 0.2],
            [0.3, 0.3],
            [0.2, 0.2],
          ],
        ],
        [
          [
            [2, 2],
            [2.2, 2],
            [2.2, 2.2],
            [2, 2],
          ],
        ],
      ],
      type: "MultiPolygon",
    };
    const rings = projectCountyDisplayRings(geometry);
    expect(rings.map((ring) => ring.length)).toStrictEqual([5, 4, 4]);
    expect(
      formatProjectedRingsAsSvgPath(rings).split("Z").filter(Boolean)
    ).toHaveLength(3);
  });

  it("refuses geometry that is not a closed polygon ring", () => {
    expect(() =>
      projectCountyDisplayGeometryToSvgPath({
        coordinates: [0, 0],
        type: "Point",
      })
    ).toThrow(/polygon display geometry/);
    expect(() =>
      projectCountyDisplayGeometryToSvgPath({
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        ],
        type: "Polygon",
      })
    ).toThrow(/closed ring/);
  });

  it("keeps the October 15 release when current metadata has advanced", () => {
    const advancedReleaseId = "governed-2099-01-01-later-prod";
    const feature = montgomeryFeature();
    const requests = frontPorchDisplayGeometryRequests(
      "https://api.onehealthatlas.org",
      advancedReleaseId
    );
    expect({
      outline: projectCountyDisplayGeometryToSvgPath(feature.geometry),
      requests,
      sha256: countyDisplayFeatureSha256(feature),
      usesAdvancedRelease: JSON.stringify(requests).includes(advancedReleaseId),
    }).toStrictEqual({
      outline: MONTGOMERY_COUNTY_OUTLINE,
      requests: {
        geometryUrl:
          "https://api.onehealthatlas.org/v1/atlas/geometry?dataset_version=governed-2026-10-15-january-climate-prod",
        metadataUrl:
          "https://api.onehealthatlas.org/v1/atlas/metadata?dataset_version=governed-2026-10-15-january-climate-prod",
        releaseId: FRONT_PORCH_DISPLAY_GEOMETRY_RELEASE_ID,
      },
      sha256: MONTGOMERY_COUNTY_OUTLINE_PROVENANCE.featureSha256,
      usesAdvancedRelease: false,
    });
    expect(() =>
      frontPorchDisplayGeometryRequests("https://api.onehealthatlas.org", " ")
    ).toThrow(/release_id is empty/);
  });

  it("keeps the homepage outline on the generated asset", () => {
    const scrolly = readFileSync(SCROLLY_PATH, "utf-8");
    const generator = readFileSync(GENERATOR_PATH, "utf-8");
    expect({
      apiPath: generator.includes(COUNTY_DISPLAY_GEOMETRY_API_PATH),
      authorization: /["']Authorization["']/u.test(generator),
      pinnedRequests: generator.includes("frontPorchDisplayGeometryRequests"),
      censusBoundary: /Census county boundary/u.test(scrolly),
      generatedImport: scrolly.includes("montgomery-county-outline.generated"),
      oldPath: scrolly.includes("M203.1 184.8"),
      pathUses: scrolly.match(/d=\{MONTGOMERY_COUNTY_OUTLINE\}/gu)?.length,
    }).toStrictEqual({
      apiPath: true,
      authorization: false,
      pinnedRequests: true,
      censusBoundary: false,
      generatedImport: true,
      oldPath: false,
      pathUses: 4,
    });
  });

  it("paints the same path on desktop and mobile without a geometry request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<FrontPorchScrolly />);
    const outlines = [
      ...container.querySelectorAll(
        ".front-porch-county, .front-porch-sketch-county, #county-texture-clip path, #county-sketch-texture-clip path"
      ),
    ].map((outline) => outline.getAttribute("d"));
    expect({
      fetchCalls: fetchSpy.mock.calls.length,
      map: container.querySelector(".maplibregl-map"),
      outlines,
    }).toStrictEqual({
      fetchCalls: 0,
      map: null,
      outlines: [
        MONTGOMERY_COUNTY_OUTLINE,
        MONTGOMERY_COUNTY_OUTLINE,
        MONTGOMERY_COUNTY_OUTLINE,
        MONTGOMERY_COUNTY_OUTLINE,
      ],
    });
  });
});
