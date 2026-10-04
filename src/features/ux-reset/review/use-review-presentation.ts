"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  buildReviewScopePresentation,
  type ReviewScopePresentation,
} from "@/features/ux-reset/review/build-review-presentation";
import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import { metadataV1AtlasMetadataGet, scoresV1AtlasScoresGet } from "@/generated/atlas";
import {
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { ScoreSettings } from "@/lib/atlas-ui";

type ReviewPresentationState = {
  presentation: ReviewScopePresentation | null;
  requestScope: ReviewScope | null;
};

const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

/** Loads governed county scores and projects them for the active Review scope. */
export function useReviewPresentation(scope: ReviewScope) {
  const [scoped, setScoped] = useState<ReviewPresentationState>({
    presentation: null,
    requestScope: null,
  });

  const metadataQuery = useQuery({
    queryFn: async ({ signal }) =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (await metadataV1AtlasMetadataGet(undefined, { signal })).data
      ),
    queryKey: ["ux-reset-review-metadata"],
  });

  const releaseId = metadataQuery.data?.release_id;

  const scoresQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async ({ signal }) =>
      validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        (
          await scoresV1AtlasScoresGet(
            { dataset_version: releaseId, ...DEFAULT_SCORE_SETTINGS },
            { signal }
          )
        ).data
      ),
    queryKey: ["ux-reset-review-scores", releaseId, DEFAULT_SCORE_SETTINGS],
  });

  useEffect(() => {
    if (!scoresQuery.data) {
      setScoped({ presentation: null, requestScope: null });
      return;
    }
    setScoped({
      presentation: buildReviewScopePresentation(
        scope,
        scoresQuery.data.counties
      ),
      requestScope: scope,
    });
  }, [scope, scoresQuery.data]);

  const isLoading = metadataQuery.isPending || scoresQuery.isPending;
  const isError = metadataQuery.isError || scoresQuery.isError;

  const presentationMatchesScope =
    scoped.presentation !== null && scoped.requestScope === scope;

  return {
    isError,
    isLoading,
    metadata: metadataQuery.data,
    presentation: presentationMatchesScope ? scoped.presentation : null,
    requestScope: presentationMatchesScope ? scoped.requestScope : null,
    scoresQuery,
  };
}
