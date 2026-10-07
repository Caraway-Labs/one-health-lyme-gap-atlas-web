"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CompareAlignment } from "@/features/ux-reset/compare/compare-alignment";
import {
  compareCatalogCoolingDown,
  compareCatalogRetryDelay,
  forgetCompareCatalogCooldown,
  rememberCompareCatalogCooldown,
  waitForCompareCatalogCooldown,
} from "@/features/ux-reset/compare/compare-catalog-cooldown";
import {
  classifyCompareEntry,
  compareCountyOptionLabel,
  compareRecoveryMessages,
  compareReturnPath,
  removeCompareMember,
  replaceCompareSlot,
  resolveVisibleCompareEntry,
  type CompareReturnTarget,
  type ResolvedCompareEntry,
} from "@/features/ux-reset/compare/compare-entry";
import { compareSearchParams } from "@/features/ux-reset/compare/compare-search-params";
import {
  compareEvidenceQueryKey,
  compareRetryCooldowns,
  CompareContractError,
  loadCompareEvidence,
  preservedCompareMeasures,
  shouldRetryCompareRequest,
} from "@/features/ux-reset/compare/load-compare-evidence";
import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import {
  parseCompareFipsList,
  serializeCompareFipsList,
  sharedContextToSearchParams,
  type UxResetSharedContext,
} from "@/features/ux-reset/context-params";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import {
  fetchExploreCountyDirectory,
  fetchExploreMeasures,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  RESET_COMPARE_PATH,
  RESET_INVESTIGATE_PATH,
} from "@/features/ux-reset/routes";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import type { AtlasMetadata } from "@/generated/models";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
  type AtlasStateOption,
} from "@/lib/atlas-state-geography";

const EMPTY_COUNTY_DIRECTORY: readonly ExploreCountyIdentity[] = [];

export type CompareRecoveryState =
  | "directory"
  | "empty"
  | "partial"
  | "ready"
  | "unknown";

export type CompareCountyOption = {
  disabled: boolean;
  fips: string;
  label: string;
};

export type CompareWorkspace = {
  alignment: CompareAlignment | null;
  catalogCoolingDown: boolean;
  catalogError: string | null;
  catalogRetrying: boolean;
  clearPair: () => void;
  dataset: string | null;
  directoryError: string | null;
  directoryLoading: boolean;
  entry: ResolvedCompareEntry;
  evidenceError: string | null;
  evidenceLoading: boolean;
  evidenceRetrying: boolean;
  investigateHref: (fips: string) => string;
  metadata: AtlasMetadata | null;
  metadataError: string | null;
  metadataLoading: boolean;
  options: readonly CompareCountyOption[];
  pairIssue: string;
  period: string | null;
  recoveryMessages: string[];
  recoveryState: CompareRecoveryState;
  releaseId: string | null;
  removeMember: (fips: string) => void;
  returnHref: string | null;
  returnTarget: CompareReturnTarget | null;
  retryCatalog: () => void;
  retryEvidence: () => void;
  scopeLabel: string;
  setSlot: (slot: 0 | 1, fips: string) => void;
  slotMessage: string | null;
  unknownFips: readonly string[];
};

function metadataErrorMessage(
  error: unknown,
  requestedDataset: string | null
): string {
  if (error instanceof CompareContractError) {
    return "The release response did not match the requested dataset.";
  }
  if (error instanceof AtlasApiError && requestedDataset) {
    return `The requested release "${requestedDataset}" is not available. ${error.message}`;
  }
  if (error instanceof AtlasApiError) {
    return error.message;
  }
  return "Unable to load governed release metadata.";
}

function recoveryStateFor(input: {
  directoryError: boolean;
  pairLength: number;
  unknownCount: number;
}): CompareRecoveryState {
  if (input.directoryError && input.pairLength > 0) {
    return "directory";
  }
  if (input.unknownCount > 0) {
    return "unknown";
  }
  if (input.pairLength === 0) {
    return "empty";
  }
  if (input.pairLength === 1) {
    return "partial";
  }
  return "ready";
}

