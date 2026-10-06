import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import { RESET_ASSISTANT_PATH } from "@/features/ux-reset/routes";

type SearchParamSource = Pick<URLSearchParams, "get" | "getAll" | "has">;

/**
 * Sidecar handoff into the reset research workspace.
 * Shared county and dataset follow the reset handoff matrix. `conversation`
 * is page-local and is added only for this explicit link.
 */
export function resetAskAtlasWorkspaceHref(
  sourcePathname: string,
  sourceSearchParams: SearchParamSource,
  conversationId?: string
): string {
  const base = uxResetShellHandoffHref(
    RESET_ASSISTANT_PATH,
    sourcePathname,
    sourceSearchParams
  );
  if (!conversationId) {
    return base;
  }
  const url = new URL(base, "https://atlas.local");
  url.searchParams.set("conversation", conversationId);
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
