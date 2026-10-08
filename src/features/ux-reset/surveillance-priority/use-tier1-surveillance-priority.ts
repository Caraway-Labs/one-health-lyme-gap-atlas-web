"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { countyTier1SurveillancePriorityGet } from "@/generated/atlas";
import type { Tier1CountyPriority } from "@/generated/models";
import { CountyTier1SurveillancePriorityGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

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

export function useTier1SurveillancePriority(
  fips: string,
  release: Tier1ActiveRelease
) {
  const queryClient = useQueryClient();
  const releaseId = release.status === "ready" ? release.releaseId : null;
  return useQuery({
    enabled: COUNTY_FIPS.test(fips) && releaseId !== null,
    queryFn: async ({ signal }): Promise<Tier1CountyPriority> => {
      const response = await countyTier1SurveillancePriorityGet(fips, {
        signal,
      });
      if (response.status !== 200) {
        throw new AtlasApiError(
          "Model-assisted surveillance priority could not be loaded.",
          `/v1/counties/${fips}/tier1-surveillance-priority`,
          response.status,
          null
        );
      }
      return validateApiResponse(
        "Tier 1 surveillance priority",
        CountyTier1SurveillancePriorityGetResponse,
        response.data
      );
    },
    queryKey: ["ux-reset-tier1-surveillance-priority", fips, releaseId],
    retry: (failureCount, error) => {
      if (error instanceof AtlasApiError && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (failureCount, error) =>
      tier1SurveillancePriorityRetryDelay(
        failureCount,
        error,
        queryClient.getDefaultOptions().queries?.retryDelay
      ),
  });
}
