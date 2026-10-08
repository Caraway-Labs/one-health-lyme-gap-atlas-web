import { ATLAS_OVERVIEW_PATH } from "@/lib/navigation";

const FIPS_PATTERN = /^\d{5}$/;

export const ANALYTICAL_NAVIGATION_PATHS = [
  ATLAS_OVERVIEW_PATH,
  "/geographic_explorer",
  "/investigate",
] as const;

export type AnalyticalNavigationPath =
  (typeof ANALYTICAL_NAVIGATION_PATHS)[number];

const ANALYTICAL_NAVIGATION_PATH_SET = new Set<string>(
  ANALYTICAL_NAVIGATION_PATHS
);

/** Shared URL state across Overview and Investigation Workspace. */
export const OVERVIEW_INVESTIGATE_HANDOFF_PARAMS = [
  "breakpoint",
  "compare",
  "county",
  "dataset",
  "eco",
  "evidence",
  "missing",
  "q",
  "state",
] as const;

/** Geographic Explorer route-specific parameters (not invented on other routes). */
export const GEOGRAPHIC_EXPLORER_HANDOFF_PARAMS = [
  "metric",
  "page",
  "selected",
  "view",
] as const;

type SearchParamSource = Pick<URLSearchParams, "getAll" | "has">;

export function isAnalyticalNavigationPath(
  pathname: string
): pathname is AnalyticalNavigationPath {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  return ANALYTICAL_NAVIGATION_PATH_SET.has(normalized);
}

function allowedHandoffParamsForTarget(
  targetPath: AnalyticalNavigationPath
): readonly string[] {
  if (targetPath === "/geographic_explorer") {
    return [
      ...OVERVIEW_INVESTIGATE_HANDOFF_PARAMS,
      ...GEOGRAPHIC_EXPLORER_HANDOFF_PARAMS,
    ];
  }
  return OVERVIEW_INVESTIGATE_HANDOFF_PARAMS;
}

function shouldCopyParam(key: string, value: string): boolean {
  if (key === "county") {
    return FIPS_PATTERN.test(value);
  }
  if (key === "dataset") {
    return value.trim().length > 0;
  }
  return value.length > 0;
}

/**
 * Build the query string for primary navigation between analytical routes.
 * Copies only parameters the target route understands; never fabricates
 * cross-route filter equivalence.
 */
export function analyticalNavigationHandoffSearchParams(
  sourcePathname: string,
  targetPathname: string,
  sourceSearchParams: SearchParamSource
): URLSearchParams {
  if (
    !isAnalyticalNavigationPath(sourcePathname) ||
    !isAnalyticalNavigationPath(targetPathname)
  ) {
    return new URLSearchParams();
  }

  const allowed = new Set(allowedHandoffParamsForTarget(targetPathname));
  const handoff = new URLSearchParams();

  for (const key of allowed) {
    if (!sourceSearchParams.has(key)) continue;
    for (const value of sourceSearchParams.getAll(key)) {
      if (!shouldCopyParam(key, value)) continue;
      handoff.append(key, value);
    }
  }

  return handoff;
}

export function analyticalNavigationHref(
  targetHref: string,
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): string {
  const targetPath = targetHref.split(/[?#]/, 1)[0] || "/";
  if (!isAnalyticalNavigationPath(targetPath)) {
    return targetHref;
  }

  const handoff = analyticalNavigationHandoffSearchParams(
    sourcePathname,
    targetPath,
    sourceSearchParams
  );
  const serialized = handoff.toString();
  return serialized ? `${targetPath}?${serialized}` : targetPath;
}
