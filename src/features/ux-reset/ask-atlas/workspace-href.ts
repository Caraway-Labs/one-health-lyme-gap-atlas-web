import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import { RESET_ASSISTANT_PATH } from "@/features/ux-reset/routes";

type SearchParamSource = Pick<URLSearchParams, "get" | "getAll" | "has">;

/** Obsolete Ask Atlas page-reference query. Old links may still carry it. */
export const OBSOLETE_ASK_ATLAS_PAGE_REFERENCE_PARAM = "page_ref";

const ACCEPTED_PAGE_REFERENCE_STORAGE_KEY =
  "one-health-lyme-gap-atlas:ask-atlas-accepted-page-reference:v1";

/**
 * Explicit handoff into the reset Ask Atlas page.
 * Shared county and dataset follow the reset handoff matrix. `conversation`
 * is page-local and is added only when a saved conversation is selected.
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

/**
 * Drop every obsolete `page_ref` value and keep every other parameter,
 * including `conversation`. The result is a path, query, and hash.
 */
export function hrefWithoutObsoleteAskAtlasPageReference(href: string): string {
  const url = new URL(href, "https://atlas.local");
  url.searchParams.delete(OBSOLETE_ASK_ATLAS_PAGE_REFERENCE_PARAM);
  const query = url.searchParams.toString();
  const next = query ? `${url.pathname}?${query}` : url.pathname;
  return `${next}${url.hash}`;
}

/** Remove a bookmarked page reference from the address bar and this browser. */
export function replaceObsoleteAskAtlasPageReference(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(ACCEPTED_PAGE_REFERENCE_STORAGE_KEY);
  } catch {
    // The panel is gone either way. A blocked store can keep the old snapshot.
  }
  const next = hrefWithoutObsoleteAskAtlasPageReference(window.location.href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) {
    return;
  }
  window.history.replaceState(window.history.state, "", next);
}
