import type { AtlasStateOption } from "@/lib/atlas-state-geography";

/**
 * Supported Review states for stories. Alaska and Hawaii are out of scope.
 * North Carolina is included so a long label can wrap.
 */
export const storyReleaseStates = [
  { code: "CO", name: "Colorado" },
  { code: "DC", name: "District of Columbia" },
  { code: "NC", name: "North Carolina" },
  { code: "NY", name: "New York" },
] as const satisfies readonly AtlasStateOption[];
