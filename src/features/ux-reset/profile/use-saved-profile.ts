"use client";

import {
  CancelledError,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { SavedProfile } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import {
  readSavedProfile,
  SavedProfileClientError,
} from "@/features/ux-reset/profile/saved-profile-client";

export const savedProfileQueryKey = ["ux-reset-saved-profile"] as const;

export function useSavedProfile(): UseQueryResult<SavedProfile> {
  return useQuery({
    queryFn: async ({ signal }) => {
      try {
        return await readSavedProfile(signal);
      } catch (error) {
        if (
          error instanceof SavedProfileClientError &&
          error.code === "superseded"
        ) {
          throw new CancelledError({ revert: true });
        }
        throw error;
      }
    },
    queryKey: savedProfileQueryKey,
    retry: false,
    staleTime: 60_000,
  });
}
