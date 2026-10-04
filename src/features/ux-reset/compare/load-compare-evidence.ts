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
const TRANSIENT_ATTEMPT_LIMIT = 3;
const MILLISECONDS_PER_SECOND = 1000;
const UNSCHEDULED_RETRY_BACKOFF_MS = 50;

type CompareCooldownScope = {
  leftFips: string;
  measureId: string;
  period: string | null;
  releaseId: string;
  rightFips: string;
};

/**
 * Deadlines received from Retry-After. Kept outside the evidence query so an
 * abort during the wait does not leave the previous alignment as the only record.
 */
const observationRetryDeadlines = new Map<string, number>();

function observationCooldownKey(scope: CompareCooldownScope): string {
  return [
    scope.releaseId,
    scope.leftFips,
    scope.rightFips,
    scope.period ?? "",
    scope.measureId,
  ].join("\u0000");
}

function rememberObservationCooldown(
  scope: CompareCooldownScope,
  retryAfterSeconds: number | null
): void {
  if (retryAfterSeconds === null || retryAfterSeconds < 0) {
    return;
  }
  const retryAtMs = Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND;
  const key = observationCooldownKey(scope);
  const existing = observationRetryDeadlines.get(key);
  if (existing === undefined || retryAtMs > existing) {
    observationRetryDeadlines.set(key, retryAtMs);
  }
}

function rememberedCooldownMs(scope: CompareCooldownScope): number | null {
  return observationRetryDeadlines.get(observationCooldownKey(scope)) ?? null;
}

function forgetObservationCooldown(scope: CompareCooldownScope): void {
  observationRetryDeadlines.delete(observationCooldownKey(scope));
}

/** Drops pair-scoped deadlines. Tests use this so later cases are not blocked. */
export function clearCompareObservationRetryDeadlines(): void {
  observationRetryDeadlines.clear();
}

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Server Retry-After is waited in full. Shortening it spends the retry budget
 * before the API allows another read. A missing header uses a short backoff.
 */
function transientDelayMs(
  retryAfterSeconds: number | null,
  attempt: number
): number {
  if (retryAfterSeconds !== null && retryAfterSeconds >= 0) {
    return retryAfterSeconds * MILLISECONDS_PER_SECOND;
  }
  return UNSCHEDULED_RETRY_BACKOFF_MS * attempt;
}

function retryAfterSecondsFromHeaders(
  headers: Headers | undefined
): number | null {
  const value = headers?.get("Retry-After") ?? null;
  if (!value) {
    return null;
  }
  const asInteger = Number.parseInt(value, 10);
  if (String(asInteger) === value.trim() && asInteger >= 0) {
    return asInteger;
  }
  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) {
    return null;
  }
  return Math.max(
    0,
    Math.ceil((asDate - Date.now()) / MILLISECONDS_PER_SECOND)
  );
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (ms <= 0) {
    return;
  }
  const { promise, reject, resolve } = Promise.withResolvers<boolean>();
  const timer = setTimeout(() => {
    signal.removeEventListener("abort", onAbort);
    resolve(true);
  }, ms);
  const onAbort = () => {
    clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  await promise;
}

/** Absolute time of the latest Retry-After. Exhausted attempts must keep it. */
function retryAtMsFromError(error: unknown): number | null {
  if (!(error instanceof AtlasApiError) || error.retryAfterSeconds === null) {
    return null;
  }
  if (error.retryAfterSeconds < 0) {
    return null;
  }
  return Date.now() + error.retryAfterSeconds * MILLISECONDS_PER_SECOND;
}

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

async function readCompareObservationPage(
  params: ObservationsV1ObservationsGetParams,
  scope: CompareCooldownScope,
  signal: AbortSignal
) {
  for (let attempt = 1; attempt <= TRANSIENT_ATTEMPT_LIMIT; attempt += 1) {
    try {
      const response = await observationsV1ObservationsGet(params, { signal });
      if (response.status === 200) {
        forgetObservationCooldown(scope);
        return response;
      }
      const retryAfter = retryAfterSecondsFromHeaders(response.headers);
      rememberObservationCooldown(scope, retryAfter);
      const retryable =
        isTransientStatus(response.status) && attempt < TRANSIENT_ATTEMPT_LIMIT;
      if (!retryable) {
        throw new AtlasApiError(
          "Governed observations could not be loaded.",
          "/v1/observations",
          response.status,
          null,
          retryAfter
        );
      }
      await delay(transientDelayMs(retryAfter, attempt), signal);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        throw error;
      }
      if (error instanceof AtlasApiError) {
        rememberObservationCooldown(scope, error.retryAfterSeconds);
      }
      const retryable =
        error instanceof AtlasApiError &&
        isTransientStatus(error.status) &&
        attempt < TRANSIENT_ATTEMPT_LIMIT;
      if (!retryable) {
        throw error;
      }
      await delay(transientDelayMs(error.retryAfterSeconds, attempt), signal);
    }
  }
  throw new AtlasApiError(
    "Governed observations could not be loaded.",
    "/v1/observations",
    503,
    null
  );
}

