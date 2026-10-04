import {
  readExploreSelectedFips,
  serializeCompareFipsList,
  UX_RESET_PAGE_LOCAL_PARAM_KEYS,
  UX_RESET_SHARED_CONTEXT_PARAM_KEYS,
  type UxResetSharedContextParamKey,
} from "@/features/ux-reset/context-params";
import {
  isUxResetRoutePath,
  UX_RESET_ROUTE_PATHS,
  type UxResetDestinationId,
  uxResetDestinationFromPath,
} from "@/features/ux-reset/routes";
import { isCountyFips } from "@/lib/county-geography";

const DATASET_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATE_SCOPE_PATTERN = /^[A-Z]{2}$/;

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
  investigate: ["scope", "county", "dataset", "period"],
  review: ["scope", "county", "dataset", "period"],
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

function shouldCopySharedValue(
  key: UxResetSharedContextParamKey,
  value: string
): boolean {
  switch (key) {
    case "scope": {
      return value === "ALL" || STATE_SCOPE_PATTERN.test(value);
    }
    case "county": {
      return isCountyFips(value);
    }
    case "compare": {
      return value.split(",").some((part) => isCountyFips(part.trim()));
    }
    case "dataset": {
      return DATASET_PATTERN.test(value);
    }
    case "period": {
      return ISO_DATE_PATTERN.test(value);
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
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
  sourceDestination: UxResetDestinationId | null
): Set<string> {
  const keys = new Set<string>();
  for (const key of ALL_TRACKED_SOURCE_KEYS) {
    if (searchParams.has(key)) {
      keys.add(key);
    }
  }
  if (sourceDestination) {
    for (const key of UX_RESET_PAGE_LOCAL_PARAM_KEYS[sourceDestination]) {
      if (searchParams.has(key)) {
        keys.add(key);
      }
    }
  }
  return keys;
}

function appendCompareFromSource(
  handoff: URLSearchParams,
  sourceSearchParams: SearchParamSource,
  sourceDestination: UxResetDestinationId | null
): void {
  if (handoff.has("compare")) {
    return;
  }
  if (sourceSearchParams.has("compare")) {
    for (const value of sourceSearchParams.getAll("compare")) {
      if (shouldCopySharedValue("compare", value)) {
        handoff.append("compare", value);
      }
    }
    return;
  }
  if (sourceDestination === "explore") {
    const selected = readExploreSelectedFips(sourceSearchParams);
    if (selected.length > 0) {
      handoff.set("compare", serializeCompareFipsList(selected));
    }
  }
}

/**
 * Build destination query parameters for UX Reset shell navigation.
 * Copies only semantically valid shared context; never promotes page-local controls.
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
  if (!targetDestination) {
    return { dropped: [], params: new URLSearchParams() };
  }

  const sourceDestination = uxResetDestinationFromPath(sourcePath);

  const accepted = new Set(UX_RESET_HANDOFF_ACCEPTANCE[targetDestination]);
  const handoff = new URLSearchParams();
  const sourceKeys = collectSourceKeys(sourceSearchParams, sourceDestination);
  const copied = new Set<string>();

  for (const key of UX_RESET_SHARED_CONTEXT_PARAM_KEYS) {
    if (!accepted.has(key) || !sourceSearchParams.has(key)) {
      continue;
    }
    for (const value of sourceSearchParams.getAll(key)) {
      if (!shouldCopySharedValue(key, value)) {
        continue;
      }
      handoff.append(key, value);
      copied.add(key);
    }
  }

  if (accepted.has("compare")) {
    appendCompareFromSource(handoff, sourceSearchParams, sourceDestination);
    if (handoff.has("compare")) {
      copied.add("compare");
    }
  }

  const dropped = [...sourceKeys].filter((key) => !copied.has(key)).sort();

  return { dropped, params: handoff };
}

export function uxResetNavigationHref(
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

export function uxResetDestinationHref(
  destination: UxResetDestinationId,
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): string {
  return uxResetNavigationHref(
    UX_RESET_ROUTE_PATHS[destination],
    sourcePathname,
    sourceSearchParams
  );
}
