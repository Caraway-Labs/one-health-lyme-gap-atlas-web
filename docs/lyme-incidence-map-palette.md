# Lyme incidence map palette

Spec for GitHub #745. Recorded from `origin/main` at `450aad7` before the palette change. Numeric thresholds, units, and the six gap-score colors stay as they are.

## Code paths

| Concern | Path |
| --- | --- |
| Layer id and label | `src/features/ux-reset/review/explorer-map-layers.ts` (`incidence_floor`, "Minimum reported Lyme incidence") |
| Measure, year, unit | `src/features/ux-reset/review/explorer-map-observation.ts` (`incidence_floor_2023`, year 2023, unit `per 100,000`, minimum 0, no fixed maximum) |
| Paint and legend entries | `paintReadyObservationLayer` → `paintQuantity` in `src/features/ux-reset/review/explorer-map-layer-scale.ts` |
| Shared per-layer colors | `src/features/ux-reset/review/explorer-layer-palettes.ts` (incidence anchors only; other layers keep their existing contracts) |
| Legend strip | `buildExplorerLegendModel` in `src/features/ux-reset/review/explorer-legend-model.ts`, rendered by `src/features/ux-reset/review/explorer-map-legend.tsx` |
| Map fill | `colorsByFips` from that paint, drawn by the Explorer MapLibre layer |

`NUMERIC_SCALE.incidence_floor` is a two-stop mix, not a classified bin scale. Rurality, tick status, and pathogen status use their own categorical contracts. Social vulnerability and uninsured stay on their own two-stop mixes.

## As-found mapping

- Domain: lowest and highest published `OBSERVED` or `ZERO` value in the loaded rows. No quantiles and no extra epidemiologic cutoffs.
- Color: `mixExplorerScaleColor` from `hsl(204, 45%, 88%)` at the low end to `hsl(210, 72%, 24%)` at the high end. Ratio is `(value - min) / (max - min)`.
- A single repeated number uses only the low color.
- Legend captions are the numeric ends (`0`, `12.4`, and so on). The title unit is the observation unit `per 100,000`.
- Note: "2023 published lower bound per 100,000, not an exact incidence estimate…"
- `MISSING` uses shared `var(--mint)`. `SUPPRESSED`, `UNAVAILABLE`, `NO_COUNTY_LINKED_RECORD`, and `NO_RECORDS` keep the shared state colors. Omitted counties use `var(--explorer-boundary)` labeled "No published value". `ZERO` is the low end of the numeric scale when it is the minimum, not the missing swatch.

## Approved mapping

Anchors, low to high, equally spaced on the existing observed ratio (0, 0.25, 0.5, 0.75, 1). They are palette stops, not new cutoffs.

| Ratio | Hex       |
| ----- | --------- |
| 0     | `#E5F5E0` |
| 0.25  | `#A1D99B` |
| 0.5   | `#41D65C` |
| 0.75  | `#238B45` |
| 1     | `#005A32` |

Between anchors, color is piecewise HSL. Exact anchor ratios keep the hex. Lightness of the anchors decreases monotonically (about 92%, 73%, 55%, 34%, 18%).

- Valid zero at the low end stays `#E5F5E0`.
- Incidence `MISSING` is `#D1D5DB` with the existing "Missing (not zero and not a low value)" label. Other value states keep their existing colors and labels.
- Legend captions: "Lower published incidence" and "Higher published incidence", with the existing numeric ends still visible. The visible unit is "per 100,000 residents". The stored observation unit stays `per 100,000`.
- The note keeps the minimum-not-complete-incidence explanation and the review-ranking sentence.
- Gap-score, rurality, tick, pathogen, SVI, uninsured, and completeness colors are unchanged. Pathogen Present stays the single category color on its own contract.
