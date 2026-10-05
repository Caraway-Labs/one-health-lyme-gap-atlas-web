/**
 * UX Reset route path authority for cross-page context (issues 406, 408).
 * Shell navigation metadata (labels, icons) lives in the shell PR; path strings
 * are defined here so handoff and the shell stay aligned.
 */

export const UX_RESET_APP_PREFIX = "/app" as const;

export const DOCS_PATH = "/docs" as const;

export const RESET_REVIEW_PATH = `${UX_RESET_APP_PREFIX}/review` as const;
export const RESET_EXPLORE_PATH = `${UX_RESET_APP_PREFIX}/explore` as const;
export const RESET_INVESTIGATE_PATH =
  `${UX_RESET_APP_PREFIX}/investigate` as const;
export const RESET_COMPARE_PATH = `${UX_RESET_APP_PREFIX}/compare` as const;
export const RESET_ACTION_PATH = `${UX_RESET_APP_PREFIX}/action` as const;
export const RESET_ASSISTANT_PATH = `${UX_RESET_APP_PREFIX}/assistant` as const;
export const RESET_FEED_PATH = `${UX_RESET_APP_PREFIX}/feed` as const;
export const RESET_SETTINGS_PATH = `${UX_RESET_APP_PREFIX}/settings` as const;

/**
 * Authenticated trust page. It is not a workspace destination, so it stays
 * out of cross-page context handoff (issues 403, 406, 433).
 */
export const RESET_AI_RESPONSIBLE_USE_PATH =
  `${UX_RESET_APP_PREFIX}/ai-responsible-use` as const;

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
  review: RESET_REVIEW_PATH,
  settings: RESET_SETTINGS_PATH,
};

const UX_RESET_ROUTE_PATH_SET = new Set<string>(
  Object.values(UX_RESET_ROUTE_PATHS)
);

export function uxResetDestinationFromPath(
  pathname: string
): UxResetDestinationId | null {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  for (const id of UX_RESET_DESTINATION_IDS) {
    if (UX_RESET_ROUTE_PATHS[id] === normalized) {
      return id;
    }
  }
  return null;
}

export function isUxResetRoutePath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  return UX_RESET_ROUTE_PATH_SET.has(normalized);
}
