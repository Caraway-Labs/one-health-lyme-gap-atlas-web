"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { DatedObservationContractError } from "@/features/ux-reset/review/dated-observation-envelope";
import type {
  ExplorerLayerGate,
  ExplorerMapLayerId,
  ExplorerObservationPaintState,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  EXPLORER_OBSERVATION_LAYER_IDS,
  EXPLORER_OBSERVATION_SPECS,
  ExplorerMapContractError,
  type ExplorerMapObservationReady,
  type ExplorerObservationLayerId,
} from "@/features/ux-reset/review/explorer-map-observation";
import { loadExplorerMapObservations } from "@/features/ux-reset/review/load-explorer-map-observations";
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
    return "The observation response did not match the governed contract for this layer.";
  }
  if (error instanceof AtlasApiError) {
    if (error.status === 404) {
      return "No admitted observations were published for this measure on the current release.";
    }
    if (error.status === 400) {
      return (
        error.message ||
        "This measure filter is not supported for the current release."
      );
    }
  }
  return "Published observations could not be loaded for this layer.";
}

function retryObservation(failureCount: number, error: unknown): boolean {
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
  const fipsKey = fips.join(",");
  const enabled =
    Boolean(input.releaseId) &&
    input.geometryStatus === "ready" &&
    fips.length > 0;
  const queries = useQueries({
    queries: EXPLORER_OBSERVATION_LAYER_IDS.map((layerId) => ({
      enabled: enabled && layerId === input.activeLayerId,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        const releaseId = input.releaseId;
        if (!releaseId) {
          throw new ExplorerMapContractError(
            "Map layers require a governed release."
          );
        }
        return loadExplorerMapObservations({
          fips,
          releaseId,
          signal,
          spec: EXPLORER_OBSERVATION_SPECS[layerId],
        });
      },
      queryKey: [
        "ux-reset-explorer-map-observations",
        input.releaseId,
        layerId,
        fipsKey,
      ],
      retry: retryObservation,
      staleTime: Infinity,
    })),
  });
  return useMemo(() => {
    const states = {} as Record<
      ExplorerObservationLayerId,
      ExplorerObservationLayerState
    >;
    for (const [index, layerId] of EXPLORER_OBSERVATION_LAYER_IDS.entries()) {
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
      const query = queries[index];
      if (!query) {
        states[layerId] = { status: "unloaded" };
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
        states[layerId] = { ...query.data, status: "ready" };
        continue;
      }
      if (layerId !== input.activeLayerId || query.fetchStatus === "idle") {
        states[layerId] = { status: "unloaded" };
        continue;
      }
      states[layerId] = { reason: LOADING_REASON, status: "loading" };
    }
    return states;
  }, [
    fips.length,
    input.activeLayerId,
    input.geometryStatus,
    input.releaseId,
    queries,
  ]);
}
