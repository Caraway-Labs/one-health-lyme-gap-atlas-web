import { QueryClient } from "@tanstack/react-query";

import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountySurveillanceSituations } from "@/generated/models/countySurveillanceSituations";
import type { SituationVariant } from "@/generated/models/situationVariant";
import { SituationVariantAvailability } from "@/generated/models/situationVariantAvailability";
import { SituationVariantCompatibility } from "@/generated/models/situationVariantCompatibility";
import { SituationVariantUnavailableReason } from "@/generated/models/situationVariantUnavailableReason";

import {
  syntheticCounty,
  syntheticReleaseId,
} from "../fixtures/synthetic-county";

const SYNTHETIC_BUNDLE_SHA = "0123456789abcdef".repeat(4);
const FRESH_QUERY = {
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
} as const;

/**
 * In-memory score and situation results for the county preview catalog.
 * Storybook does not alias these clients, and an empty cache would request
 * `/v1/atlas/scores` and `/v1/counties/{fips}/surveillance-situations`.
 */
export function reviewPreviewQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const scoreKey = [
    "ux-reset-review-scores",
    syntheticReleaseId,
    EXPLORER_SCORE_SETTINGS,
  ];
  client.setQueryDefaults(scoreKey, FRESH_QUERY);
  client.setQueryData(scoreKey, {
    counties: [
      {
        color: "#55a8a3",
        fips: syntheticCounty.fips,
        in_contiguous_tick_scope: true,
        score: { score: 70 },
      },
    ],
    methodology_version: "synthetic-story-score",
    release_id: syntheticReleaseId,
  });
  const situationsKey = [
    "ux-reset-surveillance-situations",
    syntheticCounty.fips,
  ];
  client.setQueryDefaults(situationsKey, FRESH_QUERY);
  const situations = {
    bundle_sha256: SYNTHETIC_BUNDLE_SHA,
    county_fips: syntheticCounty.fips,
    four_state: unpublishedSituation("synthetic-four-state"),
    release_id: syntheticReleaseId,
    tick_pathogen: unpublishedSituation("synthetic-tick-pathogen"),
  } as const satisfies CountySurveillanceSituations;
  client.setQueryData(situationsKey, situations);
  return client;
}

function unpublishedSituation(modelId: string): SituationVariant {
  return {
    availability: SituationVariantAvailability.UNAVAILABLE,
    batch_id: null,
    batch_version: null,
    compatibility: SituationVariantCompatibility.UNAVAILABLE,
    data: null,
    input_release_id: null,
    model_id: modelId,
    unavailable_reason: SituationVariantUnavailableReason.NOT_PUBLISHED,
  };
}
