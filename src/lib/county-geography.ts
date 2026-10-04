import { z } from "zod";

import { geometryV1AtlasGeometryGet } from "@/generated/atlas";
import type { GeographyIdentity } from "@/generated/models";
import { GeographyIdentity as geographyIdentitySchema } from "@/generated/zod/geographyIdentity.zod";

/**
 * County map rendering uses **display geometry** from `GET /v1/atlas/geometry`
 * (generalized CDC/ATSDR SVI 2022 polygons in EPSG:4326).
 *
 * The data platform also maintains **analysis geometry** (2025 TIGER/Line) for
 * raster/grid aggregation. That geometry is not published to browsers and must
 * not replace display geometry without an explicit product review.
 *
 * County identity for joins (scores, observations, environmental context) is
 * always five-digit FIPS via {@link GeographyIdentity}, independent of either
 * polygon representation.
 */

/** Only approved public route for county map/display polygons. */
export const COUNTY_DISPLAY_GEOMETRY_API_PATH = "/v1/atlas/geometry";

/**
 * Future analysis-geometry routes must not be wired into map consumers. Tests
 * guard against accidental client generation or adapter use of these patterns.
 */
export const FORBIDDEN_COUNTY_ANALYSIS_GEOMETRY_PATH_PATTERNS = [
  "/v1/atlas/analysis-geometry",
  "/v1/geographies/county/",
  "analysis_geometry",
] as const;

const COUNTY_FIPS_PATTERN = /^\d{5}$/;

export type CountyFips = string;

export type CountyDisplayGeometryFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { fips: CountyFips }
>;

const countyDisplayGeometryFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    fips: z.string().regex(COUNTY_FIPS_PATTERN),
  }),
  geometry: z.custom<GeoJSON.Geometry>(),
});

const countyDisplayGeometryCollectionSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(countyDisplayGeometryFeatureSchema).min(1),
  })
  .strict();

export class CountyDisplayGeometryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CountyDisplayGeometryContractError";
  }
}

export function isCountyFips(value: string): boolean {
  return COUNTY_FIPS_PATTERN.test(value);
}

export function countyFipsFromGeographyIdentity(
  identity: GeographyIdentity
): CountyFips | null {
  if (identity.geography_type !== "county") {
    return null;
  }
  return isCountyFips(identity.geography_id) ? identity.geography_id : null;
}

export function assertApprovedCountyDisplayGeometryPath(path: string): void {
  const normalized = path.split("?")[0] ?? path;
  if (normalized !== COUNTY_DISPLAY_GEOMETRY_API_PATH) {
    throw new CountyDisplayGeometryContractError(
      `County map geometry must be loaded from ${COUNTY_DISPLAY_GEOMETRY_API_PATH}, not ${path}.`
    );
  }
  for (const pattern of FORBIDDEN_COUNTY_ANALYSIS_GEOMETRY_PATH_PATTERNS) {
    if (path.toLowerCase().includes(pattern.toLowerCase())) {
      throw new CountyDisplayGeometryContractError(
        `County analysis geometry paths are not approved for browser map rendering (${path}).`
      );
    }
  }
}

function rejectAnalysisGeometryMetadata(
  payload: Record<string, unknown>
): void {
  const purpose = payload.geometry_purpose;
  if (purpose === "analysis" || purpose === "tiger_2025") {
    throw new CountyDisplayGeometryContractError(
      "Received analysis-grade county geometry metadata; display geometry is required for map rendering."
    );
  }
  const basis = payload.polygon_basis;
  if (typeof basis === "string" && /tiger|analysis/i.test(basis)) {
    throw new CountyDisplayGeometryContractError(
      "Received analysis-grade county polygon basis; display geometry is required for map rendering."
    );
  }
}

/**
 * Validates the display-geometry FeatureCollection contract (FIPS on every
 * feature). Rejects analysis-tagged collection metadata when present.
 */
export function parseCountyDisplayGeometry(
  value: unknown
): CountyDisplayGeometryFeatureCollection {
  if (!value || typeof value !== "object") {
    throw new CountyDisplayGeometryContractError(
      "County display geometry must be a GeoJSON FeatureCollection."
    );
  }
  rejectAnalysisGeometryMetadata(value as Record<string, unknown>);
  const parsed = countyDisplayGeometryCollectionSchema.safeParse(value);
  if (!parsed.success) {
    throw new CountyDisplayGeometryContractError(
      "County display geometry could not be verified for map rendering."
    );
  }
  return parsed.data as CountyDisplayGeometryFeatureCollection;
}

export type CountyDisplayGeometryQueryScope =
  | "atlas-home"
  | "explorer"
  | "ux-reset-explore"
  | "variant";

export function countyDisplayGeometryQueryKey(
  scope: CountyDisplayGeometryQueryScope,
  releaseId: string | undefined
): readonly [string, CountyDisplayGeometryQueryScope, string | undefined] {
  return ["county-display-geometry", scope, releaseId];
}

type GeometryRequestOptions = Parameters<typeof geometryV1AtlasGeometryGet>[1];

/**
 * Loads governed county **display** geometry for map rendering. Callers must not
 * substitute geography identity responses or future analysis geometry endpoints.
 */
export async function fetchCountyDisplayGeometry(
  datasetVersion: string,
  options?: GeometryRequestOptions
): Promise<CountyDisplayGeometryFeatureCollection> {
  assertApprovedCountyDisplayGeometryPath(COUNTY_DISPLAY_GEOMETRY_API_PATH);
  const response = await geometryV1AtlasGeometryGet(
    { dataset_version: datasetVersion },
    options
  );
  return parseCountyDisplayGeometry(response.data);
}

export type CountyContextByFips<T> = ReadonlyMap<CountyFips, T>;

/**
 * Indexes environmental or canonical observation payloads by county FIPS without
 * requiring polygon geometry on the context records.
 */
export function indexCountyContextByFips<
  T extends { geography: GeographyIdentity },
>(records: readonly T[]): CountyContextByFips<T> {
  const map = new Map<CountyFips, T>();
  for (const record of records) {
    const parsed = geographyIdentitySchema.safeParse(record.geography);
    if (!parsed.success) {
      continue;
    }
    const fips = countyFipsFromGeographyIdentity(parsed.data);
    if (!fips) {
      continue;
    }
    map.set(fips, record);
  }
  return map;
}

/**
 * Joins county score (or summary) rows to context payloads using FIPS only.
 */
export function joinCountyScoresWithContextByFips<
  TCounty extends { fips: string },
  TContext,
>(
  counties: readonly TCounty[],
  contextByFips: CountyContextByFips<TContext>
): { county: TCounty; context: TContext | undefined }[] {
  return counties.map((county) => ({
    county,
    context: isCountyFips(county.fips)
      ? contextByFips.get(county.fips)
      : undefined,
  }));
}
