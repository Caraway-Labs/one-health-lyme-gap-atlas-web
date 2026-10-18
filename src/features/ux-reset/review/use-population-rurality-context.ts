"use client";

import { useQueries } from "@tanstack/react-query";

import type { KnownEmptyObservationSelection } from "@/features/ux-reset/observations/selection-availability";
import {
  fetchPopulationRuralityMeasure,
  populationRuralityLoadErrorMessage,
} from "@/features/ux-reset/review/load-population-rurality-context";
import {
  observationMatchesPopulationRuralityRequest,
  POPULATION_RURALITY_MEASURES,
  populationRuralityQueryKey,
  presentPopulationRuralityObservation,
  type PopulationRuralityLoad,
  type PopulationRuralityPresentation,
} from "@/features/ux-reset/review/population-rurality-context";
import { isCountyFips } from "@/lib/county-geography";

export type PopulationRuralityMeasureView =
  | { measureId: string; status: "idle" }
  | { measureId: string; status: "loading" }
  | {
      measureId: string;
      message: string;
      retry: () => void;
      status: "error";
    }
  | {
      measureId: string;
      selection?: KnownEmptyObservationSelection | null;
      status: "absent";
    }
  | { count: number; measureId: string; status: "conflict" }
  | {
      measureId: string;
      presentation: PopulationRuralityPresentation;
      status: "ready";
    };

function viewForLoad(input: {
  claimLabel: string;
  fips: string;
  load: PopulationRuralityLoad;
  measureId: string;
  releaseId: string;
  vintageYear: number;
}): PopulationRuralityMeasureView {
  switch (input.load.kind) {
    case "absent": {
      return {
        measureId: input.measureId,
        selection: input.load.selection ?? null,
        status: "absent",
      };
    }
    case "conflict": {
      return {
        count: input.load.count,
        measureId: input.measureId,
        status: "conflict",
      };
    }
    case "observation": {
      const matches = observationMatchesPopulationRuralityRequest(
        input.load.observation,
        {
          fips: input.fips,
          measureId: input.measureId,
          releaseId: input.releaseId,
          vintageYear: input.vintageYear,
        }
      );
      if (!matches) {
        return {
          measureId: input.measureId,
          message:
            "This response did not match the selected county, measure, vintage, and release, so it was not shown.",
          retry: () => {},
          status: "error",
        };
      }
      return {
        measureId: input.measureId,
        presentation: presentPopulationRuralityObservation({
          claimLabel: input.claimLabel,
          observation: input.load.observation,
        }),
        status: "ready",
      };
    }
    default: {
      const exhaustive: never = input.load;
      return exhaustive;
    }
  }
}

export function usePopulationRuralityContext(input: {
  fips: string | null;
  releaseId: string | null;
}): { enabled: boolean; measures: PopulationRuralityMeasureView[] } {
  const fips = input.fips?.trim() ?? "";
  const releaseId = input.releaseId?.trim() ?? "";
  const enabled = isCountyFips(fips) && releaseId.length > 0;
  const queries = useQueries({
    queries: POPULATION_RURALITY_MEASURES.map((measure) => ({
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchPopulationRuralityMeasure({
          fips,
          measureId: measure.measureId,
          releaseId,
          signal,
          vintageYear: measure.vintageYear,
        }),
      queryKey: populationRuralityQueryKey({
        fips,
        measureId: measure.measureId,
        releaseId,
        vintageYear: measure.vintageYear,
      }),
      retry: false,
      staleTime: (query: { state: { data?: PopulationRuralityLoad } }) => {
        const data = query.state.data;
        if (data?.kind === "absent" && data.selection) {
          return 0;
        }
        return 300_000;
      },
    })),
  });
  const measures = POPULATION_RURALITY_MEASURES.map((measure, index) => {
    const query = queries[index];
    if (!enabled || !query) {
      return { measureId: measure.measureId, status: "idle" as const };
    }
    if (query.isFetching && query.data === undefined) {
      return { measureId: measure.measureId, status: "loading" as const };
    }
    if (query.isError) {
      return {
        measureId: measure.measureId,
        message: populationRuralityLoadErrorMessage(query.error),
        retry: () => {
          void query.refetch();
        },
        status: "error" as const,
      };
    }
    if (query.data === undefined) {
      return { measureId: measure.measureId, status: "loading" as const };
    }
    const view = viewForLoad({
      claimLabel: measure.claimLabel,
      fips,
      load: query.data,
      measureId: measure.measureId,
      releaseId,
      vintageYear: measure.vintageYear,
    });
    if (view.status === "error") {
      return {
        ...view,
        retry: () => {
          void query.refetch();
        },
      };
    }
    return view;
  });
  return { enabled, measures };
}
