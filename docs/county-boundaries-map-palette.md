# County boundaries map palette

Spec for the Atlas Explorer County boundaries layer (`/explore?layer=boundaries`). Desktop only. Other layer palettes stay on their current definitions.

## Source

The layer is geography only. It has no score, measure, or observation rows.

| Item | Path |
| --- | --- |
| Layer id and label | `boundaries`, **County boundaries**, in `src/features/ux-reset/review/explorer-map-layers.ts` |
| Legend entries | `paintExplorerMapLayer` for `boundaries`, then `buildExplorerLegendModel` |
| Map chrome | `AtlasMap` in `src/components/atlas-map.tsx` |
| State perimeters | `stateBoundaryLines` in `src/features/ux-reset/review/county-boundary-lines.ts` |
| Stroke widths | `src/features/ux-reset/review/county-boundary-paint.ts` and the stops in `explorer-layer-palettes.ts` |
| National and state Explorer | `review-national-picture.tsx` and `review-operating-picture.tsx` pass `neutralGeography` only when this layer is selected |

## As-found mapping

- County fill fell through to `var(--explorer-boundary)` (`#e4e9ea`), the same token as an unpainted value on other layers.
- County edges were a white fill outline (`rgba(255,255,255,.9)`).
- A selected state stroked every county polygon in that state. National selection and a state frame used black `#000000` at width 2.5. With no selected state, the shared outline paint stayed teal `#0b7285` and matched no features.
- The selected county was `#061f3d` at width 3. There was no hover stroke.
- The legend was one swatch labeled `County boundary` in the boundary token. The note said the map is not colored by Atlas gap score. The period said county boundaries are not an evidence layer.
- The map well used the shared mint gradient behind a transparent canvas.

## Final mapping

| Role | Color |
| --- | --- |
| Map background | `#F8FAFC` |
| County fill | `#F3F4F6` |
| County stroke | `#4B5563` |
| State perimeter | `#1F2937` |
| Selected state perimeter | `#000000` at width 2.5 |
| Selected county | `#111827` at width 2.75, with a `#FFFFFF` casing at width 5.5 |
| Hover | Same charcoal, at a heavier width. The fill does not change. |

Legend keys, in order: County fill, County outline, State outline. They are separate keys, not a connected numeric scale. The title stays **County boundaries**. The period stays “County boundaries are not an evidence layer.” The note says the neutral fill is not an Atlas gap score and is not missing disease data.

A failed score or completeness load still uses the old boundary token and the `County boundary` label. That fallback is not this layer’s palette.

## Zoom

Stops are `[zoom, width]`. County strokes: `[2, 0]`, `[3.8, 0]`, `[4.2, 0.45]`, `[5.5, 0.9]`, `[8, 1.35]`. State strokes: `[2, 0.7]`, `[3.2, 0.95]`, `[5, 1.35]`, `[8, 1.9]`. Hover: `[2, 0]`, `[3.8, 0]`, `[4.2, 1.35]`, `[5.5, 1.8]`, `[8, 2.4]`.

The national camera for the Explorer pane is about zoom 2.3–3.5. County strokes stay exactly 0 through zoom 3.8. A fractional width still rasterizes as a visible hairline and turns the eastern counties into a dark mass. State and coast lines, about 0.7–1px, carry the readable geography. A state frame is usually zoom 5–6, where county strokes are about 0.9px. Width 2.5 on the selected state stays above the state stroke through zoom 8.

State lines are not every county edge. Shared census borders are not vertex-identical, so each edge is sampled on a 0.012 degree grid. An edge that is mostly inside one state and shared by two counties is dropped. A selected state uses that perimeter in black instead of stroking every county in the state.

Shared border utilities on other layers are unchanged: thematic county selection stays `#061f3d` at width 3, and the teal outline is not used while this layer is showing.