function pairIssue(entry: ResolvedCompareEntry): string {
  const issues: string[] = [];
  if (entry.invalidTokens.length > 0) {
    issues.push("invalid");
  }
  if (entry.duplicateFips.length > 0) {
    issues.push("duplicate");
  }
  if (entry.overfull) {
    issues.push("overfull");
  }
  return issues.join(",");
}

export function useCompareWorkspace(): CompareWorkspace {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const retrySetting = queryClient.getDefaultOptions().queries?.retry;
  const [urlState, setUrlState] = useQueryStates(compareSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const [pendingPair, setPendingPair] = useState<string[] | null>(null);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const rawCompareValues = searchParams.getAll("compare");
  const rawCompareSignature = rawCompareValues.join("\u0000");
  const rawKey = classifyCompareEntry(
    rawCompareSignature.split("\u0000")
  ).pair.join(",");
  const stateKey = serializeCompareFipsList(urlState.compare);
  const pendingKey =
    pendingPair === null ? null : serializeCompareFipsList(pendingPair);
  const historyReplacedPending =
    pendingKey !== null && stateKey === rawKey && stateKey !== pendingKey;
  const entry = resolveVisibleCompareEntry({
    pendingPair: historyReplacedPending ? null : pendingPair,
    rawCompareValues,
    statePair: urlState.compare,
  });
  const pairKey = entry.pair.join(",");
  const committedPairKey = useRef(pairKey);
  useEffect(() => {
    committedPairKey.current = pairKey;
  }, [committedPairKey, pairKey]);

  const commitPair = (next: readonly string[]) => {
    const pair = parseCompareFipsList(next.join(","));
    const nextKey = pair.join(",");
    if (nextKey === committedPairKey.current) {
      setSlotMessage(null);
      return;
    }
    committedPairKey.current = nextKey;
    setPendingPair(pair);
    setSlotMessage(null);
    void setUrlState({ compare: pair });
  };

  const metadataQuery = useQuery({
    queryFn: async ({ signal }) => {
      const response = await metadataV1AtlasMetadataGet(
        urlState.dataset ? { dataset_version: urlState.dataset } : undefined,
        { signal }
      );
      if (response.status !== 200) {
        throw new AtlasApiError(
          urlState.dataset
            ? `Release "${urlState.dataset}" is not available.`
            : "Atlas metadata is temporarily unavailable.",
          "/v1/atlas/metadata",
          response.status,
          null
        );
      }
      const metadata = validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        response.data
      );
      if (urlState.dataset && metadata.release_id !== urlState.dataset) {
        throw new CompareContractError(
          "Metadata release does not match the requested dataset.",
          "release_mismatch"
        );
      }
      return metadata;
    },
    queryKey: ["ux-reset-compare-metadata", urlState.dataset],
  });

  const releaseId = metadataQuery.data?.release_id ?? null;
  const stateOptions: AtlasStateOption[] = useMemo(
    () =>
      metadataQuery.data
        ? atlasStateOptionsFromMetadata(metadataQuery.data.states)
        : [],
    [metadataQuery.data]
  );

  const directoryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Compare county directory requires a release.");
      }
      return fetchExploreCountyDirectory(releaseId, signal);
    },
    queryKey: ["ux-reset-compare-directory", releaseId],
  });
  const directory = directoryQuery.data ?? EMPTY_COUNTY_DIRECTORY;
  const directoryByFips = useMemo(() => {
    const byFips = new Map<string, ExploreCountyIdentity>();
    for (const county of directory) {
      byFips.set(county.fips, county);
    }
    return byFips;
  }, [directory]);
  const unknownFips = directoryQuery.isSuccess
    ? entry.pair.filter((fips) => !directoryByFips.has(fips))
    : [];
  const pairReady =
    entry.pair.length === 2 &&
    unknownFips.length === 0 &&
    directoryQuery.isSuccess;

  const measuresQuery = useQuery({
    enabled: Boolean(releaseId) && pairReady,
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Compare measures require a release.");
      }
      await waitForCompareCatalogCooldown(releaseId, signal);
      try {
        const measures = await fetchExploreMeasures(signal, releaseId);
        forgetCompareCatalogCooldown(releaseId);
        return measures;
      } catch (error) {
        if (error instanceof AtlasApiError) {
          rememberCompareCatalogCooldown(releaseId, error.retryAfterSeconds);
        }
        throw error;
      }
    },
    queryKey: ["ux-reset-compare-measures", releaseId],
    retry: (failureCount, error) =>
      shouldRetryCompareRequest(failureCount, error, retrySetting),
    retryDelay: (failureCount, error) =>
      compareCatalogRetryDelay(
        failureCount,
        error,
        queryClient.getDefaultOptions().queries?.retryDelay
      ),
  });
  const measures = measuresQuery.data ?? [];
  const measureIds = measures.map((measure) => measure.measure_id);
  const leftFips = entry.pair[0] ?? "";
  const rightFips = entry.pair[1] ?? "";
  const leftLabel = compareCountyOptionLabel(
    directoryByFips.get(leftFips) ?? null,
    leftFips
  );
  const rightLabel = compareCountyOptionLabel(
    directoryByFips.get(rightFips) ?? null,
    rightFips
  );

  const evidenceQuery = useQuery({
    enabled: Boolean(
      releaseId && pairReady && measuresQuery.isSuccess && leftFips && rightFips
    ),
    queryFn: async ({ client, queryKey, signal }) => {
      if (!(releaseId && leftFips && rightFips)) {
        throw new CompareContractError(
          "Aligned evidence requires two counties and a release.",
          "rejected"
        );
      }
      const cached = client.getQueryData<CompareAlignment>(queryKey);
      const preserve = preservedCompareMeasures({
        alignment: cached,
        leftFips,
        period: urlState.period,
        releaseId,
        rightFips,
      });
      return loadCompareEvidence({
        cooldowns: preserve ? compareRetryCooldowns(cached) : null,
        leftFips,
        leftLabel,
        measures,
        period: urlState.period,
        preserve,
        releaseId,
        rightFips,
        rightLabel,
        signal,
      });
    },
    queryKey:
      releaseId && leftFips && rightFips
        ? compareEvidenceQueryKey({
            measureIds,
            pair: [leftFips, rightFips],
            period: urlState.period,
            releaseId,
          })
        : ["ux-reset-compare-evidence", "idle"],
    retry: (failureCount, error) =>
      shouldRetryCompareRequest(failureCount, error, retrySetting),
  });
  const retryGateRef = useRef(false);
  const retryEvidence = async () => {
    if (retryGateRef.current || evidenceQuery.isFetching) {
      return;
    }
    retryGateRef.current = true;
    try {
      await evidenceQuery.refetch({ cancelRefetch: false });
    } finally {
      retryGateRef.current = false;
    }
  };
  const retryCatalog = () => {
    void measuresQuery.refetch();
  };

  const currentPair = pairKey.length > 0 ? pairKey.split(",") : [];
  const setSlot = (slot: 0 | 1, fips: string) => {
    const next = replaceCompareSlot(currentPair, slot, fips);
    if (!next) {
      setSlotMessage(
        "Choose a different county. Compare cannot list the same county twice."
      );
      return;
    }
    commitPair(next);
  };
  const removeMember = (fips: string) => {
    commitPair(removeCompareMember(currentPair, fips));
  };
  const clearPair = () => {
    commitPair([]);
  };

  const dataset = releaseId ?? urlState.dataset;
  const contextFor = (
    county: string | null,
    pair: readonly string[]
  ): UxResetSharedContext => ({
    compare: [...pair],
    county,
    dataset,
    period: urlState.period,
    scope: urlState.scope,
  });
  const investigateHref = (fips: string) =>
    uxResetShellHandoffHref(
      RESET_INVESTIGATE_PATH,
      RESET_COMPARE_PATH,
      sharedContextToSearchParams(contextFor(fips, currentPair))
    );
  const returnTarget = urlState.return;
  const returnHref = returnTarget
    ? uxResetShellHandoffHref(
        compareReturnPath(returnTarget),
        RESET_COMPARE_PATH,
        sharedContextToSearchParams(contextFor(urlState.county, currentPair))
      )
    : null;
  const optionRows = new Map<string, ExploreCountyIdentity | null>();
  for (const county of directory) {
    optionRows.set(county.fips, county);
  }
  for (const fips of currentPair) {
    if (!optionRows.has(fips)) {
      optionRows.set(fips, null);
    }
  }
  const options = [...optionRows.entries()]
    .map(([fips, county]) => ({
      disabled: false,
      fips,
      label: compareCountyOptionLabel(county, fips),
    }))
    .toSorted(
      (left, right) =>
        left.label.localeCompare(right.label, "en") ||
        left.fips.localeCompare(right.fips)
    );

  const recoveryState = recoveryStateFor({
    directoryError: directoryQuery.isError,
    pairLength: entry.pair.length,
    unknownCount: unknownFips.length,
  });

  return {
    alignment:
      recoveryState === "ready" &&
      evidenceQuery.data?.leftFips === leftFips &&
      evidenceQuery.data.rightFips === rightFips
        ? evidenceQuery.data
        : null,
    // failureCount changes on an automatic retry while status stays pending.
    // The catalog deadline lives outside the query, so this read is what
    // lets the wait message render before the next request is allowed.
    catalogCoolingDown: compareCatalogCoolingDown(
      measuresQuery.failureCount >= 0 ? releaseId : null
    ),
    catalogError:
      recoveryState === "ready" && measuresQuery.isError
        ? "Governed measures could not be loaded."
        : null,
    catalogRetrying: measuresQuery.isFetching && measuresQuery.isError,
    clearPair,
    dataset,
    directoryError: directoryQuery.isError
      ? "The published county list for this release could not be loaded."
      : null,
    directoryLoading: Boolean(releaseId) && directoryQuery.isLoading,
    entry,
    evidenceError:
      recoveryState === "ready" && evidenceQuery.isError
        ? "Aligned evidence did not load for these two counties."
        : null,
    evidenceLoading:
      recoveryState === "ready" &&
      (evidenceQuery.isLoading ||
        measuresQuery.isLoading ||
        directoryQuery.isLoading),
    evidenceRetrying:
      recoveryState === "ready" &&
      evidenceQuery.isFetching &&
      Boolean(evidenceQuery.data),
    investigateHref,
    metadata: metadataQuery.data ?? null,
    metadataError: metadataQuery.isError
      ? metadataErrorMessage(metadataQuery.error, urlState.dataset)
      : null,
    metadataLoading: metadataQuery.isLoading,
    options,
    pairIssue: pairIssue(entry),
    period: urlState.period,
    recoveryMessages: compareRecoveryMessages({
      entry,
      unknownFips,
    }),
    recoveryState,
    releaseId,
    removeMember,
    returnHref,
    returnTarget,
    retryCatalog,
    retryEvidence,
    scopeLabel: reviewScopeLabel(urlState.scope, stateOptions),
    setSlot,
    slotMessage,
    unknownFips,
  };
}

export function compareOptionDisabled(
  options: readonly CompareCountyOption[],
  otherFips: string | undefined
): CompareCountyOption[] {
  return options.map((option) => ({
    ...option,
    disabled: Boolean(otherFips) && option.fips === otherFips,
  }));
}
