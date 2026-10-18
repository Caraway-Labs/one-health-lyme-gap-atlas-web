import { mixExplorerScaleColor } from "@/features/ux-reset/review/explorer-map-layer-scale";
import type {
  ExplorerLegendScale,
  ExplorerMapLegendEntry,
  ExplorerMapPaint,
} from "@/features/ux-reset/review/explorer-map-layers";

const NO_PUBLISHED_VALUE = "No published value";

export type ExplorerLegendSegment = {
  accessibleName: string;
  color: string;
  id: string;
  label: string;
  role: ExplorerMapLegendEntry["role"];
  tooltip: string;
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

export type ExplorerLegendAboutSection = {
  heading: string;
  paragraphs: readonly string[];
};

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

function segmentCopy(entry: ExplorerMapLegendEntry): {
  accessibleName: string;
  tooltip: string;
} {
  if (entry.label === NO_PUBLISHED_VALUE) {
    const text = entry.detail
      ? `${NO_PUBLISHED_VALUE}. ${entry.detail}`
      : NO_PUBLISHED_VALUE;
    return { accessibleName: text, tooltip: text };
  }
  const range = compactRange(entry.label);
  const detail = entry.detail?.trim();
  if (range !== entry.label && detail) {
    const text = `${range}. ${detail}`;
    return { accessibleName: text, tooltip: text };
  }
  if (detail) {
    const text = `${entry.label}. ${detail}`;
    return { accessibleName: text, tooltip: text };
  }
  return { accessibleName: entry.label, tooltip: entry.label };
}

function toSegment(
  entry: ExplorerMapLegendEntry,
  index: number
): ExplorerLegendSegment {
  const copy = segmentCopy(entry);
  return {
    accessibleName: copy.accessibleName,
    color: entry.color,
    id: `${index}-${entry.label}`,
    label: entry.label,
    role: entry.role,
    tooltip: copy.tooltip,
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
      left: missing.some((entry) => entry.label === NO_PUBLISHED_VALUE)
        ? "No data"
        : null,
      right: high ? compactRange(high.label) : null,
    };
  }
  if (paint.layerId === "rurality") {
    return {
      left: missing.length > 0 ? "No data" : "1",
      right: "9",
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
  high: string
): ExplorerLegendGradientStop[] {
  return GRADIENT_STOP_PERCENTS.map((percent) => ({
    color: mixExplorerScaleColor(low, high, percent / 100),
    percent,
  }));
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
  const unit = paint.unit ? ` ${paint.unit}` : "";
  const detail = low.detail?.trim();
  const text = detail ? `${value}${unit}. ${detail}` : `${value}${unit}.`;
  const swatch = toSegment(low, missing.length);
  return {
    gradient: null,
    leftCaption: value,
    rightCaption: null,
    segments: [
      ...missing,
      {
        ...swatch,
        accessibleName: text,
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
    toSegment(entry, index)
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
  const unit = paint.unit ? ` ${paint.unit}` : "";
  const zero =
    low.detail && low.label.includes("observed zero") ? ` ${low.detail}` : "";
  const highest = note
    ? ` ${note.label}. ${note.detail ?? "Not a separate class."}`
    : "";
  const tooltip = `${endpointCaption(low.label)} to ${endpointCaption(high.label)}${unit}. Color is mixed between these ends.${zero}${highest} Missing is not drawn as zero.`;
  return {
    gradient: {
      accessibleName: tooltip,
      highColor: high.color,
      lowColor: low.color,
      stops: scaleGradientStops(low.color, high.color),
      tooltip,
    },
    leftCaption: endpointCaption(low.label),
    rightCaption: endpointCaption(high.label),
    segments: missing,
  };
}

function aboutSections(paint: ExplorerMapPaint): ExplorerLegendAboutSection[] {
  const sections: ExplorerLegendAboutSection[] = [];
  const note = paint.note.trim();
  if (note) {
    sections.push({ heading: "How to read this layer", paragraphs: [note] });
  }
  const period = paint.period.trim();
  if (period) {
    sections.push({ heading: "Period and sources", paragraphs: [period] });
  }
  const classes = paint.entries
    .filter((entry) => entry.role !== "note")
    .map((entry) => segmentCopy(entry).tooltip);
  if (classes.length > 0) {
    sections.push({ heading: "Colors", paragraphs: classes });
  }
  const selection = paint.selection?.trim();
  if (selection) {
    sections.push({ heading: "Selected county", paragraphs: [selection] });
  }
  return sections;
}

export function buildExplorerLegendModel(
  paint: ExplorerMapPaint
): ExplorerLegendModel {
  const unitLabel = paint.unit?.trim() ? paint.unit.trim() : null;
  const base = {
    aboutLabel: `About ${paint.title}`,
    aboutSections: aboutSections(paint),
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
    segments: ordered.map((entry, index) => toSegment(entry, index)),
    status: ordered.length === 0 ? paint.note : null,
  };
}
