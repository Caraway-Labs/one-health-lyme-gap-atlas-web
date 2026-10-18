"use client";

import { useQueries } from "@tanstack/react-query";

import {
  ENVIRONMENTAL_CONTEXT_MEASURES,
  environmentalContextQueryKey,
  environmentalDateSupport,
  observationMatchesEnvironmentalRequest,
  presentEnvironmentalObservation,
  type EnvironmentalMeasurePresentation,
} from "@/features/ux-reset/review/environmental-context";
import {
  environmentalLoadErrorMessage,
  fetchEnvironmentalMeasure,
  type EnvironmentalMeasureLoad,
} from "@/features/ux-reset/review/load-environmental-context";
import { isCountyFips } from "@/lib/county-geography";

export type EnvironmentalMeasureView =
  | { measureId: string; status: "idle" }
  | { measureId: string; status: "loading" }
  | {
      measureId: string;
      message: string;
      retry: () => void;
      status: "error";
    }
  | { measureId: string; status: "absent" }
  | { count: number; measureId: string; status: "conflict" }
  | {
      measureId: string;
      presentation: EnvironmentalMeasurePresentation;
      status: "ready";
    };

function viewForLoad(input: {
  date: string;
  fips: string;
  load: EnvironmentalMeasureLoad;
  measureId: string;
  releaseId: string;
  claimLabel: string;
}): EnvironmentalMeasureView {
  switch (input.load.kind) {
    case "absent": {
      return { measureId: input.measureId, status: "absent" };
    }
    case "conflict": {
      return {
        count: input.load.count,
        measureId: input.measureId,
        status: "conflict",
      };
    }
    case "observation": {
      const matches = observationMatchesEnvironmentalRequest(
        input.load.observation,
        {
          date: input.date,
          fips: input.fips,
          measureId: input.measureId,
          releaseId: input.releaseId,
        }
      );
      if (!matches) {
        return {
          measureId: input.measureId,
          message:
            "This response did not match the selected county, date, measure, and release, so it was not shown.",
          retry: () => {},
          status: "error",
        };
      }
      return {
        measureId: input.measureId,
        presentation: presentEnvironmentalObservation({
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

export function useEnvironmentalContext(input: {
  date: string;
  fips: string | null;
  releaseId: string | null;
}): {
  dateSupport: ReturnType<typeof environmentalDateSupport>;
  enabled: boolean;
  measures: EnvironmentalMeasureView[];
} {
  const fips = input.fips?.trim() ?? "";
  const releaseId = input.releaseId?.trim() ?? "";
  const dateSupport = environmentalDateSupport(input.date);
  const enabled =
    isCountyFips(fips) && releaseId.length > 0 && dateSupport === "supported";
  const queries = useQueries({
    queries: ENVIRONMENTAL_CONTEXT_MEASURES.map((measure) => ({
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchEnvironmentalMeasure({
          date: input.date,
          fips,
          measureId: measure.measureId,
          releaseId,
          signal,
        }),
      queryKey: environmentalContextQueryKey({
        date: input.date,
        fips,
        measureId: measure.measureId,
        releaseId,
      }),
      retry: false,
      staleTime: 300_000,
    })),
  });
  const measures = ENVIRONMENTAL_CONTEXT_MEASURES.map((measure, index) => {
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
        message: environmentalLoadErrorMessage(query.error),
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
      date: input.date,
      fips,
      load: query.data,
      measureId: measure.measureId,
      releaseId,
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
  return { dateSupport, enabled, measures };
}
