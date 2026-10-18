/**
 * Recorded six-page workspace route migration (issues 196, 608).
 *
 * `recordedWorkspaceMigration` is the old→new map. Issue 197 installs it from
 * middleware after the auth guard. Issue 608 moves Atlas Explorer, Compare,
 * and Ask Atlas to `/explore`, `/compare`, and `/askatlas` and makes those
 * redirects permanent. Canonical destinations are fixed points.
 */

import { ACTION_EVIDENCE_BRIEF_PLAN_ID } from "@/features/ux-reset/action/evidence-brief";
import {
  mergeCompareQueryValues,
  parseUxResetSharedContext,
  sharedContextToSearchParams,
  UX_RESET_COMPARE_COUNTY_LIMIT,
  UX_RESET_HANDOFF_ACCEPTANCE,
  UX_RESET_PAGE_LOCAL_PARAM_KEYS,
  type UxResetSharedContext,
  type UxResetSharedContextParamKey,
} from "@/features/ux-reset/context-shared";
import {
  EXPLORER_SELECTION_PARAM,
  EXPLORER_SELECTION_REQUIRED,
} from "@/features/ux-reset/review/explorer-mode";
import {
  ATLAS_EXPLORER_PATH,
  DOCS_PATH,
  LEGACY_ASSISTANT_PATH,
  LEGACY_COMPARE_PATH,
  RESET_ACTION_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
  RESET_DATA_PROVENANCE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
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

/** Query name for Explorer county mode. Omitted for browse. Read on Review. */
export const EXPLORER_MODE_PARAM = "mode" as const;
export const EXPLORER_EVIDENCE_MODE = "evidence" as const;
export const EXPLORER_FOLLOW_UP_MODE = "follow-up" as const;

/**
 * Keys historical aliases do not copy onto Atlas Explorer.
 * `state` and `selected` are not listed: they map to `scope` and `compare`
 * when those targets are empty. `metric` is dropped. Explorer does not read it.
 * The former Review, Compare, and Ask Atlas paths are same-surface moves and
 * keep the keys those pages already read, including Review `sort`, `page`,
 * and `layer`.
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
  redirectsInstalled: true,
  /**
   * Issue 608 permanent canonical URLs. Browsers may cache 308.
   * Middleware keeps unauthenticated sign-in redirects at 307 so a missing
   * session is never cached as the destination.
   */
  redirectStatus: 308,
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
    id: "data-provenance",
    label: "Data Provenance",
    path: RESET_DATA_PROVENANCE_PATH,
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
  | "evidence-brief"
  | "existing-public-assistant"
  | "front-porch"
  | "out-of-scope";

export type RecordedWorkspaceMigration =
  | {
      kind: "redirect";
      compareTruncated: boolean;
      droppedKeys: readonly string[];
      href: string;
      mode: ExplorerMigrationMode | null;
      pathname:
        | typeof ATLAS_EXPLORER_PATH
        | typeof RESET_COMPARE_PATH
        | typeof RESET_ASSISTANT_PATH;
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
    pathname === RESET_DATA_PROVENANCE_PATH ||
    pathname.startsWith(`${RESET_DATA_PROVENANCE_PATH}/`) ||
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

/**
 * One trimmed `plan=evidence-brief` still renders ActionEvidenceBrief.
 * Repeats and every other plan id, including `brief`, redirect with Action.
 */
function actionKeepsEvidenceBrief(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (pathname !== RESET_ACTION_PATH) {
    return false;
  }
  const plans = searchParams.getAll("plan");
  if (plans.length !== 1) {
    return false;
  }
  return plans[0]?.trim() === ACTION_EVIDENCE_BRIEF_PLAN_ID;
}

function unchangedReason(
  pathname: string,
  searchParams: URLSearchParams
): WorkspaceMigrationUnchangedReason | null {
  if (isCanonicalDestination(pathname)) {
    return "canonical-destination";
  }
  if (actionKeepsEvidenceBrief(pathname, searchParams)) {
    return "evidence-brief";
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

function compareFromValues(
  values: readonly string[],
  source: CompareSource
): { compare: string[]; source: CompareSource; truncated: boolean } | null {
  const compare = mergeCompareQueryValues(values);
  if (compare.length === 0) {
    return null;
  }
  return {
    compare,
    source,
    truncated: validFipsTokens(values).length > UX_RESET_COMPARE_COUNTY_LIMIT,
  };
}

/**
 * Geographic Explorer reads and updates `selected`. An inherited `compare`
 * query can sit unused on that URL, so a non-empty `selected` list wins.
 * `/app/explore` still keeps a parsed `compare` pair ahead of `selected`.
 */
function resolveCompare(
  pathname: string,
  searchParams: URLSearchParams
): { compare: string[]; source: CompareSource | null; truncated: boolean } {
  const compareValues = searchParams.has("compare")
    ? searchParams.getAll("compare")
    : [];
  const selectedValues =
    selectedMaySupplyCompare(pathname) && searchParams.has("selected")
      ? searchParams.getAll("selected")
      : [];
  const empty = {
    compare: [],
    source: null,
    truncated: false,
  };
  if (pathname === PUBLIC_GEOGRAPHIC_EXPLORER_PATH) {
    return (
      compareFromValues(selectedValues, "selected") ??
      compareFromValues(compareValues, "compare") ??
      empty
    );
  }
  return (
    compareFromValues(compareValues, "compare") ??
    compareFromValues(selectedValues, "selected") ??
    empty
  );
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
  const mode = modeFor(pathname, context.county);
  const requireExplicitCounty =
    searchParams.has("county") && context.county === null;
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
  if (requireExplicitCounty) {
    params.set(EXPLORER_SELECTION_PARAM, EXPLORER_SELECTION_REQUIRED);
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
  return {
    compareTruncated: resolvedCompare.truncated,
    droppedKeys: uniqueSourceKeys(searchParams).filter(
      (key) => !mapped.has(key)
    ),
    mode,
    search: params.toString(),
  };
}

type SameSurfaceDestination = "assistant" | "compare" | "review";

const SAME_SURFACE_REDIRECTS: readonly {
  destination: SameSurfaceDestination;
  from: string;
  to:
    | typeof ATLAS_EXPLORER_PATH
    | typeof RESET_ASSISTANT_PATH
    | typeof RESET_COMPARE_PATH;
}[] = [
  {
    destination: "review",
    from: RESET_REVIEW_PATH,
    to: ATLAS_EXPLORER_PATH,
  },
  {
    destination: "compare",
    from: LEGACY_COMPARE_PATH,
    to: RESET_COMPARE_PATH,
  },
  {
    destination: "assistant",
    from: LEGACY_ASSISTANT_PATH,
    to: RESET_ASSISTANT_PATH,
  },
];

function supportedSurfaceKeys(
  destination: SameSurfaceDestination
): readonly string[] {
  return [
    ...UX_RESET_HANDOFF_ACCEPTANCE[destination],
    ...UX_RESET_PAGE_LOCAL_PARAM_KEYS[destination],
  ];
}

/**
 * Former canonical pages move path and keep the query their own parsers read.
 * Unsupported keys are dropped so a bookmark cannot invent state the page
 * does not have. Historical aliases still use `explorerQuery` instead.
 */
function preservedSurfaceSearch(
  searchParams: URLSearchParams,
  supportedKeys: readonly string[]
): { droppedKeys: readonly string[]; search: string } {
  const allowed = new Set<string>(supportedKeys);
  const next = new URLSearchParams();
  const seen = new Set<string>();
  for (const key of searchParams.keys()) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!allowed.has(key)) {
      continue;
    }
    for (const value of searchParams.getAll(key)) {
      next.append(key, value);
    }
  }
  return {
    droppedKeys: [...seen].filter((key) => !allowed.has(key)).sort(),
    search: next.toString(),
  };
}

function explorerModeFromSearch(search: string): ExplorerMigrationMode {
  const modes = new URLSearchParams(search).getAll(EXPLORER_MODE_PARAM);
  if (modes.length !== 1) {
    return "browse";
  }
  if (modes[0] === EXPLORER_EVIDENCE_MODE) {
    return "evidence";
  }
  if (modes[0] === EXPLORER_FOLLOW_UP_MODE) {
    return "follow-up";
  }
  return "browse";
}

function sameSurfaceRedirect(
  sourcePathname: string,
  searchParams: URLSearchParams
): RecordedWorkspaceMigration | null {
  const match = SAME_SURFACE_REDIRECTS.find(
    (candidate) => candidate.from === sourcePathname
  );
  if (!match || match.from === match.to) {
    return null;
  }
  const preserved = preservedSurfaceSearch(
    searchParams,
    supportedSurfaceKeys(match.destination)
  );
  const href = preserved.search ? `${match.to}?${preserved.search}` : match.to;
  return {
    compareTruncated: false,
    droppedKeys: preserved.droppedKeys,
    href,
    kind: "redirect",
    mode:
      match.destination === "review"
        ? explorerModeFromSearch(preserved.search)
        : null,
    pathname: match.to,
    search: preserved.search,
    sourcePathname,
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
  const sameSurface = sameSurfaceRedirect(pathname, input.searchParams);
  if (sameSurface) {
    return sameSurface;
  }
  if (shouldRedirect(pathname, input.searchParams)) {
    return redirectResult(pathname, input.searchParams);
  }
  return { kind: "unchanged", pathname, reason: "out-of-scope" };
}

/**
 * Installed compatibility redirect (issue 197). Auth must run first.
 * Canonical destinations, the Front Porch, and the public Assistant return null.
 */
export function installedWorkspaceRedirect(input: {
  pathname: string;
  searchParams: URLSearchParams;
}): {
  href: string;
  status: typeof WORKSPACE_MIGRATION_INSTALL.redirectStatus;
} | null {
  const result = recordedWorkspaceMigration(input);
  if (result.kind !== "redirect") {
    return null;
  }
  return {
    href: result.href,
    status: WORKSPACE_MIGRATION_INSTALL.redirectStatus,
  };
}
