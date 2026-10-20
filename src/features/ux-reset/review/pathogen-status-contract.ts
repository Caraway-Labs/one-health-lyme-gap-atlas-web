import {
  BURGDORFERI_NO_RECORDS_COLOR,
  BURGDORFERI_PRESENT_COLOR,
} from "@/features/ux-reset/review/explorer-layer-palettes";

/**
 * B. burgdorferi status presentation. Map fills and legend swatches both
 * read this module. Tick status and the gap-score ramp stay on their own
 * scales.
 *
 * Approved October 19, 2026 coordinated palette: No records #D1D5DB on the
 * left, Present indigo #4F46E5 on the right. Present is one categorical color,
 * not an incidence gradient. Known extra statuses use fixed hues so Absent,
 * Unknown, and other published categories stay distinct from those two and
 * from each other.
 */
export const PATHOGEN_STATUS_NO_RECORDS_COLOR = BURGDORFERI_NO_RECORDS_COLOR;
export const PATHOGEN_STATUS_PRESENT_COLOR = BURGDORFERI_PRESENT_COLOR;

export const PATHOGEN_STATUS_EXTRA_COLORS = {
  Absent: "hsl(16,72%,42%)",
  Missing: "hsl(32,64%,36%)",
  "Not ranked": "hsl(174,48%,28%)",
  "Not supplied": "hsl(344,58%,36%)",
  Suppressed: "hsl(46,62%,32%)",
  Unavailable: "hsl(330,52%,40%)",
  Unknown: "hsl(270,46%,40%)",
} as const;

const PATHOGEN_STATUS_PRIMARY = [
  {
    color: PATHOGEN_STATUS_NO_RECORDS_COLOR,
    key: "no records",
    label: "No records (not zero, not confirmed absence)",
    lines: ["No records", "(not zero, not confirmed absence)"],
  },
  {
    color: PATHOGEN_STATUS_PRESENT_COLOR,
    key: "present",
    label: "Present",
    lines: ["Present"],
  },
] as const;

const PRIMARY_INDEX = new Map(
  PATHOGEN_STATUS_PRIMARY.map((entry, index) => [`primary:${entry.key}`, index])
);

const KNOWN_EXTRA_BY_KEY = {
  absent: {
    color: PATHOGEN_STATUS_EXTRA_COLORS.Absent,
    label: "Absent",
    observedZero: true,
  },
  missing: {
    color: PATHOGEN_STATUS_EXTRA_COLORS.Missing,
    label: "Missing",
    observedZero: false,
  },
  "not ranked": {
    color: PATHOGEN_STATUS_EXTRA_COLORS["Not ranked"],
    label: "Not ranked",
    observedZero: false,
  },
  "not supplied": {
    color: PATHOGEN_STATUS_EXTRA_COLORS["Not supplied"],
    label: "Not supplied",
    observedZero: false,
  },
  suppressed: {
    color: PATHOGEN_STATUS_EXTRA_COLORS.Suppressed,
    label: "Suppressed",
    observedZero: false,
  },
  unavailable: {
    color: PATHOGEN_STATUS_EXTRA_COLORS.Unavailable,
    label: "Unavailable",
    observedZero: false,
  },
  unknown: {
    color: PATHOGEN_STATUS_EXTRA_COLORS.Unknown,
    label: "Unknown",
    observedZero: false,
  },
} as const;

const OBSERVED_ZERO =
  /^(?:0|zero|none|not detected|negative|absent|no detection)$/;

export type PathogenStatusLegendEntry = {
  classId: string;
  color: string;
  label: string;
  visibleLines: readonly string[];
};

type PathogenStatusDraft = {
  classId: string;
  color: string | null;
  label: string;
  visibleLines: readonly string[];
};

function publishedPathogenValue(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "Unavailable";
}

function normalizedPathogenValue(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function primaryFor(
  value: string
): (typeof PATHOGEN_STATUS_PRIMARY)[number] | null {
  const normalized = normalizedPathogenValue(value);
  return (
    PATHOGEN_STATUS_PRIMARY.find((entry) => entry.key === normalized) ?? null
  );
}

function knownExtraFor(value: string) {
  const normalized = normalizedPathogenValue(value);
  if (normalized in KNOWN_EXTRA_BY_KEY) {
    return KNOWN_EXTRA_BY_KEY[normalized as keyof typeof KNOWN_EXTRA_BY_KEY];
  }
  return null;
}

function isObservedZero(value: string): boolean {
  return OBSERVED_ZERO.test(normalizedPathogenValue(value));
}

function observedZeroDisplay(normalized: string): string {
  if (!/[a-z]/.test(normalized)) {
    return normalized;
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function draftFor(raw: string): PathogenStatusDraft {
  const published = publishedPathogenValue(raw);
  const primary = primaryFor(published);
  if (primary) {
    return {
      classId: `primary:${primary.key}`,
      color: primary.color,
      label: primary.label,
      visibleLines: primary.lines,
    };
  }
  const known = knownExtraFor(published);
  if (known) {
    return {
      classId: `extra:${known.label}`,
      color: known.color,
      label: known.observedZero
        ? `${known.label} (observed zero or negative finding)`
        : known.label,
      visibleLines: [known.label],
    };
  }
  if (isObservedZero(published)) {
    const canonical = normalizedPathogenValue(published);
    const display = observedZeroDisplay(canonical);
    return {
      classId: `zero:${canonical}`,
      color: null,
      label: `${display} (observed zero or negative finding)`,
      visibleLines: [display],
    };
  }
  return {
    classId: `extra:${published}`,
    color: null,
    label: published,
    visibleLines: [published],
  };
}

export function pathogenStatusClassId(raw: string): string {
  return draftFor(raw).classId;
}

function compareDrafts(
  left: PathogenStatusDraft,
  right: PathogenStatusDraft
): number {
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

function reservedPathogenColors(
  drafts: readonly PathogenStatusDraft[]
): Set<string> {
  const used = new Set<string>();
  for (const entry of PATHOGEN_STATUS_PRIMARY) {
    used.add(entry.color);
  }
  for (const color of Object.values(PATHOGEN_STATUS_EXTRA_COLORS)) {
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
 * One ordered legend for the published pathogen values. No records and
 * Present lead when they occur. Known categories collapse case and outer
 * whitespace. Any other published string keeps its own key.
 */
export function buildPathogenStatusLegend(
  rawValues: readonly string[],
  allocateExtra: (used: ReadonlySet<string>) => string
): PathogenStatusLegendEntry[] {
  const drafts = new Map<string, PathogenStatusDraft>();
  for (const raw of rawValues) {
    const draft = draftFor(raw);
    if (!drafts.has(draft.classId)) {
      drafts.set(draft.classId, draft);
    }
  }
  const ordered = [...drafts.values()].toSorted(compareDrafts);
  const used = reservedPathogenColors(ordered);
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
