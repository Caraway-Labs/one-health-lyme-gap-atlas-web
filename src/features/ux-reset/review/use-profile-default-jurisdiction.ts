"use client";

import { useQuery } from "@tanstack/react-query";

import { getProfileV1MeProfileGet } from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

export type ProfileDefaultJurisdiction = {
  stateCode: string | null;
};

/**
 * Read-only profile jurisdiction for Review starting scope and Settings display.
 * Scope switching on Review must never call the profile save path.
 */
export function useProfileDefaultJurisdiction() {
  return useQuery({
    queryFn: async () => {
      const result = await getProfileV1MeProfileGet();
      if (result.status !== 200) {
        throw new AtlasApiError(
          "Your profile is temporarily unavailable.",
          "/v1/me/profile",
          result.status,
          null
        );
      }
      const code =
        result.data.profile?.state_code?.trim().toUpperCase() ?? null;
      return {
        stateCode: code && code.length === 2 ? code : null,
      } satisfies ProfileDefaultJurisdiction;
    },
    queryKey: ["ux-reset-profile-default-jurisdiction"],
    retry: false,
    staleTime: 60_000,
  });
}
