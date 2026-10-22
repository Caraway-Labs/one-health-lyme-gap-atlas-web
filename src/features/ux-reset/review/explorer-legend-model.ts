import {
  LYME_INCIDENCE_HIGH_LABEL,
  LYME_INCIDENCE_LOW_LABEL,
  LYME_INCIDENCE_UNIT_LABEL,
  mixExplorerRampColor,
  SVI_HIGH_LABEL,
  SVI_LOW_LABEL,
  UNINSURED_POPULATION_HIGH_LABEL,
  UNINSURED_POPULATION_LOW_LABEL,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import {
  approvedSegmentTooltip,
  type ExplorerLegendAboutSection,
  explorerLegendAboutSections,
  GAP_NO_SCORE_INFO,
  gapLegendCopyForMinimum,
  quantityColorSentence,
} from "@/features/ux-reset/review/explorer-legend-info-copy";
import { mixExplorerScaleColor } from "@/features/ux-reset/review/explorer-map-layer-scale";
import type {
  ExplorerLegendScale,
  ExplorerMapLayerId,
  ExplorerMapLegendEntry,
  ExplorerMapPaint,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  RURALITY_MORE_RURAL_LABEL,
  RURALITY_MORE_URBAN_LABEL,
} from "@/features/ux-reset/review/rurality-palette";
import { SCORE_COLOR_BANDS } from "@/features/ux-reset/review/suggested-follow-up-content";

const NO_PUBLISHED_VALUE = "No published value";
const GAP_SCORE_UNAVAILABLE_LABEL = "Gap score unavailable";

/**
 * Gray has no score band. Colored bands use the approved review category
 * and follow-up, which agree with the INFO table.
 */
const GAP_SCORE_UNAVAILABLE_DISCLOSURE = {
  action: GAP_NO_SCORE_INFO.action,
  category: GAP_NO_SCORE_INFO.category,
  title: GAP_SCORE_UNAVAILABLE_LABEL,
} as const;

export type ExplorerLegendDisclosure = {
  action: string;
  category: string | null;
  title: string;
};

export type ExplorerLegendSegment = {
  accessibleName: string;
  color: string;
  disclosure: ExplorerLegendDisclosure | null;
  id: string;
  label: string;
  outline?: string;
  role: ExplorerMapLegendEntry["role"];
  tooltip: string;
  visibleLines?: readonly string[];
};

export type ExplorerLegendGradientStop = {
  color: string;
  percent: number;
};

export type ExplorerLegendGradient = {
  accessibleName: string;
  highColor: string;
  lowColor: string;
  stops: readonly ExplorerLegendGradientStop[];
  tooltip: string;
};

const GRADIENT_STOP_PERCENTS = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
  100,
] as const;

export type ExplorerLegendModel = {
  aboutLabel: string;
  aboutSections: readonly ExplorerLegendAboutSection[];
  gradient: ExplorerLegendGradient | null;
  leftCaption: string | null;
  mode: "gradient" | "message" | "segments";
  rightCaption: string | null;
  segments: readonly ExplorerLegendSegment[];
  status: string | null;
  title: string;
  unitLabel: string | null;
};

function compactRange(label: string): string {
  const lessThan =
    /^(?<low>\d+(?:\.\d+)?) to less than (?<high>\d+(?:\.\d+)?)$/.exec(label);
  if (lessThan?.groups) {
    return `${lessThan.groups.low} to <${lessThan.groups.high}`;
  }
  const higher = /^(?<low>\d+(?:\.\d+)?) or higher$/.exec(label);
  if (higher?.groups) {
    return `>=${higher.groups.low}`;
  }
  return label;
}

function endpointCaption(label: string): string {
  const head = label.split(" (")[0]?.trim();
  return head || label;
}

function methodologyCopy(entry: ExplorerMapLegendEntry): string {
  if (entry.label === NO_PUBLISHED_VALUE) {
    return entry.detail
      ? `${NO_PUBLISHED_VALUE}. ${entry.detail}`
      : NO_PUBLISHED_VALUE;
  }
  const range = compactRange(entry.label);
  const detail = entry.detail?.trim();
  if (range !== entry.label && detail) {
    return `${range}. ${detail}`;
  }
  if (detail) {
    return `${entry.label}. ${detail}`;
  }
  return entry.label;
}

function disclosureAccessibleName(
  disclosure: ExplorerLegendDisclosure
): string {
  if (disclosure.category) {
    return `${disclosure.title}. ${disclosure.category}. ${disclosure.action}`;
  }
  return `${disclosure.title}. ${disclosure.action}`;
}

function scoreBandThreshold(band: (typeof SCORE_COLOR_BANDS)[number]): string {
  if (band.maxExclusive === null) {
    return `${band.minInclusive} or higher`;
  }
  return `${band.minInclusive} to less than ${band.maxExclusive}`;
}

