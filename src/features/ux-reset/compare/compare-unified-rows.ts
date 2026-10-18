import type {
  CompareAlignedRow,
  CompareCell,
} from "@/features/ux-reset/compare/compare-alignment";
import type {
  CompareProfileAlignment,
  CompareProfileCell,
  CompareProfileRowId,
} from "@/features/ux-reset/compare/compare-county-profile";

/**
 * Catalog measures that name the same published county-record field.
 * A match is removed only when both counties agree in value and period.
 * A different value, a different period, or more than one observation stays.
 */
const MEASURE_TO_PROFILE_ROW: Record<string, CompareProfileRowId> = {
  burgdorferi_status: "burgdorferi_status",
  case_count_floor_2023: "human_case_floor",
  human_case_floor: "human_case_floor",
  incidence_floor: "incidence_floor",
  incidence_floor_2023: "incidence_floor",
  ixodes_pacificus_status: "pacificus_status",
  ixodes_scapularis_status: "scapularis_status",
  pacificus_status: "pacificus_status",
  population_2022: "population_2022",
  rucc_2023: "rucc_2023",
  scapularis_status: "scapularis_status",
  svi_percentile_2022: "svi_percentile_2022",
  tick_status: "tick_status",
  uninsured_percent_2022: "uninsured_percent_2022",
};

const SEPARATE_OBSERVATION_NOTE =
  "Kept separately. This observation’s period or value is not the same as the county-record row.";

export type ReconciledAlignmentRow = {
  note: string | null;
  row: CompareAlignedRow;
};

export const COMPARE_REVIEW_ROW_IDS = [
  "review_category",
  "review_reasons",
  "published_review_score",
] as const;

export const COMPARE_HUMAN_ROW_IDS = [
  "human_case_floor",
  "incidence_floor",
] as const;

export const COMPARE_VECTOR_ROW_IDS = [
  "scapularis_status",
  "pacificus_status",
  "burgdorferi_status",
  "tick_status",
] as const;

export const COMPARE_COMMUNITY_ROW_IDS = [
  "population_2022",
  "svi_percentile_2022",
  "uninsured_percent_2022",
  "rucc_2023",
] as const;

export const COMPARE_SCORE_ROW_IDS = [
  "human_weakness",
  "ecological_component",
  "community_component",
] as const;

export const COMPARE_STATE_CONTEXT_ROW_ID = "state_unallocated_2023";
export const COMPARE_LIMITATION_ROW_ID = "release_limitation";

const TICK_AGGREGATE_NOTE =
  "Kept separately. This published tick status is not the same evidence as the species rows.";

function evidenceSignature(cell: CompareProfileCell): string | null {
  if (cell.kind !== "evidence") {
    return null;
  }
  const provenance = cell.evidence.provenance;
  return [
    cell.evidence.displayValue.trim(),
    provenance.observationPeriod.trim(),
    provenance.datasetVintage?.trim() ?? "",
  ].join("|");
}

function sideDuplicatesSpecies(
  tick: CompareProfileCell,
  scapularis: CompareProfileCell,
  pacificus: CompareProfileCell
): boolean {
  const tickSignature = evidenceSignature(tick);
  if (!tickSignature) {
    return true;
  }
  const scapularisSignature = evidenceSignature(scapularis);
  const pacificusSignature = evidenceSignature(pacificus);
  const matchesScapularis = scapularisSignature === tickSignature;
  const matchesPacificus = pacificusSignature === tickSignature;
  const scapularisAbsent = scapularis.kind === "empty";
  const pacificusAbsent = pacificus.kind === "empty";
  if (matchesScapularis && (matchesPacificus || pacificusAbsent)) {
    return true;
  }
  return matchesPacificus && scapularisAbsent;
}

/**
 * Hide the aggregate tick row only when both counties repeat a species row
 * with the same value and period. A different status stays visible.
 */
