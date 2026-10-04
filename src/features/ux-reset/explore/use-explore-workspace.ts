"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import {
  commitExploreSelection,
  filterDirectoryByMapScope,
  resolveExploreMapScope,
  resolveRequestedMeasureId,
  type ExploreCommittedSelection,
  type ExploreRequestStatus,
} from "@/features/ux-reset/explore/explore-model";
import { exploreSearchParams } from "@/features/ux-reset/explore/explore-search-params";
import {
  fetchExploreCountyDirectory,
  fetchExploreMeasures,
  loadExploreSelection,
} from "@/features/ux-reset/explore/load-explore-resources";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  atlasStateOptionsFromMetadata,
  type AtlasStateOption,
} from "@/lib/atlas-state-geography";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
  type CountyDisplayGeometryFeatureCollection,
} from "@/lib/county-geography";

function metadataErrorMessage(error: unknown, requestedDataset: string | null) {
  if (error instanceof AtlasApiError && requestedDataset) {
    return `The requested release "${requestedDataset}" is not available. ${error.message}`;
  }
  if (error instanceof AtlasApiError) {
    return error.message;
  }
  return "Unable to load governed release metadata for Explore.";
}

function requestStatus(input: {
  isError: boolean;
  isSuccess: boolean;
}): ExploreRequestStatus {
  if (input.isSuccess) {
    return "success";
  }
  if (input.isError) {
    return "error";
  }
  return "pending";
}

export function useExploreWorkspace() {
  const [urlState, setUrlState] = useQueryStates(exploreSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const [committed, setCommitted] = useState<ExploreCommittedSelection | null>(
    null
  );

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
      return validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        response.data
      );
    },
    queryKey: ["ux-reset-explore-metadata", urlState.dataset],
  });

  const releaseId = metadataQuery.data?.release_id ?? null;
  const stateOptions: AtlasStateOption[] = useMemo(
    () =>
      metadataQuery.data
        ? atlasStateOptionsFromMetadata(metadataQuery.data.states)
        : [],
    [metadataQuery.data]
  );
  const stateCodes = useMemo(
    () => stateOptions.map((state) => state.code),
    [stateOptions]
  );
  const mapScope = resolveExploreMapScope({
    mapScopeParam: urlState.map_scope,
    reviewScope: urlState.scope,
    stateCodes,
  });

  const measuresQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => fetchExploreMeasures(signal),
    queryKey: ["ux-reset-explore-measures", releaseId],
  });
  const measures = useMemo(
    () => measuresQuery.data ?? [],
    [measuresQuery.data]
  );
  const requestedMeasureId = resolveRequestedMeasureId(
    measures,
    urlState.metric
  );
  const requestedMeasure =
    measures.find((measure) => measure.measure_id === requestedMeasureId) ??
    null;

  const directoryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Explore county directory requires a release.");
      }
      return fetchExploreCountyDirectory(releaseId, signal);
    },
    queryKey: ["ux-reset-explore-directory", releaseId],
  });

  const framedDirectory = useMemo(
    () => filterDirectoryByMapScope(directoryQuery.data ?? [], mapScope),
    [directoryQuery.data, mapScope]
  );
  const framedFipsKey = framedDirectory.map((county) => county.fips).join(",");

  const observationsQuery = useQuery({
    enabled: Boolean(
      releaseId && requestedMeasure && framedDirectory.length > 0
    ),
    queryFn: async ({ signal }) => {
      if (!releaseId || !requestedMeasure) {
        throw new Error("Explore observations require a measure and release.");
      }
      return loadExploreSelection({
        directory: framedDirectory,
        mapScope,
        measure: requestedMeasure,
        releaseId,
        signal,
      });
    },
    queryKey: [
      "ux-reset-explore-observations",
      releaseId,
      requestedMeasureId,
      mapScope,
      framedFipsKey,
    ],
  });

  const geometryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Display geometry requires a release.");
      }
      return fetchCountyDisplayGeometry(releaseId, { signal });
    },
    queryKey: countyDisplayGeometryQueryKey(
      "ux-reset-explore",
      releaseId ?? undefined
    ),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const nextCommitted = commitExploreSelection({
    current: committed,
    incoming: observationsQuery.data ?? null,
    requestStatus: requestStatus({
      isError: observationsQuery.isError,
      isSuccess: observationsQuery.isSuccess,
    }),
    requestedMapScope: mapScope,
    requestedMeasureId,
    requestedReleaseId: releaseId,
  });
  if (nextCommitted !== committed) {
    setCommitted(nextCommitted);
  }

  useEffect(() => {
    if (!requestedMeasureId) {
      return;
    }
    const catalogIds = new Set(measures.map((measure) => measure.measure_id));
    void setUrlState(
      (current) => {
        if (!current.metric) {
          return { metric: requestedMeasureId };
        }
        if (catalogIds.has(current.metric)) {
          // An empty patch leaves scope and county in place. Null would clear them.
          return {};
        }
        return { metric: requestedMeasureId };
      },
      { history: "replace" }
    );
  }, [measures, requestedMeasureId, setUrlState]);

  useEffect(() => {
    if (!committed) {
      return;
    }
    const countyStillVisible = committed.rows.some(
      (row) => row.fips === urlState.county
    );
    if (urlState.county && countyStillVisible) {
      return;
    }
    const nextCounty = committed.rows[0]?.fips ?? null;
    if (!nextCounty) {
      return;
    }
    void setUrlState({ county: nextCounty }, { history: "replace" });
  }, [committed, setUrlState, urlState.county]);

  const geometry: CountyDisplayGeometryFeatureCollection | null =
    geometryQuery.data ?? null;

  return {
    committed,
    directoryError: directoryQuery.isError,
    directoryLoading: directoryQuery.isPending && Boolean(releaseId),
    geometry,
    geometryError: geometryQuery.isError,
    geometryLoading: geometryQuery.isPending && Boolean(releaseId),
    geometryReleaseId: releaseId,
    mapScope,
    measures,
    measuresError: measuresQuery.isError,
    measuresLoading: measuresQuery.isPending && Boolean(releaseId),
    metadata: metadataQuery.data,
    metadataError: metadataQuery.isError
      ? metadataErrorMessage(metadataQuery.error, urlState.dataset)
      : null,
    metadataLoading: metadataQuery.isPending,
    observationsError: observationsQuery.isError,
    observationsLoading:
      observationsQuery.isFetching && !observationsQuery.isSuccess,
    releaseId,
    requestedMeasure,
    requestedMeasureId,
    retryGeometry: () => {
      void geometryQuery.refetch();
    },
    setCounty: (county: string) => {
      void setUrlState({ county });
    },
    setCompareSelection: (selected: string[]) => {
      void setUrlState({ selected });
    },
    setMapScope: (nextMapScope: string) => {
      void setUrlState({ map_scope: nextMapScope });
    },
    setMeasureId: (metric: string) => {
      void setUrlState({ metric });
    },
    stateOptions,
    urlState,
  };
}
