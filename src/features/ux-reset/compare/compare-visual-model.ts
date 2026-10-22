import { compareReaderState } from "@/features/ux-reset/compare/compare-compact-evidence";
import type {
  CompareProfileAlignment,
  CompareProfileCell,
  CompareProfileRow,
  CompareProfileRowId,
} from "@/features/ux-reset/compare/compare-county-profile";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";

/**
 * Pure view model for the visual Compare results.
 * It reads the already-published county rows and never calculates a
 * difference, a rank, or a verdict. Missing is never zero.
 */

export const compareVisualSectionIds = [
  "human",
  "vector",
  "community",
] as const;
export type CompareVisualSectionId = (typeof compareVisualSectionIds)[number];

export type CompareVisualKind = "bars" | "chips" | "dots";

export const compareVisualSectionTitles: Record<
  CompareVisualSectionId,
  { question: string; title: string }
> = {
  community: {
    question: "Who lives here and what shapes their access to care?",
    title: "Community context",
  },
  human: {
    question: "What has been reported in people?",
    title: "Human reporting",
  },
  vector: {
    question: "What is known about ticks and the bacteria they carry?",
    title: "Ticks and pathogens",
  },
};

type CompareVisualSpec = {
  /** The published value is a lower bound ("at least"). */
  atLeast?: boolean;
  id: CompareProfileRowId;
  /** Upper end of a fixed 0-based scale. Null means a scale shared by the pair. */
  scale: number | null;
  section: CompareVisualSectionId;
  /** Short unit shown after the number, when the number alone is unclear. */
  unit?: string;
  visual: CompareVisualKind;
};

const VISUAL_SPECS: readonly CompareVisualSpec[] = [
  {
    atLeast: true,
    id: "human_case_floor",
    scale: null,
    section: "human",
    visual: "bars",
  },
  {
    atLeast: true,
    id: "incidence_floor",
    scale: null,
    section: "human",
    unit: "per 100,000",
    visual: "bars",
  },
  {
    id: "state_unallocated_2023",
    scale: null,
    section: "human",
    visual: "bars",
  },
  { id: "scapularis_status", scale: null, section: "vector", visual: "chips" },
  { id: "pacificus_status", scale: null, section: "vector", visual: "chips" },
  { id: "burgdorferi_status", scale: null, section: "vector", visual: "chips" },
  { id: "tick_status", scale: null, section: "vector", visual: "chips" },
  { id: "population_2022", scale: null, section: "community", visual: "bars" },
  {
    id: "svi_percentile_2022",
    scale: 100,
    section: "community",
    unit: "percentile",
    visual: "dots",
  },
  {
    id: "uninsured_percent_2022",
    scale: 100,
    section: "community",
    unit: "%",
    visual: "dots",
  },
  { id: "rucc_2023", scale: null, section: "community", visual: "chips" },
];

export type CompareMissingReason =
  | "failed"
  | "missing"
  | "release_mismatch"
  | "suppressed"
  | "unavailable";

export type CompareSideValue =
  | {
      kind: "missing";
      reason: CompareMissingReason;
      /** Full reader-state sentence, kept for screen readers and details. */
      text: string;
    }
  | {
      evidence: EvidenceObjectModel;
      isZero: boolean;
      kind: "value";
      limited: boolean;
      number: number | null;
      /** Full governed display value. */
      text: string;
    };

export type CompareRowRelation = "different" | "incomparable" | "same";

export type CompareVisualRow = {
  atLeast: boolean;
  gap: boolean;
  id: CompareProfileRowId;
  label: string;
  left: CompareSideValue;
  note: string | null;
  relation: CompareRowRelation;
  right: CompareSideValue;
  scale: number | null;
  section: CompareVisualSectionId;
  unit: string | null;
  visual: CompareVisualKind;
};

export function compareNumberToken(value: string): number | null {
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(value);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0].replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function missingReasonFor(displayValue: string): CompareMissingReason {
  return displayValue.trim().toLowerCase() === "suppressed"
    ? "suppressed"
    : "unavailable";
}

