"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import {
  isTier1ResponseCoherent,
  TIER1_INCOHERENT_REASON,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { getCountyTier1Priority } from "@/generated/atlas";
import type { Tier1CountyPriority } from "@/generated/models";
import { GetCountyTier1PriorityResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  ApiResponseValidationError,
  logUnverifiedApiResponse,
  validateApiResponse,
} from "@/lib/api-response-validation";

const COUNTY_FIPS = /^\d{5}$/;
const MILLISECONDS_PER_SECOND = 1000;
const UNSCHEDULED_RETRY_CAP_MS = 30_000;

type RetryDelaySetting =
  | number
  | ((failureCount: number, error: Error) => number)
  | undefined;

/** Server Retry-After wins over TanStack Query's generic backoff. */
export function tier1SurveillancePriorityRetryDelay(
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

export function tier1SurveillancePriorityQueryOptions(
  fips: string,
  queryClient: QueryClient,
  enabled = true
): UseQueryOptions<Tier1CountyPriority, Error> {
  const endpoint = `/v1/counties/${fips}/tier1-surveillance-priority`;
  return {
    enabled: enabled && COUNTY_FIPS.test(fips),
    queryFn: async ({
      signal,
    }: {
      signal: AbortSignal;
    }): Promise<Tier1CountyPriority> => {
      const response = await getCountyTier1Priority(fips, {
        signal,
      });
      if (response.status !== 200) {
        throw new AtlasApiError(
          "Model-assisted surveillance priority could not be loaded.",
          endpoint,
          response.status,
          null
        );
      }
      let parsed: Tier1CountyPriority;
      try {
        parsed = validateApiResponse(
          "Tier 1 surveillance priority",
          GetCountyTier1PriorityResponse,
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
      if (!isTier1ResponseCoherent(parsed)) {
        logUnverifiedApiResponse({
          endpoint,
          fips,
          reason: TIER1_INCOHERENT_REASON,
        });
        throw new ApiResponseValidationError(
          "Tier 1 surveillance priority",
          TIER1_INCOHERENT_REASON
        );
      }
      return parsed;
    },
    queryKey: ["ux-reset-tier1-surveillance-priority", fips] as const,
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof AtlasApiError && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (failureCount: number, error: unknown) =>
      tier1SurveillancePriorityRetryDelay(
        failureCount,
        error,
        queryClient.getDefaultOptions().queries?.retryDelay
      ),
  };
}

export function useTier1SurveillancePriority(fips: string) {
  const queryClient = useQueryClient();
  return useQuery(tier1SurveillancePriorityQueryOptions(fips, queryClient));
}