async function fetchCompareObservations(input: {
  measureId: string;
  pair: readonly [string, string];
  period: string | null;
  releaseId: string;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<Observation[]> {
  const collected: Observation[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  const scope: CompareCooldownScope = {
    leftFips: input.pair[0],
    measureId: input.measureId,
    period: input.period,
    releaseId: input.releaseId,
    rightFips: input.pair[1],
  };
  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const params = buildCompareObservationParams({
      measureId: input.measureId,
      pageToken,
      pair: input.pair,
      timeBound: input.timeBound,
    });
    const response = await readCompareObservationPage(
      params,
      scope,
      input.signal
    );
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

export type CompareRetryCooldown = {
  measureId: string;
  retryAtMs: number;
};

/** Ready rows kept while failed measures are requested again. */
export type PreservedCompareMeasures = {
  leftFips: string;
  outcomes: readonly CompareMeasureOutcome[];
  period: string | null;
  releaseId: string;
  rightFips: string;
};

function reusableCompareOutcomes(
  outcomes: readonly CompareMeasureOutcome[]
): CompareMeasureOutcome[] {
  return outcomes.filter(
    (outcome) =>
      outcome.status === "ready" || outcome.status === "unsupported_period"
  );
}

function preservedForRequest(input: {
  leftFips: string;
  measures: readonly Measure[];
  period: string | null;
  preserve: PreservedCompareMeasures | null;
  releaseId: string;
  rightFips: string;
}): CompareMeasureOutcome[] {
  const preserve = input.preserve;
  if (
    !preserve ||
    preserve.leftFips !== input.leftFips ||
    preserve.rightFips !== input.rightFips ||
    preserve.releaseId !== input.releaseId ||
    preserve.period !== input.period
  ) {
    return [];
  }
  const measureIds = new Set(
    input.measures.map((measure) => measure.measure_id)
  );
  return reusableCompareOutcomes(preserve.outcomes).filter((outcome) =>
    measureIds.has(outcome.measureId)
  );
}

async function waitForMeasureCooldown(input: {
  cooldowns: readonly CompareRetryCooldown[] | null | undefined;
  scope: CompareCooldownScope;
  signal: AbortSignal;
}): Promise<void> {
  const fromAlignment = input.cooldowns?.find(
    (entry) => entry.measureId === input.scope.measureId
  )?.retryAtMs;
  const retryAtMs = Math.max(
    fromAlignment ?? 0,
    rememberedCooldownMs(input.scope) ?? 0
  );
  await delay(retryAtMs - Date.now(), input.signal);
}

export function compareRetryCooldowns(
  alignment: CompareAlignment | undefined
): CompareRetryCooldown[] {
  const cooldowns: CompareRetryCooldown[] = [];
  for (const outcome of alignment?.outcomes ?? []) {
    if (outcome.status === "failed" && outcome.retryAtMs !== null) {
      cooldowns.push({
        measureId: outcome.measureId,
        retryAtMs: outcome.retryAtMs,
      });
    }
  }
  return cooldowns;
}

export function preservedCompareMeasures(input: {
  alignment: CompareAlignment | undefined;
  leftFips: string;
  period: string | null;
  releaseId: string;
  rightFips: string;
}): PreservedCompareMeasures | null {
  const alignment = input.alignment;
  if (
    !alignment ||
    alignment.leftFips !== input.leftFips ||
    alignment.rightFips !== input.rightFips ||
    alignment.releaseId !== input.releaseId ||
    (alignment.period ?? null) !== input.period
  ) {
    return null;
  }
  return {
    leftFips: input.leftFips,
    outcomes: reusableCompareOutcomes(alignment.outcomes),
    period: input.period,
    releaseId: input.releaseId,
    rightFips: input.rightFips,
  };
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
  cooldowns?: readonly CompareRetryCooldown[] | null;
  leftFips: string;
  leftLabel: string;
  measures: readonly Measure[];
  period: string | null;
  preserve?: PreservedCompareMeasures | null;
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
  const preserved = preservedForRequest({
    leftFips: input.leftFips,
    measures: input.measures,
    period: input.period,
    preserve: input.preserve ?? null,
    releaseId: input.releaseId,
    rightFips: input.rightFips,
  });
  const preservedIds = new Set(preserved.map((outcome) => outcome.measureId));
  const measuresToFetch = input.measures.filter(
    (measure) => !preservedIds.has(measure.measure_id)
  );
  const fetched: CompareMeasureOutcome[] = await mapWithConcurrency(
    measuresToFetch,
    COMPARE_OBSERVATION_CONCURRENCY,
    async (measure) => {
      const timeBound = resolveExploreTimeBound(measure, input.period);
      if (!timeBound) {
        return {
          measureId: measure.measure_id,
          status: "unsupported_period" as const,
        };
      }
      const scope: CompareCooldownScope = {
        leftFips: pair[0],
        measureId: measure.measure_id,
        period: input.period,
        releaseId: input.releaseId,
        rightFips: pair[1],
      };
      try {
        await waitForMeasureCooldown({
          cooldowns: input.cooldowns,
          scope,
          signal: input.signal,
        });
        const observations = await fetchCompareObservations({
          measureId: measure.measure_id,
          pair,
          period: input.period,
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
          retryAtMs: retryAtMsFromError(error),
          status: "failed" as const,
        };
      }
    }
  );
  const outcomes = [...preserved, ...fetched];
  return {
    ...alignCompareEvidence({
      leftFips: input.leftFips,
      leftLabel: input.leftLabel,
      measures: input.measures,
      outcomes,
      rightFips: input.rightFips,
      rightLabel: input.rightLabel,
    }),
    period: input.period,
    releaseId: input.releaseId,
  };
}
