"use client";

import { useQuery } from "@tanstack/react-query";

import { getAtlasScores } from "@/generated/atlas";
import { GetAtlasScoresResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { ScoreSettings } from "@/lib/atlas-ui";

/** Same defaults Review already uses when it requests published scores. */
export const EXPLORER_SCORE_SETTINGS: ScoreSettings = {
  ecological_share: 65,
  smooth_k: 50,
  missing_human_weakness: 75,
};

export function useExplorerMapScores(releaseId: string | null) {
  return useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) => {
      if (!releaseId) {
        throw new Error("Map colors require a release.");
      }
      const response = await getAtlasScores(
        { dataset_version: releaseId, ...EXPLORER_SCORE_SETTINGS },
        { signal }
      );
      return validateApiResponse(
        "Atlas scores",
        GetAtlasScoresResponse,
        response.data
      );
    },
    queryKey: ["ux-reset-review-scores", releaseId, EXPLORER_SCORE_SETTINGS],
  });
}
