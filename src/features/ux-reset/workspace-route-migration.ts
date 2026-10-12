/**
 * Recorded six-page workspace route migration (#196).
 *
 * `recordedWorkspaceMigration` is the old→new map. It does not redirect,
 * rewrite history, or change navigation. Installing it is #197, after the
 * Explorer view (#413) and dedicated Ask Atlas page (#424) are ready.
 */

import {
  mergeCompareQueryValues,
  parseUxResetSharedContext,
  sharedContextToSearchParams,
  UX_RESET_COMPARE_COUNTY_LIMIT,
  type UxResetSharedContext,
  type UxResetSharedContextParamKey,
} from "@/features/ux-reset/context-params";
import {
  ATLAS_EXPLORER_PATH,
  DOCS_PATH,
  RESET_ACTION_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_SETTINGS_PATH,
  UX_RESET_APP_PREFIX,
} from "@/features/ux-reset/routes";
import {
  legacyAnalyticalOverviewHref,
  OVERVIEW_INVESTIGATE_HANDOFF_PARAMS,
} from "@/lib/analytical-navigation-handoff";
import { isCountyFips } from "@/lib/county-geography";
import { ATLAS_OVERVIEW_PATH } from "@/lib/navigation";

export const PUBLIC_GEOGRAPHIC_EXPLORER_PATH = "/geographic_explorer" as const;
export const PUBLIC_INVESTIGATE_PATH = "/investigate" as const;
export const PUBLIC_ASSISTANT_PATH = "/assistant" as const;
export const PUBLIC_KNOWLEDGE_GRAPH_PATH = "/knowledge-graph" as const;

/** Query name for Explorer county mode. Omitted for browse. Not read yet. */
export const EXPLORER_MODE_PARAM = "mode" as const;
export const EXPLORER_EVIDENCE_MODE = "evidence" as const;
export const EXPLORER_FOLLOW_UP_MODE = "follow-up" as const;

/**
 * Geographic Explorer's measure switch. These tokens are not Reset measure ids.
 * `/app/explore` uses `metric` for a governed measure id instead.
 */
export const LEGACY_GEOGRAPHIC_METRIC_VALUES = [
  "completeness",
  "score",
] as const;

const EXPLORE_METRIC_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Keys the recorded map never copies onto Atlas Explorer.
 * `state` and `selected` are not listed: they map to `scope` and `compare`
 * when those targets are empty. `metric` is copied only from `/app/explore`.
 */
export const WORKSPACE_MIGRATION_UNSUPPORTED_KEYS = [
  "breakpoint",
  "conversation",
  "eco",
  "evidence",
  "fips",
  "layer",
  "map_scope",
  "missing",
  "page",
  "plan",
  "q",
  "release",
  "return",
  "role",
  "sort",
  "tab",
  "view",
] as const;

export const WORKSPACE_MIGRATION_INSTALL = {
  askAtlasIssue: 424,
  cutoverIssue: 197,
  explorerViewIssue: 413,
  /** Same-path query cleanup and cross-route redirects both replace history. */
  history: "replace",
  redirectsInstalled: false,
  /** Temporary so a cutover can be reversed. Do not emit 308 in that change. */
  redirectStatus: 307,
} as const;

export const WORKSPACE_DESTINATIONS = [
  {
    id: "explorer",
    label: "Atlas Explorer",
    path: ATLAS_EXPLORER_PATH,
  },
  {
    id: "compare",
    label: "Compare",
    path: RESET_COMPARE_PATH,
  },
  {
    id: "ask-atlas",
    label: "Ask Atlas",
    path: RESET_ASSISTANT_PATH,
  },
  {
    id: "feed",
    label: "Feed",
    path: RESET_FEED_PATH,
  },
  {
    id: "settings",
    label: "Settings",
    path: RESET_SETTINGS_PATH,
  },
  {
    id: "docs",
    label: "Docs",
    path: DOCS_PATH,
  },
] as const;

export type WorkspaceDestinationId =
  (typeof WORKSPACE_DESTINATIONS)[number]["id"];

export type ExplorerMigrationMode = "browse" | "evidence" | "follow-up";

export type WorkspaceMigrationUnchangedReason =
  | "canonical-destination"
  | "existing-public-assistant"
  | "front-porch"
  | "out-of-scope";

export type RecordedWorkspaceMigration =
  | {
      kind: "redirect";
      compareTruncated: boolean;
      droppedKeys: readonly string[];
      href: string;
      mode: ExplorerMigrationMode;
      pathname: typeof ATLAS_EXPLORER_PATH;
      search: string;
      sourcePathname: string;
    }
  | {
      kind: "retired-not-revived";
      pathname: string;
    }
  | {
      kind: "unchanged";
      pathname: string;
      reason: WorkspaceMigrationUnchangedReason;
    };

type CompareSource = "compare" | "selected";

type ExplorerQuery = {
  compareTruncated: boolean;
  droppedKeys: readonly string[];
  mode: ExplorerMigrationMode;
  search: string;
};

