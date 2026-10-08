"use client";

import { useQuery } from "@tanstack/react-query";

import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import { isLower48ReviewScope } from "@/features/ux-reset/review/review-state-fips";
import { stateReviewV1StatesStateReviewGet } from "@/generated/atlas";
import { StateReviewV1StatesStateReviewGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

function reviewErrorMessage(error: unknown): string {
  if (error instanceof AtlasApiError) {
    return error.message;
  }
  return "Unable to load the state review result.";
}

/**
 * Loads the authoritative state review for one already resolved release.
 * National scope does not aggregate a review, and an unresolved release
 * does not start a second default-release request.
 */
export function useStateReview(
  scope: ReviewScope,
  resolvedRelease: string | null
) {
  const enabled = isLower48ReviewScope(scope) && Boolean(resolvedRelease);
  const query = useQuery({
    enabled,
    queryFn: async ({ signal }) => {
      if (!resolvedRelease) {
        throw new Error("State review requires a resolved release.");
      }
      const response = await stateReviewV1StatesStateReviewGet(
        scope,
        { dataset_version: resolvedRelease },
        { signal }
      );
      if (response.status !== 200) {
        throw new AtlasApiError(
          "State review is temporarily unavailable.",
          `/v1/states/${scope}/review`,
          response.status,
          null
        );
      }
      const review = validateApiResponse(
        "State review",
        StateReviewV1StatesStateReviewGetResponse,
        response.data
      );
      if (review.requested_state !== scope) {
        throw new AtlasApiError(
          "State review response did not match the requested state.",
          `/v1/states/${scope}/review`,
          response.status,
          null
        );
      }
      if (review.data_release_version !== resolvedRelease) {
        throw new AtlasApiError(
          "State review response did not match the requested release.",
          `/v1/states/${scope}/review`,
          response.status,
          null
        );
      }
      return review;
    },
    queryKey: ["ux-reset-state-review", scope, resolvedRelease],
  });

  const review =
    query.data &&
    query.data.requested_state === scope &&
    query.data.data_release_version === resolvedRelease
      ? query.data
      : null;

  return {
    errorMessage: query.isError ? reviewErrorMessage(query.error) : null,
    isError: enabled && query.isError,
    isLoading: enabled && query.isPending,
    review,
  };
}
