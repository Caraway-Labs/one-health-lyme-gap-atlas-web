/**
 * Geography-only Explorer layer (#751).
 * Other layers do not read these colors. Do not retune them from a sibling
 * palette ticket.
 *
 * Zoom stops match docs/county-boundaries-map-palette.md.
 */

export const COUNTY_BOUNDARIES_BACKGROUND = "#F8FAFC";

export const COUNTY_BOUNDARIES_FILL = "#F3F4F6";

export const COUNTY_BOUNDARIES_COUNTY_STROKE = "#4B5563";

export const COUNTY_BOUNDARIES_STATE_STROKE = "#1F2937";

export const COUNTY_BOUNDARIES_SELECTED_STATE_STROKE = "#000000";

export const COUNTY_BOUNDARIES_HOVER_STROKE = "#111827";

export const COUNTY_BOUNDARIES_HOVER_CASING = "#F8FAFC";

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING = "#000000";

/** Matches the shared selected-county core so selection stays a weight change. */
export const COUNTY_BOUNDARIES_SELECTED_COUNTY_CORE = "#061f3d";

export const COUNTY_BOUNDARIES_SELECTED_STATE_LINE_WIDTH = 2.5;

export const COUNTY_BOUNDARIES_SELECTED_COUNTY_CASING_WIDTH = 6;

/**
 * Display geometry does not share vertices. A county edge whose midpoint is
 * this close to another county in the same state is an interior county line.
 */
export const COUNTY_BOUNDARY_SHARED_EDGE_DEGREES = 0.008;

export const COUNTY_BOUNDARIES_LEGEND_LABEL = "County boundary";

export const COUNTY_BOUNDARIES_LEGEND_DETAIL =
  "Neutral county fill with charcoal county outlines and darker state outlines. Not a score, not disease data, and not a missing value.";

export const COUNTY_BOUNDARIES_NOTE =
  "Shows county and state boundaries without displaying a data measure. Counties have a neutral fill, with darker lines marking state boundaries.";

export const COUNTY_BOUNDARY_COUNTY_LINE_WIDTH = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  0.2,
  3,
  0.32,
  4.5,
  0.75,
  6,
  1.15,
  8,
  1.55,
] as const;

export const COUNTY_BOUNDARY_STATE_LINE_WIDTH = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  1.05,
  3,
  1.25,
  4.5,
  1.55,
  6,
  1.9,
  8,
  2.25,
] as const;

export const COUNTY_BOUNDARY_HOVER_LINE_WIDTH = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  1.8,
  5,
  2.6,
  8,
  3.6,
] as const;

export const COUNTY_BOUNDARY_HOVER_CASING_LINE_WIDTH = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  3.2,
  5,
  4.2,
  8,
  5.2,
] as const;

/** Feature-state only. Zoom stays in the width expressions above. */
export const COUNTY_BOUNDARY_HOVER_OPACITY = [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  1,
  0,
] as const;