export function normalizeMigrationPathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery.length > 0 ? withoutQuery : "/";
}

function isRetiredPath(pathname: string): boolean {
  return (
    pathname.startsWith("/variant_") ||
    pathname === "/ux-lab" ||
    pathname.startsWith("/ux-lab/")
  );
}

function isCanonicalDestination(pathname: string): boolean {
  return (
    pathname === ATLAS_EXPLORER_PATH ||
    pathname === RESET_COMPARE_PATH ||
    pathname === RESET_ASSISTANT_PATH ||
    pathname === RESET_FEED_PATH ||
    pathname === RESET_SETTINGS_PATH ||
    pathname === DOCS_PATH ||
    pathname.startsWith(`${DOCS_PATH}/`)
  );
}

function isAliasRedirectSource(pathname: string): boolean {
  return (
    pathname === UX_RESET_APP_PREFIX ||
    pathname === RESET_EXPLORE_PATH ||
    pathname === RESET_INVESTIGATE_PATH ||
    pathname === RESET_ACTION_PATH ||
    pathname === ATLAS_OVERVIEW_PATH ||
    pathname === PUBLIC_GEOGRAPHIC_EXPLORER_PATH ||
    pathname === PUBLIC_INVESTIGATE_PATH
  );
}

function rootCarriesLegacyAnalyticalQuery(
  searchParams: URLSearchParams
): boolean {
  const record: Record<string, string | string[]> = {};
  for (const key of OVERVIEW_INVESTIGATE_HANDOFF_PARAMS) {
    if (!searchParams.has(key)) {
      continue;
    }
    const values = searchParams.getAll(key);
    if (values.length === 1) {
      const only = values[0];
      if (only !== undefined) {
        record[key] = only;
      }
      continue;
    }
    record[key] = values;
  }
  return legacyAnalyticalOverviewHref(record) !== null;
}

function unchangedReason(
  pathname: string,
  searchParams: URLSearchParams
): WorkspaceMigrationUnchangedReason | null {
  if (isCanonicalDestination(pathname)) {
    return "canonical-destination";
  }
  if (
    pathname === PUBLIC_ASSISTANT_PATH ||
    pathname === PUBLIC_KNOWLEDGE_GRAPH_PATH
  ) {
    return "existing-public-assistant";
  }
  if (pathname === "/" && !rootCarriesLegacyAnalyticalQuery(searchParams)) {
    return "front-porch";
  }
  return null;
}

function shouldRedirect(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (isAliasRedirectSource(pathname)) {
    return true;
  }
  return pathname === "/" && rootCarriesLegacyAnalyticalQuery(searchParams);
}

function uniqueSourceKeys(searchParams: URLSearchParams): string[] {
  return [...new Set(searchParams.keys())].sort();
}

function validFipsTokens(values: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      if (!isCountyFips(trimmed) || unique.includes(trimmed)) {
        continue;
      }
      unique.push(trimmed);
    }
  }
  return unique;
}

function selectedMaySupplyCompare(pathname: string): boolean {
  return (
    pathname === RESET_EXPLORE_PATH ||
    pathname === PUBLIC_GEOGRAPHIC_EXPLORER_PATH
  );
}

function resolveCompare(
  pathname: string,
  searchParams: URLSearchParams
): { compare: string[]; source: CompareSource | null; truncated: boolean } {
  const fromCompare = searchParams.has("compare")
    ? mergeCompareQueryValues(searchParams.getAll("compare"))
    : [];
  if (fromCompare.length > 0) {
    return {
      compare: fromCompare,
      source: "compare",
      truncated:
        validFipsTokens(searchParams.getAll("compare")).length >
        UX_RESET_COMPARE_COUNTY_LIMIT,
    };
  }
  if (!selectedMaySupplyCompare(pathname) || !searchParams.has("selected")) {
    return { compare: [], source: null, truncated: false };
  }
  const selected = mergeCompareQueryValues(searchParams.getAll("selected"));
  if (selected.length === 0) {
    return { compare: [], source: null, truncated: false };
  }
  return {
    compare: selected,
    source: "selected",
    truncated:
      validFipsTokens(searchParams.getAll("selected")).length >
      UX_RESET_COMPARE_COUNTY_LIMIT,
  };
}

function isLegacyGeographicMetric(value: string): boolean {
  return (LEGACY_GEOGRAPHIC_METRIC_VALUES as readonly string[]).includes(value);
}

/** Copy a Reset Explore measure id. Geographic `score` / `completeness` never qualify. */
function readExploreMetric(
  pathname: string,
  searchParams: URLSearchParams
): string | null {
  if (pathname !== RESET_EXPLORE_PATH || !searchParams.has("metric")) {
    return null;
  }
  const unique = [
    ...new Set(searchParams.getAll("metric").map((value) => value.trim())),
  ];
  if (unique.length !== 1) {
    return null;
  }
  const metric = unique[0] ?? "";
  if (
    !EXPLORE_METRIC_PATTERN.test(metric) ||
    isLegacyGeographicMetric(metric)
  ) {
    return null;
  }
  return metric;
}

