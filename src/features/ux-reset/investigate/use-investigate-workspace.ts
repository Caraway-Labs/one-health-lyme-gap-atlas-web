"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import {
  fetchExploreCountyDirectory,
  fetchExploreMeasures,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  classifyInvestigateCountySelection,
  countyEvidenceForRequest,
  InvestigateContractError,
  type CountyEvidenceBundle,
  type InvestigateCountySelection,
  type ResolvedCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import { investigateSearchParams } from "@/features/ux-reset/investigate/investigate-search-params";
import {
  fetchInvestigateGeography,
  fetchInvestigateIndicators,
  loadCountyEvidenceBundle,
  shouldRetryInvestigateRequest,
} from "@/features/ux-reset/investigate/load-county-evidence";
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
import { isCountyFips } from "@/lib/county-geography";

export type InvestigateRecovery =
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
  directory: readonly ExploreCountyIdentity[];
  directoryError: string | null;
  evidenceError: string | null;
  evidenceLoading: boolean;
  geographyLoading: boolean;
  identity: ResolvedCountyIdentity | null;
  metadata: AtlasMetadata | null;
  metadataError: string | null;
  metadataLoading: boolean;
  period: string | null;
  recovery: InvestigateRecovery | null;
  releaseId: string | null;
  requestedFips: string | null;
  scope: string;
  scopeLabel: string;
  selection: InvestigateCountySelection;
  setCounty: (fips: string) => void;
  stateLabel: string | null;
};

function metadataErrorMessage(
  error: unknown,
  requestedDataset: string | null
): string {
  if (error instanceof InvestigateContractError) {
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

  const geographyQuery = useQuery({
    enabled: Boolean(requestedFips),
    queryFn: async ({ signal }) => {
      if (!requestedFips) {
        throw new InvestigateContractError(
          "County FIPS is not canonical.",
          "rejected"
        );
      }
      return fetchInvestigateGeography(requestedFips, signal);
    },
    queryKey: ["ux-reset-investigate-geography", requestedFips],
    retry: (failureCount, error) =>
      shouldRetryInvestigateRequest(failureCount, error, retrySetting),
  });

  const identity =
    geographyQuery.data && geographyQuery.data.fips === requestedFips
      ? geographyQuery.data
      : null;
  const geographyRecovery = recoveryFromError(geographyQuery.error);

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
  const directory = directoryQuery.data ?? [];
  const inRelease = Boolean(
    requestedFips && directory.some((county) => county.fips === requestedFips)
  );
  const unsupported =
    selection.kind === "county" &&
    Boolean(identity) &&
    directoryQuery.isSuccess &&
    !inRelease;

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

  const measureKey = (measuresQuery.data ?? [])
    .map((measure) => measure.measure_id)
    .join("|");
  const indicatorKey = indicatorsQuery.isError
    ? "domains-failed"
    : (indicatorsQuery.data ?? [])
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
      measuresQuery.isSuccess &&
      indicatorsQuery.isFetched &&
      !indicatorsQuery.isFetching
    ),
    queryFn: async ({ signal }) => {
      if (!(releaseId && requestedFips && identity)) {
        throw new InvestigateContractError(
          "County evidence requires a resolved county and release.",
          "rejected"
        );
      }
      return loadCountyEvidenceBundle({
        domainsRequestFailed: indicatorsQuery.isError,
        fips: requestedFips,
        identity,
        indicators: indicatorsQuery.data ?? [],
        measures: measuresQuery.data ?? [],
        period: urlState.period,
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
    retry: (failureCount, error) =>
      shouldRetryInvestigateRequest(failureCount, error, retrySetting),
  });

  const setCounty = useCallback(
    (fips: string) => {
      if (!isCountyFips(fips)) {
        return;
      }
      setUrlState({ county: fips });
    },
    [setUrlState]
  );

  let recovery: InvestigateRecovery | null = null;
  if (selection.kind === "missing") {
    recovery = "missing";
  } else if (selection.kind === "malformed") {
    recovery = "malformed";
  } else if (geographyRecovery) {
    recovery = geographyRecovery;
  } else if (recoveryFromError(metadataQuery.error)) {
    recovery = recoveryFromError(metadataQuery.error);
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
    catalogError: measuresQuery.isError
      ? "Governed measures could not be loaded."
      : null,
    directory,
    directoryError: directoryQuery.isError
      ? "County geography for this release could not be loaded."
      : null,
    evidenceError: evidenceQuery.isError
      ? "County evidence did not load for the requested county."
      : null,
    evidenceLoading:
      !recovery &&
      selection.kind === "county" &&
      (evidenceQuery.isLoading ||
        (inRelease && (measuresQuery.isLoading || indicatorsQuery.isLoading))),
    geographyLoading:
      selection.kind === "county" &&
      geographyQuery.isLoading &&
      !geographyRecovery,
    identity,
    metadata: metadataQuery.data ?? null,
    metadataError: metadataQuery.isError
      ? metadataErrorMessage(metadataQuery.error, urlState.dataset)
      : null,
    metadataLoading: metadataQuery.isLoading,
    period: urlState.period,
    recovery,
    releaseId,
    requestedFips,
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
