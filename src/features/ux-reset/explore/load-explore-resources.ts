import {
  assertExploreCatalogRelease,
  assertExploreObservations,
  buildExploreSelection,
  countyDirectoryFromScoreSummaries,
  countyExploreMeasures,
  EXPLORE_COUNTY_GEOGRAPHY_SEMANTICS,
  ExploreContractError,
  type ExploreCommittedSelection,
  type ExploreCountyIdentity,
  type ExploreTimeBound,
} from "@/features/ux-reset/explore/explore-model";
import {
  getObservationsV1ObservationsGetUrl,
  measuresV1MeasuresGet,
  observationsV1ObservationsGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import type {
  Measure,
  MeasuresV1MeasuresGetParams,
  Observation,
  ObservationsV1ObservationsGetParams,
} from "@/generated/models";
import {
  MeasuresV1MeasuresGetResponse,
  ObservationsV1ObservationsGetResponse,
  ScoresV1AtlasScoresGetResponse,
  measuresV1MeasuresGetQueryPageSizeOneMax,
  observationsV1ObservationsGetQueryGeographyIdMax,
  observationsV1ObservationsGetQueryPageSizeOneMax,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

const MAX_COLLECTION_PAGES = 20;
const PAGE_TOKEN_FINGERPRINT_HEX_LENGTH = 64;
const PAGE_TOKEN_SIGNATURE_BYTES = 32;
const MAX_PAGE_TOKEN_OFFSET = 10_000;
const MAX_RELEASE_ID_LENGTH = 64;

/** Default public API query-string ceiling (`public_max_query_bytes`). */
export const PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT = 8192;

type ExploreQueryRetrySetting =
  | boolean
  | number
  | ((failureCount: number, error: Error) => boolean)
  | undefined;

/**
 * Contract mismatches and 4xx responses are deterministic. Transient failures
 * follow the surrounding QueryClient retry setting, including `retry: false`.
 */
export function shouldRetryExploreObservation(
  failureCount: number,
  error: unknown,
  configured: ExploreQueryRetrySetting
): boolean {
  if (error instanceof ExploreContractError) {
    return false;
  }
  if (
    error instanceof AtlasApiError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  if (configured === false || configured === 0) {
    return false;
  }
  if (typeof configured === "number") {
    return failureCount < configured;
  }
  if (typeof configured === "function") {
    if (!(error instanceof Error)) {
      return false;
    }
    return configured(failureCount, error);
  }
  return failureCount < 3;
}

/**
 * Upper bound of a valid observations continuation token: sha256 fingerprint,
 * 64-character release id, offset at the decoder maximum, and a 32-byte signature.
 */
export function maximumObservationPageToken(): string {
  const payload = {
    offset: MAX_PAGE_TOKEN_OFFSET,
    query: "f".repeat(PAGE_TOKEN_FINGERPRINT_HEX_LENGTH),
    release: "r".repeat(MAX_RELEASE_ID_LENGTH),
  };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const combined = new Uint8Array(body.length + PAGE_TOKEN_SIGNATURE_BYTES);
  combined.set(body);
  let binary = "";
  for (const byte of combined) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function exploreMeasuresPageParams(input: {
  geographySemantics: string;
  pageToken?: string | null;
}): MeasuresV1MeasuresGetParams {
  const params: MeasuresV1MeasuresGetParams = {
    geography_type: input.geographySemantics,
    page_size: measuresV1MeasuresGetQueryPageSizeOneMax,
  };
  if (input.pageToken) {
    params.page_token = input.pageToken;
  }
  return params;
}

export function exploreObservationPageParams(input: {
  fips: readonly string[];
  measureId: string;
  pageToken?: string | null;
  timeBound: ExploreTimeBound;
}): ObservationsV1ObservationsGetParams {
  const params: ObservationsV1ObservationsGetParams = {
    geography_id: [...input.fips],
    geography_type: "county",
    measure_id: input.measureId,
    page_size: observationsV1ObservationsGetQueryPageSizeOneMax,
  };
  switch (input.timeBound.kind) {
    case "year": {
      params.year = input.timeBound.year;
      break;
    }
    case "day": {
      params.start_date = input.timeBound.date;
      params.end_date = input.timeBound.date;
      break;
    }
    default: {
      const exhaustive: never = input.timeBound;
      return exhaustive;
    }
  }
  if (input.pageToken) {
    params.page_token = input.pageToken;
  }
  return params;
}

export function observationQueryByteLength(
  params: ObservationsV1ObservationsGetParams
): number {
  const url = getObservationsV1ObservationsGetUrl(params);
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  return new TextEncoder().encode(query).length;
}

function observationBatchFits(input: {
  fips: readonly string[];
  measureId: string;
  timeBound: ExploreTimeBound;
}): boolean {
  if (
    input.fips.length === 0 ||
    input.fips.length > observationsV1ObservationsGetQueryGeographyIdMax
  ) {
    return false;
  }
  const bytes = observationQueryByteLength(
    exploreObservationPageParams({
      fips: input.fips,
      measureId: input.measureId,
      pageToken: maximumObservationPageToken(),
      timeBound: input.timeBound,
    })
  );
  return bytes <= PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT;
}

/** Geography batches that stay under the id cap and the query-byte cap, including a continuation token. */
export function splitExploreObservationBatches(input: {
  fips: readonly string[];
  measureId: string;
  timeBound: ExploreTimeBound;
}): string[][] {
  const batches: string[][] = [];
  const current: string[] = [];
  for (const fips of input.fips) {
    current.push(fips);
    if (
      observationBatchFits({
        fips: current,
        measureId: input.measureId,
        timeBound: input.timeBound,
      })
    ) {
      continue;
    }
    current.pop();
    if (current.length === 0) {
      throw new ExploreContractError(
        "A county observation request exceeds the public query byte limit."
      );
    }
    batches.push([...current]);
    current.length = 0;
    current.push(fips);
    if (
      !observationBatchFits({
        fips: current,
        measureId: input.measureId,
        timeBound: input.timeBound,
      })
    ) {
      throw new ExploreContractError(
        "A county observation request exceeds the public query byte limit."
      );
    }
  }
  if (current.length > 0) {
    batches.push([...current]);
  }
  return batches;
}

async function fetchMeasuresForSemantic(
  geographySemantics: string,
  signal: AbortSignal
): Promise<Measure[]> {
  const measures: Measure[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const response = await measuresV1MeasuresGet(
      exploreMeasuresPageParams({
        geographySemantics,
        pageToken,
      }),
      { signal }
    );
    if (response.status !== 200) {
      throw new AtlasApiError(
        "Governed measures are temporarily unavailable.",
        "/v1/measures",
        response.status,
        null
      );
    }
    const parsed = validateApiResponse(
      "Measures",
      MeasuresV1MeasuresGetResponse,
      response.data
    );
    for (const measure of parsed.data) {
      if (measure.geography_semantics === geographySemantics) {
        measures.push(measure);
      }
    }
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }

  return measures;
}

export async function fetchExploreMeasures(
  signal: AbortSignal,
  requestedReleaseId: string
): Promise<Measure[]> {
  const collected: Measure[] = [];
  for (const geographySemantics of EXPLORE_COUNTY_GEOGRAPHY_SEMANTICS) {
    const page = await fetchMeasuresForSemantic(geographySemantics, signal);
    for (const measure of page) {
      collected.push(measure);
    }
  }
  assertExploreCatalogRelease({
    measures: collected,
    requestedReleaseId,
  });
  const measures: Measure[] = [];
  const seenIds = new Set<string>();
  for (const measure of countyExploreMeasures(collected)) {
    if (seenIds.has(measure.measure_id)) {
      continue;
    }
    seenIds.add(measure.measure_id);
    measures.push(measure);
  }
  return measures;
}

export async function fetchExploreCountyDirectory(
  releaseId: string,
  signal: AbortSignal
): Promise<ExploreCountyIdentity[]> {
  const response = await scoresV1AtlasScoresGet(
    { dataset_version: releaseId },
    { signal }
  );
  if (response.status !== 200) {
    throw new AtlasApiError(
      "County geography is temporarily unavailable.",
      "/v1/atlas/scores",
      response.status,
      null
    );
  }
  const parsed = validateApiResponse(
    "Atlas scores",
    ScoresV1AtlasScoresGetResponse,
    response.data
  );
  if (parsed.release_id !== releaseId) {
    throw new ExploreContractError(
      "County directory release does not match the requested release."
    );
  }
  return countyDirectoryFromScoreSummaries(parsed.counties);
}

async function fetchObservationPage(input: {
  fips: readonly string[];
  measureId: string;
  pageToken: string | null;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<{ nextToken: string | null; observations: Observation[] }> {
  const response = await observationsV1ObservationsGet(
    exploreObservationPageParams({
      fips: input.fips,
      measureId: input.measureId,
      pageToken: input.pageToken,
      timeBound: input.timeBound,
    }),
    { signal: input.signal }
  );
  if (response.status !== 200) {
    throw new AtlasApiError(
      "Governed observations are temporarily unavailable.",
      "/v1/observations",
      response.status,
      null
    );
  }
  const parsed = validateApiResponse(
    "Observations",
    ObservationsV1ObservationsGetResponse,
    response.data
  );
  return {
    nextToken: parsed.meta.next_page_token ?? null,
    observations: parsed.data,
  };
}

export async function fetchExploreObservations(input: {
  catalogReleaseId: string | null;
  fips: readonly string[];
  measureId: string;
  releaseId: string;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<Observation[]> {
  const observations: Observation[] = [];
  const batches = splitExploreObservationBatches({
    fips: input.fips,
    measureId: input.measureId,
    timeBound: input.timeBound,
  });
  for (const batch of batches) {
    const seenTokens = new Set<string>();
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
      const result = await fetchObservationPage({
        fips: batch,
        measureId: input.measureId,
        pageToken,
        signal: input.signal,
        timeBound: input.timeBound,
      });
      for (const observation of result.observations) {
        observations.push(observation);
      }
      if (!result.nextToken || seenTokens.has(result.nextToken)) {
        break;
      }
      seenTokens.add(result.nextToken);
      pageToken = result.nextToken;
    }
  }
  assertExploreObservations({
    catalogReleaseId: input.catalogReleaseId,
    measureId: input.measureId,
    observations,
    releaseId: input.releaseId,
    timeBound: input.timeBound,
  });
  return observations;
}

export async function loadExploreSelection(input: {
  directory: readonly ExploreCountyIdentity[];
  mapScope: string;
  measure: Measure;
  releaseId: string;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<ExploreCommittedSelection> {
  const fips = input.directory.map((county) => county.fips);
  const observations = await fetchExploreObservations({
    catalogReleaseId: input.measure.release_version?.trim() || null,
    fips,
    measureId: input.measure.measure_id,
    releaseId: input.releaseId,
    signal: input.signal,
    timeBound: input.timeBound,
  });
  return buildExploreSelection({
    directory: input.directory,
    mapScope: input.mapScope,
    measure: input.measure,
    observations,
    releaseId: input.releaseId,
    timeBound: input.timeBound,
  });
}
