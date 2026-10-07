"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildReviewScopePresentation } from "@/features/ux-reset/review/build-review-presentation";
import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import {
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import {
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { ScoreSettings } from "@/lib/atlas-ui";

const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

function metadataErrorMessage(error: unknown, requestedDataset: string | null) {
  if (error instanceof AtlasApiError) {
    if (requestedDataset) {
      return `The requested release "${requestedDataset}" is not available. ${error.message}`;
    }
    return error.message;
  }
  return "Unable to load governed release metadata for Review.";
}

/**
 * Loads governed release metadata. County scores stay optional so Review can
 * avoid a browser ranking when the state review result is authoritative.
 */
export function useReviewPresentation(
  scope: ReviewScope,
  requestedDataset: string | null,
  loadScores = true
) {
  const metadataQuery = useQuery({
    queryFn: async ({ signal }) => {
      const response = await metadataV1AtlasMetadataGet(
        requestedDataset ? { dataset_version: requestedDataset } : undefined,
        { signal }
      );
      if (response.status !== 200) {
        throw new AtlasApiError(
          requestedDataset
            ? `Release "${requestedDataset}" is not available.`
            : "Atlas metadata is temporarily unavailable.",
          "/v1/atlas/metadata",
          response.status,
          null
        );
      }
      return validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        response.data
      );
    },
    queryKey: ["ux-reset-review-metadata", requestedDataset],
  });

  const releaseId = metadataQuery.data?.release_id;

  const scoresQuery = useQuery({
    enabled: loadScores && Boolean(releaseId),
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

  const presentation = useMemo(() => {
    if (!(loadScores && scoresQuery.data)) {
      return null;
    }
    return buildReviewScopePresentation(scope, scoresQuery.data.counties);
  }, [loadScores, scope, scoresQuery.data]);

  const scoresQueryEnabled =
    loadScores && Boolean(releaseId) && !metadataQuery.isError;
  const isLoading =
    metadataQuery.isPending || (scoresQueryEnabled && scoresQuery.isPending);
  const metadataIsError = metadataQuery.isError;
  const scoresIsError = scoresQuery.isError;
  const metadataError = metadataIsError
    ? metadataErrorMessage(metadataQuery.error, requestedDataset)
    : null;

  return {
    isError: metadataIsError || scoresIsError,
    isLoading,
    metadata: metadataQuery.data,
    metadataError,
    metadataIsError,
    presentation,
    requestScope: presentation?.scope ?? null,
    scoresIsError,
    scoresQuery,
  };
}
