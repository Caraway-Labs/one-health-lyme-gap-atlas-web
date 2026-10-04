/**
 * UX Reset professional workspace route contract (issue 406).
 * Central path metadata for shell navigation and cross-page context handoff (issue 408).
 */

export const UX_RESET_APP_PREFIX = "/app";

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
  action: `${UX_RESET_APP_PREFIX}/action`,
  assistant: `${UX_RESET_APP_PREFIX}/assistant`,
  compare: `${UX_RESET_APP_PREFIX}/compare`,
  explore: `${UX_RESET_APP_PREFIX}/explore`,
  feed: `${UX_RESET_APP_PREFIX}/feed`,
  investigate: `${UX_RESET_APP_PREFIX}/investigate`,
  review: `${UX_RESET_APP_PREFIX}/review`,
  settings: `${UX_RESET_APP_PREFIX}/settings`,
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
