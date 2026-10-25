# County boundaries map palette

County outlines stay on every thematic Explorer layer through the shared `fill-outline-color`. The boundaries-only **County boundaries** choice is no longer in the Map layer menu. A saved or shared `layer=boundaries` value falls back to Gap review score.

The notes below record the neutral geography chrome `AtlasMap` applies only when `neutralCountyBoundaries` is set. Explorer no longer selects that presentation. Desktop only. Other layer palettes, score colors, and the shared selected-county stroke stay on their current definitions.

## Source

| Item | Path |
| --- | --- |
| Layer id | Retired. `boundaries` is not a member of `EXPLORER_MAP_LAYERS`. |
| Legend title | `County boundaries` |
| Paint | `boundaryPaint` for this layer only. Failed score or completeness loads still use the old boundary swatch and are not this layer. |
| Map chrome | `AtlasMap` in `src/components/atlas-map.tsx` |
| Geometry | Display polygons from `GET /v1/atlas/geometry`. County features are not topologically shared. |
| Period copy | `County boundaries are not an evidence layer.` |

This layer has no numeric measure, bin, or value state. It does not recolor gap review, incidence, tick status, pathogen status, social vulnerability, uninsured population, rurality, or evidence completeness.

## Current mapping

| Surface | Current treatment |
| --- | --- |
| Map surround | `.map-wrap` gradient `#f7fbfb` to `#f0f6f5`, showing through a transparent canvas |
| County fill | `#e4e9ea` (`--explorer-boundary`) because `colorsByFips` is empty |
| County stroke | `fill-outline-color` `rgba(255,255,255,.9)` on every layer |
| Selected state | `selected-state-outline` strokes every county ring in the selected state. Black `#000000` at width `2.5`, or the zoom width when the camera is state-focused. A fresh map with nothing selected may still hold the legacy accent `#0b7285`, but clearing a highlight hides the layer immediately and does not repaint that stroke teal. |
| Selected county | Solid `#000000` at full opacity. Constant width `5` CSS pixels. No casing or blur. |
| Legend | One full-width swatch, `var(--explorer-boundary)`, label `County boundary`, no numeric captions |

## Final mapping

Shared constants live in `src/features/ux-reset/review/county-boundaries-palette.ts`. They apply only while this layer is selected.

| Surface | Color |
| --- | --- |
| Background, including area outside counties | `#F8FAFC` |
| County fill | `#F3F4F6` at full opacity |
| County stroke | `#4B5563` |
| State perimeter, including coastline | `#1F2937` |
| Selected state perimeter | `#000000` |
| Selected county | The shared solid `#000000` stroke at constant width `5` CSS pixels, drawn above county, state, and hover lines. Hover does not replace it. |
| Hover county | `#111827`, heavier than the county stroke, with a `#F8FAFC` casing. No fill change |

The neutral fill is geography. The legend stays a single swatch with a charcoal inset stroke, label `County boundary`, and no numeric captions. The swatch text says the fill is not a score, not disease data, and not a missing value.

State perimeters are the county edges whose midpoint is more than `0.008` degrees from another county in the same state. That tolerance is wider than the gaps between generalized neighbors in Colorado (median about `0`) and still leaves a state-length perimeter (Colorado: 40 outer segments, about 22 degrees). Interior edges stay county strokes. The shared `selected-state-outline` layer keeps its black color and width `2.5` for the existing outline checks, and its opacity is `0` on this layer so those strokes do not repaint every interior county edge.

## Zoom widths

Widths are CSS pixels. Measured Explorer cameras: national `1440×900` zoom `2.55`, national `1280×800` zoom `2.29`, Colorado focus zoom `5.48`, selected county zoom `7.86`. Map zoom stops are `0` to `8` on the national Explorer.

| Zoom | County `#4B5563` | State `#1F2937` | Selected state `#000000` |
| ---- | ---------------- | --------------- | ------------------------ |
| 2    | 0.2              | 1.05            | 2.5                      |
| 3    | 0.32             | 1.25            | 2.5                      |
| 4.5  | 0.75             | 1.55            | 2.5                      |
| 6    | 1.15             | 1.9             | 2.5                      |
| 8    | 1.55             | 2.25            | 2.5                      |

County and state widths interpolate linearly between those stops. At national zoom the county stroke stays a fine line so the eastern United States does not become a dark mass, and state perimeters stay darker and heavier. The selected state perimeter stays black at the existing `2.5` weight in both the national frame and a state frame. Hover width interpolates from `1.8` at zoom 2 to `3.6` at zoom 8, with a casing from `3.2` to `5.2`. Hover uses line opacity rather than nesting that zoom expression, so the stroke appears only on the county under the pointer.
