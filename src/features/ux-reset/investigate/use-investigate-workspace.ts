"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useCallback, useMemo, useRef } from "react";

import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import {
  fetchExploreCountyDirectory,
  fetchExploreMeasures,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  classifyInvestigateCountySelection,
  countyEvidenceForRequest,
  identityFromPublishedCounty,
  InvestigateContractError,
  retryCooldownsFromBundle,
  reusableMeasureOutcomes,
  type CountyEvidenceBundle,
  type InvestigateCountySelection,
  type MeasureRetryCooldown,
  type ResolvedCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateRequestDisclosure,
  type InvestigateQueryOutcome,
} from "@/features/ux-reset/investigate/investigate-request-state";
import { investigateSearchParams } from "@/features/ux-reset/investigate/investigate-search-params";
import {
  fetchInvestigateIndicators,
  loadCountyEvidenceBundle,
  loadInvestigateCountyRecord,
  shouldRetryInvestigateRequest,
  type PreservedCountyMeasures,
} from "@/features/ux-reset/investigate/load-county-evidence";
import { publishedCountyRecordFromDetail } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import { evidenceFromCounty } from "@/features/ux-reset/review/suggested-follow-up-content";
import type { SuggestedFollowUpEvidence } from "@/features/ux-reset/review/suggested-follow-up-content";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import type { AtlasMetadata, CountyDetail, Measure } from "@/generated/models";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
  type AtlasStateOption,
} from "@/lib/atlas-state-geography";
import { isCountyFips } from "@/lib/county-geography";

export type InvestigateRecovery =
  | "directory"
  | "identity"
  | "malformed"
  | "missing"
  | "rejected"
  | "release_mismatch"
  | "unknown"
  | "unsupported";

export type InvestigateWorkspace = {
  bundle: CountyEvidenceBundle | null;
  catalogError: string | null;
  catalogRefreshError: string | null;
  compare: readonly string[];
  countyRecord: PublishedCountyRecord | null;
  /** Published county record used to build the five follow-up workflows. */
  countyDetail: CountyDetail | null;
  /** Successful county read that returned no record (HTTP 404). */
  countyRecordAbsent: boolean;
  /**
   * Published county fields used to choose suggested follow-up. Score,
   * priority, and color stay out of the evidence hierarchy.
   */
  suggestedFollowUpEvidence: SuggestedFollowUpEvidence | null;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  countyRecordRefreshError: string | null;
  directory: readonly ExploreCountyIdentity[];
  directoryError: string | null;
  directoryLoading: boolean;
  directoryRefreshError: string | null;
  evidenceError: string | null;
  evidenceFetching: boolean;
  evidenceLoading: boolean;
  /** Observation query outcome. `undefined` data is never-loaded or failed-first-load. `null` data is settled-absent. */
  observationOutcome: InvestigateQueryOutcome;
  identity: ResolvedCountyIdentity | null;
  indicatorError: string | null;
  indicatorRefreshError: string | null;
  measures: readonly Measure[];
  metadata: AtlasMetadata | null;
  metadataError: string | null;
  metadataLoading: boolean;
  metadataRefreshError: string | null;
  period: string | null;
  recovery: InvestigateRecovery | null;
  releaseId: string | null;
  requestedDataset: string | null;
  requestedFips: string | null;
  scope: string;
  scopeLabel: string;
  retryDirectory: () => void;
  retryEvidence: () => void;
  selection: InvestigateCountySelection;
  setCounty: (fips: string) => void;
  stateLabel: string | null;
};

function preservedMeasuresForCachedBundle(input: {
  bundle: CountyEvidenceBundle | undefined;
  fips: string;
  period: string | null;
  releaseId: string;
}): PreservedCountyMeasures | null {
  const { bundle } = input;
  if (
    !bundle ||
    bundle.county.fips !== input.fips ||
    bundle.releaseId !== input.releaseId
  ) {
    return null;
  }
  return {
    fips: bundle.county.fips,
    outcomes: reusableMeasureOutcomes(bundle),
    period: input.period,
    releaseId: bundle.releaseId,
  };
}

