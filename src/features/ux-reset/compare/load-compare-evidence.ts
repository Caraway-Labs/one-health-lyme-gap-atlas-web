import {
  alignCompareEvidence,
  type CompareAlignment,
  type CompareMeasureOutcome,
} from "@/features/ux-reset/compare/compare-alignment";
import { withCompareReadLimit } from "@/features/ux-reset/compare/compare-read-limit";
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
import {
  createObservationSelectionAccumulator,
  observationAuthorityFailure,
  type KnownEmptyObservationSelection,
} from "@/features/ux-reset/observations/selection-availability";
import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import { listObservations } from "@/generated/atlas";
import type {
  Measure,
  Observation,
  ListObservationsParams,
} from "@/generated/models";
import {
  ListObservationsResponse,
  listObservationsQueryPageSizeMax,
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
  params: ListObservationsParams
): 400 | 414 | null {
  return investigateObservationRequestRejection(params);
}

export function buildCompareObservationParams(input: {
  measureId: string;
  pageToken?: string | null;
  pair: readonly [string, string];
  timeBound: ExploreTimeBound;
}): ListObservationsParams {
  const params: ListObservationsParams = {
    geography_id: [input.pair[0], input.pair[1]],
    geography_type: "county",
    measure_id: input.measureId,
    page_size: listObservationsQueryPageSizeMax,
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
  params: ListObservationsParams,
  scope: CompareCooldownScope,
  signal: AbortSignal
) {
  for (let attempt = 1; attempt <= TRANSIENT_ATTEMPT_LIMIT; attempt += 1) {
    try {
      const response = await listObservations(params, { signal });
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
}): Promise<{
  observations: Observation[];
  selection: KnownEmptyObservationSelection | null;
}> {
  const collected: Observation[] = [];
  const seenTokens = new Set<string>();
  const selection = createObservationSelectionAccumulator({
    measureId: input.measureId,
    requestedReleaseId: input.releaseId,
  });
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
      ListObservationsResponse,
      response.data
    );
    selection.note({
      dataCount: parsed.data.length,
      meta: parsed.meta,
      pageToken,
    });
    collected.push(...readDatedObservations(parsed.data));
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  const folded = selection.finish();
  const authorityFailure = observationAuthorityFailure(folded);
  if (authorityFailure === "release_mismatch") {
    throw new CompareContractError(
      "Observation availability release does not match the requested release.",
      "release_mismatch"
    );
  }
  if (authorityFailure === "malformed_authority") {
    throw new CompareContractError(
      "Observation availability did not include a checked release and limitations.",
      "rejected"
    );
  }
  return {
    observations: acceptPairObservations({
      measureId: input.measureId,
      observations: collected,
      pair: input.pair,
      releaseId: input.releaseId,
      timeBound: input.timeBound,
    }),
    selection: folded.kind === "known_unavailable" ? folded.selection : null,
  };
}

const FALLBACK_ANNUAL_YEAR = 2023;
const FALLBACK_CUMULATIVE_DAY = "2025-12-31";

function dayBound(date: string): ExploreTimeBound {
  return { date, handoffPeriod: date, kind: "day" };
}

/**
 * Time bounds to try for one measure, best first. The governed bound comes
 * first. When the catalog does not name one, the public API still serves
 * the published annual year and the cumulative day, so those are tried
 * instead of withholding the measure before any request is made.
 */
function compareTimeBoundCandidates(
  measure: Pick<Measure, "temporal_grains" | "temporal_semantics">,
  period: string | null
): { bound: ExploreTimeBound; governed: boolean }[] {
  const governed = resolveExploreTimeBound(measure, period);
  if (governed) {
    return [{ bound: governed, governed: true }];
  }
  const candidates: ExploreTimeBound[] = [];
  const semantics = measure.temporal_semantics?.trim() ?? "";
  if (parseCalendarIsoDate(semantics) === semantics) {
    candidates.push(dayBound(semantics));
  }
  if (period && parseCalendarIsoDate(period) === period) {
    candidates.push(dayBound(period));
  }
  candidates.push(
    {
      handoffPeriod: `${FALLBACK_ANNUAL_YEAR}-01-01`,
      kind: "year",
      year: FALLBACK_ANNUAL_YEAR,
    },
    dayBound(FALLBACK_CUMULATIVE_DAY)
  );
  const seen = new Set<string>();
  return candidates
    .filter((bound) => {
      const key = bound.kind === "year" ? String(bound.year) : bound.date;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((bound) => ({ bound, governed: false }));
}

const INCOMPATIBLE_TIME_FILTER_CODE = "UNSUPPORTED_FILTER";

/**
 * The public observations contract names an incompatible time bound as HTTP
 * 400 `UNSUPPORTED_FILTER`. Other 4xx responses, including 401 and 403, are
 * request failures and must not be read as "no published value".
 */
function isIncompatibleTimeFilter(error: unknown): boolean {
  if (!(error instanceof AtlasApiError) || error.status !== 400) {
    return false;
  }
  const body = error.responseBody;
  if (!body || typeof body !== "object") {
    return false;
  }
  const code = "code" in body ? body.code : null;
  return code === INCOMPATIBLE_TIME_FILTER_CODE;
}

async function fetchFirstAvailableObservations(input: {
  measureId: string;
  pair: readonly [string, string];
  period: string | null;
  releaseId: string;
  signal: AbortSignal;
  timeBounds: readonly { bound: ExploreTimeBound; governed: boolean }[];
}): Promise<{
  observations: Observation[];
  selection: KnownEmptyObservationSelection | null;
}> {
  let successfulEmpty: {
    observations: Observation[];
    selection: KnownEmptyObservationSelection | null;
  } | null = null;
  let rejectedFilter: unknown = null;
  for (const candidate of input.timeBounds) {
    try {
      const loaded = await fetchCompareObservations({
        measureId: input.measureId,
        pair: input.pair,
        period: input.period,
        releaseId: input.releaseId,
        signal: input.signal,
        timeBound: candidate.bound,
      });
      if (loaded.observations.length > 0 || candidate.governed) {
        return loaded;
      }
      successfulEmpty = loaded;
    } catch (error) {
      // Only an explicit incompatible time filter may try the next bound.
      // A governed bound, or any other rejection, is a failed read.
      if (candidate.governed || !isIncompatibleTimeFilter(error)) {
        throw error;
      }
      rejectedFilter = error;
    }
  }
  if (successfulEmpty) {
    return successfulEmpty;
  }
  // Every candidate was rejected. Absence was not read from the API.
  if (rejectedFilter) {
    throw rejectedFilter;
  }
  return { observations: [], selection: null };
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
  return outcomes.filter((outcome) => {
    if (outcome.status === "unsupported_period") {
      return true;
    }
    if (outcome.status !== "ready") {
      return false;
    }
    return !(
      outcome.observations.length === 0 && outcome.selectionAvailability
    );
  });
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
      const timeBounds = compareTimeBoundCandidates(measure, input.period);
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
        const loaded = await withCompareReadLimit(input.signal, () =>
          fetchFirstAvailableObservations({
            measureId: measure.measure_id,
            pair,
            period: input.period,
            releaseId: input.releaseId,
            signal: input.signal,
            timeBounds,
          })
        );
        return {
          measureId: measure.measure_id,
          observations: loaded.observations,
          selectionAvailability: loaded.selection,
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
