"use client";

import { useQuery } from "@tanstack/react-query";

import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import { stateReviewV1StatesStateReviewGet } from "@/generated/atlas";
import { StateReviewV1StatesStateReviewGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

const STATE_SCOPE = /^[A-Z]{2}$/;

function reviewErrorMessage(error: unknown): string {
  if (error instanceof AtlasApiError) {
    return error.message;
  }
  return "Unable to load the state review result.";
}

/** Loads the authoritative state review result. National scope does not aggregate one. */
export function useStateReview(
  scope: ReviewScope,
  requestedDataset: string | null
) {
  const enabled = STATE_SCOPE.test(scope);
  const query = useQuery({
    enabled,
    queryFn: async ({ signal }) => {
      const response = await stateReviewV1StatesStateReviewGet(
        scope,
        requestedDataset ? { dataset_version: requestedDataset } : undefined,
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
      return review;
    },
    queryKey: ["ux-reset-state-review", scope, requestedDataset],
  });

  const review =
    query.data && query.data.requested_state === scope ? query.data : null;

  return {
    errorMessage: query.isError ? reviewErrorMessage(query.error) : null,
    isError: enabled && query.isError,
    isLoading: enabled && query.isPending,
    review,
  };
}