export function compareSideValue(
  cell: CompareProfileCell,
  numeric: boolean
): CompareSideValue {
  switch (cell.kind) {
    case "empty": {
      return {
        kind: "missing",
        reason: cell.reason,
        text: compareReaderState(cell.reason, cell.message),
      };
    }
    case "evidence": {
      const { evidence } = cell;
      if (evidence.availability === "unavailable") {
        return {
          kind: "missing",
          reason: missingReasonFor(evidence.displayValue),
          text: evidence.displayValue,
        };
      }
      const number = numeric ? compareNumberToken(evidence.displayValue) : null;
      return {
        evidence,
        isZero: evidence.reasonCode === "ZERO" || number === 0,
        kind: "value",
        limited: evidence.availability === "limited",
        number,
        text: evidence.displayValue,
      };
    }
    case "reasons":
    case "text": {
      return {
        kind: "missing",
        reason: "unavailable",
        text: "Not shown as a single value.",
      };
    }
    default: {
      const exhaustive: never = cell;
      return exhaustive;
    }
  }
}

function sideText(side: CompareSideValue): string | null {
  return side.kind === "value" ? side.text.trim().toLowerCase() : null;
}

export function compareRowRelation(
  left: CompareSideValue,
  right: CompareSideValue
): CompareRowRelation {
  const first = sideText(left);
  const second = sideText(right);
  if (first === null || second === null) {
    return "incomparable";
  }
  return first === second ? "same" : "different";
}

function sideHasGap(side: CompareSideValue): boolean {
  return side.kind === "missing" || side.limited;
}

function profileRow(
  profile: CompareProfileAlignment,
  id: CompareProfileRowId
): CompareProfileRow | null {
  return profile.rows.find((row) => row.id === id) ?? null;
}

/**
 * The visual rows, in display order. The aggregate tick status is dropped when
 * the caller already decided it repeats the species rows.
 */
export function buildCompareVisualRows(
  profile: CompareProfileAlignment,
  options: {
    hideRowIds?: readonly CompareProfileRowId[];
    rowNote?: (rowId: CompareProfileRowId) => string | null;
  } = {}
): CompareVisualRow[] {
  const rows: CompareVisualRow[] = [];
  for (const spec of VISUAL_SPECS) {
    if (options.hideRowIds?.includes(spec.id)) {
      continue;
    }
    const source = profileRow(profile, spec.id);
    if (!source) {
      continue;
    }
    const numeric = spec.visual !== "chips";
    const left = compareSideValue(source.left, numeric);
    const right = compareSideValue(source.right, numeric);
    rows.push({
      atLeast: spec.atLeast ?? false,
      gap: sideHasGap(left) || sideHasGap(right),
      id: spec.id,
      label: source.label,
      left,
      note: options.rowNote?.(spec.id) ?? null,
      relation: compareRowRelation(left, right),
      right,
      scale: spec.scale,
      section: spec.section,
      unit: spec.unit ?? null,
      visual: spec.visual,
    });
  }
  return rows;
}

export function compareRowsForSection(
  rows: readonly CompareVisualRow[],
  section: CompareVisualSectionId
): CompareVisualRow[] {
  return rows.filter((row) => row.section === section);
}

export type CompareRowFilters = {
  onlyDifferences: boolean;
  onlyGaps: boolean;
};

export function filterCompareRows(
  rows: readonly CompareVisualRow[],
  filters: CompareRowFilters
): CompareVisualRow[] {
  return rows.filter((row) => {
    if (filters.onlyDifferences && row.relation === "same") {
      return false;
    }
    if (filters.onlyGaps && !row.gap) {
      return false;
    }
    return true;
  });
}

/**
 * Shared scale for a bar row. Both counties use the same maximum so lengths
 * can be compared. Returns 0 when both values are zero or unreadable.
 */
export function compareBarScale(row: CompareVisualRow): number {
  if (row.scale !== null) {
    return row.scale;
  }
  const values = [row.left, row.right].map((side) =>
    side.kind === "value" && side.number !== null ? side.number : 0
  );
  return Math.max(...values, 0);
}

export function compareBarFraction(
  side: CompareSideValue,
  scale: number
): number | null {
  if (side.kind !== "value" || side.number === null) {
    return null;
  }
  if (scale <= 0) {
    return 0;
  }
  return Math.min(Math.max(side.number / scale, 0), 1);
}

