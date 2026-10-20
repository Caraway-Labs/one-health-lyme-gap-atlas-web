/**
 * Blacklegged tick status presentation. Map fills and legend swatches both
 * read this module. Pathogen status and the gap-score ramp stay on their own
 * scales. WEB #721 can add a sibling contract without changing this one.
 *
 * Approved October 19, 2026 colors: No records #D1D5DB, Reported #E9B949,
 * Established #946200. These are categorical statuses, not a risk gradient.
 * Known extra statuses use fixed hues so they stay distinct from those three
 * and from each other.
 */
export const TICK_STATUS_NO_RECORDS_COLOR = "#D1D5DB";
export const TICK_STATUS_REPORTED_COLOR = "#E9B949";
export const TICK_STATUS_ESTABLISHED_COLOR = "#946200";

export const TICK_STATUS_EXTRA_COLORS = {
  Missing: "hsl(24,48%,42%)",
  "Not ranked": "hsl(128,26%,34%)",
  "Not supplied": "hsl(12,42%,46%)",
  Suppressed: "hsl(48,46%,38%)",
  Unavailable: "hsl(332,38%,46%)",
  Unknown: "hsl(282,32%,40%)",
} as const;

const TICK_STATUS_PRIMARY = [
  {
    color: TICK_STATUS_NO_RECORDS_COLOR,
    key: "no records",
    label: "No records (not zero, not confirmed absence)",
    lines: ["No records", "(not zero, not confirmed absence)"],
  },
  {
    color: TICK_STATUS_REPORTED_COLOR,
    key: "reported",
    label: "Reported",
    lines: ["Reported"],
  },
  {
    color: TICK_STATUS_ESTABLISHED_COLOR,
    key: "established",
    label: "Established",
    lines: ["Established"],
  },
] as const;

const PRIMARY_INDEX = new Map(
  TICK_STATUS_PRIMARY.map((entry, index) => [`primary:${entry.key}`, index])
);

const OBSERVED_ZERO =
  /^(?:0|zero|none|not detected|negative|absent|no detection)$/;

export type TickStatusLegendEntry = {
  classId: string;
  color: string;
  label: string;
  visibleLines: readonly string[];
};

type TickStatusDraft = {
  classId: string;
  color: string | null;
  label: string;
  visibleLines: readonly string[];
};

function publishedTickValue(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "Unavailable";
}

function normalizedTickValue(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function primaryFor(
  value: string
): (typeof TICK_STATUS_PRIMARY)[number] | null {
  const normalized = normalizedTickValue(value);
  return TICK_STATUS_PRIMARY.find((entry) => entry.key === normalized) ?? null;
}

function isObservedZero(value: string): boolean {
  return OBSERVED_ZERO.test(normalizedTickValue(value));
}

function knownExtraColor(value: string): string | null {
  for (const [label, color] of Object.entries(TICK_STATUS_EXTRA_COLORS)) {
    if (label === value) {
      return color;
    }
  }
  return null;
}

function draftFor(raw: string): TickStatusDraft {
  const published = publishedTickValue(raw);
  const primary = primaryFor(published);
  if (primary) {
    return {
      classId: `primary:${primary.key}`,
      color: primary.color,
      label: primary.label,
      visibleLines: primary.lines,
    };
  }
  const label = isObservedZero(published)
    ? `${published} (observed zero or negative finding)`
    : published;
  return {
    classId: `extra:${published}`,
    color: knownExtraColor(published),
    label,
    visibleLines: [published],
  };
}

export function tickStatusClassId(raw: string): string {
  return draftFor(raw).classId;
}

function compareDrafts(left: TickStatusDraft, right: TickStatusDraft): number {
  const leftIndex = PRIMARY_INDEX.get(left.classId);
  const rightIndex = PRIMARY_INDEX.get(right.classId);
  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }
  if (leftIndex !== undefined) {
    return -1;
  }
  if (rightIndex !== undefined) {
    return 1;
  }
  return left.label.localeCompare(right.label, "en");
}

function reservedTickColors(drafts: readonly TickStatusDraft[]): Set<string> {
  const used = new Set<string>();
  for (const entry of TICK_STATUS_PRIMARY) {
    used.add(entry.color);
  }
  for (const color of Object.values(TICK_STATUS_EXTRA_COLORS)) {
    used.add(color);
  }
  for (const draft of drafts) {
    if (draft.color) {
      used.add(draft.color);
    }
  }
  return used;
}

/**
 * One ordered legend for the published tick values. Primary classes collapse
 * case and whitespace. Any other published string keeps its own key.
 */
export function buildTickStatusLegend(
  rawValues: readonly string[],
  allocateExtra: (used: ReadonlySet<string>) => string
): TickStatusLegendEntry[] {
  const drafts = new Map<string, TickStatusDraft>();
  for (const raw of rawValues) {
    const draft = draftFor(raw);
    if (!drafts.has(draft.classId)) {
      drafts.set(draft.classId, draft);
    }
  }
  const ordered = [...drafts.values()].toSorted(compareDrafts);
  const used = reservedTickColors(ordered);
  return ordered.map((entry) => {
    const color = entry.color ?? allocateExtra(used);
    used.add(color);
    return {
      classId: entry.classId,
      color,
      label: entry.label,
      visibleLines: entry.visibleLines,
    };
  });
}