function cooldownsForCachedBundle(input: {
  bundle: CountyEvidenceBundle | undefined;
  fips: string;
  releaseId: string;
}): readonly MeasureRetryCooldown[] {
  const { bundle } = input;
  if (
    !bundle ||
    bundle.county.fips !== input.fips ||
    bundle.releaseId !== input.releaseId
  ) {
    return [];
  }
  return retryCooldownsFromBundle(bundle);
}

function recoveryFromError(error: unknown): InvestigateRecovery | null {
  if (!(error instanceof InvestigateContractError)) {
    return null;
  }
  switch (error.code) {
    case "identity_mismatch": {
      return "identity";
    }
    case "rejected": {
      return "rejected";
    }
    case "release_mismatch": {
      return "release_mismatch";
    }
    case "unknown_county": {
      return "unknown";
    }
    default: {
      const exhaustive: never = error.code;
      return exhaustive;
    }
  }
}

function stateLabelForCounty(input: {
  directory: readonly ExploreCountyIdentity[];
  identity: ResolvedCountyIdentity | null;
  stateOptions: readonly AtlasStateOption[];
}): string | null {
  const { identity } = input;
  if (!identity) {
    return null;
  }
  if (identity.stateCode) {
    const match = input.stateOptions.find(
      (state) => state.code === identity.stateCode
    );
    return match ? `${match.name} (${identity.stateCode})` : identity.stateCode;
  }
  const entry = input.directory.find((county) => county.fips === identity.fips);
  if (!entry) {
    return null;
  }
  return entry.stateName ? `${entry.stateName} (${entry.state})` : entry.state;
}