function modeFor(
  pathname: string,
  county: string | null
): ExplorerMigrationMode {
  if (county === null) {
    return "browse";
  }
  if (
    pathname === RESET_INVESTIGATE_PATH ||
    pathname === PUBLIC_INVESTIGATE_PATH
  ) {
    return "evidence";
  }
  if (pathname === RESET_ACTION_PATH) {
    return "follow-up";
  }
  return "browse";
}

function scopeSource(searchParams: URLSearchParams): "scope" | "state" | null {
  if (searchParams.has("scope")) {
    return "scope";
  }
  if (searchParams.has("state")) {
    return "state";
  }
  return null;
}

function syntheticSharedParams(
  searchParams: URLSearchParams,
  explicitScope: "scope" | "state" | null
): URLSearchParams {
  const synthetic = new URLSearchParams();
  if (explicitScope) {
    for (const value of searchParams.getAll(explicitScope)) {
      synthetic.append("scope", value);
    }
  }
  for (const key of ["county", "dataset", "period"] as const) {
    for (const value of searchParams.getAll(key)) {
      synthetic.append(key, value);
    }
  }
  return synthetic;
}

function explorerQuery(
  pathname: string,
  searchParams: URLSearchParams
): ExplorerQuery {
  const explicitScope = scopeSource(searchParams);
  const parsed = parseUxResetSharedContext(
    syntheticSharedParams(searchParams, explicitScope)
  );
  const resolvedCompare = resolveCompare(pathname, searchParams);
  const context: UxResetSharedContext = {
    ...parsed,
    compare: resolvedCompare.compare,
  };
  const metric = readExploreMetric(pathname, searchParams);
  const mode = modeFor(pathname, context.county);
  const sharedKeys: UxResetSharedContextParamKey[] = [];
  if (explicitScope) {
    sharedKeys.push("scope");
  }
  if (context.county) {
    sharedKeys.push("county");
  }
  if (context.compare.length > 0) {
    sharedKeys.push("compare");
  }
  if (context.dataset) {
    sharedKeys.push("dataset");
  }
  if (context.period) {
    sharedKeys.push("period");
  }
  const params = sharedContextToSearchParams(context, { keys: sharedKeys });
  if (metric) {
    params.set("metric", metric);
  }
  switch (mode) {
    case "browse": {
      break;
    }
    case "evidence": {
      params.set(EXPLORER_MODE_PARAM, EXPLORER_EVIDENCE_MODE);
      break;
    }
    case "follow-up": {
      params.set(EXPLORER_MODE_PARAM, EXPLORER_FOLLOW_UP_MODE);
      break;
    }
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unhandled Explorer mode ${exhaustive}.`);
    }
  }
  const mapped = new Set<string>();
  if (explicitScope) {
    mapped.add(explicitScope);
  }
  if (context.county) {
    mapped.add("county");
  }
  if (resolvedCompare.source && context.compare.length > 0) {
    mapped.add(resolvedCompare.source);
  }
  if (context.dataset) {
    mapped.add("dataset");
  }
  if (context.period) {
    mapped.add("period");
  }
  if (metric) {
    mapped.add("metric");
  }
  return {
    compareTruncated: resolvedCompare.truncated,
    droppedKeys: uniqueSourceKeys(searchParams).filter(
      (key) => !mapped.has(key)
    ),
    mode,
    search: params.toString(),
  };
}

function redirectResult(
  sourcePathname: string,
  searchParams: URLSearchParams
): RecordedWorkspaceMigration {
  const query = explorerQuery(sourcePathname, searchParams);
  const href = query.search
    ? `${ATLAS_EXPLORER_PATH}?${query.search}`
    : ATLAS_EXPLORER_PATH;
  return {
    compareTruncated: query.compareTruncated,
    droppedKeys: query.droppedKeys,
    href,
    kind: "redirect",
    mode: query.mode,
    pathname: ATLAS_EXPLORER_PATH,
    search: query.search,
    sourcePathname,
  };
}

/**
 * Compatibility target for one URL. Canonical workspace destinations, the
 * public Front Porch, and the public Assistant alias are fixed points.
 * Retired `/variant_*` and `/ux-lab` paths stay unmapped so they are not revived.
 */
export function recordedWorkspaceMigration(input: {
  pathname: string;
  searchParams: URLSearchParams;
}): RecordedWorkspaceMigration {
  const pathname = normalizeMigrationPathname(input.pathname);
  if (isRetiredPath(pathname)) {
    return { kind: "retired-not-revived", pathname };
  }
  const reason = unchangedReason(pathname, input.searchParams);
  if (reason) {
    return { kind: "unchanged", pathname, reason };
  }
  if (shouldRedirect(pathname, input.searchParams)) {
    return redirectResult(pathname, input.searchParams);
  }
  return { kind: "unchanged", pathname, reason: "out-of-scope" };
}
