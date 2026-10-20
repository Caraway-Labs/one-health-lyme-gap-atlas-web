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
