import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  LYME_INCIDENCE_MISSING_COLOR,
  LYME_INCIDENCE_RAMP,
  mixExplorerRampColor,
  SVI_NO_DATA_COLOR,
  SVI_RAMP,
  UNINSURED_POPULATION_MISSING_COLOR,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import type {
  ExplorerMapLegendEntry,
  ExplorerMapPaint,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  evidenceObjectForExplorerMapRow,
  explorerMapLayerClaimLabel,
  type ExplorerMapNumericRow,
  type ExplorerObservationLayerId,
} from "@/features/ux-reset/review/explorer-map-observation";
import { MINIMUM_REPORTED_INCIDENCE_LABEL } from "@/features/ux-reset/review/published-human-case-copy";
import { RUCC_2023_LABELS } from "@/features/ux-reset/review/review-rationale";
import {
  RURALITY_LEGEND_EXPLANATION,
  RURALITY_NO_DATA_COLOR,
  RURALITY_NO_DATA_LABEL,
  RURALITY_RUCC_FILLS,
  ruralityFillForCode,
} from "@/features/ux-reset/review/rurality-palette";
import { ValueState } from "@/generated/models";

const NO_PUBLISHED_VALUE = "No published value";
const BOUNDARY_COLOR = "var(--explorer-boundary)";

const NUMERIC_SCALE = {
  incidence_floor: {
    high: LYME_INCIDENCE_RAMP.at(-1) ?? LYME_INCIDENCE_RAMP[0],
    low: LYME_INCIDENCE_RAMP[0],
  },
  svi: {
    high: SVI_RAMP.at(-1) ?? SVI_RAMP[0],
    low: SVI_RAMP[0],
    maximum: 1,
    minimum: 0,
  },
  uninsured: {
    high: UNINSURED_POPULATION_RAMP.at(-1) ?? UNINSURED_POPULATION_RAMP[0],
    low: UNINSURED_POPULATION_RAMP[0],
    maximum: 100,
    minimum: 0,
  },
} as const;

/**
 * Rounded share of six release conditions from Data
 * `semantic_release._evidence_completeness`. 3/6, 4/6, 5/6, and 6/6 round to
 * 50, 67, 83, and 100.
 */
const COMPLETENESS_COLORS: Readonly<Record<number, string>> = {
  0: "hsl(208, 45%, 94%)",
  17: "hsl(208, 48%, 84%)",
  33: "hsl(208, 52%, 72%)",
  50: "hsl(208, 55%, 60%)",
  67: "hsl(208, 60%, 46%)",
  83: "hsl(208, 64%, 34%)",
  100: "hsl(208, 72%, 24%)",
};

export const EVIDENCE_COMPLETENESS_EXPLANATION =
  "Published evidence completeness is the rounded share of six release conditions: a published minimum reported cases value; blacklegged tick status Established or Reported; B. burgdorferi Present; a non-null social-vulnerability percentile; a non-null uninsured percentile; and a non-null rural-urban code. It is not surveillance sampling completeness, not evidence of disease absence, and not a confidence score. The map uses the published integer and does not recompute it. The county list stays the review ranking.";

const STATE_COLOR: Partial<Record<ValueState, string>> = {
  [ValueState.MISSING]: "var(--mint)",
  [ValueState.NO_COUNTY_LINKED_RECORD]: "hsl(28, 18%, 46%)",
  [ValueState.NO_RECORDS]: "hsl(200, 10%, 62%)",
  [ValueState.SUPPRESSED]: "var(--navy-2)",
  [ValueState.UNAVAILABLE]: "var(--atlas-muted-text)",
};

const STATE_LABEL: Partial<Record<ValueState, string>> = {
  [ValueState.MISSING]: "Missing (not zero and not a low value)",
  [ValueState.NO_COUNTY_LINKED_RECORD]:
    "No county-linked record (not zero and not confirmed absence)",
  [ValueState.NO_RECORDS]: "No records (not zero and not confirmed absence)",
  [ValueState.SUPPRESSED]: "Suppressed (not zero)",
  [ValueState.UNAVAILABLE]: "Unavailable (not zero)",
};

function parseHsl(color: string): [number, number, number] {
  const match =
    /^hsl\((?<h>\d+(?:\.\d+)?),\s*(?<s>\d+(?:\.\d+)?)%,\s*(?<l>\d+(?:\.\d+)?)%\)$/.exec(
      color
    );
  if (!match?.groups) {
    return [0, 0, 50];
  }
  return [
    Number(match.groups.h),
    Number(match.groups.s),
    Number(match.groups.l),
  ];
}

