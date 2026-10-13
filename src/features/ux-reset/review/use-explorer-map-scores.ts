"use client";

import { useQuery } from "@tanstack/react-query";

import { explorerMapLayerById } from "@/features/ux-reset/review/explorer-map-layers";
import { scoresV1AtlasScoresGet } from "@/generated/atlas";
import { ScoresV1AtlasScoresGetResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { ScoreSettings } from "@/lib/atlas-ui";

/** Same defaults Review already uses when it requests published scores. */
export const EXPLORER_SCORE_SETTINGS: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

export function useExplorerMapScores(
  releaseId: string | null,
  layerId: string
) {
  const layer = explorerMapLayerById(layerId);
  return useQuery({
    enabled: Boolean(releaseId) && layer.needsScores,
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Map colors require a release.");
      }
      return validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        (
          await scoresV1AtlasScoresGet(
            { dataset_version: releaseId, ...EXPLORER_SCORE_SETTINGS },
            { signal }
          )
        ).data
      );
    },
    queryKey: ["ux-reset-review-scores", releaseId, EXPLORER_SCORE_SETTINGS],
  });
}
