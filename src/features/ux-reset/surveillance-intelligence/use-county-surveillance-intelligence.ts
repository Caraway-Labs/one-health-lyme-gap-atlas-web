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
import type { Tier1CountyPriority } from "@/generated/models/tier1CountyPriority";
import { AtlasApiError } from "@/lib/api-mutator";

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

function situationsPhase(
  release: Tier1ActiveRelease,
  fips: string,
  query: UseQueryResult<unknown, Error>
): IntelligenceQueryPhase {
  if (!/^\d{5}$/.test(fips)) {
    return "idle";
  }
  switch (release.status) {
    case "pending": {
      return "loading";
    }
    case "unknown": {
      return "idle";
    }
    case "ready": {
      return phaseOf(true, query);
    }
    default: {
      const exhaustive: never = release;
      return exhaustive;
    }
  }
}

function tier1Phase(
  release: Tier1ActiveRelease,
  query: UseQueryResult<Tier1CountyPriority, Error>
): IntelligenceQueryPhase {
  switch (release.status) {
    case "pending": {
      return "loading";
    }
    case "unknown": {
      return "idle";
    }
    case "ready": {
      return phaseOf(true, query);
    }
    default: {
      const exhaustive: never = release;
      return exhaustive;
    }
  }
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
  const tier1Query = useTier1SurveillancePriority(input.fips, input.release);
  const situationsEnabled = releaseId !== null && /^\d{5}$/.test(input.fips);
  const situationsQuery = useSurveillanceSituations(
    input.fips,
    releaseId,
    situationsEnabled
  );
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
      phase: situationsPhase(input.release, input.fips, situationsQuery),
      release: input.release,
      result: situationsQuery.isSuccess ? situationsQuery.data : null,
    },
    tier1: {
      errorStatus: errorStatus(tier1Query.error),
      phase: tier1Phase(input.release, tier1Query),
      release: input.release,
      result: tier1Query.isSuccess ? tier1Query.data : null,
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
