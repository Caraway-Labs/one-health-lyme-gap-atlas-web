import {
  presentTier1SurveillancePriority,
  type Tier1ActiveRelease,
  type Tier1SurveillancePriorityView,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "../../tests/fixtures/tier1-surveillance-priority";
import { syntheticCounty, syntheticReleaseId } from "./synthetic-county";

export const tier1StoryPresetIds = [
  "high-sufficient",
  "medium-sufficient",
  "low-insufficient",
  "not-estimable",
  "unavailable",
  "loading",
  "failed",
  "stale",
  "release-unknown",
  "release-mismatch",
] as const;

export type Tier1StoryPresetId = (typeof tier1StoryPresetIds)[number];

const requestedFips = syntheticCounty.fips;
const storyRelease: Tier1ActiveRelease = {
  releaseId: syntheticReleaseId,
  status: "ready",
};

function storyCountyResult(
  result: Tier1CountyPriority,
  fips: string
): Tier1CountyPriority {
  return tier1PriorityForRelease(
    tier1PriorityForCounty(result, fips),
    syntheticReleaseId
  );
}

function notEstimable(fips: string): Tier1CountyPriority {
  return storyCountyResult(
    {
      ...tier1HighSufficientFixture,
      evidence_sufficiency: "NOT_ESTIMABLE",
      priority_percentile: null,
      priority_tier: null,
      raw_model_score: null,
      reasons: [],
    },
    fips
  );
}

export function tier1StoryView(
  preset: Tier1StoryPresetId
): Tier1SurveillancePriorityView {
  switch (preset) {
    case "high-sufficient": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: storyCountyResult(tier1HighSufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "medium-sufficient": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: storyCountyResult(tier1MediumSufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "low-insufficient": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: storyCountyResult(tier1LowInsufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "not-estimable": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: notEstimable(requestedFips),
        status: "success",
      });
    }
    case "unavailable": {
      return presentTier1SurveillancePriority({
        errorStatus: 404,
        release: storyRelease,
        requestedFips,
        result: null,
        status: "error",
      });
    }
    case "loading": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: null,
        status: "loading",
      });
    }
    case "failed": {
      return presentTier1SurveillancePriority({
        errorStatus: 500,
        release: storyRelease,
        requestedFips,
        result: null,
        status: "error",
      });
    }
    case "stale": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: storyCountyResult(tier1HighSufficientFixture, "08013"),
        status: "success",
      });
    }
    case "release-unknown": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: { status: "unknown" },
        requestedFips,
        result: storyCountyResult(tier1HighSufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "release-mismatch": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        release: storyRelease,
        requestedFips,
        result: tier1PriorityForCounty(
          tier1HighSufficientFixture,
          requestedFips
        ),
        status: "success",
      });
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
