"use client";

import { useQuery } from "@tanstack/react-query";

import { countyTier1SurveillancePriorityGet } from "@/generated/atlas";
import type { Tier1CountyPriority } from "@/generated/models";
import { CountyTier1SurveillancePriorityGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

const COUNTY_FIPS = /^\d{5}$/;

export function useTier1SurveillancePriority(fips: string) {
  return useQuery({
    enabled: COUNTY_FIPS.test(fips),
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
    queryKey: ["ux-reset-tier1-surveillance-priority", fips],
    retry: (failureCount, error) => {
      if (error instanceof AtlasApiError && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
