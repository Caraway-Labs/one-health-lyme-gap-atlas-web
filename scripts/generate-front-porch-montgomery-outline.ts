/**
 * Builds the Front Porch Montgomery County outline from governed display
 * geometry. The public homepage does not call this. It consumes the committed
 * path so it makes no geometry request and does not start MapLibre.
 *
 * Anonymous GET /v1/atlas/geometry on https://api.onehealthatlas.org is
 * reachable without credentials (public, immutable cache). Regenerate with:
 *
 *   npm run generate:front-porch-county
 *
 * Optional override: ATLAS_GEOMETRY_API_BASE_URL. No Authorization header is sent.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH,
  FRONT_PORCH_OUTLINE_PROJECTION,
  MONTGOMERY_COUNTY_FIPS,
  canonicalCountyDisplayFeature,
  countyDisplayFeatureSha256,
  projectCountyDisplayGeometryToSvgPath,
  ringPointCounts,
} from "../src/features/front-porch/county-outline-path.ts";

export const PUBLIC_ATLAS_API_BASE_URL = "https://api.onehealthatlas.org";

const METADATA_PATH = "/v1/atlas/metadata";
const REGENERATE_COMMAND = "npm run generate:front-porch-county";
const SVI_SOURCE_KEY = "context_svi";

type OutlineProvenance = {
  apiBaseUrl: string;
  countyFips: typeof MONTGOMERY_COUNTY_FIPS;
  countyName: "Montgomery County, Virginia";
  datasetLabel: string;
  datasetVintage: string;
  displayGeometryPath: typeof FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH;
  featureSha256: string;
  geometryEtag: string;
  geometryUrl: string;
  projection: string;
  regenerate: typeof REGENERATE_COMMAND;
  releaseId: string;
  ringPointCounts: number[][];
  sourceCrs: "EPSG:4326";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function geometryApiBaseUrl(): string {
  const override = process.env.ATLAS_GEOMETRY_API_BASE_URL?.trim();
  const base =
    override && override.length > 0 ? override : PUBLIC_ATLAS_API_BASE_URL;
  return base.replace(/\/$/u, "");
}

function readSviRelease(value: unknown): {
  label: string;
  releaseId: string;
  vintage: string;
} {
  if (
    !isRecord(value) ||
    typeof value.release_id !== "string" ||
    value.release_id.length === 0
  ) {
    throw new Error("Atlas metadata is missing release_id.");
  }
  if (!Array.isArray(value.sources)) {
    throw new TypeError("Atlas metadata is missing sources.");
  }
  for (const source of value.sources) {
    if (!isRecord(source) || source.key !== SVI_SOURCE_KEY) {
      continue;
    }
    if (
      typeof source.label !== "string" ||
      typeof source.vintage !== "string"
    ) {
      throw new TypeError("CDC/ATSDR SVI metadata is incomplete.");
    }
    return {
      label: source.label,
      releaseId: value.release_id,
      vintage: source.vintage,
    };
  }
  throw new Error(
    "Atlas metadata is missing the CDC/ATSDR SVI display-geometry source."
  );
}

function assertDisplayGeometryCollection(
  value: unknown
): GeoJSON.FeatureCollection {
  if (!isRecord(value)) {
    throw new Error("Display geometry must be a GeoJSON FeatureCollection.");
  }
  if (
    value.geometry_purpose === "analysis" ||
    value.geometry_purpose === "tiger_2025"
  ) {
    throw new Error("Refusing analysis-grade county geometry.");
  }
  if (
    typeof value.polygon_basis === "string" &&
    /tiger|analysis/i.test(value.polygon_basis)
  ) {
    throw new Error("Refusing analysis-grade county polygon basis.");
  }
  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw new Error("Display geometry must be a GeoJSON FeatureCollection.");
  }
  return {
    features: value.features as GeoJSON.Feature[],
    type: "FeatureCollection",
  };
}

function montgomeryFeature(
  collection: GeoJSON.FeatureCollection
): GeoJSON.Feature {
  const matches = collection.features.filter((feature) => {
    const properties = feature.properties;
    return isRecord(properties) && properties.fips === MONTGOMERY_COUNTY_FIPS;
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${MONTGOMERY_COUNTY_FIPS} display feature, received ${matches.length}.`
    );
  }
  const feature = matches[0];
  if (!feature) {
    throw new Error(`Expected one ${MONTGOMERY_COUNTY_FIPS} display feature.`);
  }
  return feature;
}

async function getAnonymousJson(
  url: string
): Promise<{ body: unknown; etag: string | null }> {
  const response = await fetch(url, {
    headers: { accept: "application/geo+json, application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed (${response.status}). Anonymous display geometry was not reachable.`
    );
  }
  const body: unknown = await response.json();
  return { body, etag: response.headers.get("etag") };
}

function generatedModule(
  provenance: OutlineProvenance,
  outline: string
): string {
  return `/**
 * Montgomery County, Virginia (FIPS 51121) Front Porch illustration outline.
 *
 * Generated from governed CDC/ATSDR SVI 2022 display geometry (EPSG:4326)
 * served by GET /v1/atlas/geometry. Do not hand-edit this path or substitute
 * a Census or TIGER/Line analysis boundary.
 *
 * Regenerate: ${REGENERATE_COMMAND}
 */
