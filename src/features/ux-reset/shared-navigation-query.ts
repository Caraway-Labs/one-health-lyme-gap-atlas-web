import type { ResetRoute } from "@/features/ux-reset/paths";
import { resetNavigationHref } from "@/features/ux-reset/paths";

/**
 * Workspace context preserved when navigating between /app routes until the
 * shared-context contract (issue 408) lands in a dedicated module.
 */
export const RESET_SHARED_QUERY_KEYS = [
  "scope",
  "county",
  "compare",
  "dataset",
  "period",
] as const;

export type ResetSharedQueryKey = (typeof RESET_SHARED_QUERY_KEYS)[number];

export function pickResetSharedSearchParams(
  search: string | URLSearchParams
): URLSearchParams {
  const source =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : new URLSearchParams([...search.entries()]);
  const picked = new URLSearchParams();
  for (const key of RESET_SHARED_QUERY_KEYS) {
    const value = source.get(key);
    if (value !== null) {
      picked.set(key, value);
    }
  }
  return picked;
}

export function appendSharedSearchParams(
  href: string,
  shared: URLSearchParams
): string {
  if ([...shared.keys()].length === 0) {
    return href;
  }
  const [path, existingQuery = ""] = href.split("?");
  const merged = new URLSearchParams(existingQuery);
  for (const [key, value] of shared.entries()) {
    merged.set(key, value);
  }
  const query = merged.toString();
  return query ? `${path}?${query}` : path;
}

/** Single seam for shell navigation: route target plus shared query context. */
export function resetShellNavigationHref(
  route: ResetRoute,
  currentSearch: string
): string {
  const base = resetNavigationHref(route);
  const shared = pickResetSharedSearchParams(currentSearch);
  return appendSharedSearchParams(base, shared);
}
