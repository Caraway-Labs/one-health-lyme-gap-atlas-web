/**
 * Rurality map and legend fills. Both read this module. Gap score, incidence,
 * tick status, pathogen status, and the other choropleth ramps stay on their
 * own scales.
 *
 * Stepped 2023 RUCC fills. Code 1 is light lavender. Code 9 is deep purple.
 * The steps are ordered classes, not an interpolated value and not a
 * proportional increase in rurality, Lyme risk, or review priority.
 */
export const RURALITY_NO_DATA_COLOR = "#D1D5DB";
export const RURALITY_NO_DATA_LABEL = "No data";
export const RURALITY_MORE_URBAN_LABEL = "More urban";
export const RURALITY_MORE_RURAL_LABEL = "More rural";
export const RURALITY_LEGEND_EXPLANATION =
  "Rural–Urban Continuum Codes classify counties by population size and proximity to metropolitan areas.";

export const RURALITY_RUCC_FILLS = {
  1: "#F2F0F7",
  2: "#E5E0EF",
  3: "#D5CCE5",
  4: "#BFB1D5",
  5: "#A590C4",
  6: "#8B6EB0",
  7: "#74529B",
  8: "#5D3985",
  9: "#46216E",
} as const;

export type RuralityRuccCode = keyof typeof RURALITY_RUCC_FILLS;

export function ruralityFillForCode(code: number): string | null {
  if (!Number.isInteger(code) || code < 1 || code > 9) {
    return null;
  }
  return RURALITY_RUCC_FILLS[code as RuralityRuccCode];
}
