"use client";

import { createContext, useContext } from "react";
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

const Tier1StoryQueryContext = createContext<Tier1StoryQuery>(idleQuery);

export function Tier1StoryQueryProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: Tier1StoryQuery;
}) {
  return (
    <Tier1StoryQueryContext.Provider value={value}>
      {children}
    </Tier1StoryQueryContext.Provider>
  );
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
