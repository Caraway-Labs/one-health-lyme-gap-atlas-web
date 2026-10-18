import { canonicalGeographyAvailability } from "@/generated/atlas";
import { CanonicalGeographyAvailabilityResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  ApiResponseValidationError,
  validateApiResponse,
} from "@/lib/api-response-validation";
import { isCountyFips } from "@/lib/county-geography";

const MILLISECONDS_PER_SECOND = 1000;
const UNSCHEDULED_RETRY_CAP_MS = 30_000;

type QueryRetrySetting =
  | boolean
  | number
  | ((failureCount: number, error: Error) => boolean)
  | undefined;

type RetryDelaySetting =
  | number
  | ((failureCount: number, error: Error) => number)
  | undefined;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Contract mismatches and 4xx responses, including 429, are not retried.
 * Transient failures follow the surrounding QueryClient retry setting.
 */
export function shouldRetryCanonicalGeographyAvailability(
  failureCount: number,
  error: unknown,
  configured: QueryRetrySetting
): boolean {
  if (error instanceof ApiResponseValidationError || isAbortError(error)) {
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

/** Server Retry-After is the wait. A missing header uses a short capped backoff. */
export function canonicalGeographyAvailabilityRetryDelay(
  failureCount: number,
  error: unknown,
  configured?: RetryDelaySetting
): number {
  if (
    error instanceof AtlasApiError &&
    error.retryAfterSeconds !== null &&
    error.retryAfterSeconds >= 0
  ) {
    return error.retryAfterSeconds * MILLISECONDS_PER_SECOND;
  }
  if (typeof configured === "number") {
    return configured;
  }
  if (typeof configured === "function" && error instanceof Error) {
    return configured(failureCount, error);
  }
  return Math.min(
    MILLISECONDS_PER_SECOND * 2 ** failureCount,
    UNSCHEDULED_RETRY_CAP_MS
  );
}

export const CANONICAL_GEOGRAPHY_UNPUBLISHED_COPY =
  "Canonical geography is not yet published for this county.";

export type CanonicalGeographyAvailabilityView =
  | { status: "idle" }
  | { status: "loading" }
  | {
      limitations: readonly string[];
      releaseId: string;
      status: "unpublished";
    }
  | { message: string; status: "unsupported" }
  | { message: string; status: "not_found" }
  | {
      message: string;
      retryAfterSeconds: number | null;
      status: "rate_limited";
    }
  | { message: string; status: "error" };

const UNSUPPORTED_MESSAGE =
  "This identifier is not a supported county for canonical geography publication.";

export function unsupportedCanonicalGeographyView(): Extract<
  CanonicalGeographyAvailabilityView,
  { status: "unsupported" }
> {
  return { message: UNSUPPORTED_MESSAGE, status: "unsupported" };
}
const NOT_FOUND_MESSAGE =
  "This county is not in the current geography release.";
const RATE_LIMITED_MESSAGE =
  "Canonical geography publication could not be checked because the request was rate limited.";
export const CANONICAL_GEOGRAPHY_CHECK_ERROR_COPY =
  "Canonical geography publication could not be checked. Published county facts and map display stay available.";
const ERROR_MESSAGE = CANONICAL_GEOGRAPHY_CHECK_ERROR_COPY;
const MALFORMED_MESSAGE =
  "The geography availability response did not match the governed contract.";

export function canonicalGeographyViewFromError(
  error: unknown
): Exclude<
  CanonicalGeographyAvailabilityView,
  { status: "idle" } | { status: "loading" } | { status: "unpublished" }
> {
  if (error instanceof ApiResponseValidationError) {
    return { message: MALFORMED_MESSAGE, status: "error" };
  }
  if (!(error instanceof AtlasApiError)) {
    return { message: ERROR_MESSAGE, status: "error" };
  }
  switch (error.status) {
    case 400:
    case 413:
    case 414: {
      return { message: UNSUPPORTED_MESSAGE, status: "unsupported" };
    }
    case 404: {
      return { message: NOT_FOUND_MESSAGE, status: "not_found" };
    }
    case 429: {
      const wait =
        error.retryAfterSeconds === null
          ? ""
          : ` Retry after ${error.retryAfterSeconds} seconds.`;
      return {
        message: `${RATE_LIMITED_MESSAGE}${wait}`,
        retryAfterSeconds: error.retryAfterSeconds,
        status: "rate_limited",
      };
    }
    default: {
      return { message: ERROR_MESSAGE, status: "error" };
    }
  }
}

/**
 * Reads the additive availability operation. `data` stays null and is never
 * turned into a Geography or passed to county identity resolution.
 */
export async function fetchCanonicalGeographyAvailability(
  fips: string,
  signal: AbortSignal
): Promise<
  Extract<CanonicalGeographyAvailabilityView, { status: "unpublished" }>
> {
  if (!isCountyFips(fips)) {
    throw new AtlasApiError(
      UNSUPPORTED_MESSAGE,
      "/v1/geographies/county/availability",
      400,
      null
    );
  }
  const response = await canonicalGeographyAvailability("county", fips, {
    signal,
  });
  if (response.status !== 200) {
    throw new AtlasApiError(
      ERROR_MESSAGE,
      `/v1/geographies/county/${fips}/availability`,
      response.status,
      response.headers.get("X-Request-ID")
    );
  }
  const parsed = validateApiResponse(
    "Canonical geography availability",
    CanonicalGeographyAvailabilityResponse,
    response.data
  );
  if (parsed.data !== null) {
    throw new ApiResponseValidationError("Canonical geography availability");
  }
  return {
    limitations: parsed.limitations,
    releaseId: parsed.release_id,
    status: "unpublished",
  };
}
