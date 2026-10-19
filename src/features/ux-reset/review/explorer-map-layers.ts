import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  paintReadyCompletenessLayer,
  paintReadyObservationLayer,
} from "@/features/ux-reset/review/explorer-map-layer-scale";
import type {
  ExplorerMapNumericRow,
  ExplorerObservationLayerId,
} from "@/features/ux-reset/review/explorer-map-observation";
import { EXPLORER_OBSERVATION_LAYER_IDS } from "@/features/ux-reset/review/explorer-map-observation";
import { priorityLabel } from "@/features/ux-reset/review/explorer-scenario-score";
import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";
import {
  buildTickStatusLegend,
  tickStatusClassId,
} from "@/features/ux-reset/review/tick-status-contract";
import type { CountyScoreSummary } from "@/generated/models";

/**
 * Atlas Explorer layers. Score and boundary layers stay selectable from the
 * scores collection. Observation layers stay selectable until a load fails
 * validation. Completeness stays selectable only after scores validate.
 */
export const EXPLORER_MAP_LAYERS = [
  {
    id: "gap_score",
    label: "Atlas gap score",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "incidence_floor",
    label: "Lyme incidence floor",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "tick_status",
    label: "Blacklegged tick status",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "pathogen_status",
    label: "B. burgdorferi status",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "svi",
    label: "Social vulnerability",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "uninsured",
    label: "Uninsured population",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "rurality",
    label: "Rurality",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "completeness",
    label: "Evidence completeness",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "boundaries",
    label: "County boundaries",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
] as const;

export type ExplorerMapLayerId = (typeof EXPLORER_MAP_LAYERS)[number]["id"];

export type ExplorerMapLayer = (typeof EXPLORER_MAP_LAYERS)[number];

export type ExplorerMapLegendSource = {
  key: string;
  label: string;
  vintage: string;
};

const BOUNDARY_COLOR = "var(--explorer-boundary)";

/**
 * Category hues stay off the review-priority ramp. A heat ramp would read as
 * severity for a status that is only a published category.
 */
const POSITIVE_STATUS_COLOR: Readonly<Record<string, string>> = {
  established: "var(--teal)",
  present: "var(--teal)",
  reported: "var(--navy)",
};
const OBSERVED_ZERO_COLOR = "var(--teal-dark)";
const NEUTRAL_STATUS_COLOR = "var(--atlas-muted-text)";
/**
 * Colors already assigned to a known status or to the absent-data swatch.
 * An unrecognized category must not reuse one of these.
 */
const RESERVED_STATUS_COLORS = new Set<string>([
  BOUNDARY_COLOR,
  NEUTRAL_STATUS_COLOR,
  OBSERVED_ZERO_COLOR,
  "var(--mint)",
  "var(--navy)",
  "var(--navy-2)",
  "var(--teal)",
]);
/**
 * Concrete colors for published categories the legend does not already name.
 * MapLibre can paint hsl/rgb/hex, and it cannot resolve var() or color-mix.
 * None of these are a neutral status color or a known category color.
 */
const EXTRA_CATEGORY_COLORS = [
  "hsl(262,46%,42%)",
  "hsl(328,58%,48%)",
  "hsl(78,38%,36%)",
] as const;

/** Static extra-category colors. Further categories use the generated hues. */
export const EXPLORER_STATIC_EXTRA_COLOR_COUNT = EXTRA_CATEGORY_COLORS.length;

function neutralStatusColor(normalized: string): string {
  switch (normalized) {
    case "no records": {
      return "var(--atlas-muted-text)";
    }
    case "unknown": {
      return "var(--navy-2)";
    }
    case "missing":
    case "not ranked":
    case "not supplied":
    case "suppressed":
    case "unavailable": {
      return "var(--mint)";
    }
    default: {
      return NEUTRAL_STATUS_COLOR;
    }
  }
}

const CATEGORY_SOURCE_KEYS: Partial<
  Record<ExplorerMapLayerId, readonly string[]>
> = {
  gap_score: ["human", "tick", "pathogen", "context_svi", "context_rucc"],
  pathogen_status: ["pathogen"],
  tick_status: ["tick"],
};

/** Used only when metadata does not name the expected source. */
const EXPECTED_SOURCE_LABEL = {
  context_rucc: "Rural-urban codes",
  context_svi: "Social vulnerability",
  human: "Human surveillance",
  pathogen: "Pathogen status",
  tick: "Tick status",
} as const;

type LegendKind =
  | "boundaries"
  | "categorical"
  | "choropleth"
  | "loading"
  | "unavailable";

export type ExplorerMapLegendRole =
  | "class"
  | "endpoint-high"
  | "endpoint-low"
  | "missing"
  | "note";

export type ExplorerMapLegendEntry = {
  color: string;
  detail: string | null;
  label: string;
  role?: ExplorerMapLegendRole;
  /** Persistent legend lines. Omitted swatches stay unlabeled. */
  visibleLines?: readonly string[];
};

export type ExplorerLegendScale = "gradient" | "segments";

export type ExplorerMapPaint = {
  colorsByFips: ReadonlyMap<string, string>;
  entries: readonly ExplorerMapLegendEntry[];
  kind: LegendKind;
  layerId: ExplorerMapLayerId;
  note: string;
  /** Whether map paint interpolates or uses discrete governed classes. */
  scale: ExplorerLegendScale;
  period: string;
  /** Exact published value for the selected county, when one is selected. */
  selection?: string | null;
  /** Shared evidence contract for the selected county on an observation layer. */
  selectionEvidence?: EvidenceObjectModel | null;
  title: string;
  unit: string | null;
};

export type ExplorerObservationPaintState =
  | { reason: string; status: "error" | "idle" | "loading" }
  | {
      omitted: number;
      period: string;
      rows: readonly ExplorerMapNumericRow[];
      sourceLabel: string | null;
      status: "ready";
      unit: string;
    };

type PaintInput = {
  counties: readonly CountyScoreSummary[];
  layerId: ExplorerMapLayerId;
  observation?: ExplorerObservationPaintState | null;
  releaseId?: string | null;
  scoresStatus: "error" | "loading" | "ready";
  selectedFips?: string | null;
  sources?: readonly ExplorerMapLegendSource[];
};

export type ExplorerLayerGate = {
  reason: string | null;
  selectable: boolean;
};

const OBSERVATION_LAYER_ID_SET = new Set<string>(
  EXPLORER_OBSERVATION_LAYER_IDS
);

export function isExplorerObservationLayer(
  layerId: string
): layerId is ExplorerObservationLayerId {
  return OBSERVATION_LAYER_ID_SET.has(layerId);
}

export function completenessLayerGate(input: {
  counties: readonly { evidence_completeness: number }[];
  scoresStatus: "error" | "loading" | "ready";
}): ExplorerLayerGate {
  if (input.scoresStatus === "loading") {
    return {
      reason: "Published values for this layer are still loading.",
      selectable: false,
    };
  }
  if (input.scoresStatus === "error") {
    return {
      reason:
        "The scores collection could not be loaded, so evidence completeness cannot be checked.",
      selectable: false,
    };
  }
  const paintable = input.counties.some(
    (county) =>
      Number.isInteger(county.evidence_completeness) &&
      county.evidence_completeness >= 0 &&
      county.evidence_completeness <= 100
  );
  if (!paintable) {
    return {
      reason:
        "No published evidence-completeness value in the 0–100 range was available.",
      selectable: false,
    };
  }
  return { reason: null, selectable: true };
}

export function explorerMapLayerGates(input: {
  completeness: ExplorerLayerGate;
  observations: Record<ExplorerObservationLayerId, ExplorerLayerGate>;
}): Record<ExplorerMapLayerId, ExplorerLayerGate> {
  const gates = {} as Record<ExplorerMapLayerId, ExplorerLayerGate>;
  for (const layer of EXPLORER_MAP_LAYERS) {
    if (layer.id === "completeness") {
      gates[layer.id] = input.completeness;
      continue;
    }
    if (isExplorerObservationLayer(layer.id)) {
      gates[layer.id] = input.observations[layer.id];
      continue;
    }
    gates[layer.id] = { reason: null, selectable: true };
  }
  return gates;
}

type ScoreBand = (typeof SCORE_COLOR_BANDS)[number];

type GapColorGroup = {
  color: string;
  priorities: Map<string, number>;
  scores: number[];
};

export function explorerMapLayerById(
  value: string | null | undefined
): ExplorerMapLayer {
  return (
    EXPLORER_MAP_LAYERS.find((layer) => layer.id === value) ??
    EXPLORER_MAP_LAYERS[0]
  );
}

export function parseExplorerMapLayerId(
  value: string
): ExplorerMapLayerId | null {
  const layer = EXPLORER_MAP_LAYERS.find((entry) => entry.id === value);
  if (!layer?.selectable) {
    return null;
  }
  return layer.id;
}

function noPublishedValueEntry(): ExplorerMapLegendEntry {
  return {
    color: BOUNDARY_COLOR,
    detail:
      "Available published data do not support calculation of an Atlas gap score for this county. Not zero, not low priority, and not confirmed absence.",
    label: "Gap score unavailable",
    role: "missing",
  };
}

const PRIORITY_LABEL_EDGES = [30, 50, 70] as const;

/** Priority phrases that intersect one score-color band. The edges are the existing scales. */
function governedPriorityDetail(band: ScoreBand): string {
  const probes = [band.minInclusive];
  for (const edge of PRIORITY_LABEL_EDGES) {
    if (
      edge > band.minInclusive &&
      (band.maxExclusive === null || edge < band.maxExclusive)
    ) {
      probes.push(edge);
    }
  }
  const labels: string[] = [];
  for (const probe of probes) {
    const label = priorityLabel(probe);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels.join("; ");
}

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function observedScoreLabel(scores: readonly number[]): string {
  if (scores.length === 0) {
    return "Published score color";
  }
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (min === max) {
    return `Published score ${formatScore(min)}`;
  }
  return `Published scores ${formatScore(min)}–${formatScore(max)}`;
}

function bandThreshold(band: ScoreBand): string {
  if (band.maxExclusive === null) {
    return `${band.minInclusive} or higher`;
  }
  return `${band.minInclusive} to less than ${band.maxExclusive}`;
}

function scoreFitsBand(score: number, band: ScoreBand): boolean {
  if (score < band.minInclusive) {
    return false;
  }
  if (band.maxExclusive === null) {
    return true;
  }
  return score < band.maxExclusive;
}

/**
 * A governed band is claimed only when the painted color is that band's
 * published color and every painted score already falls inside it. Other
 * colors keep the observed score endpoints.
 */
function governedBandForColor(color: string): ScoreBand | null {
  const normalized = color.trim().toLowerCase();
  const byHex = SCORE_COLOR_BANDS.find(
    (band) => band.color.toLowerCase() === normalized
  );
  if (byHex) {
    return byHex;
  }
  const token = /^var\((?<token>--map-ramp-[1-6])\)$/.exec(normalized);
  const bandToken = token?.groups?.token;
  if (!bandToken) {
    return null;
  }
  return SCORE_COLOR_BANDS.find((band) => band.token === bandToken) ?? null;
}

function sourceDisplayLabel(
  key: string,
  source: ExplorerMapLegendSource | undefined
): string {
  const published = source?.label.trim() ?? "";
  if (published) {
    return published;
  }
  if (key in EXPECTED_SOURCE_LABEL) {
    return EXPECTED_SOURCE_LABEL[key as keyof typeof EXPECTED_SOURCE_LABEL];
  }
  return key;
}

function sourceVintagePhrase(
  key: string,
  sources: readonly ExplorerMapLegendSource[] | undefined
): string {
  const source = sources?.find((entry) => entry.key === key);
  const label = sourceDisplayLabel(key, source);
  const vintage = source?.vintage.trim() ?? "";
  if (!vintage) {
    return `${label} vintage unavailable`;
  }
  return `${label} ${vintage}`;
}

function legendPeriod(input: PaintInput, layerId: ExplorerMapLayerId): string {
  if (layerId === "boundaries") {
    return "County boundaries are not an evidence layer.";
  }
  const release = input.releaseId?.trim()
    ? `Release ${input.releaseId.trim()}`
    : null;
  const keys = CATEGORY_SOURCE_KEYS[layerId] ?? [];
  if (keys.length === 0) {
    return release
      ? `${release}. Source vintage unavailable.`
      : "Source vintage unavailable.";
  }
  const listed = keys
    .map((key) => sourceVintagePhrase(key, input.sources))
    .join(" · ");
  return release ? `${release}. ${listed}` : listed;
}

function dynamicExtraColor(step: number): string {
  const hue = (step * 29 + 11) % 360;
  const lightness = 28 + (step % 4) * 10;
  return `hsl(${hue},57%,${lightness}%)`;
}

function nextExtraColor(used: ReadonlySet<string>): string {
  for (const candidate of EXTRA_CATEGORY_COLORS) {
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  for (let step = 0; step < 1440; step += 1) {
    const color = dynamicExtraColor(step);
    if (!used.has(color)) {
      return color;
    }
  }
  return dynamicExtraColor(0);
}

/**
 * Value MapLibre can paint. Known status tokens resolve from CSS variables.
 * Expressions such as color-mix are dropped instead of being sent to the map.
 */
export function resolveExplorerMapColor(
  color: string | undefined
): string | undefined {
  if (!color) {
    return undefined;
  }
  const trimmed = color.trim();
  if (trimmed.startsWith("var(")) {
    if (typeof document === "undefined") {
      return undefined;
    }
    const token = trimmed.slice(4, -1).trim();
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();
    return paintableMapColor(value);
  }
  return paintableMapColor(trimmed);
}

function paintableMapColor(value: string): string | undefined {
  if (!value || value.startsWith("var(") || value.includes("color-mix(")) {
    return undefined;
  }
  return value;
}

function boundaryPaint(
  input: PaintInput,
  note: string,
  title: string,
  kind: LegendKind
): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  return {
    colorsByFips: new Map(),
    entries: [
      { color: BOUNDARY_COLOR, detail: null, label: "County boundary" },
    ],
    kind,
    layerId: layer.id,
    note,
    period: legendPeriod(
      input,
      layer.id === "boundaries" ? "boundaries" : layer.id
    ),
    scale: "segments",
    title,
    unit: null,
  };
}

function unavailablePaint(input: PaintInput): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  return {
    colorsByFips: new Map(),
    entries: [],
    kind: "unavailable",
    layerId: layer.id,
    note:
      layer.unavailableReason ??
      "This layer has no published map color scale. The map shows county boundaries only.",
    period: "Source vintage unavailable.",
    scale: "segments",
    title: layer.label,
    unit: null,
  };
}

function gapScorePaint(input: PaintInput): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  const groups = new Map<string, GapColorGroup>();
  const colorsByFips = new Map<string, string>();
  for (const county of input.counties) {
    const color = county.color.trim();
    if (!color) {
      continue;
    }
    colorsByFips.set(county.fips, color);
    let group = groups.get(color);
    if (!group) {
      group = { color, priorities: new Map(), scores: [] };
      groups.set(color, group);
    }
    const value = county.score.score;
    if (!Number.isFinite(value)) {
      continue;
    }
    group.scores.push(value);
    const priority =
      county.priority.trim() || "Published priority label unavailable";
    const current = group.priorities.get(priority);
    if (current === undefined || value < current) {
      group.priorities.set(priority, value);
    }
  }
  const matched = new Set<string>();
  const entries: ExplorerMapLegendEntry[] = [noPublishedValueEntry()];
  for (const band of SCORE_COLOR_BANDS) {
    const group = [...groups.values()].find((candidate) => {
      if (matched.has(candidate.color)) {
        return false;
      }
      return governedBandForColor(candidate.color)?.id === band.id;
    });
    const priorities = group
      ? [...group.priorities.entries()]
          .toSorted(
            (left, right) =>
              left[1] - right[1] || left[0].localeCompare(right[0])
          )
          .map(([label]) => label)
      : [];
    const fits =
      group !== undefined &&
      group.scores.length > 0 &&
      group.scores.every((score) => scoreFitsBand(score, band));
    if (group && !fits) {
      matched.add(group.color);
      entries.push({
        color: group.color,
        detail:
          priorities.join("; ") ||
          "Painted scores fall outside this color's governed band.",
        label: observedScoreLabel(group.scores),
        role: "class",
      });
      continue;
    }
    if (group) {
      matched.add(group.color);
    }
    const governedParts = governedPriorityDetail(band).split("; ");
    const extras = priorities.filter((label) => !governedParts.includes(label));
    entries.push({
      color: group?.color ?? band.color,
      detail: [...governedParts, ...extras].join("; "),
      label: bandThreshold(band),
      role: "class",
    });
  }
  for (const group of groups.values()) {
    if (matched.has(group.color)) {
      continue;
    }
    const priorities = [...group.priorities.entries()]
      .toSorted(
        (left, right) => left[1] - right[1] || left[0].localeCompare(right[0])
      )
      .map(([label]) => label);
    entries.push({
      color: group.color,
      detail: priorities.join("; ") || "Published priority label unavailable",
      label: observedScoreLabel(group.scores),
      role: "class",
    });
  }
  return {
    colorsByFips,
    entries,
    kind: "choropleth",
    layerId: layer.id,
    note: "Colors are the published score colors. Every governed band stays on the legend. A band keeps its numeric range only when every score painted in that color already falls inside it. Priority labels can span more than one color. This is surveillance review priority, not personal disease risk and not an ML surveillance label. A missing color is not zero or low priority. The county list stays the review ranking.",
    period: legendPeriod(input, layer.id),
    scale: "segments",
    title: "Atlas gap score",
    unit: "review-priority score",
  };
}

