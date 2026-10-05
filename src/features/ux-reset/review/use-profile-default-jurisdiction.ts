"use client";

import { useSavedProfile } from "@/features/ux-reset/profile/use-saved-profile";

export type ProfileDefaultJurisdiction = {
  stateCode: string | null;
};

/**
 * Review starting scope reads the shared saved-profile adapter.
 * Scope switching on Review must never call the profile save path.
 * Null means there is no confirmed state default (unselected, national, or unrecognized).
 */
export function useProfileDefaultJurisdiction() {
  const query = useSavedProfile();
  const stateCode =
    query.data?.selection.kind === "state"
      ? query.data.selection.stateCode
      : null;
  return {
    ...query,
    data: query.data
      ? ({ stateCode } satisfies ProfileDefaultJurisdiction)
      : undefined,
  };
}