export function mixExplorerScaleColor(
  low: string,
  high: string,
  ratio: number
): string {
  if (ratio <= 0) {
    return low;
  }
  if (ratio >= 1) {
    return high;
  }
  const start = parseHsl(low);
  const end = parseHsl(high);
  const hue = Math.round(start[0] + (end[0] - start[0]) * ratio);
  const saturation = Math.round(start[1] + (end[1] - start[1]) * ratio);
  const lightness = Math.round(start[2] + (end[2] - start[2]) * ratio);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function appendUnpaintedKey(
  entries: ExplorerMapLegendEntry[],
  rows: readonly ExplorerMapNumericRow[],
  colorsByFips: ReadonlyMap<string, string>,
  omitted: number
): void {
  const unpaintedRow = rows.some((row) => !colorsByFips.has(row.fips));
  if (!(omitted > 0 || unpaintedRow)) {
    return;
  }
  if (entries.some((entry) => entry.label === NO_PUBLISHED_VALUE)) {
    return;
  }
  entries.push(noPublishedValueEntry());
}

function noPublishedValueEntry(): ExplorerMapLegendEntry {
  return {
    color: BOUNDARY_COLOR,
    detail: "Not zero, not low, and not confirmed absence",
    label: NO_PUBLISHED_VALUE,
    role: "missing",
  };
}

function countStates(
  rows: readonly ExplorerMapNumericRow[]
): Map<ValueState, number> {
  const counts = new Map<ValueState, number>();
  for (const row of rows) {
    counts.set(row.valueState, (counts.get(row.valueState) ?? 0) + 1);
  }
  return counts;
}

function coverageSentence(
  rows: readonly ExplorerMapNumericRow[],
  omitted: number
): string {
  const counts = countStates(rows);
  return `This load: ${counts.get(ValueState.OBSERVED) ?? 0} observed, ${counts.get(ValueState.ZERO) ?? 0} observed zero, ${counts.get(ValueState.MISSING) ?? 0} missing, ${omitted} omitted.`;
}

function selectionSentence(
  rows: readonly ExplorerMapNumericRow[],
  selectedFips: string | null | undefined,
  unit: string
): string | null {
  if (!selectedFips) {
    return null;
  }
  const row = rows.find((entry) => entry.fips === selectedFips);
  if (!row) {
    return `Selected county ${selectedFips}: no published row. Not zero.`;
  }
  if (row.valueState === ValueState.ZERO) {
    return `Selected county ${selectedFips}: 0 ${unit}, observed zero. Not a missing value.`;
  }
  if (row.valueState === ValueState.OBSERVED && row.raw) {
    const label = row.categoryLabel ? `, ${row.categoryLabel}` : "";
    return `Selected county ${selectedFips}: ${row.raw} ${unit}${label}.`;
  }
  const label = STATE_LABEL[row.valueState] ?? row.valueState;
  return `Selected county ${selectedFips}: ${label}.`;
}

function scaleRatio(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) {
    return 0;
  }
  return (value - minimum) / (maximum - minimum);
}

function stateColor(
  layerId: ExplorerObservationLayerId,
  state: ValueState
): string | undefined {
  if (state === ValueState.MISSING) {
    if (layerId === "incidence_floor") {
      return LYME_INCIDENCE_MISSING_COLOR;
    }
    if (layerId === "svi") {
      return SVI_NO_DATA_COLOR;
    }
    if (layerId === "uninsured") {
      return UNINSURED_POPULATION_MISSING_COLOR;
    }
  }
  return STATE_COLOR[state];
}

function stateEntries(
  layerId: ExplorerObservationLayerId,
  rows: readonly ExplorerMapNumericRow[]
): ExplorerMapLegendEntry[] {
  const present = new Set(rows.map((row) => row.valueState));
  const entries: ExplorerMapLegendEntry[] = [];
  for (const state of [
    ValueState.MISSING,
    ValueState.SUPPRESSED,
    ValueState.UNAVAILABLE,
    ValueState.NO_COUNTY_LINKED_RECORD,
    ValueState.NO_RECORDS,
  ]) {
    if (!present.has(state)) {
      continue;
    }
    entries.push({
      color: stateColor(layerId, state) ?? "var(--atlas-muted-text)",
      detail: null,
      label: STATE_LABEL[state] ?? state,
      role: "missing",
    });
  }
  return entries;
}

