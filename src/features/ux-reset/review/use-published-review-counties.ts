"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchExploreCountyDirectory } from "@/features/ux-reset/explore/load-explore-resources";
import { reviewCandidateFipsForScope } from "@/features/ux-reset/review/review-operating-state";

/** Identity only: published scores never become browser recommendations. */
export function usePublishedReviewCounties(
  scope: string,
  releaseId: string | null
) {
  const query = useQuery({
    enabled: Boolean(releaseId) && scope !== "ALL",
    queryKey: ["ux-reset-review-county-directory", releaseId],
    queryFn: ({ signal }) => {
      if (!releaseId) {
        throw new Error("County directory requires a release.");
      }
      return fetchExploreCountyDirectory(releaseId, signal);
    },
  });
  const counties =
    query.isError || !releaseId
      ? []
      : (query.data ?? [])
          .filter(
            (entry) =>
              entry.state === scope &&
              reviewCandidateFipsForScope(entry.fips, scope) === entry.fips
          )
          .toSorted(
            (left, right) =>
              left.county.localeCompare(right.county, "en") ||
              left.fips.localeCompare(right.fips)
          );
  return {
    counties,
    isError: query.isError,
    isLoading: Boolean(releaseId) && query.isPending,
    isSuccess: Boolean(releaseId) && query.isSuccess,
  };
}
