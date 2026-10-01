const ASSISTANT_WORKSPACE_PATH = "/assistant";

/**
 * Literature Atlas Assistant is gated by the public knowledge-graph chat flag.
 */
export function isAtlasAssistantLiteratureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true";
}

/**
 * Product decision (GitHub issue 335): when literature chat is enabled, the floating
 * launcher is the primary entry for in-flow questions; the sidebar link appears
 * only on the full `/assistant` workspace for wayfinding. When chat is
 * disabled, the sidebar shows the bounded Coming Soon destination and the
 * launcher is not rendered.
 */
export function shouldShowAssistantInPrimaryNavigation(
  pathname: string,
  literatureEnabled: boolean = isAtlasAssistantLiteratureEnabled()
): boolean {
  if (!literatureEnabled) {
    return true;
  }
  return pathname === ASSISTANT_WORKSPACE_PATH;
}

export function shouldShowAtlasAssistantLauncher(
  pathname: string,
  literatureEnabled: boolean = isAtlasAssistantLiteratureEnabled()
): boolean {
  if (!literatureEnabled) {
    return false;
  }
  return pathname !== ASSISTANT_WORKSPACE_PATH;
}

export function assistantNavigationStatusLabel(
  literatureEnabled: boolean = isAtlasAssistantLiteratureEnabled()
): string {
  return literatureEnabled ? "Early access" : "Coming Soon";
}

export const ATLAS_ASSISTANT_LAUNCHER_LABEL = "Atlas Assistant";

export function atlasAssistantLauncherAccessibleName(
  literatureEnabled: boolean = isAtlasAssistantLiteratureEnabled()
): string {
  return literatureEnabled
    ? `${ATLAS_ASSISTANT_LAUNCHER_LABEL}, early access`
    : ATLAS_ASSISTANT_LAUNCHER_LABEL;
}
