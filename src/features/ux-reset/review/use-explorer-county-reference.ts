"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchExplorerCountyReference } from "@/features/ux-reset/review/load-explorer-county-reference";

/** Published lower-48 and DC counties for the Explorer toolbar. Scores stay on the server response. */
export function useExplorerCountyReference(releaseId: string | null) {
  const query = useQuery({
    enabled: Boolean(releaseId),
    queryFn: ({ signal }) => {
      if (!releaseId) {
        throw new Error("County reference requires a release.");
      }
      return fetchExplorerCountyReference(releaseId, signal);
    },
    queryKey: ["ux-reset-explorer-county-reference", releaseId],
  });
  return {
    counties: query.data ?? [],
    isError: query.isError,
    isLoading: Boolean(releaseId) && query.isPending,
    isSuccess: Boolean(releaseId) && query.isSuccess,
  };
}
