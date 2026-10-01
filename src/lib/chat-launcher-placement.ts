const COUNTY_WORKSPACE_PATHS = new Set([
  "/geographic_explorer",
  "/investigate",
]);

export type ChatLauncherPlacement = "county-workspace" | "default";

export function chatLauncherPlacementForPath(
  pathname: string
): ChatLauncherPlacement {
  return COUNTY_WORKSPACE_PATHS.has(pathname) ? "county-workspace" : "default";
}
