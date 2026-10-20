import {
  maximumObservationPageToken,
  PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  createObservationSelectionAccumulator,
  mergeKnownEmptySelections,
  observationAuthorityFailure,
  type FoldedObservationSelection,
  type KnownEmptyObservationSelection,
} from "@/features/ux-reset/observations/selection-availability";
import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import {
  acceptExplorerMapObservations,
  ExplorerMapContractError,
  type ExplorerMapObservationReady,
  type ExplorerObservationSpec,
} from "@/features/ux-reset/review/explorer-map-observation";
import {
  getObservationsV1ObservationsGetUrl,
  observationsV1ObservationsGet,
} from "@/generated/atlas";
import type {
  CountyContextObservation,
  Observation,
  ObservationsV1ObservationsGetParams,
} from "@/generated/models";
import {
  ObservationsV1ObservationsGetResponse,
  observationsV1ObservationsGetQueryGeographyIdMax,
  observationsV1ObservationsGetQueryPageSizeMax,
} from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";

const MAX_COLLECTION_PAGES = 20;

function pageParams(input: {
  fips: readonly string[];
  pageToken?: string | null;
  spec: ExplorerObservationSpec;
}): ObservationsV1ObservationsGetParams {
  const params: ObservationsV1ObservationsGetParams = {
    geography_id: [...input.fips],
    geography_type: "county",
    measure_id: input.spec.measureId,
    page_size: observationsV1ObservationsGetQueryPageSizeMax,
  };
  if (input.spec.context) {
    params.vintage_year = input.spec.vintageYear;
  } else {
    params.year = input.spec.year;
  }
  if (input.pageToken) {
    params.page_token = input.pageToken;
  }
  return params;
}

function batchFits(input: {
  fips: readonly string[];
  spec: ExplorerObservationSpec;
}): boolean {
  if (
    input.fips.length === 0 ||
    input.fips.length > observationsV1ObservationsGetQueryGeographyIdMax
  ) {
    return false;
  }
  const url = getObservationsV1ObservationsGetUrl(
    pageParams({
      fips: input.fips,
      pageToken: maximumObservationPageToken(),
      spec: input.spec,
    })
  );
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  return (
    new TextEncoder().encode(query).length <=
    PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT
  );
}

/** Geography batches under the id cap and the public query-byte cap. */
export function splitExplorerMapObservationBatches(input: {
  fips: readonly string[];
  spec: ExplorerObservationSpec;
}): string[][] {
  const batches: string[][] = [];
  const current: string[] = [];
  for (const fips of input.fips) {
    current.push(fips);
    if (batchFits({ fips: current, spec: input.spec })) {
      continue;
    }
    current.pop();
    if (
      current.length === 0 ||
      !batchFits({ fips: [fips], spec: input.spec })
    ) {
      throw new ExplorerMapContractError(
        "A county observation request exceeds the public query byte limit."
      );
    }
    batches.push([...current]);
    current.length = 0;
    current.push(fips);
  }
  if (current.length > 0) {
    batches.push([...current]);
  }
  return batches;
}

function readContextObservations(
  rows: readonly unknown[]
): CountyContextObservation[] {
  const contextRows: CountyContextObservation[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || !("county_context" in row)) {
      throw new ExplorerMapContractError(
        "A county-context request returned a dated observation."
      );
    }
    const record = row as { county_context?: unknown };
    if (record.county_context == null) {
      throw new ExplorerMapContractError(
        "A county-context request returned a row without county context."
      );
    }
    contextRows.push(row as CountyContextObservation);
  }
  return contextRows;
}

async function fetchPages(input: {
  fips: readonly string[];
  releaseId: string;
  signal: AbortSignal;
  spec: ExplorerObservationSpec;
}): Promise<{
  knownEmptySelection: KnownEmptyObservationSelection | null;
  rows: readonly (CountyContextObservation | Observation)[];
}> {
  const collected: unknown[] = [];
  const folds: FoldedObservationSelection[] = [];
  const batches = splitExplorerMapObservationBatches({
    fips: input.fips,
    spec: input.spec,
  });
  for (const batch of batches) {
    const seenTokens = new Set<string>();
    const selection = createObservationSelectionAccumulator({
      measureId: input.spec.measureId,
      requestedReleaseId: input.releaseId,
    });
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
      const response = await observationsV1ObservationsGet(
        pageParams({ fips: batch, pageToken, spec: input.spec }),
        { signal: input.signal }
      );
      const parsed = validateApiResponse(
        "Observations",
        ObservationsV1ObservationsGetResponse,
        response.data
      );
      selection.note({
        dataCount: parsed.data.length,
        meta: parsed.meta,
        pageToken,
      });
      for (const row of parsed.data) {
        collected.push(row);
      }
      const nextToken = parsed.meta.next_page_token ?? null;
      if (!nextToken || seenTokens.has(nextToken)) {
        break;
      }
      seenTokens.add(nextToken);
      pageToken = nextToken;
    }
    folds.push(selection.finish());
  }
  const folded = mergeKnownEmptySelections(folds);
  const authorityFailure = observationAuthorityFailure(folded);
  if (authorityFailure === "release_mismatch") {
    throw new ExplorerMapContractError(
      "Observation availability release does not match the requested release."
    );
  }
  if (authorityFailure === "malformed_authority") {
    throw new ExplorerMapContractError(
      "Observation availability did not include a checked release and limitations."
    );
  }
  const rows = input.spec.context
    ? readContextObservations(collected)
    : readDatedObservations(collected);
  return {
    knownEmptySelection:
      folded.kind === "known_unavailable" ? folded.selection : null,
    rows,
  };
}

function knownEmptyPeriod(spec: ExplorerObservationSpec): string {
  if (!spec.context) {
    return `${spec.periodStart}–${spec.periodEnd}`;
  }
  if (spec.dates === "none") {
    return `Vintage ${spec.vintageYear}`;
  }
  return `${spec.periodStart}–${spec.periodEnd}`;
}

export async function loadExplorerMapObservations(input: {
  fips: readonly string[];
  releaseId: string;
  signal: AbortSignal;
  spec: ExplorerObservationSpec;
}): Promise<ExplorerMapObservationReady> {
  const loaded = await fetchPages(input);
  if (loaded.rows.length === 0 && loaded.knownEmptySelection) {
    return {
      knownEmptySelection: loaded.knownEmptySelection,
      omitted: input.fips.length,
      period: knownEmptyPeriod(input.spec),
      rows: [],
      sourceLabel: null,
      unit: input.spec.unit,
    };
  }
  return {
    ...acceptExplorerMapObservations({
      releaseId: input.releaseId,
      requestedFips: input.fips,
      rows: loaded.rows,
      spec: input.spec,
    }),
    knownEmptySelection: null,
  };
}