type StatusKind = "category" | "neutral" | "observed-zero";

function statusKind(value: string): StatusKind {
  const normalized = value.trim().toLowerCase();
  if (
    /^(?:0|zero|none|not detected|negative|absent|no detection)$/.test(
      normalized
    )
  ) {
    return "observed-zero";
  }
  if (
    /no records|missing|unknown|unavailable|not supplied|suppressed|not ranked/.test(
      normalized
    )
  ) {
    return "neutral";
  }
  return "category";
}

function statusLabel(status: string, kind: StatusKind): string {
  switch (kind) {
    case "category": {
      return status;
    }
    case "neutral": {
      return `${status} (not zero, not confirmed absence)`;
    }
    case "observed-zero": {
      return `${status} (observed zero or negative finding)`;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function statusSortKey(status: string, kind: StatusKind): string {
  const normalized = status.trim().toLowerCase();
  switch (kind) {
    case "category": {
      const preferred = ["established", "reported", "present"].indexOf(
        normalized
      );
      return preferred === -1
        ? `1-${normalized}`
        : `0-${String(preferred).padStart(2, "0")}`;
    }
    case "observed-zero": {
      return `2-${normalized}`;
    }
    case "neutral": {
      const preferred = [
        "no records",
        "unknown",
        "missing",
        "unavailable",
        "suppressed",
        "not ranked",
        "not supplied",
      ].indexOf(normalized);
      return preferred === -1
        ? `4-${normalized}`
        : `3-${String(preferred).padStart(2, "0")}`;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function statusLegend(
  counties: readonly CountyScoreSummary[],
  read: (county: CountyScoreSummary) => string
): { colors: Map<string, string>; entries: ExplorerMapLegendEntry[] } {
  const statuses = [
    ...new Set(counties.map((county) => read(county).trim() || "Unavailable")),
  ].toSorted((left, right) =>
    statusSortKey(left, statusKind(left)).localeCompare(
      statusSortKey(right, statusKind(right))
    )
  );
  const colors = new Map<string, string>();
  const used = new Set<string>(RESERVED_STATUS_COLORS);
  for (const status of statuses) {
    const kind = statusKind(status);
    const normalized = status.trim().toLowerCase();
    let color: string;
    if (kind === "neutral") {
      color = neutralStatusColor(normalized);
    } else if (kind === "observed-zero") {
      color = OBSERVED_ZERO_COLOR;
    } else {
      color = POSITIVE_STATUS_COLOR[normalized] ?? nextExtraColor(used);
    }
    colors.set(status, color);
    used.add(color);
  }
  return {
    colors,
    entries: statuses.map((status) => ({
      color: colors.get(status) ?? NEUTRAL_STATUS_COLOR,
      detail: null,
      label: statusLabel(status, statusKind(status)),
    })),
  };
}

function tickStatusPaint(input: PaintInput): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  const legend = buildTickStatusLegend(
    input.counties.map((county) => county.tick_status),
    nextExtraColor
  );
  const byClass = new Map(legend.map((entry) => [entry.classId, entry]));
  const colorsByFips = new Map<string, string>();
  for (const county of input.counties) {
    const color = byClass.get(tickStatusClassId(county.tick_status))?.color;
    if (color) {
      colorsByFips.set(county.fips, color);
    }
  }
  return {
    colorsByFips,
    entries: legend.map((entry) => ({
      color: entry.color,
      detail: null,
      label: entry.label,
      role: "class" as const,
      visibleLines: entry.visibleLines,
    })),
    kind: "categorical",
    layerId: layer.id,
    note: "Colors are separate published status categories, not a continuous risk gradient or a severity ranking. No records is not absence. An observed zero stays distinct from a missing status.",
    period: legendPeriod(input, layer.id),
    scale: "segments",
    title: layer.label,
    unit: "published status category",
  };
}

function categoricalPaint(
  input: PaintInput,
  read: (county: CountyScoreSummary) => string
): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  const legend = statusLegend(input.counties, read);
  const colorsByFips = new Map<string, string>();
  for (const county of input.counties) {
    const status = read(county).trim() || "Unavailable";
    colorsByFips.set(
      county.fips,
      legend.colors.get(status) ?? NEUTRAL_STATUS_COLOR
    );
  }
  return {
    colorsByFips,
    entries: legend.entries.map((entry) => ({
      ...entry,
      role: "class" as const,
    })),
    kind: "categorical",
    layerId: layer.id,
    note: "Colors are separate published status categories, not a continuous risk gradient or a severity ranking. No records is not absence. An observed zero stays distinct from a missing status.",
    period: legendPeriod(input, layer.id),
    scale: "segments",
    title: layer.label,
    unit: "published status category",
  };
}

function loadingPaint(input: PaintInput, note: string): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  return {
    colorsByFips: new Map(),
    entries: [],
    kind: "loading",
    layerId: layer.id,
    note,
    period: legendPeriod(input, layer.id),
    scale: "segments",
    title: layer.label,
    unit: null,
  };
}

function observationPaint(input: PaintInput): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  const observation = input.observation;
  if (!isExplorerObservationLayer(layer.id)) {
    return unavailablePaint(input);
  }
  if (observation?.status === "ready") {
    return paintReadyObservationLayer({
      layerId: layer.id,
      omitted: observation.omitted,
      period: observation.period,
      releaseId: input.releaseId,
      rows: observation.rows,
      selectedFips: input.selectedFips,
      sourceLabel: observation.sourceLabel,
      unit: observation.unit,
    });
  }
  if (observation?.status === "error") {
    return {
      ...unavailablePaint(input),
      note: observation.reason,
    };
  }
  return loadingPaint(
    input,
    observation?.reason ??
      `Loading ${layer.label} from the published observation collection.`
  );
}

/**
 * Colors for counties the geometry can draw. Score colors are copied from the
 * scores response. Observation colors come from admitted rows only. Missing
 * stays missing.
 */
export function paintExplorerMapLayer(input: PaintInput): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  const layerId = layer.id;
  switch (layerId) {
    case "boundaries": {
      return boundaryPaint(
        input,
        "County boundaries only. This map is not colored by Atlas gap score.",
        "County boundaries",
        "boundaries"
      );
    }
    case "incidence_floor":
    case "rurality":
    case "svi":
    case "uninsured": {
      return observationPaint(input);
    }
    case "completeness": {
      if (input.scoresStatus === "loading") {
        return loadingPaint(
          input,
          "Loading evidence completeness from the published scores collection."
        );
      }
      if (input.scoresStatus === "error" || input.counties.length === 0) {
        return boundaryPaint(
          input,
          "Evidence completeness could not be loaded from the scores collection. The map shows county boundaries only.",
          "County boundaries",
          "unavailable"
        );
      }
      return paintReadyCompletenessLayer({
        counties: input.counties,
        period: legendPeriod(input, "completeness"),
        selectedFips: input.selectedFips,
      });
    }
    case "gap_score":
    case "pathogen_status":
    case "tick_status": {
      if (input.scoresStatus === "loading") {
        return loadingPaint(
          input,
          `Loading ${layer.label} from the published scores collection.`
        );
      }
      if (input.scoresStatus === "error" || input.counties.length === 0) {
        return boundaryPaint(
          input,
          `${layer.label} could not be loaded from the scores collection. The map shows county boundaries only.`,
          "County boundaries",
          "unavailable"
        );
      }
      if (layerId === "gap_score") {
        return gapScorePaint(input);
      }
      if (layerId === "tick_status") {
        return tickStatusPaint(input);
      }
      return categoricalPaint(input, (county) => county.burgdorferi_status);
    }
    default: {
      const exhaustive: never = layerId;
      return exhaustive;
    }
  }
}