export type CompareCoverage = "available" | "limited" | "unavailable";

/**
 * Coverage of one evidence area for one county, in the governed vocabulary.
 * Every row available means Available. No row available means Unavailable.
 * Anything in between is Limited.
 */
export function compareSectionCoverage(
  rows: readonly CompareVisualRow[],
  side: "left" | "right"
): CompareCoverage {
  if (rows.length === 0) {
    return "unavailable";
  }
  let available = 0;
  let limited = 0;
  for (const row of rows) {
    const value = row[side];
    if (value.kind === "value") {
      if (value.limited) {
        limited += 1;
      } else {
        available += 1;
      }
    }
  }
  if (available === rows.length) {
    return "available";
  }
  if (available === 0 && limited === 0) {
    return "unavailable";
  }
  return "limited";
}

export type CompareSummaryCounts = {
  different: number;
  incomparable: number;
  same: number;
};

export function compareSummaryCounts(
  relations: readonly CompareRowRelation[]
): CompareSummaryCounts {
  const counts: CompareSummaryCounts = {
    different: 0,
    incomparable: 0,
    same: 0,
  };
  for (const relation of relations) {
    counts[relation] += 1;
  }
  return counts;
}

export type CompareGapEntry = {
  label: string;
  reason: string;
  state: "Limited" | "Unavailable";
};

function gapReason(side: CompareSideValue): CompareGapEntry["reason"] | null {
  if (side.kind === "missing") {
    switch (side.reason) {
      case "suppressed": {
        return "Suppressed in the published data. A suppressed value is not zero.";
      }
      case "failed": {
        return "This county record could not be loaded.";
      }
      case "release_mismatch": {
        return "This county record belongs to a different release.";
      }
      case "missing":
      case "unavailable": {
        return "No published value. A missing value is not zero.";
      }
      default: {
        const exhaustive: never = side.reason;
        return exhaustive;
      }
    }
  }
  if (side.limited) {
    return (
      side.evidence.provenance.materialCaveat?.trim() ||
      "Published with a stated limitation."
    );
  }
  return null;
}

/** Rows where one county has no usable value or a limited one. */
export function compareGapEntries(
  rows: readonly CompareVisualRow[],
  side: "left" | "right"
): CompareGapEntry[] {
  return rows.flatMap((row) => {
    const value = row[side];
    const reason = gapReason(value);
    if (reason === null) {
      return [];
    }
    return [
      {
        label: row.label,
        reason,
        state: value.kind === "missing" ? "Unavailable" : "Limited",
      } satisfies CompareGapEntry,
    ];
  });
}

export type CompareGapSides = "both" | "left" | "right";

export type CompareMissingGroup = {
  /** Measures with no usable value, and which county lacks it. */
  items: { label: string; sides: CompareGapSides; reason: string }[];
};

export type CompareCautionGroup = {
  reason: string;
  items: { label: string; sides: CompareGapSides }[];
};

export type CompareGapSummary = {
  cautions: CompareCautionGroup[];
  missing: CompareMissingGroup["items"];
};

function gapSides(left: boolean, right: boolean): CompareGapSides {
  if (left && right) {
    return "both";
  }
  return left ? "left" : "right";
}

/**
 * Splits the gaps into values that are not published and values that are
 * published with a caution. Cautions that share wording are grouped so the
 * same sentence is not repeated for every measure and county.
 */
export function compareGapSummary(
  rows: readonly CompareVisualRow[]
): CompareGapSummary {
  const missing: CompareGapSummary["missing"] = [];
  const cautionMap = new Map<string, CompareCautionGroup>();
  for (const row of rows) {
    const missingLeft = row.left.kind === "missing";
    const missingRight = row.right.kind === "missing";
    if (missingLeft || missingRight) {
      const reason =
        gapReason(missingLeft ? row.left : row.right) ??
        "No published value. A missing value is not zero.";
      missing.push({
        label: row.label,
        reason,
        sides: gapSides(missingLeft, missingRight),
      });
    }
    const limitedLeft = row.left.kind === "value" && row.left.limited;
    const limitedRight = row.right.kind === "value" && row.right.limited;
    if (limitedLeft || limitedRight) {
      const reason =
        gapReason(limitedLeft ? row.left : row.right) ??
        "Published with a stated limitation.";
      const group = cautionMap.get(reason) ?? { items: [], reason };
      group.items.push({
        label: row.label,
        sides: gapSides(limitedLeft, limitedRight),
      });
      cautionMap.set(reason, group);
    }
  }
  return { cautions: [...cautionMap.values()], missing };
}