function paintBase(input: {
  entries: ExplorerMapLegendEntry[];
  kind: ExplorerMapPaint["kind"];
  layerId: ExplorerMapPaint["layerId"];
  note: string;
  period: string;
  title: string;
  unit: string | null;
  colorsByFips: Map<string, string>;
  scale: ExplorerMapPaint["scale"];
  ramp?: readonly string[];
  selection: string | null;
  selectionEvidence?: EvidenceObjectModel | null;
}): ExplorerMapPaint {
  return {
    colorsByFips: input.colorsByFips,
    entries: input.entries,
    kind: input.kind,
    layerId: input.layerId,
    note: input.note,
    period: input.period,
    ramp: input.ramp,
    scale: input.scale,
    selection: input.selection,
    selectionEvidence: input.selectionEvidence ?? null,
    title: input.title,
    unit: input.unit,
  };
}

export function paintReadyObservationLayer(input: {
  layerId: ExplorerObservationLayerId;
  omitted: number;
  period: string;
  releaseId?: string | null;
  rows: readonly ExplorerMapNumericRow[];
  selectedFips?: string | null;
  sourceLabel: string | null;
  unit: string;
}): ExplorerMapPaint {
  const release = input.releaseId?.trim()
    ? `Release ${input.releaseId.trim()}. `
    : "";
  const period = `${release}${input.period}`;
  const selection = selectionSentence(
    input.rows,
    input.selectedFips,
    input.unit
  );
  const selectedRow = input.selectedFips
    ? input.rows.find((row) => row.fips === input.selectedFips)
    : undefined;
  const selectionEvidence = selectedRow
    ? evidenceObjectForExplorerMapRow(
        selectedRow,
        explorerMapLayerClaimLabel(input.layerId)
      )
    : null;
  if (input.layerId === "rurality") {
    return paintRurality({
      omitted: input.omitted,
      period,
      rows: input.rows,
      selection,
      selectionEvidence,
      unit: input.unit,
    });
  }
  return paintQuantity({
    layerId: input.layerId,
    omitted: input.omitted,
    period,
    rows: input.rows,
    selection,
    selectionEvidence,
    unit: input.unit,
  });
}

function quantityRamp(
  layerId: Exclude<ExplorerObservationLayerId, "rurality">
): readonly string[] | undefined {
  if (layerId === "incidence_floor") {
    return LYME_INCIDENCE_RAMP;
  }
  if (layerId === "svi") {
    return SVI_RAMP;
  }
  if (layerId === "uninsured") {
    return UNINSURED_POPULATION_RAMP;
  }
  return undefined;
}

function quantityColor(
  layerId: Exclude<ExplorerObservationLayerId, "rurality">,
  scale: { high: string; low: string },
  ratio: number
): string {
  const ramp = quantityRamp(layerId);
  if (ramp) {
    return mixExplorerRampColor(ramp, ratio);
  }
  return mixExplorerScaleColor(scale.low, scale.high, ratio);
}

