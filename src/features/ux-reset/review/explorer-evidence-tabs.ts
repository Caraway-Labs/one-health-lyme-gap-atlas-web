import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_SECTION_IDS,
  type ExplorerCountyMode,
} from "@/features/ux-reset/review/explorer-mode";

/**
 * Tabs of the county evidence view (`mode=evidence`, `mode=follow-up`). All
 * panels stay mounted, so every section id and `#hash` link still resolves.
 */
export const EXPLORER_EVIDENCE_TABS = [
  "overview",
  "evidence",
  "context",
  "follow-up",
  "sources",
] as const;

export type ExplorerEvidenceTab = (typeof EXPLORER_EVIDENCE_TABS)[number];

/** Attribute on each tab panel. A hash target inside a panel names its tab. */
export const EXPLORER_TAB_PANEL_ATTRIBUTE = "data-explorer-tab" as const;

export function parseExplorerEvidenceTab(
  value: unknown
): ExplorerEvidenceTab | null {
  return EXPLORER_EVIDENCE_TABS.find((tab) => tab === value) ?? null;
}

/**
 * `mode=follow-up` opens Follow-up. `mode=evidence` opens Evidence: the
 * county was just chosen from a summary already on the map, so the evidence
 * itself is the next thing to read. Overview stays one click away.
 */
export function defaultExplorerEvidenceTab(
  mode: ExplorerCountyMode
): ExplorerEvidenceTab {
  switch (mode) {
    case EXPLORER_EVIDENCE_MODE: {
      return "evidence";
    }
    case EXPLORER_FOLLOW_UP_MODE: {
      return "follow-up";
    }
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Tab that owns each governed section id. */
export function explorerTabForSectionId(
  id: string
): ExplorerEvidenceTab | null {
  switch (id) {
    case EXPLORER_SECTION_IDS.summary: {
      return "overview";
    }
    case EXPLORER_SECTION_IDS.evidence: {
      return "evidence";
    }
    case EXPLORER_SECTION_IDS.environmental:
    case EXPLORER_SECTION_IDS.populationRurality:
    case EXPLORER_SECTION_IDS.context: {
      return "context";
    }
    case EXPLORER_SECTION_IDS.followUp: {
      return "follow-up";
    }
    case EXPLORER_SECTION_IDS.sources: {
      return "sources";
    }
    default: {
      return null;
    }
  }
}

/** Element id named by a `location.hash`, or null when there is none. */
export function explorerHashTargetId(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) {
    return null;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Element with this exact id. Unlike `#id`, any id is safe to look up. */
export function explorerElementForId(
  root: Pick<Document, "querySelector">,
  id: string
): Element | null {
  return root.querySelector(
    `[id="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
  );
}

/**
 * Tab that holds a `location.hash` target. Governed section ids map
 * directly. Other ids (an inspected observation, for example) are found in
 * the document and mapped through the panel that contains them.
 */
export function explorerTabForHash(
  hash: string,
  root: Pick<Document, "querySelector">
): ExplorerEvidenceTab | null {
  const id = explorerHashTargetId(hash);
  if (!id) {
    return null;
  }
  const bySection = explorerTabForSectionId(id);
  if (bySection) {
    return bySection;
  }
  const panel = explorerElementForId(root, id)?.closest(
    `[${EXPLORER_TAB_PANEL_ATTRIBUTE}]`
  );
  return parseExplorerEvidenceTab(
    panel?.getAttribute(EXPLORER_TAB_PANEL_ATTRIBUTE)
  );
}
