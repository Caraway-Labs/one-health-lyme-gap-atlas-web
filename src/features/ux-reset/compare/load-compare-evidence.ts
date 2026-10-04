import {
  alignCompareEvidence,
  type CompareAlignment,
  type CompareMeasureOutcome,
} from "@/features/ux-reset/compare/compare-alignment";
import { parseCalendarIsoDate } from "@/features/ux-reset/context-params";
import {
  resolveExploreTimeBound,
  type ExploreTimeBound,
} from "@/features/ux-reset/explore/explore-model";
import {
  acceptCountyObservations,
  InvestigateContractError,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  mapWithConcurrency,
  investigateObservationRequestRejection,
} from "@/features/ux-reset/investigate/load-county-evidence";
import { observationsV1ObservationsGet } from "@/generated/atlas";
import type {
  Measure,
  Observation,
  ObservationsV1ObservationsGetParams,
} from "@/generated/models";
import {
  ObservationsV1ObservationsGetResponse,
  observationsV1ObservationsGetQueryPageSizeOneMax,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import { isCountyFips } from "@/lib/county-geography";

const MAX_COLLECTION_PAGES = 20;
const COMPARE_OBSERVATION_CONCURRENCY = 5;

export type CompareContractCode =
  | "identity_mismatch"
  | "rejected"
  | "release_mismatch";

export class CompareContractError extends Error {
  readonly code: CompareContractCode;

  constructor(message: string, code: CompareContractCode) {
    super(message);
    this.name = "CompareContractError";
    this.code = code;
  }
}

type QueryRetrySetting =
  | boolean
  | number
  | ((failureCount: number, error: Error) => boolean)
  | undefined;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function shouldRetryCompareRequest(
  failureCount: number,
  error: unknown,
  configured: QueryRetrySetting
): boolean {
  if (error instanceof CompareContractError || isAbortError(error)) {
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

export function compareEvidenceQueryKey(input: {
  measureIds: readonly string[];
  pair: readonly [string, string];
  period: string | null;
  releaseId: string;
}): readonly [string, string, string, string, string, string] {
  return [
    "ux-reset-compare-evidence",
    input.releaseId,
    input.pair[0],
    input.pair[1],
    input.period ?? "",
    [...input.measureIds].toSorted().join("|"),
  ];
}

/**
 * Status for a two-county observation request the public API rejects.
 * Delegates the shared geography, time, and token rules to Investigate.
 */
export function compareObservationRequestRejection(
  params: ObservationsV1ObservationsGetParams
): 400 | 414 | null {
  return investigateObservationRequestRejection(params);
}

export function buildCompareObservationParams(input: {
  measureId: string;
  pageToken?: string | null;
  pair: readonly [string, string];
  timeBound: ExploreTimeBound;
}): ObservationsV1ObservationsGetParams {
  const params: ObservationsV1ObservationsGetParams = {
    geography_id: [input.pair[0], input.pair[1]],
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
  if (compareObservationRequestRejection(params) !== null) {
    throw new CompareContractError(
      "County comparison request is not accepted by the public API.",
      "rejected"
    );
  }
  return params;
}

function assertPairIdentity(pair: readonly [string, string]): void {
  if (!isCountyFips(pair[0]) || !isCountyFips(pair[1]) || pair[0] === pair[1]) {
    throw new CompareContractError(
      "Compare requires two different county identifiers.",
      "rejected"
    );
  }
}

function acceptPairObservations(input: {
  measureId: string;
  observations: readonly Observation[];
  pair: readonly [string, string];
  releaseId: string;
  timeBound: ExploreTimeBound;
}): Observation[] {
  const grouped: Record<string, Observation[]> = {
    [input.pair[0]]: [],
    [input.pair[1]]: [],
  };
  for (const observation of input.observations) {
    if (observation.measure_id !== input.measureId) {
      throw new CompareContractError(
        "Observation measure does not match the request.",
        "identity_mismatch"
      );
    }
    if (observation.release_id !== input.releaseId) {
      throw new CompareContractError(
        "Observation release does not match the requested release.",
        "release_mismatch"
      );
    }
    const fips = observation.geography.geography_id;
    const bucket = grouped[fips];
    if (observation.geography.geography_type !== "county" || !bucket) {
      throw new CompareContractError(
        "Observation geography is not one of the two counties.",
        "identity_mismatch"
      );
    }
    bucket.push(observation);
  }
  const accepted: Observation[] = [];
  for (const fips of input.pair) {
    const bucket = grouped[fips] ?? [];
    if (bucket.length === 0) {
      continue;
    }
    accepted.push(
      ...acceptCountyObservations({
        measureId: input.measureId,
        observations: bucket,
        releaseId: input.releaseId,
        requestedFips: fips,
        timeBound: input.timeBound,
      })
    );
  }
  return accepted;
}

async function fetchCompareObservations(input: {
  measureId: string;
  pair: readonly [string, string];
  releaseId: string;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<Observation[]> {
  const collected: Observation[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const params = buildCompareObservationParams({
      measureId: input.measureId,
      pageToken,
      pair: input.pair,
      timeBound: input.timeBound,
    });
    const response = await observationsV1ObservationsGet(params, {
      signal: input.signal,
    });
    if (response.status !== 200) {
      throw new AtlasApiError(
        "Governed observations could not be loaded.",
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
    collected.push(...parsed.data);
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return acceptPairObservations({
    measureId: input.measureId,
    observations: collected,
    pair: input.pair,
    releaseId: input.releaseId,
    timeBound: input.timeBound,
  });
}

function failureMessage(error: unknown): string {
  if (
    error instanceof CompareContractError ||
    error instanceof InvestigateContractError
  ) {
    return "This measure response did not match the requested counties.";
  }
  return "This measure could not be loaded.";
}

export async function loadCompareEvidence(input: {
  leftFips: string;
  leftLabel: string;
  measures: readonly Measure[];
  period: string | null;
  releaseId: string;
  rightFips: string;
  rightLabel: string;
  signal: AbortSignal;
}): Promise<CompareAlignment> {
  const pair: [string, string] = [input.leftFips, input.rightFips];
  assertPairIdentity(pair);
  if (input.period && parseCalendarIsoDate(input.period) !== input.period) {
    throw new CompareContractError(
      "The comparison period is not a calendar date.",
      "rejected"
    );
  }
  const outcomes: CompareMeasureOutcome[] = await mapWithConcurrency(
    input.measures,
    COMPARE_OBSERVATION_CONCURRENCY,
    async (measure) => {
      const timeBound = resolveExploreTimeBound(measure, input.period);
      if (!timeBound) {
        return {
          measureId: measure.measure_id,
          status: "unsupported_period" as const,
        };
      }
      try {
        const observations = await fetchCompareObservations({
          measureId: measure.measure_id,
          pair,
          releaseId: input.releaseId,
          signal: input.signal,
          timeBound,
        });
        return {
          measureId: measure.measure_id,
          observations,
          status: "ready" as const,
        };
      } catch (error) {
        if (isAbortError(error) || input.signal.aborted) {
          throw error;
        }
        return {
          measureId: measure.measure_id,
          message: failureMessage(error),
          status: "failed" as const,
        };
      }
    }
  );
  return alignCompareEvidence({
    leftFips: input.leftFips,
    leftLabel: input.leftLabel,
    measures: input.measures,
    outcomes,
    rightFips: input.rightFips,
    rightLabel: input.rightLabel,
  });
}