export function useInvestigateWorkspace(): InvestigateWorkspace {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const retrySetting = queryClient.getDefaultOptions().queries?.retry;
  const [urlState, setUrlState] = useQueryStates(investigateSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const rawSelection = classifyInvestigateCountySelection(
    searchParams.getAll("county")
  );
  const selection: InvestigateCountySelection = urlState.county
    ? { fips: urlState.county, kind: "county" }
    : rawSelection.kind === "malformed"
      ? rawSelection
      : { kind: "missing" };
  const requestedFips = selection.kind === "county" ? selection.fips : null;

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
        throw new InvestigateContractError(
          "Metadata release does not match the requested dataset.",
          "release_mismatch"
        );
      }
      return metadata;
    },
    queryKey: ["ux-reset-investigate-metadata", urlState.dataset],
  });

  const releaseId = metadataQuery.data?.release_id ?? null;
  const stateOptions = useMemo(
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
        throw new Error("Investigate county directory requires a release.");
      }
      return fetchExploreCountyDirectory(releaseId, signal);
    },
    queryKey: ["ux-reset-investigate-directory", releaseId],
  });
  const directoryState = investigateRequestDisclosure({
    data: directoryQuery.data,
    error: directoryQuery.error,
    isError: directoryQuery.isError,
    request: "directory",
  });
  const directory =
    directoryQuery.data === undefined ? [] : directoryQuery.data;
  const publishedCounty = directory.find(
    (county) => county.fips === requestedFips
  );
  const identity = publishedCounty
    ? identityFromPublishedCounty(publishedCounty)
    : null;
  const inRelease = Boolean(identity);
  const unsupported =
    selection.kind === "county" &&
    directoryState.keepsResolvedResult &&
    !inRelease;

  const countyRecordQuery = useQuery({
    enabled: Boolean(releaseId && requestedFips && inRelease),
    queryFn: async ({ signal }) => {
      if (!(releaseId && requestedFips)) {
        throw new InvestigateContractError(
          "A published county record requires a county and release.",
          "rejected"
        );
      }
      const detail = await loadInvestigateCountyRecord({
        fips: requestedFips,
        releaseId,
        signal,
      });
      if (!detail) {
        return null;
      }
      return {
        detail,
        followUpEvidence: evidenceFromCounty(detail, 10),
        record: publishedCountyRecordFromDetail(detail),
      };
    },
    queryKey: ["ux-reset-investigate-county-record", releaseId, requestedFips],
    retry: (failureCount, error) =>
      shouldRetryInvestigateRequest(failureCount, error, retrySetting),
  });

  const measuresQuery = useQuery({
    enabled: Boolean(releaseId) && inRelease,
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Investigate measures require a release.");
      }
      return fetchExploreMeasures(signal, releaseId);
    },
    queryKey: ["ux-reset-investigate-measures", releaseId],
  });
  const indicatorsQuery = useQuery({
    enabled: Boolean(releaseId) && inRelease,
    queryFn: async ({ signal }) => fetchInvestigateIndicators(signal),
    queryKey: ["ux-reset-investigate-indicators", releaseId],
    retry: (failureCount, error) =>
      shouldRetryInvestigateRequest(failureCount, error, retrySetting),
  });

  const catalogState = investigateRequestDisclosure({
    data: measuresQuery.data,
    error: measuresQuery.error,
    isError: measuresQuery.isError,
    request: "catalog",
  });
  const indicatorState = investigateRequestDisclosure({
    data: indicatorsQuery.data,
    error: indicatorsQuery.error,
    isError: indicatorsQuery.isError,
    request: "indicators",
  });
  const measureKey = (
    measuresQuery.data === undefined ? [] : measuresQuery.data
  )
    .map((measure) => measure.measure_id)
    .join("|");
  const indicatorKey =
    indicatorState.outcome === "failed-first-load"
      ? "domains-failed"
      : (indicatorsQuery.data === undefined ? [] : indicatorsQuery.data)
          .map(
            (indicator) =>
              `${indicator.indicator_id}:${indicator.domain ?? ""}:${indicator.release_version ?? ""}`
          )
          .join("|");
  const evidenceQuery = useQuery({
    enabled: Boolean(
      releaseId &&
      requestedFips &&
      identity &&
      inRelease &&
      catalogState.keepsResolvedResult &&
      indicatorsQuery.isFetched &&
      !indicatorsQuery.isFetching
    ),
    queryFn: async ({ client, queryKey, signal }) => {
      if (!(releaseId && requestedFips && identity)) {
        throw new InvestigateContractError(
          "County evidence requires a resolved county and release.",
          "rejected"
        );
      }
      // Production staleTime can render this query's cached bundle without
      // running queryFn. Read that cache here so a later retry keeps successes
      // for this county, release, and period only.
      const cached = client.getQueryData<CountyEvidenceBundle>(queryKey);
      const preserve = preservedMeasuresForCachedBundle({
        bundle: cached,
        fips: requestedFips,
        period: urlState.period,
        releaseId,
      });
      // The cached bundle can predate a Retry-After received during a cancelled
      // retry. The loader also waits on that identity-scoped deadline.
      return loadCountyEvidenceBundle({
        cooldowns: cooldownsForCachedBundle({
          bundle: cached,
          fips: requestedFips,
          releaseId,
        }),
        domainsRequestFailed: indicatorState.outcome === "failed-first-load",
        fips: requestedFips,
        identity,
        indicators:
          indicatorsQuery.data === undefined ? [] : indicatorsQuery.data,
        measures: measuresQuery.data === undefined ? [] : measuresQuery.data,
        period: urlState.period,
        preserve,
        releaseId,
        signal,
      });
    },
    queryKey: [
      "ux-reset-investigate-evidence",
      releaseId,
      requestedFips,
      urlState.period,
      measureKey,
      indicatorKey,
    ],
    staleTime: (query) =>
      (query.state.data?.knownEmptySelections.length ?? 0) > 0 ? 0 : 300_000,
    retry: (failureCount, error) =>
      shouldRetryInvestigateRequest(failureCount, error, retrySetting),
  });

  const retryDirectory = useCallback(() => {
    void directoryQuery.refetch();
  }, [directoryQuery]);
  const retryGateRef = useRef(false);
  const retryEvidence = useCallback(async () => {
    if (retryGateRef.current || evidenceQuery.isFetching) {
      return;
    }
    retryGateRef.current = true;
    try {
      await evidenceQuery.refetch({ cancelRefetch: false });
    } finally {
      retryGateRef.current = false;
    }
  }, [evidenceQuery]);

  const setCounty = useCallback(
    (fips: string) => {
      if (!isCountyFips(fips)) {
        return;
      }
      setUrlState({ county: fips });
    },
    [setUrlState]
  );

  const countyState = investigateRequestDisclosure({
    data: countyRecordQuery.data,
    error: countyRecordQuery.error,
    isError: countyRecordQuery.isError,
    request: "county-record",
  });
  const observationState = investigateRequestDisclosure({
    data: evidenceQuery.data,
    error: evidenceQuery.error,
    isError: evidenceQuery.isError,
    request: "observations",
  });
  const metadataState = investigateRequestDisclosure({
    data: metadataQuery.data,
    error: metadataQuery.error,
    isError: metadataQuery.isError,
    request: "metadata",
    requestedDataset: urlState.dataset,
  });

  let recovery: InvestigateRecovery | null = null;
  if (selection.kind === "missing") {
    recovery = "missing";
  } else if (selection.kind === "malformed") {
    recovery = "malformed";
  } else if (
    metadataState.outcome === "failed-first-load" &&
    recoveryFromError(metadataQuery.error)
  ) {
    recovery = recoveryFromError(metadataQuery.error);
  } else if (
    selection.kind === "county" &&
    directoryState.outcome === "failed-first-load"
  ) {
    recovery = "directory";
  } else if (unsupported) {
    recovery = "unsupported";
  }

  return {
    bundle: recovery
      ? null
      : countyEvidenceForRequest(evidenceQuery.data, {
          fips: requestedFips,
          releaseId,
        }),
    catalogError: catalogState.failure,
    catalogRefreshError: catalogState.refreshFailure,
    compare: urlState.compare,
    countyRecord: countyRecordQuery.data?.record ?? null,
    countyDetail: countyRecordQuery.data?.detail ?? null,
    suggestedFollowUpEvidence: countyRecordQuery.data?.followUpEvidence ?? null,
    countyRecordAbsent: countyState.absent,
    countyRecordError: countyState.failure,
    countyRecordLoading:
      !recovery &&
      selection.kind === "county" &&
      inRelease &&
      countyRecordQuery.isLoading &&
      !countyRecordQuery.isError,
    countyRecordRefreshError: countyState.refreshFailure,
    directory,
    directoryError: directoryState.failure,
    directoryLoading:
      selection.kind === "county" &&
      directoryQuery.isLoading &&
      !directoryQuery.isError,
    directoryRefreshError: directoryState.refreshFailure,
    evidenceError: observationState.failure ?? observationState.refreshFailure,
    evidenceFetching:
      !recovery &&
      selection.kind === "county" &&
      evidenceQuery.isFetching &&
      observationState.keepsResolvedResult,
    evidenceLoading:
      !recovery &&
      selection.kind === "county" &&
      (evidenceQuery.isLoading ||
        (inRelease && (measuresQuery.isLoading || indicatorsQuery.isLoading))),
    observationOutcome: observationState.outcome,
    identity,
    indicatorError: indicatorState.failure,
    indicatorRefreshError: indicatorState.refreshFailure,
    measures: measuresQuery.data === undefined ? [] : measuresQuery.data,
    metadata: metadataQuery.data === undefined ? null : metadataQuery.data,
    metadataError: metadataState.failure,
    metadataLoading: metadataQuery.isLoading,
    metadataRefreshError: metadataState.refreshFailure,
    period: urlState.period,
    recovery,
    releaseId,
    requestedDataset: urlState.dataset,
    requestedFips,
    retryDirectory,
    retryEvidence,
    scope: urlState.scope,
    scopeLabel: reviewScopeLabel(urlState.scope, stateOptions),
    selection,
    setCounty,
    stateLabel: stateLabelForCounty({
      directory,
      identity,
      stateOptions,
    }),
  };
}
