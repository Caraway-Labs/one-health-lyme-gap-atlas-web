"use client";

import {
  CancelledError,
  useQueries,
  useQueryClient,
  type QueryClient,
  type QueryFunctionContext,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

import { isLower48CountyFips } from "@/features/ux-reset/review/review-state-fips";
import {
  explorerMlListClassification,
  type ExplorerMlListClassification,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import { tier1SurveillancePriorityQueryOptions } from "@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";

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

function tier1QueryState(queryClient: QueryClient, fips: string) {
  return queryClient.getQueryState<Tier1CountyPriority, Error>([
    "ux-reset-tier1-surveillance-priority",
    fips,
  ]);
}

type SlotWaiter = {
  done: boolean;
  onAbort: () => void;
  start: () => void;
};

type SlotGate = {
  active: number;
  waiters: SlotWaiter[];
};

const slotGates = new WeakMap<QueryClient, SlotGate>();

function slotGateFor(queryClient: QueryClient): SlotGate {
  const existing = slotGates.get(queryClient);
  if (existing) {
    return existing;
  }
  const created: SlotGate = { active: 0, waiters: [] };
  slotGates.set(queryClient, created);
  return created;
}

function acquireExplorerMlPrioritySlot(
  queryClient: QueryClient,
  signal: AbortSignal
): Promise<boolean> {
  if (signal.aborted) {
    return Promise.reject(new CancelledError({ revert: true }));
  }
  const gate = slotGateFor(queryClient);
  if (gate.active < EXPLORER_ML_PRIORITY_FETCH_LIMIT) {
    gate.active += 1;
    return Promise.resolve(true);
  }
  const deferred = Promise.withResolvers<boolean>();
  const waiter: SlotWaiter = {
    done: false,
    onAbort: () => {
      if (waiter.done) {
        return;
      }
      waiter.done = true;
      const index = gate.waiters.indexOf(waiter);
      if (index !== -1) {
        gate.waiters.splice(index, 1);
      }
      deferred.reject(new CancelledError({ revert: true }));
    },
    start: () => {
      if (waiter.done) {
        return;
      }
      waiter.done = true;
      signal.removeEventListener("abort", waiter.onAbort);
      deferred.resolve(true);
    },
  };
  gate.waiters.push(waiter);
  signal.addEventListener("abort", waiter.onAbort, { once: true });
  return deferred.promise;
}

function releaseExplorerMlPrioritySlot(queryClient: QueryClient): void {
  const gate = slotGates.get(queryClient);
  if (!gate) {
    return;
  }
  while (gate.waiters.length > 0) {
    const next = gate.waiters.shift();
    if (next && !next.done) {
      next.start();
      return;
    }
  }
  gate.active -= 1;
}

function tier1QuerySettled(queryClient: QueryClient, fips: string): boolean {
  const state = tier1QueryState(queryClient, fips);
  return state?.status === "success" || state?.status === "error";
}

function boundedTier1QueryOptions(
  fips: string,
  queryClient: QueryClient,
  enabled: boolean
): UseQueryOptions<Tier1CountyPriority, Error> {
  const options = tier1SurveillancePriorityQueryOptions(
    fips,
    queryClient,
    enabled
  );
  const queryFn = options.queryFn;
  if (typeof queryFn !== "function") {
    return options;
  }
  return {
    ...options,
    queryFn: async (context: QueryFunctionContext) => {
      await acquireExplorerMlPrioritySlot(queryClient, context.signal);
      try {
        if (context.signal.aborted) {
          throw new CancelledError({ revert: true });
        }
        return await queryFn(context);
      } finally {
        releaseExplorerMlPrioritySlot(queryClient);
      }
    },
  };
}

/**
 * Lower-48 counties that may start a fetch now. In-flight reads keep their
 * slot. A settled success or error does not take one, so the next unfetched
 * county can start. The hook still leaves that settled observer enabled, and
 * the shared slot gate keeps a later refresh to the same limit.
 */
export function explorerMlPriorityFetchTargets(
  fipsList: readonly string[],
  queryClient: QueryClient,
  limit = EXPLORER_ML_PRIORITY_FETCH_LIMIT
): ReadonlySet<string> {
  const fetching: string[] = [];
  const idle: string[] = [];
  for (const fips of fipsList) {
    if (!isLower48CountyFips(fips)) {
      continue;
    }
    const state = tier1QueryState(queryClient, fips);
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
  fipsList: readonly string[]
): ReadonlyMap<string, ExplorerMlListClassification> {
  const queryClient = useQueryClient();
  const fetchTargets = explorerMlPriorityFetchTargets(fipsList, queryClient);
  const queries: PriorityResult[] = useQueries({
    queries: fipsList.map((fips) => {
      const inScope = isLower48CountyFips(fips);
      // A finished read stays enabled so mount, focus, and invalidation can
      // refresh it. Enabling only the active window left 503s and stale
      // successes disabled for the rest of the cache lifetime.
      const keepSettledObserver =
        inScope && tier1QuerySettled(queryClient, fips);
      return boundedTier1QueryOptions(
        fips,
        queryClient,
        keepSettledObserver || fetchTargets.has(fips)
      );
    }),
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
        requestedFips: fips,
        result: status === "success" ? (query?.data ?? null) : null,
        status,
        unverified: query?.error instanceof ApiResponseValidationError,
      })
    );
  }
  return classifications;
}