function gapScoreRangeTitle(band: (typeof SCORE_COLOR_BANDS)[number]): string {
  if (band.maxExclusive === null) {
    return `Gap review score: ${band.minInclusive} or higher`;
  }
  return `Gap review score: ${band.minInclusive} to <${band.maxExclusive}`;
}

function gapScoreDisclosure(
  layerId: ExplorerMapLayerId | undefined,
  label: string
): ExplorerLegendDisclosure | null {
  if (layerId !== "gap_score") {
    return null;
  }
  if (label === GAP_SCORE_UNAVAILABLE_LABEL) {
    return GAP_SCORE_UNAVAILABLE_DISCLOSURE;
  }
  const band = SCORE_COLOR_BANDS.find(
    (entry) => scoreBandThreshold(entry) === label
  );
  const copy = band ? gapLegendCopyForMinimum(band.minInclusive) : null;
  if (!(band && copy)) {
    return null;
  }
  return {
    action: copy.action,
    category: copy.category,
    title: gapScoreRangeTitle(band),
  };
}

function toSegment(
  entry: ExplorerMapLegendEntry,
  index: number,
  layerId?: ExplorerMapLayerId
): ExplorerLegendSegment {
  const methodology = methodologyCopy(entry);
  const disclosure = gapScoreDisclosure(layerId, entry.label);
  const approved =
    layerId && !disclosure ? approvedSegmentTooltip(layerId, entry) : null;
  const accessibleName = disclosure
    ? disclosureAccessibleName(disclosure)
    : methodology;
  return {
    accessibleName,
    color: entry.color,
    disclosure,
    id: `${index}-${entry.label}`,
    label: entry.label,
    outline: entry.outline,
    role: entry.role,
    tooltip: approved ?? accessibleName,
    visibleLines: entry.visibleLines,
  };
}

function classEntries(
  entries: readonly ExplorerMapLegendEntry[]
): ExplorerMapLegendEntry[] {
  return entries.filter(
    (entry) => entry.role !== "missing" && entry.role !== "note"
  );
}

function missingEntries(
  entries: readonly ExplorerMapLegendEntry[]
): ExplorerMapLegendEntry[] {
  return entries.filter((entry) => entry.role === "missing");
}

function captionsForSegments(
  paint: ExplorerMapPaint,
  classes: readonly ExplorerMapLegendEntry[],
  missing: readonly ExplorerMapLegendEntry[]
): { left: string | null; right: string | null } {
  if (paint.layerId === "gap_score") {
    const high =
      classes.find((entry) => entry.label === "75 or higher") ?? classes.at(-1);
    return {
      left: missing.some(
        (entry) =>
          entry.label === NO_PUBLISHED_VALUE ||
          entry.label === "Gap score unavailable"
      )
        ? "Gap score unavailable"
        : null,
      right: high ? compactRange(high.label) : null,
    };
  }
  if (paint.layerId === "rurality") {
    return {
      left: RURALITY_MORE_URBAN_LABEL,
      right: RURALITY_MORE_RURAL_LABEL,
    };
  }
  if (paint.layerId === "completeness" && classes.length > 0) {
    return {
      left: missing.length > 0 ? "No data" : (classes[0]?.label ?? null),
      right: classes.at(-1)?.label ?? null,
    };
  }
  if (missing.length > 0 && classes.length > 0) {
    return { left: "No data", right: null };
  }
  return { left: null, right: null };
}

function scaleGradientStops(
  low: string,
  high: string,
  ramp: readonly string[] | undefined
): ExplorerLegendGradientStop[] {
  return GRADIENT_STOP_PERCENTS.map((percent) => ({
    color:
      ramp && ramp.length >= 2
        ? mixExplorerRampColor(ramp, percent / 100)
        : mixExplorerScaleColor(low, high, percent / 100),
    percent,
  }));
}

function legendUnit(paint: ExplorerMapPaint): string {
  if (
    paint.layerId === "incidence_floor" &&
    paint.unit?.trim() === "per 100,000"
  ) {
    return LYME_INCIDENCE_UNIT_LABEL;
  }
  return paint.unit?.trim() ?? "";
}

function quantityPhrase(layerId: ExplorerMapLayerId): {
  highLabel: string;
  lowLabel: string;
  scaleSentence: string;
} | null {
  if (layerId === "incidence_floor") {
    return {
      highLabel: LYME_INCIDENCE_HIGH_LABEL,
      lowLabel: LYME_INCIDENCE_LOW_LABEL,
      scaleSentence:
        "Darker green means higher reported incidence. Gray indicates unavailable data. A reported zero remains separate from missing data.",
    };
  }
  if (layerId === "uninsured") {
    return {
      highLabel: UNINSURED_POPULATION_HIGH_LABEL,
      lowLabel: UNINSURED_POPULATION_LOW_LABEL,
      scaleSentence:
        "Darker burgundy means a higher uninsured percentage. Gray indicates unavailable data; 0% means a reported uninsured percentage of zero.",
    };
  }
  if (layerId === "svi") {
    return {
      highLabel: SVI_HIGH_LABEL,
      lowLabel: SVI_LOW_LABEL,
      scaleSentence:
        "Higher values and darker orange indicate greater social vulnerability relative to other U.S. counties. The value is a county ranking, not the percentage of residents who are vulnerable. Gray indicates unavailable data.",
    };
  }
  return null;
}

