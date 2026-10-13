"use client";

import type { QueryClient, UseQueryOptions } from "@tanstack/react-query";
import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";

import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

const COUNTY_FIPS = /^\d{5}$/;

export type Tier1StoryQuery =
  | { data: Tier1CountyPriority; status: "success" }
  | { errorStatus: number; status: "error" }
  | { status: "pending" }
  | { status: "idle" };

const idleQuery = { status: "idle" } as const satisfies Tier1StoryQuery;

/**
 * The Explorer list reads query options outside the hook. Storybook aliases this
 * module in place of the production client, so the provider mirrors its value
 * here for those options. The value is in-memory fixture data and is never fetched.
 */
let storyScenario: Tier1StoryQuery = idleQuery;

const Tier1StoryQueryContext = createContext<Tier1StoryQuery>(idleQuery);

export function Tier1StoryQueryProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: Tier1StoryQuery;
}) {
  // Query options are plain functions, so they cannot read this context during
  // the child render. The assignment has to happen before children render;
  // an effect would leave the Explorer list on the idle scenario.
  // eslint-disable-next-line react/globals -- mirrored fixture for the aliased query options
  storyScenario = value;
  useEffect(() => {
    storyScenario = value;
    return () => {
      if (storyScenario === value) {
        storyScenario = idleQuery;
      }
    };
  }, [value]);
  return (
    <Tier1StoryQueryContext.Provider value={value}>
      {children}
    </Tier1StoryQueryContext.Provider>
  );
}

function storyPriorityResult(fips: string): Promise<Tier1CountyPriority> {
  const scenario = storyScenario;
  const path = `/v1/counties/${fips}/tier1-surveillance-priority`;
  switch (scenario.status) {
    case "success": {
      return Promise.resolve({ ...scenario.data, county_fips: fips });
    }
    case "error": {
      return Promise.reject(
        new AtlasApiError(
          "Synthetic model request failed.",
          path,
          scenario.errorStatus,
          null
        )
      );
    }
    case "idle":
    case "pending": {
      return Promise.reject(
        new AtlasApiError(
          "Synthetic model request is not ready.",
          path,
          503,
          null
        )
      );
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

/**
 * Storybook substitute for the shared Tier 1 query. It never calls the API.
 * Idle and pending scenarios stay disabled so the Explorer list shows the
 * unavailable state instead of issuing a request.
 */
export function tier1SurveillancePriorityQueryOptions(
  fips: string,
  releaseId: string | null,
  _queryClient: QueryClient,
  enabled = true
): UseQueryOptions<Tier1CountyPriority, Error> {
  const scenarioReady =
    storyScenario.status === "success" || storyScenario.status === "error";
  return {
    enabled:
      enabled && scenarioReady && COUNTY_FIPS.test(fips) && releaseId !== null,
    queryFn: (): Promise<Tier1CountyPriority> => storyPriorityResult(fips),
    queryKey: ["ux-reset-tier1-surveillance-priority", fips, releaseId],
    retry: false,
  };
}

type StoryQueryResult = {
  data: Tier1CountyPriority | undefined;
  error: AtlasApiError | null;
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
};

/**
 * Storybook substitute for the request hook. It never calls the API.
 * Production tests keep the real module; only the Storybook Vite alias uses this file.
 */
export function useTier1SurveillancePriority(
  fips: string,
  release: Tier1ActiveRelease
): StoryQueryResult {
  const scenario = useContext(Tier1StoryQueryContext);
  const releaseId = release.status === "ready" ? release.releaseId : null;
  if (!(COUNTY_FIPS.test(fips) && releaseId !== null)) {
    return {
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      isSuccess: false,
    };
  }
  switch (scenario.status) {
    case "idle":
    case "pending": {
      return {
        data: undefined,
        error: null,
        isError: false,
        isPending: true,
        isSuccess: false,
      };
    }
    case "success": {
      return {
        data: scenario.data,
        error: null,
        isError: false,
        isPending: false,
        isSuccess: true,
      };
    }
    case "error": {
      return {
        data: undefined,
        error: new AtlasApiError(
          "Synthetic model request failed.",
          `/v1/counties/${fips}/tier1-surveillance-priority`,
          scenario.errorStatus,
          null
        ),
        isError: true,
        isPending: false,
        isSuccess: false,
      };
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}
