import type { AtlasStateOption } from "@/lib/atlas-state-geography";

import {
  buildProfileWrite,
  type ProfileWriteBuild,
  type SavedProfile,
} from "../profile/default-jurisdiction-contract";
import { isLower48ReviewScope } from "../review/review-state-fips";
import { ATLAS_EXPLORER_PATH } from "../routes";

export const STARTING_VIEW_PATH = "/auth/starting-view";
export const STARTING_VIEW_CONTINUE_PATH = "/auth/continue";

export function isStartingViewComplete(
  profile: SavedProfile | null | undefined
): boolean {
  return profile?.startingViewVersion === 1;
}

/** A present safe internal path. An absent or unsafe value is not a destination. */
export function explicitInternalDestination(
  value: string | null
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }
  return value;
}

export function continueHref(requested: string | null): string {
  const destination = explicitInternalDestination(requested);
  if (!destination) {
    return STARTING_VIEW_CONTINUE_PATH;
  }
  return `${STARTING_VIEW_CONTINUE_PATH}?next=${encodeURIComponent(destination)}`;
}

/**
 * Completed accounts keep a safe explicit destination. Otherwise Atlas Explorer
 * opens without a scope so the saved starting view applies. Incomplete accounts
 * always finish on that same Explorer path after a confirmed save.
 */
export function destinationAfterStartingView(
  profile: SavedProfile,
  requested: string | null
): string {
  if (!isStartingViewComplete(profile)) {
    return ATLAS_EXPLORER_PATH;
  }
  return explicitInternalDestination(requested) ?? ATLAS_EXPLORER_PATH;
}

/** United States is separate. One state is a lower-48 state or the District of Columbia. */
export function startingViewStateOptions(
  options: readonly AtlasStateOption[]
): AtlasStateOption[] {
  return options.filter((option) => isLower48ReviewScope(option.code));
}

export function startingViewCompletionConfirmed(
  profile: SavedProfile,
  stateCode: string | null
): boolean {
  if (!isStartingViewComplete(profile)) {
    return false;
  }
  if (stateCode === null) {
    return profile.selection.kind === "national";
  }
  return (
    profile.selection.kind === "state" &&
    profile.selection.stateCode === stateCode
  );
}

export function buildStartingViewCompletionWrite(
  existing: SavedProfile | null,
  jurisdiction: "national" | { stateCode: string },
  stateOptions: readonly AtlasStateOption[]
): ProfileWriteBuild {
  const built = buildProfileWrite(
    {
      jobTitle: existing?.jobTitle ?? "",
      jurisdiction,
      organization: existing?.organization ?? "",
      role: existing?.role ?? null,
    },
    stateOptions
  );
  if (!built.ok) {
    return built;
  }
  return {
    body: { ...built.body, complete_starting_view: true },
    ok: true,
  };
}