export function tickAggregateNote(
  rows: readonly {
    id: string;
    left: CompareProfileCell;
    right: CompareProfileCell;
  }[]
): "hide" | "keep" | null {
  const tick = rows.find((row) => row.id === "tick_status");
  const scapularis = rows.find((row) => row.id === "scapularis_status");
  const pacificus = rows.find((row) => row.id === "pacificus_status");
  if (!(tick && scapularis && pacificus)) {
    return null;
  }
  const redundant =
    sideDuplicatesSpecies(tick.left, scapularis.left, pacificus.left) &&
    sideDuplicatesSpecies(tick.right, scapularis.right, pacificus.right);
  return redundant ? "hide" : "keep";
}

export function tickStatusRowNote(
  rows: readonly {
    id: string;
    left: CompareProfileCell;
    right: CompareProfileCell;
  }[]
): string | null {
  return tickAggregateNote(rows) === "keep" ? TICK_AGGREGATE_NOTE : null;
}

export function sharedReleaseLimitation(
  rows: readonly {
    id: string;
    left: CompareProfileCell;
    right: CompareProfileCell;
  }[]
): string | null {
  const row = rows.find((entry) => entry.id === COMPARE_LIMITATION_ROW_ID);
  if (!row || row.left.kind !== "text" || row.right.kind !== "text") {
    return null;
  }
  const left = row.left.text.trim();
  const right = row.right.text.trim();
  if (!left || left !== right) {
    return null;
  }
  if (left.startsWith("No governed limitation")) {
    return null;
  }
  return left;
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberToken(value: string): string | null {
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(value);
  return match ? match[0].replaceAll(",", "") : null;
}

function periodsCompatible(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const first = left?.trim() ?? "";
  const second = right?.trim() ?? "";
  if (first === second) {
    return true;
  }
  if (!(first && second)) {
    return false;
  }
  return first.includes(second) || second.includes(first);
}

function cellsAgree(
  profile: CompareProfileCell,
  aligned: CompareCell
): "different" | "redundant" {
  if (aligned.kind === "empty") {
    return "redundant";
  }
  if (aligned.records.length !== 1 || profile.kind !== "evidence") {
    return "different";
  }
  const record = aligned.records[0];
  if (
    !periodsCompatible(
      profile.evidence.provenance.observationPeriod,
      record.evidence.provenance.observationPeriod
    )
  ) {
    return "different";
  }
  const profileNumber = numberToken(profile.evidence.displayValue);
  const alignedNumber = numberToken(record.evidence.displayValue);
  if (profileNumber && alignedNumber) {
    return profileNumber === alignedNumber ? "redundant" : "different";
  }
  return profile.evidence.displayValue.trim() ===
    record.evidence.displayValue.trim()
    ? "redundant"
    : "different";
}

export function reconcileAlignmentRows(
  profile: CompareProfileAlignment | null,
  rows: readonly CompareAlignedRow[]
): ReconciledAlignmentRow[] {
  if (!profile) {
    return rows.map((row) => ({ note: null, row }));
  }
  const byId = new Map(profile.rows.map((row) => [row.id, row]));
  const byLabel = new Map(
    profile.rows.map((row) => [normalizeLabel(row.label), row])
  );
  const kept: ReconciledAlignmentRow[] = [];
  for (const row of rows) {
    const aliased = MEASURE_TO_PROFILE_ROW[row.measureId];
    const profileRow =
      (aliased ? byId.get(aliased) : undefined) ??
      byId.get(row.measureId as CompareProfileRowId) ??
      byLabel.get(normalizeLabel(row.measureLabel));
    if (!profileRow) {
      kept.push({ note: null, row });
      continue;
    }
    const left = cellsAgree(profileRow.left, row.left);
    const right = cellsAgree(profileRow.right, row.right);
    if (left === "different" || right === "different") {
      kept.push({ note: SEPARATE_OBSERVATION_NOTE, row });
    }
  }
  return kept;
}
