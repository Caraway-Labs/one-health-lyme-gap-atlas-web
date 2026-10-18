import {
  indicatorsV1IndicatorsGet,
  measuresV1MeasuresGet,
  sourcesV1SourcesGet,
} from "@/generated/atlas";
import type { Indicator, Measure, Source } from "@/generated/models";
import {
  IndicatorsV1IndicatorsGetResponse,
  MeasuresV1MeasuresGetResponse,
  SourcesV1SourcesGetResponse,
  indicatorsV1IndicatorsGetQueryPageSizeOneMax,
  measuresV1MeasuresGetQueryPageSizeOneMax,
  sourcesV1SourcesGetQueryPageSizeOneMax,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

import {
  buildDataProvenanceCatalog,
  type DataProvenanceCatalog,
} from "./catalog";

const MAX_COLLECTION_PAGES = 20;

type PageReader = (
  pageToken: string | null,
  signal: AbortSignal
) => Promise<{ data: unknown; status: number }>;

async function readPages<T>(input: {
  endpoint: string;
  read: PageReader;
  resource: string;
  schema: Parameters<typeof validateApiResponse>[1];
  signal: AbortSignal;
}): Promise<{ incomplete: boolean; items: T[] }> {
  const items: T[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const response = await input.read(pageToken, input.signal);
    if (response.status !== 200) {
      throw new AtlasApiError(
        `${input.resource} are temporarily unavailable.`,
        input.endpoint,
        response.status,
        null
      );
    }
    const parsed = validateApiResponse(
      input.resource,
      input.schema,
      response.data
    );
    const envelope = parsed as {
      data: T[];
      meta: { next_page_token?: string | null };
    };
    items.push(...envelope.data);
    const nextToken = envelope.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      return { incomplete: false, items };
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return { incomplete: true, items };
}

async function readSources(
  signal: AbortSignal
): Promise<{ incomplete: boolean; items: Source[] }> {
  return readPages<Source>({
    endpoint: "/v1/sources",
    read: (pageToken, requestSignal) =>
      sourcesV1SourcesGet(
        pageToken
          ? {
              page_size: sourcesV1SourcesGetQueryPageSizeOneMax,
              page_token: pageToken,
            }
          : { page_size: sourcesV1SourcesGetQueryPageSizeOneMax },
        { signal: requestSignal }
      ),
    resource: "Sources",
    schema: SourcesV1SourcesGetResponse,
    signal,
  });
}

async function readMeasures(
  signal: AbortSignal
): Promise<{ incomplete: boolean; items: Measure[] }> {
  return readPages<Measure>({
    endpoint: "/v1/measures",
    read: (pageToken, requestSignal) =>
      measuresV1MeasuresGet(
        pageToken
          ? {
              page_size: measuresV1MeasuresGetQueryPageSizeOneMax,
              page_token: pageToken,
            }
          : { page_size: measuresV1MeasuresGetQueryPageSizeOneMax },
        { signal: requestSignal }
      ),
    resource: "Measures",
    schema: MeasuresV1MeasuresGetResponse,
    signal,
  });
}

async function readIndicators(
  signal: AbortSignal
): Promise<{ incomplete: boolean; items: Indicator[] }> {
  return readPages<Indicator>({
    endpoint: "/v1/indicators",
    read: (pageToken, requestSignal) =>
      indicatorsV1IndicatorsGet(
        pageToken
          ? {
              page_size: indicatorsV1IndicatorsGetQueryPageSizeOneMax,
              page_token: pageToken,
            }
          : { page_size: indicatorsV1IndicatorsGetQueryPageSizeOneMax },
        { signal: requestSignal }
      ),
    resource: "Indicators",
    schema: IndicatorsV1IndicatorsGetResponse,
    signal,
  });
}

/**
 * Sources are required. Measure and indicator metadata only assign domains.
 * A failure there still returns the source list and says domains are unavailable.
 */
export async function loadDataProvenanceCatalog(
  signal: AbortSignal
): Promise<DataProvenanceCatalog> {
  const sources = await readSources(signal);
  const [measures, indicators] = await Promise.all([
    readMeasures(signal).then(
      (result) => ({ ...result, failed: false as const }),
      () => ({ failed: true as const, incomplete: false, items: [] })
    ),
    readIndicators(signal).then(
      (result) => ({ ...result, failed: false as const }),
      () => ({ failed: true as const, incomplete: false, items: [] })
    ),
  ]);
  return buildDataProvenanceCatalog({
    domainMetadataUnavailable: measures.failed || indicators.failed,
    incomplete:
      sources.incomplete || measures.incomplete || indicators.incomplete,
    indicators: indicators.items,
    measures: measures.items,
    sources: sources.items,
  });
}
