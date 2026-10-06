import {
  parseUxResetSharedContext,
  readExploreSelectedFips,
  sharedContextToSearchParams,
  UX_RESET_PAGE_LOCAL_PARAM_KEYS,
  UX_RESET_SHARED_CONTEXT_PARAM_KEYS,
  type UxResetSharedContext,
  type UxResetSharedContextParamKey,
} from "@/features/ux-reset/context-params";
import {
  isUxResetRoutePath,
  UX_RESET_ROUTE_PATHS,
  type UxResetDestinationId,
  uxResetDestinationFromPath,
} from "@/features/ux-reset/routes";

type SearchParamSource = Pick<URLSearchParams, "get" | "getAll" | "has">;

/**
 * Shared keys each destination may receive during cross-page handoff.
 * Keys omitted here are dropped explicitly when entering that route.
 */
export const UX_RESET_HANDOFF_ACCEPTANCE: Record<
  UxResetDestinationId,
  readonly UxResetSharedContextParamKey[]
> = {
  action: ["scope", "county", "compare", "dataset", "period"],
  assistant: ["county", "dataset"],
  compare: ["scope", "county", "compare", "dataset", "period"],
  explore: ["scope", "county", "dataset", "period"],
  feed: [],
  investigate: ["scope", "county", "compare", "dataset", "period"],
  review: ["scope", "county", "dataset", "period"],
  settings: [],
};

/**
 * Shared keys each source route may export during handoff.
 * Feed and Settings export nothing even if the URL contains query params.
 */
export const UX_RESET_HANDOFF_EXPORT: Record<
  UxResetDestinationId,
  readonly UxResetSharedContextParamKey[]
> = {
  action: [...UX_RESET_SHARED_CONTEXT_PARAM_KEYS],
  assistant: ["county", "dataset"],
  compare: [...UX_RESET_SHARED_CONTEXT_PARAM_KEYS],
  explore: [...UX_RESET_SHARED_CONTEXT_PARAM_KEYS],
  feed: [],
  investigate: [...UX_RESET_SHARED_CONTEXT_PARAM_KEYS],
  review: [...UX_RESET_SHARED_CONTEXT_PARAM_KEYS],
  settings: [],
};

export type UxResetHandoffResult = {
  /** Query keys copied onto the destination URL. */
  params: URLSearchParams;
  /** Shared or local keys present on the source but intentionally not copied. */
  dropped: string[];
};

function normalizePath(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0] || "/";
}

const ALL_TRACKED_SOURCE_KEYS = [
  ...UX_RESET_SHARED_CONTEXT_PARAM_KEYS,
  "selected",
  "view",
  "metric",
  "page",
  "map_scope",
  "evidence",
  "eco",
  "breakpoint",
  "missing",
  "q",
  "sort",
  "plan",
  "role",
  "conversation",
  "tab",
] as const;

function collectSourceKeys(
  searchParams: SearchParamSource,
  sourceDestination: UxResetDestinationId
): Set<string> {
  const keys = new Set<string>();
  for (const key of ALL_TRACKED_SOURCE_KEYS) {
    if (searchParams.has(key)) {
      keys.add(key);
    }
  }
  for (const key of UX_RESET_PAGE_LOCAL_PARAM_KEYS[sourceDestination]) {
    if (searchParams.has(key)) {
      keys.add(key);
    }
  }
  return keys;
}

function intersectHandoffKeys(
  sourceDestination: UxResetDestinationId,
  targetDestination: UxResetDestinationId
): UxResetSharedContextParamKey[] {
  const exported = new Set(UX_RESET_HANDOFF_EXPORT[sourceDestination]);
  return UX_RESET_HANDOFF_ACCEPTANCE[targetDestination].filter((key) =>
    exported.has(key)
  );
}

function contextWithExploreCompareFallback(
  context: UxResetSharedContext,
  sourceSearchParams: SearchParamSource,
  sourceDestination: UxResetDestinationId,
  handoffKeys: readonly UxResetSharedContextParamKey[]
): UxResetSharedContext {
  if (
    !handoffKeys.includes("compare") ||
    context.compare.length > 0 ||
    sourceDestination !== "explore"
  ) {
    return context;
  }
  const selected = readExploreSelectedFips(sourceSearchParams);
  if (selected.length === 0) {
    return context;
  }
  return { ...context, compare: selected };
}

