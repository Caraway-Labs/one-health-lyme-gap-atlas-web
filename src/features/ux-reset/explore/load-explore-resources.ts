import {
  buildExploreSelection,
  countyDirectoryFromScoreSummaries,
  countyExploreMeasures,
  type ExploreCommittedSelection,
  type ExploreCountyIdentity,
} from "@/features/ux-reset/explore/explore-model";
import {
  measuresV1MeasuresGet,
  observationsV1ObservationsGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import type { Measure, Observation } from "@/generated/models";
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

function chunkIds(ids: readonly string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export async function fetchExploreMeasures(
  signal: AbortSignal
): Promise<Measure[]> {
  const measures: Measure[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const response = await measuresV1MeasuresGet(
      {
        geography_type: "county",
        page_size: measuresV1MeasuresGetQueryPageSizeOneMax,
        page_token: pageToken,
      },
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
      measures.push(measure);
    }
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }

  return countyExploreMeasures(measures);
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
  return countyDirectoryFromScoreSummaries(parsed.counties);
}

async function fetchObservationPage(input: {
  fips: readonly string[];
  measureId: string;
  pageToken: string | null;
  signal: AbortSignal;
}): Promise<{ nextToken: string | null; observations: Observation[] }> {
  const response = await observationsV1ObservationsGet(
    {
      geography_id: [...input.fips],
      geography_type: "county",
      measure_id: input.measureId,
      page_size: observationsV1ObservationsGetQueryPageSizeOneMax,
      page_token: input.pageToken,
    },
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
  fips: readonly string[];
  measureId: string;
  signal: AbortSignal;
}): Promise<Observation[]> {
  const observations: Observation[] = [];
  const batches = chunkIds(
    input.fips,
    observationsV1ObservationsGetQueryGeographyIdMax
  );
  for (const batch of batches) {
    const seenTokens = new Set<string>();
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
      const result = await fetchObservationPage({
        fips: batch,
        measureId: input.measureId,
        pageToken,
        signal: input.signal,
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
  return observations;
}

export async function loadExploreSelection(input: {
  directory: readonly ExploreCountyIdentity[];
  mapScope: string;
  measure: Measure;
  releaseId: string;
  signal: AbortSignal;
}): Promise<ExploreCommittedSelection> {
  const fips = input.directory.map((county) => county.fips);
  const observations = await fetchExploreObservations({
    fips,
    measureId: input.measure.measure_id,
    signal: input.signal,
  });
  return buildExploreSelection({
    directory: input.directory,
    mapScope: input.mapScope,
    measure: input.measure,
    observations,
    releaseId: input.releaseId,
  });
}
