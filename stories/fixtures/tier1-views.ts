import {
  presentTier1SurveillancePriority,
  type Tier1SurveillancePriorityView,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
} from "../../tests/fixtures/tier1-surveillance-priority";
import { syntheticCounty } from "./synthetic-county";

export const tier1StoryPresetIds = [
  "high-sufficient",
  "medium-sufficient",
  "low-insufficient",
  "not-estimable",
  "unavailable",
  "loading",
  "failed",
  "stale",
  "unverified",
] as const;

export type Tier1StoryPresetId = (typeof tier1StoryPresetIds)[number];

const requestedFips = syntheticCounty.fips;

function storyCountyResult(
  result: Tier1CountyPriority,
  fips: string
): Tier1CountyPriority {
  return tier1PriorityForCounty(result, fips);
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
        requestedFips,
        result: storyCountyResult(tier1HighSufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "medium-sufficient": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: storyCountyResult(tier1MediumSufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "low-insufficient": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: storyCountyResult(tier1LowInsufficientFixture, requestedFips),
        status: "success",
      });
    }
    case "not-estimable": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: notEstimable(requestedFips),
        status: "success",
      });
    }
    case "unavailable": {
      return presentTier1SurveillancePriority({
        errorStatus: 404,
        requestedFips,
        result: null,
        status: "error",
      });
    }
    case "loading": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: null,
        status: "loading",
      });
    }
    case "failed": {
      return presentTier1SurveillancePriority({
        errorStatus: 500,
        requestedFips,
        result: null,
        status: "error",
      });
    }
    case "stale": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: storyCountyResult(tier1HighSufficientFixture, "08013"),
        status: "success",
      });
    }
    case "unverified": {
      return presentTier1SurveillancePriority({
        errorStatus: null,
        requestedFips,
        result: null,
        status: "error",
        unverified: true,
      });
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
