import type { ExpressionSpecification } from "maplibre-gl";

import {
  COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS,
  COUNTY_BOUNDARIES_HOVER_STROKE_STOPS,
  COUNTY_BOUNDARIES_STATE_STROKE_STOPS,
} from "@/features/ux-reset/review/explorer-layer-palettes";

function zoomWidth(
  stops: readonly (readonly [number, number])[]
): ExpressionSpecification {
  const expression: unknown[] = ["interpolate", ["linear"], ["zoom"]];
  for (const [zoom, width] of stops) {
    expression.push(zoom, width);
  }
  return expression as ExpressionSpecification;
}

/** County strokes. One zoom interpolate; MapLibre allows only one per expression. */
export function countyBoundaryCountyLineWidth(): ExpressionSpecification {
  return zoomWidth(COUNTY_BOUNDARIES_COUNTY_STROKE_STOPS);
}

/** Heavier county stroke drawn only while the pointer is over that county. */
export function countyBoundaryHoverLineWidth(): ExpressionSpecification {
  return zoomWidth(COUNTY_BOUNDARIES_HOVER_STROKE_STOPS);
}

export function countyBoundaryHoverOpacity(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    1,
    0,
  ] as ExpressionSpecification;
}

/** State perimeters. Heavier than county strokes at the same zoom. */
export function countyBoundaryStateLineWidth(): ExpressionSpecification {
  return zoomWidth(COUNTY_BOUNDARIES_STATE_STROKE_STOPS);
}
