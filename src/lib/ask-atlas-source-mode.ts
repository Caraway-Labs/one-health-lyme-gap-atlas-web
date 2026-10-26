/**
 * Explicit Ask Atlas source modes.
 *
 * Production smoke on 2026-10-25 showed all three endpoints accept a bounded
 * request and return a Zod-valid body. `POST /v1/assistant/mixed` with
 * `source_mode: "Both"` does not route an arbitrary question: an unrecognized
 * question returns `NEEDS_CLARIFICATION` and an empty `actual_sources_used`.
 * There is no verified automatic mode. Do not label a fixed choice as automatic.
 */
export const ASK_ATLAS_SOURCE_MODES = [
  "Literature",
  "Structured",
  "Both",
] as const;

export type AskAtlasSourceMode = (typeof ASK_ATLAS_SOURCE_MODES)[number];

/** Modes whose production responses were safely consumable. */
export const ASK_ATLAS_ENABLED_SOURCE_MODES = [
  "Literature",
  "Structured",
  "Both",
] as const satisfies readonly AskAtlasSourceMode[];

export function isEnabledAskAtlasSourceMode(
  value: string
): value is AskAtlasSourceMode {
  return (ASK_ATLAS_ENABLED_SOURCE_MODES as readonly string[]).includes(value);
}

export const ASK_ATLAS_SOURCE_MODE_BADGE: Record<AskAtlasSourceMode, string> = {
  Both: "Literature and governed Atlas data",
  Literature: "Reviewed literature",
  Structured: "Governed Atlas data",
};

export function askAtlasPendingStatus(mode: AskAtlasSourceMode): string {
  switch (mode) {
    case "Literature": {
      return "Searching reviewed evidence…";
    }
    case "Structured": {
      return "Searching governed Atlas data…";
    }
    case "Both": {
      return "Searching governed Atlas data and reviewed literature…";
    }
    default: {
      const unhandled: never = mode;
      return unhandled;
    }
  }
}
