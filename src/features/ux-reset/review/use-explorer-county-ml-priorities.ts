"use client";

import {
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { isLower48CountyFips } from "@/features/ux-reset/review/review-state-fips";
import {
  explorerMlListClassification,
  type ExplorerMlListClassification,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { tier1SurveillancePriorityQueryOptions } from "@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

type PriorityResult = UseQueryResult<Tier1CountyPriority, Error>;

function queryStatus(
  query: PriorityResult | undefined
): "error" | "loading" | "success" {
  if (!query || query.isPending) {
    return "loading";
  }
  if (query.isError) {
    return "error";
  }
  if (query.isSuccess) {
    return "success";
  }
  return "loading";
}

export function useExplorerCountyMlPriorities(
  fipsList: readonly string[],
  release: Tier1ActiveRelease
): ReadonlyMap<string, ExplorerMlListClassification> {
  const queryClient = useQueryClient();
  const releaseId = release.status === "ready" ? release.releaseId : null;
  const queries: PriorityResult[] = useQueries({
    queries: fipsList.map((fips) =>
      tier1SurveillancePriorityQueryOptions(
        fips,
        releaseId,
        queryClient,
        isLower48CountyFips(fips)
      )
    ),
  });
  const classifications = new Map<string, ExplorerMlListClassification>();
  for (const [index, fips] of fipsList.entries()) {
    const query = queries[index];
    const status = queryStatus(query);
    classifications.set(
      fips,
      explorerMlListClassification({
        errorStatus:
          query?.error instanceof AtlasApiError ? query.error.status : null,
        inLower48: isLower48CountyFips(fips),
        release,
        requestedFips: fips,
        result: status === "success" ? (query?.data ?? null) : null,
        status,
      })
    );
  }
  return classifications;
}
