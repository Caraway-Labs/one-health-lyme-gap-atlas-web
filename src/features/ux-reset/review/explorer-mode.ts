/**
 * Atlas Explorer county mode on `/app/review` (issue 413).
 * Omitted for browse. These tokens match the recorded route map and are
 * defined here so Review does not import that map.
 */

export const EXPLORER_MODE_PARAM = "mode" as const;
export const EXPLORER_EVIDENCE_MODE = "evidence" as const;
export const EXPLORER_FOLLOW_UP_MODE = "follow-up" as const;

/**
 * Alias arrivals that named `county` but did not yield one FIPS.
 * Browse must not substitute another county while this marker is present.
 */
export const EXPLORER_SELECTION_PARAM = "selection" as const;
export const EXPLORER_SELECTION_REQUIRED = "required" as const;

export const EXPLORER_COUNTY_MODES = [
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_FOLLOW_UP_MODE,
] as const;

export type ExplorerCountyMode = (typeof EXPLORER_COUNTY_MODES)[number];

export const EXPLORER_SECTION_IDS = {
  context: "explorer-context",
  evidence: "explorer-evidence",
  followUp: "explorer-follow-up",
  sources: "explorer-sources",
  summary: "explorer-summary",
} as const;

export function parseExplorerCountyMode(
  value: string
): ExplorerCountyMode | null {
  if (value === EXPLORER_EVIDENCE_MODE || value === EXPLORER_FOLLOW_UP_MODE) {
    return value;
  }
  return null;
}

export function parseExplorerCountySelection(
  value: string
): typeof EXPLORER_SELECTION_REQUIRED | null {
  if (value === EXPLORER_SELECTION_REQUIRED) {
    return EXPLORER_SELECTION_REQUIRED;
  }
  return null;
}

export type ExplorerModeQuery = {
  /** True when the URL contains a mode token that is not one exact value. */
  invalid: boolean;
  mode: ExplorerCountyMode | null;
};

/**
 * Browse is an omitted key. One exact `evidence` or `follow-up` token is a
 * mode. Anything else, including repeats, is invalid and must be removed
 * rather than treated as a chosen county view.
 */
export function resolveExplorerModeQuery(
  values: readonly string[]
): ExplorerModeQuery {
  if (values.length === 0) {
    return { invalid: false, mode: null };
  }
  if (values.length !== 1) {
    return { invalid: true, mode: null };
  }
  const mode = parseExplorerCountyMode(values[0] ?? "");
  if (!mode) {
    return { invalid: true, mode: null };
  }
  return { invalid: false, mode };
}

/** Append a validated Explorer mode. Other query keys stay as they are. */
export function hrefWithExplorerMode(
  href: string,
  mode: ExplorerCountyMode
): string {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const [path, query = ""] = withoutHash.split("?");
  const next = new URLSearchParams(query);
  next.set(EXPLORER_MODE_PARAM, mode);
  const serialized = next.toString();
  const withQuery = serialized ? `${path}?${serialized}` : path;
  return `${withQuery}${hash}`;
}

/**
 * Compare's return link restores expanded county evidence when this Compare
 * URL carried one exact Explorer mode and the return target is Review.
 * `return=investigate` always opens Atlas Explorer county evidence.
 */
export function compareReturnHrefWithExplorerMode(input: {
  href: string | null;
  modeValues: readonly string[];
  returnTarget: string | null;
}): string | null {
  if (!input.href) {
    return input.href;
  }
  if (input.returnTarget === "investigate") {
    return hrefWithExplorerMode(input.href, EXPLORER_EVIDENCE_MODE);
  }
  if (input.returnTarget !== "review") {
    return input.href;
  }
  const query = resolveExplorerModeQuery(input.modeValues);
  if (!query.mode) {
    return input.href;
  }
  return hrefWithExplorerMode(input.href, query.mode);
}
