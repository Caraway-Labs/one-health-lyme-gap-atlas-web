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
  indicatorsV1IndicatorsGetQueryPageSizeMax,
  measuresV1MeasuresGetQueryPageSizeMax,
  sourcesV1SourcesGetQueryPageSizeMax,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

import {
  buildDataProvenanceCatalog,
  type CollectionRead,
  type DataProvenanceCatalog,
} from "./catalog";

const MAX_COLLECTION_PAGES = 20;

type PageReader = (
  pageToken: string | null,
  signal: AbortSignal
) => Promise<{ data: unknown; status: number }>;

type PagedRead<T> = {
  incomplete: boolean;
  items: T[];
  releaseId: string | null;
};

function releaseIdFromMeta(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text || null;
}

async function readPages<T>(input: {
  endpoint: string;
  read: PageReader;
  resource: string;
  schema: Parameters<typeof validateApiResponse>[1];
  signal: AbortSignal;
}): Promise<PagedRead<T>> {
  const items: T[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  let releaseId: string | null | undefined;
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
      meta: { next_page_token?: string | null; release_id?: string | null };
    };
    const pageRelease = releaseIdFromMeta(envelope.meta.release_id);
    if (releaseId === undefined) {
      releaseId = pageRelease;
    } else if (pageRelease !== releaseId) {
      return { incomplete: true, items, releaseId };
    }
    items.push(...envelope.data);
    const nextToken = envelope.meta.next_page_token ?? null;
    if (!nextToken) {
      return { incomplete: false, items, releaseId };
    }
    if (seenTokens.has(nextToken)) {
      return { incomplete: true, items, releaseId };
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return { incomplete: true, items, releaseId: releaseId ?? null };
}

async function readSources(signal: AbortSignal): Promise<PagedRead<Source>> {
  return readPages<Source>({
    endpoint: "/v1/sources",
    read: (pageToken, requestSignal) =>
      sourcesV1SourcesGet(
        pageToken
          ? {
              page_size: sourcesV1SourcesGetQueryPageSizeMax,
              page_token: pageToken,
            }
          : { page_size: sourcesV1SourcesGetQueryPageSizeMax },
        { signal: requestSignal }
      ),
    resource: "Sources",
    schema: SourcesV1SourcesGetResponse,
    signal,
  });
}

async function readMeasures(signal: AbortSignal): Promise<PagedRead<Measure>> {
  return readPages<Measure>({
    endpoint: "/v1/measures",
    read: (pageToken, requestSignal) =>
      measuresV1MeasuresGet(
        pageToken
          ? {
              page_size: measuresV1MeasuresGetQueryPageSizeMax,
              page_token: pageToken,
            }
          : { page_size: measuresV1MeasuresGetQueryPageSizeMax },
        { signal: requestSignal }
      ),
    resource: "Measures",
    schema: MeasuresV1MeasuresGetResponse,
    signal,
  });
}

async function readIndicators(
  signal: AbortSignal
): Promise<PagedRead<Indicator>> {
  return readPages<Indicator>({
    endpoint: "/v1/indicators",
    read: (pageToken, requestSignal) =>
      indicatorsV1IndicatorsGet(
        pageToken
          ? {
              page_size: indicatorsV1IndicatorsGetQueryPageSizeMax,
              page_token: pageToken,
            }
          : { page_size: indicatorsV1IndicatorsGetQueryPageSizeMax },
        { signal: requestSignal }
      ),
    resource: "Indicators",
    schema: IndicatorsV1IndicatorsGetResponse,
    signal,
  });
}

type CollectionResult<T> = {
  items: T[];
  read: CollectionRead;
  releaseId: string | null;
};

function collectionRead(incomplete: boolean): CollectionRead {
  if (incomplete) {
    return "incomplete";
  }
  return "complete";
}

/**
 * A failed or page-capped read is not an empty relationship list.
 * Sources that already loaded stay on the page either way.
 */
async function readCollection<T>(
  read: Promise<PagedRead<T>>
): Promise<CollectionResult<T>> {
  try {
    const result = await read;
    return {
      items: result.items,
      read: collectionRead(result.incomplete),
      releaseId: result.releaseId,
    };
  } catch {
    return { items: [], read: "unavailable", releaseId: null };
  }
}

type CatalogCollections = {
  indicators: CollectionResult<Indicator>;
  measures: CollectionResult<Measure>;
  sources: PagedRead<Source>;
};

async function loadCatalogCollections(
  signal: AbortSignal
): Promise<CatalogCollections> {
  const sources = await readSources(signal);
  const [measures, indicators] = await Promise.all([
    readCollection(readMeasures(signal)),
    readCollection(readIndicators(signal)),
  ]);
  return { indicators, measures, sources };
}

function knownReleaseIds(loaded: CatalogCollections): string[] {
  return [
    loaded.sources.releaseId,
    loaded.measures.releaseId,
    loaded.indicators.releaseId,
  ].filter((releaseId): releaseId is string => releaseId !== null);
}

function releasesConflict(loaded: CatalogCollections): boolean {
  return new Set(knownReleaseIds(loaded)).size > 1;
}

function keepMetadata<T>(
  metadata: CollectionResult<T>,
  drop: boolean
): { items: T[]; read: CollectionRead } {
  if (drop) {
    return { items: [], read: "unavailable" };
  }
  return { items: metadata.items, read: metadata.read };
}

/**
 * A missing release id is not a conflict. Two different known ids are.
 * Sources anchor the comparison when they name a release. Otherwise measures
 * and indicators still have to agree with each other.
 */
function alignedMetadata(loaded: CatalogCollections): {
  indicators: { items: Indicator[]; read: CollectionRead };
  measures: { items: Measure[]; read: CollectionRead };
} {
  if (!releasesConflict(loaded)) {
    return {
      indicators: keepMetadata(loaded.indicators, false),
      measures: keepMetadata(loaded.measures, false),
    };
  }
  const anchor = loaded.sources.releaseId;
  if (anchor === null) {
    return {
      indicators: keepMetadata(loaded.indicators, true),
      measures: keepMetadata(loaded.measures, true),
    };
  }
  return {
    indicators: keepMetadata(
      loaded.indicators,
      loaded.indicators.releaseId !== null &&
        loaded.indicators.releaseId !== anchor
    ),
    measures: keepMetadata(
      loaded.measures,
      loaded.measures.releaseId !== null && loaded.measures.releaseId !== anchor
    ),
  };
}

/**
 * Sources are required. Measure and indicator metadata only assign relationships
 * from the same governed release. A mismatch is retried once, then dropped.
 */
export async function loadDataProvenanceCatalog(
  signal: AbortSignal
): Promise<DataProvenanceCatalog> {
  let loaded = await loadCatalogCollections(signal);
  if (releasesConflict(loaded)) {
    loaded = await loadCatalogCollections(signal);
  }
  const metadata = alignedMetadata(loaded);
  return buildDataProvenanceCatalog({
    indicators: metadata.indicators.items,
    indicatorsRead: metadata.indicators.read,
    measures: metadata.measures.items,
    measuresRead: metadata.measures.read,
    sources: loaded.sources.items,
    sourcesIncomplete: loaded.sources.incomplete,
  });
}
