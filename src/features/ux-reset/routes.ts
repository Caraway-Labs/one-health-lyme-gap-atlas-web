/**
 * UX Reset route path authority for cross-page context (issues 406, 408).
 * Shell navigation metadata (labels, icons) lives in the shell PR; path strings
 * are defined here so handoff and the shell stay aligned.
 */

export const UX_RESET_APP_PREFIX = "/app" as const;

export const DOCS_PATH = "/docs" as const;

/**
 * Public About Caraway Labs page (issue 523). The professional trust footer
 * links here and opens it in a new tab.
 */
export const ABOUT_CARAWAY_LABS_PATH = "/about/caraway-labs" as const;

/** Former Atlas Explorer path. Permanently redirects to `ATLAS_EXPLORER_PATH`. */
export const RESET_REVIEW_PATH = `${UX_RESET_APP_PREFIX}/review` as const;

/**
 * Canonical Atlas Explorer URL (issue 608).
 * The display name is Atlas Explorer. Compatibility redirects live in the
 * recorded workspace map and are installed from middleware.
 */
export const ATLAS_EXPLORER_PATH = "/explore" as const;
export const RESET_EXPLORE_PATH = `${UX_RESET_APP_PREFIX}/explore` as const;
export const RESET_INVESTIGATE_PATH =
  `${UX_RESET_APP_PREFIX}/investigate` as const;
/** Former Compare path. Permanently redirects to `RESET_COMPARE_PATH`. */
export const LEGACY_COMPARE_PATH = `${UX_RESET_APP_PREFIX}/compare` as const;
/** Canonical Compare URL (issue 608). */
export const RESET_COMPARE_PATH = "/compare" as const;
export const RESET_ACTION_PATH = `${UX_RESET_APP_PREFIX}/action` as const;
/** Former Ask Atlas path. Permanently redirects to `RESET_ASSISTANT_PATH`. */
export const LEGACY_ASSISTANT_PATH =
  `${UX_RESET_APP_PREFIX}/assistant` as const;
/** Canonical Ask Atlas URL (issue 608). Distinct from the public `/assistant` route. */
export const RESET_ASSISTANT_PATH = "/askatlas" as const;
export const RESET_FEED_PATH = `${UX_RESET_APP_PREFIX}/feed` as const;
export const RESET_SETTINGS_PATH = `${UX_RESET_APP_PREFIX}/settings` as const;

/**
 * Canonical Data Provenance page (issue 657). It is not part of the
 * six-destination redirect map. Contextual provenance stays on the result.
 */
export const RESET_DATA_PROVENANCE_PATH = "/data-provenance" as const;

/** Public Resources hub. Reachable without a session, inside the professional shell. */
export const RESET_RESOURCES_PATH = "/resources" as const;

export const UX_RESET_DESTINATION_IDS = [
  "review",
  "explore",
  "investigate",
  "compare",
  "action",
  "assistant",
  "feed",
  "settings",
] as const;

export type UxResetDestinationId = (typeof UX_RESET_DESTINATION_IDS)[number];

export const UX_RESET_ROUTE_PATHS: Record<UxResetDestinationId, string> = {
  action: RESET_ACTION_PATH,
  assistant: RESET_ASSISTANT_PATH,
  compare: RESET_COMPARE_PATH,
  explore: RESET_EXPLORE_PATH,
  feed: RESET_FEED_PATH,
  investigate: RESET_INVESTIGATE_PATH,
  review: ATLAS_EXPLORER_PATH,
  settings: RESET_SETTINGS_PATH,
};

/**
 * Former canonical paths keep the destination's handoff contract so a link
 * built from a bookmarked `/app/*` URL still exports the same keys. Redirect
 * targets stay in the workspace migration module, not in this lookup.
 */
const LEGACY_UX_RESET_ROUTE_PATHS: Partial<
  Record<string, UxResetDestinationId>
> = {
  [LEGACY_ASSISTANT_PATH]: "assistant",
  [LEGACY_COMPARE_PATH]: "compare",
  [RESET_REVIEW_PATH]: "review",
};

function normalizeRoutePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function uxResetDestinationFromPath(
  pathname: string
): UxResetDestinationId | null {
  const normalized = normalizeRoutePathname(pathname);
  for (const id of UX_RESET_DESTINATION_IDS) {
    if (UX_RESET_ROUTE_PATHS[id] === normalized) {
      return id;
    }
  }
  return LEGACY_UX_RESET_ROUTE_PATHS[normalized] ?? null;
}

export function isUxResetRoutePath(pathname: string): boolean {
  return uxResetDestinationFromPath(pathname) !== null;
}