function constantNumericSwatch(
  paint: ExplorerMapPaint,
  low: ExplorerMapLegendEntry,
  missing: readonly ExplorerLegendSegment[]
): Pick<
  ExplorerLegendModel,
  "gradient" | "leftCaption" | "rightCaption" | "segments"
> {
  const value = endpointCaption(low.label);
  const displayUnit = legendUnit(paint);
  const unit = displayUnit ? ` ${displayUnit}` : "";
  const phrase = quantityPhrase(paint.layerId);
  const color = quantityColorSentence(paint.layerId);
  const lead = phrase
    ? `${phrase.lowLabel} ${value}${unit}.`
    : `${value}${unit}.`;
  const text = color ? `${lead} ${color}` : lead;
  const swatch = toSegment(low, missing.length, paint.layerId);
  return {
    gradient: null,
    leftCaption: phrase ? `${phrase.lowLabel}\n${value}` : value,
    rightCaption: null,
    segments: [
      ...missing,
      {
        ...swatch,
        accessibleName: text,
        disclosure: null,
        label: value,
        tooltip: text,
      },
    ],
  };
}

function gradientModel(
  paint: ExplorerMapPaint
): Pick<
  ExplorerLegendModel,
  "gradient" | "leftCaption" | "rightCaption" | "segments"
> {
  const low = paint.entries.find((entry) => entry.role === "endpoint-low");
  const high = paint.entries.find((entry) => entry.role === "endpoint-high");
  const note = paint.entries.find((entry) => entry.role === "note");
  const missing = missingEntries(paint.entries).map((entry, index) =>
    toSegment(entry, index, paint.layerId)
  );
  if (!low) {
    return {
      gradient: null,
      leftCaption: missing.length > 0 ? "No data" : null,
      rightCaption: null,
      segments: missing,
    };
  }
  if (!high) {
    return constantNumericSwatch(paint, low, missing);
  }
  const unit = legendUnit(paint);
  const unitSuffix = unit ? ` ${unit}` : "";
  const highest = note
    ? ` Highest published value in this view: ${endpointCaption(note.label)}.`
    : "";
  const phrase = quantityPhrase(paint.layerId);
  const lowNumber = endpointCaption(low.label);
  const highNumber = endpointCaption(high.label);
  const color = phrase?.scaleSentence ?? quantityColorSentence(paint.layerId);
  const range = phrase
    ? `${phrase.lowLabel} ${lowNumber} to ${phrase.highLabel} ${highNumber}${unitSuffix}.`
    : `${lowNumber} to ${highNumber}${unitSuffix}.`;
  const tooltip = `${range}${color ? ` ${color}` : ""}${highest}`;
  return {
    gradient: {
      accessibleName: tooltip,
      highColor: high.color,
      lowColor: low.color,
      stops: scaleGradientStops(low.color, high.color, paint.ramp),
      tooltip,
    },
    leftCaption: phrase ? `${phrase.lowLabel}\n${lowNumber}` : lowNumber,
    rightCaption: phrase ? `${phrase.highLabel}\n${highNumber}` : highNumber,
    segments: missing,
  };
}

export function buildExplorerLegendModel(
  paint: ExplorerMapPaint
): ExplorerLegendModel {
  const unitText = legendUnit(paint);
  const unitLabel =
    paint.layerId === "gap_score" &&
    paint.unit?.trim() === "review-priority score"
      ? null
      : unitText.length > 0
        ? unitText
        : null;
  const base = {
    aboutLabel: `About ${paint.title}`,
    aboutSections: explorerLegendAboutSections(paint),
    title: paint.title,
    unitLabel,
  };
  if (paint.kind === "loading" || paint.kind === "unavailable") {
    return {
      ...base,
      gradient: null,
      leftCaption: null,
      mode: "message",
      rightCaption: null,
      segments: [],
      status: paint.note,
    };
  }
  const scale: ExplorerLegendScale = paint.scale;
  if (scale === "gradient") {
    const gradient = gradientModel(paint);
    return {
      ...base,
      ...gradient,
      mode: gradient.gradient ? "gradient" : "segments",
      status: null,
    };
  }
  const missing = missingEntries(paint.entries);
  const classes = classEntries(paint.entries).filter(
    (entry) => entry.role !== "endpoint-low" && entry.role !== "endpoint-high"
  );
  const ordered = [...missing, ...classes];
  const captions = captionsForSegments(paint, classes, missing);
  return {
    ...base,
    gradient: null,
    leftCaption: captions.left,
    mode: "segments",
    rightCaption: captions.right,
    segments: ordered.map((entry, index) =>
      toSegment(entry, index, paint.layerId)
    ),
    status: ordered.length === 0 ? paint.note : null,
  };
}
