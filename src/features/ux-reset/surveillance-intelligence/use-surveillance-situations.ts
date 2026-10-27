"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getCountySurveillanceSituations } from "@/generated/atlas";
import type { CountySurveillanceSituations } from "@/generated/models/countySurveillanceSituations";
import { GetCountySurveillanceSituationsResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  ApiResponseValidationError,
  logUnverifiedApiResponse,
  validateApiResponse,
} from "@/lib/api-response-validation";

const COUNTY_FIPS = /^\d{5}$/;
const MILLISECONDS_PER_SECOND = 1000;
const UNSCHEDULED_RETRY_CAP_MS = 30_000;
const NOT_FOUND = 404;

type RetryDelaySetting =
  | number
  | ((failureCount: number, error: Error) => number)
  | undefined;

export function surveillanceSituationsRetryDelay(
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

export function surveillanceSituationsQueryOptions(
  fips: string,
  queryClient: QueryClient,
  enabled = true
): UseQueryOptions<CountySurveillanceSituations, Error> {
  const endpoint = `/v1/counties/${fips}/surveillance-situations`;
  return {
    enabled: enabled && COUNTY_FIPS.test(fips),
    queryFn: async ({
      signal,
    }: {
      signal: AbortSignal;
    }): Promise<CountySurveillanceSituations> => {
      const response = await getCountySurveillanceSituations(fips, { signal });
      if (response.status !== 200) {
        throw new AtlasApiError(
          "County surveillance situations could not be loaded.",
          endpoint,
          response.status,
          null
        );
      }
      try {
        return validateApiResponse(
          "County surveillance situations",
          GetCountySurveillanceSituationsResponse,
          response.data
        );
      } catch (error) {
        if (error instanceof ApiResponseValidationError) {
          logUnverifiedApiResponse({
            endpoint,
            fips,
            reason: error.reason,
          });
        }
        throw error;
      }
    },
    queryKey: ["ux-reset-surveillance-situations", fips] as const,
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof AtlasApiError && error.status === NOT_FOUND) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (failureCount: number, error: unknown) =>
      surveillanceSituationsRetryDelay(
        failureCount,
        error,
        queryClient.getDefaultOptions().queries?.retryDelay
      ),
  };
}

export function useSurveillanceSituations(fips: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery(
    surveillanceSituationsQueryOptions(fips, queryClient, enabled)
  );
}