export const MONTGOMERY_COUNTY_FIPS = "${MONTGOMERY_COUNTY_FIPS}" as const;

export const MONTGOMERY_COUNTY_OUTLINE = ${JSON.stringify(outline)};

export const MONTGOMERY_COUNTY_OUTLINE_PROVENANCE = ${JSON.stringify(provenance, null, 2)} as const;
`;
}

async function generateMontgomeryCountyOutline(): Promise<void> {
  const apiBaseUrl = geometryApiBaseUrl();
  const metadataUrl = `${apiBaseUrl}${METADATA_PATH}`;
  const metadata = await getAnonymousJson(metadataUrl);
  const svi = readSviRelease(metadata.body);
  const geometryUrl = `${apiBaseUrl}${FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH}?dataset_version=${encodeURIComponent(svi.releaseId)}`;
  const geometry = await getAnonymousJson(geometryUrl);
  if (!geometry.etag) {
    throw new Error("Display geometry response did not include an ETag.");
  }
  const feature = canonicalCountyDisplayFeature(
    montgomeryFeature(assertDisplayGeometryCollection(geometry.body))
  );
  const outline = projectCountyDisplayGeometryToSvgPath(feature.geometry);
  const provenance: OutlineProvenance = {
    apiBaseUrl,
    countyFips: MONTGOMERY_COUNTY_FIPS,
    countyName: "Montgomery County, Virginia",
    datasetLabel: svi.label,
    datasetVintage: svi.vintage,
    displayGeometryPath: FRONT_PORCH_DISPLAY_GEOMETRY_API_PATH,
    featureSha256: countyDisplayFeatureSha256(feature),
    geometryEtag: geometry.etag,
    geometryUrl,
    projection: FRONT_PORCH_OUTLINE_PROJECTION,
    regenerate: REGENERATE_COMMAND,
    releaseId: svi.releaseId,
    ringPointCounts: ringPointCounts(feature.geometry),
    sourceCrs: "EPSG:4326",
  };
  const root = process.cwd();
  writeFileSync(
    path.join(root, "tests/fixtures/front-porch-montgomery-51121.geojson"),
    `${JSON.stringify(feature, null, 2)}\n`
  );
  writeFileSync(
    path.join(
      root,
      "src/features/front-porch/montgomery-county-outline.generated.ts"
    ),
    generatedModule(provenance, outline)
  );
  process.stdout.write(
    `Wrote FIPS ${MONTGOMERY_COUNTY_FIPS} from ${svi.releaseId} (${geometry.etag}).\n`
  );
}

async function main(): Promise<void> {
  try {
    await generateMontgomeryCountyOutline();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1]?.endsWith(
  "generate-front-porch-montgomery-outline.ts"
);
if (invokedDirectly) {
  await main();
}
