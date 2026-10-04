import { parseCalendarIsoDate } from "@/features/ux-reset/context-params";
import {
  resolveExploreTimeBound,
  type ExploreTimeBound,
} from "@/features/ux-reset/explore/explore-model";
import {
  observationQueryByteLength,
  PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  acceptCountyObservations,
  buildCountyEvidenceBundle,
  InvestigateContractError,
  resolveCountyIdentity,
  type CountyEvidenceBundle,
  type MeasureObservationOutcome,
  type ResolvedCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  geographyV1GeographiesGeographyTypeGeographyIdGet,
  indicatorsV1IndicatorsGet,
  observationsV1ObservationsGet,
} from "@/generated/atlas";
import type {
  Indicator,
  Measure,
  Observation,
  ObservationsV1ObservationsGetParams,
} from "@/generated/models";
import {
  GeographyV1GeographiesGeographyTypeGeographyIdGetResponse,
  IndicatorsV1IndicatorsGetResponse,
  ObservationsV1ObservationsGetResponse,
  indicatorsV1IndicatorsGetQueryPageSizeOneMax,
  observationsV1ObservationsGetQueryGeographyIdMax,
  observationsV1ObservationsGetQueryPageSizeOneMax,
  observationsV1ObservationsGetQueryYearOneMax,
  observationsV1ObservationsGetQueryYearOneMin,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import { isCountyFips } from "@/lib/county-geography";

const MAX_COLLECTION_PAGES = 20;

type QueryRetrySetting =
  | boolean
  | number
  | ((failureCount: number, error: Error) => boolean)
  | undefined;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Contract mismatches and 4xx responses are deterministic. Transient failures
 * follow the surrounding QueryClient retry setting.
 */
export function shouldRetryInvestigateRequest(
  failureCount: number,
  error: unknown,
  configured: QueryRetrySetting
): boolean {
  if (error instanceof InvestigateContractError || isAbortError(error)) {
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

function hasCompleteDateRange(
  params: Pick<ObservationsV1ObservationsGetParams, "end_date" | "start_date">
): boolean {
  const start = params.start_date ?? null;
  const end = params.end_date ?? null;
  if (!(start && end)) {
    return false;
  }
  return (
    parseCalendarIsoDate(start) === start && parseCalendarIsoDate(end) === end
  );
}

/**
 * Status the public observations API returns for a request it will not serve.
 * Investigate uses this before calling the client so mocks and the API agree.
 */
export function investigateObservationRequestRejection(
  params: ObservationsV1ObservationsGetParams
): 400 | 414 | null {
  const measureId = params.measure_id.trim();
  const geographyIds = params.geography_id;
  const hasYear = typeof params.year === "number";
  const yearInRange =
    hasYear &&
    params.year !== null &&
    params.year !== undefined &&
    params.year >= observationsV1ObservationsGetQueryYearOneMin &&
    params.year <= observationsV1ObservationsGetQueryYearOneMax;
  const hasRange = hasCompleteDateRange(params);
  const partialRange = Boolean(params.start_date) !== Boolean(params.end_date);
  const stratification = params.stratification ?? null;
  const pageToken = params.page_token;
  if (
    measureId.length === 0 ||
    params.geography_type !== "county" ||
    geographyIds.length === 0 ||
    geographyIds.length > observationsV1ObservationsGetQueryGeographyIdMax ||
    geographyIds.some((fips) => !isCountyFips(fips)) ||
    partialRange ||
    hasYear === hasRange ||
    (hasYear && !yearInRange) ||
    (stratification !== null && stratification.length > 0) ||
    pageToken === null ||
    pageToken === ""
  ) {
    return 400;
  }
  if (
    observationQueryByteLength(params) > PUBLIC_OBSERVATION_QUERY_BYTE_LIMIT
  ) {
    return 414;
  }
  return null;
}

export function buildInvestigateObservationParams(input: {
  fips: string;
  measureId: string;
  pageToken?: string | null;
  timeBound: ExploreTimeBound;
}): ObservationsV1ObservationsGetParams {
  const params: ObservationsV1ObservationsGetParams = {
    geography_id: [input.fips],
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
  if (investigateObservationRequestRejection(params) !== null) {
    throw new InvestigateContractError(
      "County observation request is not accepted by the public API.",
      "rejected"
    );
  }
  return params;
}

export async function fetchInvestigateGeography(
  fips: string,
  signal: AbortSignal
): Promise<ResolvedCountyIdentity> {
  if (!isCountyFips(fips)) {
    throw new InvestigateContractError(
      "County FIPS is not canonical.",
      "rejected"
    );
  }
  try {
    const response = await geographyV1GeographiesGeographyTypeGeographyIdGet(
      "county",
      fips,
      { signal }
    );
    if (response.status !== 200) {
      throw new AtlasApiError(
        "Governed geography could not be loaded.",
        `/v1/geographies/county/${fips}`,
        response.status,
        null
      );
    }
    const parsed = validateApiResponse(
      "Geography",
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse,
      response.data
    );
    return resolveCountyIdentity(parsed.data, fips);
  } catch (error) {
    if (error instanceof InvestigateContractError) {
      throw error;
    }
    if (error instanceof AtlasApiError && error.status === 404) {
      throw new InvestigateContractError(
        "This county is not in governed geography.",
        "unknown_county"
      );
    }
    if (error instanceof AtlasApiError && error.status === 400) {
      throw new InvestigateContractError(
        "The geography service rejected this county identifier.",
        "rejected"
      );
    }
    throw error;
  }
}

export async function fetchInvestigateIndicators(
  signal: AbortSignal
): Promise<Indicator[]> {
  const indicators: Indicator[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const response = await indicatorsV1IndicatorsGet(
      pageToken
        ? {
            page_size: indicatorsV1IndicatorsGetQueryPageSizeOneMax,
            page_token: pageToken,
          }
        : { page_size: indicatorsV1IndicatorsGetQueryPageSizeOneMax },
      { signal }
    );
    if (response.status !== 200) {
      throw new AtlasApiError(
        "Governed indicators are temporarily unavailable.",
        "/v1/indicators",
        response.status,
        null
      );
    }
    const parsed = validateApiResponse(
      "Indicators",
      IndicatorsV1IndicatorsGetResponse,
      response.data
    );
    indicators.push(...parsed.data);
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  return indicators;
}

/**
 * Indicator domains for family assignment. A release mismatch or two
 * conflicting domains for one indicator leave that indicator unassigned.
 */
export function indicatorDomainsById(
  indicators: readonly Indicator[],
  releaseId: string
): Map<string, string | null> {
  const domains = new Map<string, string | null>();
  const ambiguous = new Set<string>();
  for (const indicator of indicators) {
    const version = indicator.release_version?.trim() ?? "";
    if (version && version !== releaseId) {
      continue;
    }
    const domain = indicator.domain?.trim() || null;
    if (!domains.has(indicator.indicator_id)) {
      domains.set(indicator.indicator_id, domain);
      continue;
    }
    if (domains.get(indicator.indicator_id) !== domain) {
      ambiguous.add(indicator.indicator_id);
    }
  }
  for (const indicatorId of ambiguous) {
    domains.set(indicatorId, null);
  }
  return domains;
}

async function fetchMeasureObservations(input: {
  fips: string;
  measureId: string;
  releaseId: string;
  signal: AbortSignal;
  timeBound: ExploreTimeBound;
}): Promise<Observation[]> {
  const collected: Observation[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_COLLECTION_PAGES; page += 1) {
    const params = buildInvestigateObservationParams({
      fips: input.fips,
      measureId: input.measureId,
      pageToken,
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
  return acceptCountyObservations({
    measureId: input.measureId,
    observations: collected,
    releaseId: input.releaseId,
    requestedFips: input.fips,
    timeBound: input.timeBound,
  });
}

function failureMessage(error: unknown): string {
  if (error instanceof InvestigateContractError) {
    return "This measure response did not match the requested county.";
  }
  return "This measure could not be loaded.";
}

export async function loadCountyEvidenceBundle(input: {
  domainsRequestFailed: boolean;
  fips: string;
  identity: ResolvedCountyIdentity;
  indicators: readonly Indicator[];
  measures: readonly Measure[];
  period: string | null;
  releaseId: string;
  signal: AbortSignal;
}): Promise<CountyEvidenceBundle> {
  if (input.identity.fips !== input.fips) {
    throw new InvestigateContractError(
      "County identity does not match the requested county.",
      "identity_mismatch"
    );
  }
  const outcomes: MeasureObservationOutcome[] = await Promise.all(
    input.measures.map(async (measure) => {
      const timeBound = resolveExploreTimeBound(measure, input.period);
      if (!timeBound) {
        return {
          measureId: measure.measure_id,
          status: "unsupported_period" as const,
        };
      }
      try {
        const observations = await fetchMeasureObservations({
          fips: input.fips,
          measureId: measure.measure_id,
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
    })
  );
  return buildCountyEvidenceBundle({
    domainsRequestFailed: input.domainsRequestFailed,
    identity: input.identity,
    indicatorDomains: indicatorDomainsById(input.indicators, input.releaseId),
    measures: input.measures,
    outcomes,
    releaseId: input.releaseId,
  });
}