function paintQuantity(input: {
  layerId: Exclude<ExplorerObservationLayerId, "rurality">;
  omitted: number;
  period: string;
  rows: readonly ExplorerMapNumericRow[];
  selection: string | null;
  selectionEvidence: EvidenceObjectModel | null;
  unit: string;
}): ExplorerMapPaint {
  const scale = NUMERIC_SCALE[input.layerId];
  const valued = input.rows.filter(
    (row) =>
      row.numeric !== null &&
      (row.valueState === ValueState.OBSERVED ||
        row.valueState === ValueState.ZERO)
  );
  const domain =
    valued.length === 0
      ? null
      : "minimum" in scale
        ? { maximum: scale.maximum, minimum: scale.minimum }
        : observedDomain(valued);
  const colorsByFips = new Map<string, string>();
  for (const row of input.rows) {
    if (
      domain === null ||
      row.numeric === null ||
      (row.valueState !== ValueState.OBSERVED &&
        row.valueState !== ValueState.ZERO)
    ) {
      const color = stateColor(input.layerId, row.valueState);
      if (color) {
        colorsByFips.set(row.fips, color);
      }
      continue;
    }
    const ratio = scaleRatio(row.numeric, domain.minimum, domain.maximum);
    colorsByFips.set(row.fips, quantityColor(input.layerId, scale, ratio));
  }
  const entries: ExplorerMapLegendEntry[] = [];
  const lowRaw = domain
    ? (endpointRaw(valued, domain.minimum) ?? String(domain.minimum))
    : null;
  const highRaw = domain
    ? (endpointRaw(valued, domain.maximum) ?? String(domain.maximum))
    : null;
  if (domain && lowRaw && highRaw) {
    const zeroAtLow = valued.some(
      (row) =>
        row.valueState === ValueState.ZERO && row.numeric === domain.minimum
    );
    const constant = domain.maximum === domain.minimum;
    entries.push({
      color: scale.low,
      detail: zeroAtLow
        ? "Observed zero is the low end of this scale. It is not a missing value."
        : constant
          ? "Every published number in this load is this value."
          : null,
      label: zeroAtLow
        ? `${lowRaw} (observed zero)`
        : constant
          ? lowRaw
          : `${lowRaw} (low end)`,
      role: "endpoint-low",
    });
  }
  if (domain && highRaw && domain.maximum !== domain.minimum) {
    let highest: ExplorerMapNumericRow | null = null;
    for (const row of valued) {
      if (row.numeric === null) {
        continue;
      }
      if (highest?.numeric == null || row.numeric > highest.numeric) {
        highest = row;
      }
    }
    const highIsEndpoint = highest?.numeric === domain.maximum;
    entries.push({
      color: scale.high,
      detail: highIsEndpoint
        ? null
        : "Governed high end of the scale. Counties in this release can fall below it.",
      label: highIsEndpoint
        ? `${highRaw} (high end)`
        : `${domain.maximum} (scale high end)`,
      role: "endpoint-high",
    });
    if (highest?.numeric != null && !highIsEndpoint && highest.raw) {
      entries.push({
        color: quantityColor(
          input.layerId,
          scale,
          scaleRatio(highest.numeric, domain.minimum, domain.maximum)
        ),
        detail: "Highest published value in this load. Not a separate class.",
        label: `${highest.raw} (highest published value)`,
        role: "note",
      });
    }
  }
  entries.push(...stateEntries(input.layerId, input.rows));
  appendUnpaintedKey(entries, input.rows, colorsByFips, input.omitted);
  if (input.layerId === "svi") {
    for (const entry of entries) {
      if (entry.label === NO_PUBLISHED_VALUE) {
        entry.color = SVI_NO_DATA_COLOR;
      }
    }
  }
  const title = {
    incidence_floor: MINIMUM_REPORTED_INCIDENCE_LABEL,
    svi: "Social vulnerability",
    uninsured: "Uninsured population",
  }[input.layerId];
  const note = {
    incidence_floor:
      "2023 published values are minimums per 100,000 residents, not all infections and not an exact total incidence. Color runs from pale green at the lowest published value to deep green at the highest. The green anchors are a continuous ramp, not new epidemiologic cutoffs. Missing is not drawn as zero. A wide published range keeps most counties near the low end. The county list stays the review ranking.",
    svi: "2022 CDC/ATSDR Social Vulnerability Index overall percentile (RPL_THEMES). It ranks this county among U.S. counties in that product on a fixed 0 to 1 scale. It is not a percent of residents who are vulnerable, and it is not individual vulnerability or Lyme disease risk. Color runs from pale peach at the low end to burnt orange at the high end. The anchors are a continuous ramp, not new percentile cutoffs. Observed zero stays on that scale. Missing is gray, not zero. The county list stays the review ranking.",
    uninsured:
      "Percent of the civilian noninstitutionalized population on a 0 to 100 scale. This is the uninsured percentage, not the uninsured percentile. Observed zero is 0 percent, not a missing value. Color runs from pale rose at 0 percent to deep burgundy at 100 percent. The rose anchors are a continuous ramp, not new percentage cutoffs. This percentage does not establish healthcare access, reporting completeness, or Lyme risk. Missing is not drawn as zero. The county list stays the review ranking.",
  }[input.layerId];
  return paintBase({
    colorsByFips,
    entries,
    kind: "choropleth",
    layerId: input.layerId,
    note: `${note} ${coverageSentence(input.rows, input.omitted)}`,
    ramp: quantityRamp(input.layerId),
    scale: "gradient",
    period: input.period,
    selection: input.selection,
    selectionEvidence: input.selectionEvidence,
    title,
    unit: input.unit,
  });
}

function observedDomain(rows: readonly ExplorerMapNumericRow[]): {
  maximum: number;
  minimum: number;
} {
  const values = rows.flatMap((row) =>
    row.numeric === null ? [] : [row.numeric]
  );
  if (values.length === 0) {
    return { maximum: 0, minimum: 0 };
  }
  return { maximum: Math.max(...values), minimum: Math.min(...values) };
}

function endpointRaw(
  rows: readonly ExplorerMapNumericRow[],
  endpoint: number
): string | null {
  return rows.find((row) => row.numeric === endpoint && row.raw)?.raw ?? null;
}

