"use client";

import type { UseQueryResult } from "@tanstack/react-query";

import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
import {
  intelligenceStatusAnnouncement,
  mapCountySurveillanceIntelligence,
  type IntelligencePerspectiveView,
  type IntelligenceQueryPhase,
  type PublishedGapScoreSource,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import { useSurveillanceSituations } from "@/features/ux-reset/surveillance-intelligence/use-surveillance-situations";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { useTier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";

export type CountySurveillanceIntelligenceModel = {
  announcement: string;
  perspectives: IntelligencePerspectiveView[];
  retry: (id: IntelligencePerspectiveView["id"]) => void;
};

function phaseOf(
  enabled: boolean,
  query: UseQueryResult<unknown, Error>
): IntelligenceQueryPhase {
  if (!enabled) {
    return "idle";
  }
  if (query.isPending) {
    return "loading";
  }
  if (query.isError) {
    return "error";
  }
  if (query.isSuccess) {
    return "success";
  }
  return "loading";
}

function errorStatus(error: unknown): number | null {
  return error instanceof AtlasApiError ? error.status : null;
}

function countyPhase(
  fips: string,
  query: UseQueryResult<unknown, Error>
): IntelligenceQueryPhase {
  if (!/^\d{5}$/.test(fips)) {
    return "idle";
  }
  return phaseOf(true, query);
}

/**
 * Loads the four perspectives through the existing scores and Tier 1 clients
 * plus the generated surveillance-situations client. Each query fails alone.
 * Compare can reuse this hook with its own county columns.
 */
export function useCountySurveillanceIntelligence(input: {
  fips: string;
  release: Tier1ActiveRelease;
}): CountySurveillanceIntelligenceModel {
  const releaseId =
    input.release.status === "ready" ? input.release.releaseId : null;
  const scoresQuery = useExplorerMapScores(releaseId);
  const tier1Query = useTier1SurveillancePriority(input.fips);
  const situationsQuery = useSurveillanceSituations(input.fips);
  const perspectives = mapCountySurveillanceIntelligence({
    fips: input.fips,
    gapScore: {
      phase: phaseOf(releaseId !== null, scoresQuery),
      release: input.release,
      result:
        scoresQuery.isSuccess && scoresQuery.data
          ? (scoresQuery.data satisfies PublishedGapScoreSource)
          : null,
    },
    situations: {
      errorStatus: errorStatus(situationsQuery.error),
      phase: countyPhase(input.fips, situationsQuery),
      result: situationsQuery.isSuccess ? situationsQuery.data : null,
      unverified: situationsQuery.error instanceof ApiResponseValidationError,
    },
    tier1: {
      errorStatus: errorStatus(tier1Query.error),
      phase: countyPhase(input.fips, tier1Query),
      result: tier1Query.isSuccess ? tier1Query.data : null,
      unverified: tier1Query.error instanceof ApiResponseValidationError,
    },
  });
  const retry = (id: IntelligencePerspectiveView["id"]) => {
    switch (id) {
      case "gap-score": {
        void scoresQuery.refetch();
        return;
      }
      case "ml-review-priority": {
        void tier1Query.refetch();
        return;
      }
      case "ecological-situation":
      case "surveillance-situation": {
        void situationsQuery.refetch();
        return;
      }
      default: {
        const exhaustive: never = id;
        return exhaustive;
      }
    }
  };
  return {
    announcement: intelligenceStatusAnnouncement(input.fips, perspectives),
    perspectives,
    retry,
  };
}
