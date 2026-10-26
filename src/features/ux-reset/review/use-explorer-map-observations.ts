"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { KnownEmptyObservationSelection } from "@/features/ux-reset/observations/selection-availability";
import { DatedObservationContractError } from "@/features/ux-reset/review/dated-observation-envelope";
import {
  isExplorerObservationLayer,
  type ExplorerLayerGate,
  type ExplorerMapLayerId,
  type ExplorerObservationPaintState,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  EXPLORER_OBSERVATION_LAYER_IDS,
  ExplorerMapContractError,
  type ExplorerMapObservationReady,
  type ExplorerObservationLayerId,
} from "@/features/ux-reset/review/explorer-map-observation";
import {
  explorerMapValuesLayerReady,
  explorerMapValuesQueryKey,
  loadExplorerMapValues,
} from "@/features/ux-reset/review/load-explorer-map-values";
import {
  isLower48CountyFips,
  stateFipsPrefix,
} from "@/features/ux-reset/review/review-state-fips";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";

export type ExplorerObservationGeometryStatus = "error" | "loading" | "ready";

export type ExplorerObservationLayerState =
  | { reason: string; status: "error" | "idle" | "loading" }
  | { status: "unloaded" }
  | ({ status: "ready" } & ExplorerMapObservationReady);

export function knownEmptyMapSelection(
  observations: Record<
    ExplorerObservationLayerId,
    ExplorerObservationLayerState
  >,
  mapLayer: ExplorerMapLayerId
): KnownEmptyObservationSelection | null {
  if (!isExplorerObservationLayer(mapLayer)) {
    return null;
  }
  const layer = observations[mapLayer];
  if (layer.status !== "ready" || !layer.knownEmptySelection) {
    return null;
  }
  return layer.knownEmptySelection;
}

const LOADING_REASON = "Published values for this layer are still loading.";
const GEOMETRY_LOADING_REASON =
  "County shapes are still loading, so this layer cannot be checked against the release.";
const GEOMETRY_ERROR_REASON =
  "County shapes could not be loaded, so this layer cannot be checked against the release.";
const EMPTY_GEOMETRY_REASON =
  "No lower-48 county shapes were available to check this layer.";

function failureReason(error: unknown): string {
  if (
    error instanceof ExplorerMapContractError ||
    error instanceof DatedObservationContractError
  ) {
    return error.message;
  }
  if (error instanceof ApiResponseValidationError) {
    return "The map values response did not match the governed contract for this layer.";
  }
  if (error instanceof AtlasApiError) {
    if (error.status === 404) {
      return error.message || "Dataset release not found";
    }
    if (error.status === 400) {
      return (
        error.message ||
        "This measure filter is not supported for the current release."
      );
    }
  }
  return "Published map values could not be loaded for this layer.";
}

function retryMapValues(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ExplorerMapContractError ||
    error instanceof DatedObservationContractError ||
    error instanceof ApiResponseValidationError
  ) {
    return false;
  }
  if (
    error instanceof AtlasApiError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  return failureCount < 2;
}

export function observationPaintState(
  state: ExplorerObservationLayerState
): ExplorerObservationPaintState {
  if (state.status === "unloaded") {
    return { reason: LOADING_REASON, status: "loading" };
  }
  return state;
}

export function observationGate(
  state: ExplorerObservationLayerState
): ExplorerLayerGate {
  if (
    state.status === "ready" ||
    state.status === "unloaded" ||
    state.status === "loading"
  ) {
    return { reason: null, selectable: true };
  }
  return { reason: state.reason, selectable: false };
}

export function useExplorerMapObservations(input: {
  activeLayerId: ExplorerMapLayerId;
  fips: readonly string[];
  geometryStatus: ExplorerObservationGeometryStatus;
  releaseId: string | null;
  /** When set, only counties in this review state are requested. */
  scopeCode?: string | null;
}): Record<ExplorerObservationLayerId, ExplorerObservationLayerState> {
  const scopePrefix = input.scopeCode ? stateFipsPrefix(input.scopeCode) : null;
  const fips = useMemo(
    () =>
      [
        ...new Set(
          input.fips.filter(
            (countyFips) =>
              isLower48CountyFips(countyFips) &&
              (scopePrefix === null || countyFips.startsWith(scopePrefix))
          )
        ),
      ].toSorted(),
    [input.fips, scopePrefix]
  );
  const fetchEnabled =
    Boolean(input.releaseId) &&
    input.geometryStatus === "ready" &&
    fips.length > 0 &&
    isExplorerObservationLayer(input.activeLayerId);
  const query = useQuery({
    enabled: fetchEnabled,
    queryFn: ({ signal }) => {
      const releaseId = input.releaseId;
      if (!releaseId) {
        throw new ExplorerMapContractError(
          "Map layers require a governed release."
        );
      }
      return loadExplorerMapValues({ releaseId, signal });
    },
    queryKey: input.releaseId
      ? explorerMapValuesQueryKey(input.releaseId)
      : ["ux-reset-explorer-map-values", "pending"],
    retry: retryMapValues,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return useMemo(() => {
    const states = {} as Record<
      ExplorerObservationLayerId,
      ExplorerObservationLayerState
    >;
    for (const layerId of EXPLORER_OBSERVATION_LAYER_IDS) {
      if (input.geometryStatus === "loading") {
        states[layerId] = { reason: GEOMETRY_LOADING_REASON, status: "idle" };
        continue;
      }
      if (input.geometryStatus === "error") {
        states[layerId] = { reason: GEOMETRY_ERROR_REASON, status: "error" };
        continue;
      }
      if (fips.length === 0) {
        states[layerId] = { reason: EMPTY_GEOMETRY_REASON, status: "error" };
        continue;
      }
      if (!input.releaseId) {
        states[layerId] = {
          reason: "Map layers require a governed release.",
          status: "error",
        };
        continue;
      }
      if (query.isError) {
        states[layerId] = {
          reason: failureReason(query.error),
          status: "error",
        };
        continue;
      }
      if (query.data) {
        states[layerId] = {
          ...explorerMapValuesLayerReady({
            collection: query.data,
            layerId,
            requestedFips: fips,
            scopeCode: input.scopeCode,
          }),
          status: "ready",
        };
        continue;
      }
      if (
        query.isFetching &&
        isExplorerObservationLayer(input.activeLayerId) &&
        layerId === input.activeLayerId
      ) {
        states[layerId] = { reason: LOADING_REASON, status: "loading" };
        continue;
      }
      states[layerId] = { status: "unloaded" };
    }
    return states;
  }, [
    fips,
    input.activeLayerId,
    input.geometryStatus,
    input.releaseId,
    input.scopeCode,
    query.data,
    query.error,
    query.isError,
    query.isFetching,
  ]);
}
