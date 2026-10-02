import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as atlasClient from "@/generated/atlas";
import { getGeometryV1AtlasGeometryGetUrl } from "@/generated/atlas";
import { ValueState } from "@/generated/models";
import { Geography } from "@/generated/zod/geography.zod";
import { GeographyIdentity } from "@/generated/zod/geographyIdentity.zod";
import { Observation } from "@/generated/zod/observation.zod";
import {
  assertApprovedCountyDisplayGeometryPath,
  countyDisplayGeometryQueryKey,
  CountyDisplayGeometryContractError,
  COUNTY_DISPLAY_GEOMETRY_API_PATH,
  countyFipsFromGeographyIdentity,
  fetchCountyDisplayGeometry,
  indexCountyContextByFips,
  joinCountyScoresWithContextByFips,
  parseCountyDisplayGeometry,
} from "@/lib/county-geography";

const displayFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { fips: "08001" },
      geometry: { type: "Polygon", coordinates: [] },
    },
  ],
} satisfies GeoJSON.FeatureCollection;

describe("county display versus analysis geography semantics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps geography identity separate from polygon geometry in Zod contracts", () => {
    expect(Object.keys(GeographyIdentity.shape)).toStrictEqual([
      "geography_type",
      "geography_id",
    ]);
    expect(Object.keys(Geography.shape)).not.toContain("geometry");
    expect(Object.keys(Geography.shape.geography.shape)).not.toContain(
      "geometry"
    );
    expect(Object.keys(Observation.shape.geography.shape)).not.toContain(
      "geometry"
    );
  });

  it("resolves county FIPS from geography identity without geometry fields", () => {
    expect(
      countyFipsFromGeographyIdentity({
        geography_type: "county",
        geography_id: "36061",
      })
    ).toBe("36061");
    expect(
      countyFipsFromGeographyIdentity({
        geography_type: "state",
        geography_id: "36",
      })
    ).toBeNull();
  });

  it("parses display geometry FeatureCollections with FIPS properties", () => {
    expect(parseCountyDisplayGeometry(displayFeatureCollection)).toStrictEqual(
      displayFeatureCollection
    );
  });

  it("rejects analysis-tagged geometry payloads", () => {
    expect(() =>
      parseCountyDisplayGeometry({
        ...displayFeatureCollection,
        geometry_purpose: "analysis",
      })
    ).toThrow(CountyDisplayGeometryContractError);
    expect(() =>
      parseCountyDisplayGeometry({
        ...displayFeatureCollection,
        polygon_basis: "2025 TIGER/Line",
      })
    ).toThrow(/analysis-grade county polygon basis/i);
  });

  it("guards approved display geometry API paths", () => {
    expect(() =>
      assertApprovedCountyDisplayGeometryPath(COUNTY_DISPLAY_GEOMETRY_API_PATH)
    ).not.toThrow();
    expect(() =>
      assertApprovedCountyDisplayGeometryPath(
        `${COUNTY_DISPLAY_GEOMETRY_API_PATH}?dataset_version=alpha`
      )
    ).not.toThrow();
    expect(() =>
      assertApprovedCountyDisplayGeometryPath("/v1/atlas/analysis-geometry")
    ).toThrow(CountyDisplayGeometryContractError);
  });

  it("uses explicit TanStack query keys for display geometry caches", () => {
    expect(
      countyDisplayGeometryQueryKey("atlas-home", "alpha-2026")
    ).toStrictEqual(["county-display-geometry", "atlas-home", "alpha-2026"]);
    expect(
      countyDisplayGeometryQueryKey("explorer", "alpha-2026")
    ).toStrictEqual(["county-display-geometry", "explorer", "alpha-2026"]);
  });

  it("joins environmental context to counties by FIPS without geometry", () => {
    const context = indexCountyContextByFips([
      {
        observation_id: "obs-1",
        measure_id: "mean-temperature",
        geography: { geography_type: "county", geography_id: "08001" },
        period_start: "2023-01-01",
        period_end: "2023-12-31",
        temporal_grain: "annual",
        value: 52.1,
        value_state: ValueState.OBSERVED,
        unit: "fahrenheit",
        denominator: null,
        source_id: "noaa",
        methodology_id: "climate-v1",
        methodology_version: "1.0.0",
        semantic_version: "2023.1",
        release_id: "alpha",
        provenance_ref: "prov/noaa",
        limitations: [],
        evidence: {
          resource_type: "source",
          resource_id: "noaa",
          provenance_ref: "prov/noaa",
        },
      },
    ]);
    const joined = joinCountyScoresWithContextByFips(
      [
        { fips: "08001", county: "Adams", state: "CO" },
        { fips: "06037", county: "Los Angeles", state: "CA" },
      ],
      context
    );
    expect(joined[0]?.context?.measure_id).toBe("mean-temperature");
    expect(joined[1]?.context).toBeUndefined();
    expect(joined[0]?.context).not.toHaveProperty("geometry");
  });

  it("builds the governed display geometry URL in the generated client", () => {
    expect(getGeometryV1AtlasGeometryGetUrl({ dataset_version: "alpha" })).toBe(
      "/v1/atlas/geometry?dataset_version=alpha"
    );
  });

  it("does not generate analysis geometry routes in the Atlas client", () => {
    const generated = readFileSync(
      path.resolve(process.cwd(), "src/generated/atlas.ts"),
      "utf-8"
    );
    expect({
      hasDisplayPath: generated.includes(COUNTY_DISPLAY_GEOMETRY_API_PATH),
      hasGeographyIdentityRoute: generated.includes("/v1/geographies/"),
      lacksCountyGeometryRoute: !generated.includes(
        "/v1/geographies/county/geometry"
      ),
      lacksAnalysisGeometryRoute: !generated.includes(
        "/v1/atlas/analysis-geometry"
      ),
      lacksAnalysisGeometrySymbol: !generated
        .toLowerCase()
        .includes("analysis_geometry"),
    }).toStrictEqual({
      hasDisplayPath: true,
      hasGeographyIdentityRoute: true,
      lacksCountyGeometryRoute: true,
      lacksAnalysisGeometryRoute: true,
      lacksAnalysisGeometrySymbol: true,
    });
  });

  it("fetchCountyDisplayGeometry validates display payloads from the API adapter", async () => {
    vi.spyOn(atlasClient, "geometryV1AtlasGeometryGet").mockResolvedValue({
      data: displayFeatureCollection,
      status: 200,
      headers: new Headers(),
    });
    await expect(
      fetchCountyDisplayGeometry("alpha-2026")
    ).resolves.toStrictEqual(displayFeatureCollection);
  });
});