function emptySharedContext(): UxResetSharedContext {
  return {
    compare: [],
    county: null,
    dataset: null,
    period: null,
    scope: "ALL",
  };
}

function pickSharedContext(
  context: UxResetSharedContext,
  keys: readonly UxResetSharedContextParamKey[]
): UxResetSharedContext {
  const allowed = new Set(keys);
  const next = emptySharedContext();
  if (allowed.has("scope")) {
    next.scope = context.scope;
  }
  if (allowed.has("county")) {
    next.county = context.county;
  }
  if (allowed.has("compare")) {
    next.compare = context.compare;
  }
  if (allowed.has("dataset")) {
    next.dataset = context.dataset;
  }
  if (allowed.has("period")) {
    next.period = context.period;
  }
  return next;
}

/**
 * Build destination query parameters for UX Reset shell navigation.
 * Parses and canonicalizes source context once, applies source export and
 * destination acceptance policies, then serializes one value per key.
 */
export function uxResetContextHandoffSearchParams(
  sourcePathname: string,
  targetPathname: string,
  sourceSearchParams: SearchParamSource
): UxResetHandoffResult {
  const sourcePath = normalizePath(sourcePathname);
  const targetPath = normalizePath(targetPathname);

  if (!isUxResetRoutePath(targetPath) || !isUxResetRoutePath(sourcePath)) {
    return { dropped: [], params: new URLSearchParams() };
  }

  const targetDestination = uxResetDestinationFromPath(targetPath);
  const sourceDestination = uxResetDestinationFromPath(sourcePath);
  if (!targetDestination || !sourceDestination) {
    return { dropped: [], params: new URLSearchParams() };
  }

  const handoffKeys = intersectHandoffKeys(
    sourceDestination,
    targetDestination
  );
  const sourceKeys = collectSourceKeys(sourceSearchParams, sourceDestination);

  if (handoffKeys.length === 0) {
    return {
      dropped: [...sourceKeys].sort(),
      params: new URLSearchParams(),
    };
  }

  const parsed = parseUxResetSharedContext(sourceSearchParams);
  const withCompare = contextWithExploreCompareFallback(
    parsed,
    sourceSearchParams,
    sourceDestination,
    handoffKeys
  );
  const handoffContext = pickSharedContext(withCompare, handoffKeys);
  const params = sharedContextToSearchParams(handoffContext, {
    keys: handoffKeys,
  });

  const copied = new Set<string>();
  for (const key of handoffKeys) {
    const exported =
      (key === "scope" && handoffContext.scope !== "ALL") ||
      (key === "county" && handoffContext.county !== null) ||
      (key === "compare" && handoffContext.compare.length > 0) ||
      (key === "dataset" && handoffContext.dataset !== null) ||
      (key === "period" && handoffContext.period !== null);
    if (exported) {
      copied.add(key);
    }
  }

  const dropped = [...sourceKeys].filter((key) => !copied.has(key)).sort();

  return { dropped, params };
}

/**
 * Primary handoff entry point for the authenticated UX Reset shell (issue 406).
 */
export function uxResetShellHandoffHref(
  targetHref: string,
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): string {
  const [targetPath, targetHash = ""] = targetHref.split("#");
  const pathOnly = normalizePath(targetPath);
  const { params } = uxResetContextHandoffSearchParams(
    sourcePathname,
    pathOnly,
    sourceSearchParams
  );
  const serialized = params.toString();
  const withQuery = serialized ? `${pathOnly}?${serialized}` : pathOnly;
  return targetHash ? `${withQuery}#${targetHash}` : withQuery;
}

/** @deprecated Use `uxResetShellHandoffHref` from the UX Reset shell. */
export function uxResetNavigationHref(
  targetHref: string,
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): string {
  return uxResetShellHandoffHref(
    targetHref,
    sourcePathname,
    sourceSearchParams
  );
}

export function uxResetDestinationHref(
  destination: UxResetDestinationId,
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): string {
  return uxResetShellHandoffHref(
    UX_RESET_ROUTE_PATHS[destination],
    sourcePathname,
    sourceSearchParams
  );
}
