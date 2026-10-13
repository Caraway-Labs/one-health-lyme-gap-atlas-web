"use client";

import {
  useQueries,
  useQueryClient,
  type QueryClient,
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

/** In-flight Tier 1 reads for one Explorer list. A state directory must not open one request per county. */
export const EXPLORER_ML_PRIORITY_FETCH_LIMIT = 4;

/** Published-directory rows mounted and eligible to fetch before Show more. */
export const EXPLORER_ML_PRIORITY_PAGE_SIZE = 20;

type PriorityResult = UseQueryResult<Tier1CountyPriority, Error>;

function prioritizeSelectedFips(
  fipsList: readonly string[],
  selectedFips: string | null
): string[] {
  if (!selectedFips) {
    return [...fipsList];
  }
  return [selectedFips, ...fipsList.filter((fips) => fips !== selectedFips)];
}

/**
 * FIPS the list may request. Candidate rows are already bounded.
 * A published directory contributes only the current page, plus the selected
 * county when that row sits past the page.
 */
export function explorerMlListedFips(input: {
  candidateFips: readonly string[];
  directoryFips: readonly string[];
  selectedFips: string | null;
  shownDirectoryCount: number;
}): readonly string[] {
  if (input.candidateFips.length > 0) {
    return prioritizeSelectedFips(input.candidateFips, input.selectedFips);
  }
  const page = input.directoryFips.slice(
    0,
    Math.max(0, input.shownDirectoryCount)
  );
  const selectedPastPage =
    input.selectedFips !== null &&
    input.directoryFips.includes(input.selectedFips) &&
    !page.includes(input.selectedFips);
  return prioritizeSelectedFips(
    selectedPastPage && input.selectedFips
      ? [input.selectedFips, ...page]
      : page,
    input.selectedFips
  );
}

function tier1QueryState(
  queryClient: QueryClient,
  fips: string,
  releaseId: string | null
) {
  return queryClient.getQueryState<Tier1CountyPriority, Error>([
    "ux-reset-tier1-surveillance-priority",
    fips,
    releaseId,
  ]);
}

/**
 * Lower-48 counties that may fetch now. Settled rows stay out of the window
 * so a finished read is not started again. In-flight rows keep their slot.
 */
export function explorerMlPriorityFetchTargets(
  fipsList: readonly string[],
  queryClient: QueryClient,
  releaseId: string | null,
  limit = EXPLORER_ML_PRIORITY_FETCH_LIMIT
): ReadonlySet<string> {
  const fetching: string[] = [];
  const idle: string[] = [];
  for (const fips of fipsList) {
    if (!isLower48CountyFips(fips)) {
      continue;
    }
    const state = tier1QueryState(queryClient, fips, releaseId);
    if (state?.fetchStatus === "fetching" || state?.fetchStatus === "paused") {
      fetching.push(fips);
      continue;
    }
    if (state?.status === "success" || state?.status === "error") {
      continue;
    }
    idle.push(fips);
  }
  const targets = new Set(fetching.slice(0, limit));
  const room = limit - targets.size;
  for (const fips of idle.slice(0, Math.max(0, room))) {
    targets.add(fips);
  }
  return targets;
}

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
  const fetchTargets =
    release.status === "ready"
      ? explorerMlPriorityFetchTargets(fipsList, queryClient, releaseId)
      : new Set<string>();
  const queries: PriorityResult[] = useQueries({
    queries: fipsList.map((fips) =>
      tier1SurveillancePriorityQueryOptions(
        fips,
        releaseId,
        queryClient,
        fetchTargets.has(fips)
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
