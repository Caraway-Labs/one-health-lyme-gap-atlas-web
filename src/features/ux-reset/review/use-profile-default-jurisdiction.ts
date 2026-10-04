"use client";

import { useQuery } from "@tanstack/react-query";

import { getProfileV1MeProfileGet } from "@/generated/atlas";

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
        return { stateCode: null } satisfies ProfileDefaultJurisdiction;
      }
      const code = result.data.profile?.state_code?.trim().toUpperCase() ?? null;
      return {
        stateCode: code && code.length === 2 ? code : null,
      } satisfies ProfileDefaultJurisdiction;
    },
    queryKey: ["ux-reset-profile-default-jurisdiction"],
    retry: false,
    staleTime: 60_000,
  });
}