function observedRuralityFill(row: ExplorerMapNumericRow): string | null {
  if (
    row.valueState !== ValueState.OBSERVED ||
    row.numeric === null ||
    !row.categoryLabel
  ) {
    return null;
  }
  return ruralityFillForCode(row.numeric);
}

function paintRurality(input: {
  omitted: number;
  period: string;
  rows: readonly ExplorerMapNumericRow[];
  selection: string | null;
  selectionEvidence: EvidenceObjectModel | null;
  unit: string;
}): ExplorerMapPaint {
  const colorsByFips = new Map<string, string>();
  const classes = new Map<number, string>();
  let needsNoData = input.omitted > 0;
  for (const row of input.rows) {
    const fill = observedRuralityFill(row);
    if (fill && row.numeric !== null && row.categoryLabel) {
      colorsByFips.set(row.fips, fill);
      classes.set(row.numeric, row.categoryLabel);
      continue;
    }
    needsNoData = true;
    colorsByFips.set(row.fips, RURALITY_NO_DATA_COLOR);
  }
  const entries: ExplorerMapLegendEntry[] = [];
  for (let code = 1; code <= 9; code += 1) {
    const published = classes.get(code);
    const catalog = RUCC_2023_LABELS[code];
    const label = published ?? catalog;
    const color = RURALITY_RUCC_FILLS[code as keyof typeof RURALITY_RUCC_FILLS];
    if (!label) {
      continue;
    }
    entries.push({
      color,
      detail: null,
      label: `${code}. ${label}`,
      role: "class",
    });
  }
  if (needsNoData) {
    entries.push({
      color: RURALITY_NO_DATA_COLOR,
      detail:
        "Not a rural-urban code. Not urban, not rural, not zero, and not confirmed absence.",
      label: RURALITY_NO_DATA_LABEL,
      role: "missing",
      visibleLines: [RURALITY_NO_DATA_LABEL],
    });
  }
  return paintBase({
    colorsByFips,
    entries,
    kind: "categorical",
    layerId: "rurality",
    note: `${RURALITY_LEGEND_EXPLANATION} Nine 2023 USDA ERS source categories keep their published labels. Darker purple marks a higher code. That order is not a proportional increase in rurality, Lyme risk, or review priority, and the colors are not a risk gradient. This vintage has no observation dates. The county list stays the review ranking. ${coverageSentence(input.rows, input.omitted)}`,
    period: input.period,
    scale: "segments",
    selection: input.selection,
    selectionEvidence: input.selectionEvidence,
    title: "Rurality",
    unit: "rural-urban code",
  });
}

export function completenessColor(score: number): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return null;
  }
  return COMPLETENESS_COLORS[score] ?? `hsl(${(score * 17) % 360}, 35%, 42%)`;
}

export function paintReadyCompletenessLayer(input: {
  counties: readonly { evidence_completeness: number; fips: string }[];
  period: string;
  selectedFips?: string | null;
}): ExplorerMapPaint {
  const colorsByFips = new Map<string, string>();
  const present = new Map<number, string>();
  for (const county of input.counties) {
    const color = completenessColor(county.evidence_completeness);
    if (!color) {
      continue;
    }
    colorsByFips.set(county.fips, color);
    present.set(county.evidence_completeness, color);
  }
  const entries: ExplorerMapLegendEntry[] = [...present.entries()]
    .toSorted((left, right) => left[0] - right[0])
    .map(([score, color]) => ({
      color,
      detail: "Published integer. Not recomputed in the browser.",
      label: `${score}`,
      role: "class",
    }));
  if (input.counties.some((county) => !colorsByFips.has(county.fips))) {
    entries.push(noPublishedValueEntry());
  }
  const selected = input.selectedFips
    ? input.counties.find((county) => county.fips === input.selectedFips)
    : undefined;
  let selection: string | null = null;
  if (input.selectedFips) {
    selection =
      selected && completenessColor(selected.evidence_completeness)
        ? `Selected county ${input.selectedFips}: published evidence completeness ${selected.evidence_completeness}.`
        : `Selected county ${input.selectedFips}: no published evidence-completeness value in range. Not zero.`;
  }
  return paintBase({
    colorsByFips,
    entries,
    kind: "choropleth",
    layerId: "completeness",
    note: EVIDENCE_COMPLETENESS_EXPLANATION,
    period: input.period,
    scale: "segments",
    selection,
    title: "Evidence completeness",
    unit: "published percent of six conditions",
  });
}