export type CompareProvenanceFacts = {
  caveat: string | null;
  period: string | null;
  source: string | null;
  vintage: string | null;
};

const UNKNOWN = "Unavailable";

function knownFact(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text && text !== UNKNOWN ? text : null;
}

export function compareProvenanceFacts(
  evidence: EvidenceObjectModel
): CompareProvenanceFacts {
  const { provenance } = evidence;
  return {
    caveat: knownFact(provenance.materialCaveat),
    period: knownFact(provenance.observationPeriod),
    source: knownFact(provenance.sourceFamily),
    vintage: knownFact(provenance.datasetVintage),
  };
}

export function compareProvenanceUnknown(
  facts: CompareProvenanceFacts
): boolean {
  return !(facts.source || facts.period || facts.vintage);
}

/**
 * One caption for a whole section when every shown value shares the same
 * source and period. Returns null when they differ, so each value keeps its
 * own information button.
 */
export function compareSectionCaption(
  rows: readonly CompareVisualRow[]
): string | null {
  const keys = new Set<string>();
  let caption: string | null = null;
  for (const row of rows) {
    for (const side of [row.left, row.right]) {
      if (side.kind !== "value") {
        continue;
      }
      const facts = compareProvenanceFacts(side.evidence);
      if (compareProvenanceUnknown(facts)) {
        return null;
      }
      keys.add(`${facts.source}|${facts.period}|${facts.vintage}`);
      caption = [
        facts.source ? `Source: ${facts.source}` : null,
        facts.period ? `Period: ${facts.period}` : null,
        facts.vintage ? `Vintage: ${facts.vintage}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }
  return keys.size === 1 ? caption : null;
}

export type CompareGlanceSide = {
  components: readonly { id: string; label: string; value: number | null }[];
  coverage: Record<CompareVisualSectionId, CompareCoverage>;
  reasons: readonly { label: string; text: string }[];
  review: CompareProfileCell | null;
  score: number | null;
  scoreText: string | null;
};

const COMPONENT_IDS = [
  "human_weakness",
  "ecological_component",
  "community_component",
] as const satisfies readonly CompareProfileRowId[];

function scoreNumber(cell: CompareProfileCell | undefined): number | null {
  if (!cell || cell.kind !== "evidence") {
    return null;
  }
  if (cell.evidence.availability === "unavailable") {
    return null;
  }
  return compareNumberToken(cell.evidence.displayValue);
}

/** Per-county facts for the At a glance card. */
export function buildCompareGlanceSide(
  profile: CompareProfileAlignment,
  rows: readonly CompareVisualRow[],
  side: "left" | "right"
): CompareGlanceSide {
  const cellFor = (id: CompareProfileRowId): CompareProfileCell | undefined =>
    profileRow(profile, id)?.[side];
  const scoreCell = cellFor("published_review_score");
  const reasonsCell = cellFor("review_reasons");
  const coverage = {
    community: compareSectionCoverage(
      compareRowsForSection(rows, "community"),
      side
    ),
    human: compareSectionCoverage(compareRowsForSection(rows, "human"), side),
    vector: compareSectionCoverage(compareRowsForSection(rows, "vector"), side),
  };
  return {
    components: COMPONENT_IDS.map((id) => ({
      id,
      label: profileRow(profile, id)?.label ?? id,
      value: scoreNumber(cellFor(id)),
    })),
    coverage,
    reasons: reasonsCell?.kind === "reasons" ? reasonsCell.reasons : [],
    review: cellFor("review_category") ?? null,
    score: scoreNumber(scoreCell),
    scoreText:
      scoreCell?.kind === "evidence" ? scoreCell.evidence.displayValue : null,
  };
}
