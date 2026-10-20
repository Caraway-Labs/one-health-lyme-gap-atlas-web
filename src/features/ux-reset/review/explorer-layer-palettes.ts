/**
 * Per-layer Explorer map and legend colors.
 * Sibling palette tickets append their own constants. Do not retune another
 * layer's anchors here.
 *
 * Lyme incidence (#745) is a continuous ramp on the existing observed
 * minimum-to-maximum ratio. Anchor positions are 0, 0.25, 0.5, 0.75, and 1.
 * They are not epidemiologic cutoffs.
 */

export const LYME_INCIDENCE_RAMP = [
  "#E5F5E0",
  "#A1D99B",
  "#41D65C",
  "#238B45",
  "#005A32",
] as const;

export const LYME_INCIDENCE_MISSING_COLOR = "#D1D5DB";

export const LYME_INCIDENCE_LOW_LABEL = "Lower published incidence";

export const LYME_INCIDENCE_HIGH_LABEL = "Higher published incidence";

export const LYME_INCIDENCE_UNIT_LABEL = "per 100,000 residents";

/**
 * B. burgdorferi status is categorical. No records uses the coordinated light
 * gray. Present is one indigo and is not a stop on the incidence ramp.
 */
export const BURGDORFERI_NO_RECORDS_COLOR = "#D1D5DB";
export const BURGDORFERI_PRESENT_COLOR = "#4F46E5";

/**
 * Uninsured population (#749) is a continuous ramp on the existing 0 to 100
 * percent scale. Anchor positions are 0, 0.25, 0.5, 0.75, and 1.
 * They are not percentage cutoffs.
 */
export const UNINSURED_POPULATION_RAMP = [
  "#FCE4EC",
  "#F7B6CF",
  "#E66A9A",
  "#BA3167",
  "#740D3D",
] as const;

export const UNINSURED_POPULATION_MISSING_COLOR = "#D1D5DB";

export const UNINSURED_POPULATION_LOW_LABEL = "Lower uninsured percentage";

export const UNINSURED_POPULATION_HIGH_LABEL = "Higher uninsured percentage";

/**
 * Social vulnerability (#748) is a continuous ramp on the existing 0 to 1
 * national county percentile. Anchor positions are 0, 0.25, 0.5, 0.75, and 1.
 * They are not new percentile cutoffs.
 */
export const SVI_RAMP = [
  "#FEEBE2",
  "#FDC9A9",
  "#FDA06B",
  "#E56B2F",
  "#A63603",
] as const;

export const SVI_NO_DATA_COLOR = "#D1D5DB";

export const SVI_LOW_LABEL = "Lower social vulnerability";

export const SVI_HIGH_LABEL = "Higher social vulnerability";

/**
 * County boundaries (#751) are geography only. These colors are not a score
 * ramp and are not the gray used for unavailable disease data.
 *
 * Stroke widths are zoom stops, not a data scale. The national Explorer pane
 * is about zoom 2.3–3.5. County strokes stay exactly zero through zoom 3.8.
 * A fractional width still rasterizes as a visible hairline, and that hairline
 * turns the national view into a dark mass. State and coast lines carry the
 * geography there. County strokes start at zoom 4.2 and thicken toward a
 * state frame (about zoom 5–6) and the map's maximum zoom (8). State strokes
 * stay heavier than county strokes. A selected state's perimeter stays black
 * at width 2.5. Hover and the selected county use a heavier stroke, and the
 * selected county adds a light casing.
 */
export const COUNTY_BOUNDARIES_BACKGROUND = "#F8FAFC";

export const COUNTY_BOUNDARIES_FILL = "#F3F4F6";

export const COUNTY_BOUNDARIES_STROKE = "#4B5563";

export const COUNTY_BOUNDARIES_STATE_STROKE = "#1F2937";

export const COUNTY_BOUNDARIES_SELECTED_STATE_STROKE = "#000000";

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_STROKE = "#111827";

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING = "#FFFFFF";

export const COUNTY_BOUNDARIES_SELECTED_STATE_WIDTH = 2.5;

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_WIDTH = 2.75;

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING_WIDTH = 5.5;

export const COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS = [
  [2, 0],
  [3.8, 0],
  [4.2, 0.45],
  [5.5, 0.9],
  [8, 1.35],
] as const;

export const COUNTY_BOUNDARIES_STATE_STROKE_STOPS = [
  [2, 0.7],
  [3.2, 0.95],
  [5, 1.35],
  [8, 1.9],
] as const;

export const COUNTY_BOUNDARIES_HOVER_STROKE_STOPS = [
  [2, 0],
  [3.8, 0],
  [4.2, 1.35],
  [5.5, 1.8],
  [8, 2.4],
] as const;

export const COUNTY_BOUNDARIES_FILL_LABEL = "County fill";

export const COUNTY_BOUNDARIES_STROKE_LABEL = "County outline";

export const COUNTY_BOUNDARIES_STATE_LABEL = "State outline";

const HEX_COLOR = /^#(?<hex>[0-9A-Fa-f]{6})$/;

function hexToHsl(color: string): [number, number, number] | null {
  const match = HEX_COLOR.exec(color.trim());
  if (!match?.groups) {
    return null;
  }
  const hex = match.groups.hex;
  const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) {
    return [0, 0, lightness * 100];
  }
  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }
  return [hue * 60, saturation * 100, lightness * 100];
}

function mixHsl(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  ratio: number
): string {
  const hue = Math.round(start[0] + (end[0] - start[0]) * ratio);
  const saturation = Math.round(start[1] + (end[1] - start[1]) * ratio);
  const lightness = Math.round(start[2] + (end[2] - start[2]) * ratio);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Piecewise color along ordered low-to-high anchors. Exact anchor ratios keep
 * the anchor hex. In-between colors mix HSL inside that segment.
 */
export function mixExplorerRampColor(
  stops: readonly string[],
  ratio: number
): string {
  const first = stops[0];
  if (!first) {
    return "hsl(0, 0%, 50%)";
  }
  if (stops.length === 1 || ratio <= 0) {
    return first;
  }
  const last = stops.at(-1) ?? first;
  if (ratio >= 1) {
    return last;
  }
  const scaled = ratio * (stops.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = stops[index] ?? first;
  const end = stops[index + 1] ?? last;
  if (local === 0) {
    return start;
  }
  const startHsl = hexToHsl(start);
  const endHsl = hexToHsl(end);
  if (!(startHsl && endHsl)) {
    return local < 0.5 ? start : end;
  }
  return mixHsl(startHsl, endHsl, local);
}
