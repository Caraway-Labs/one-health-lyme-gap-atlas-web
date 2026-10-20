# Uninsured population map palette

Spec for GitHub #749. Recorded from `origin/main` at `738685a` before the palette change. Numeric thresholds, the percent unit, the 2022 source year, and the civilian noninstitutionalized population universe stay as they are.

## Code paths

| Concern | Path |
| --- | --- |
| Layer id and label | `src/features/ux-reset/review/explorer-map-layers.ts` (`uninsured`, "Uninsured population") |
| Measure, year, unit | `src/features/ux-reset/review/explorer-map-observation.ts` (`uninsured_percent_2022`, vintage 2022, ACS 2018-01-01 through 2022-12-31, unit `percent`, minimum 0, maximum 100, source field `EP_UNINSUR`, denominator `civilian_noninstitutionalized_population`) |
| Paint and legend entries | `paintReadyObservationLayer` → `paintQuantity` in `src/features/ux-reset/review/explorer-map-layer-scale.ts` |
| Shared per-layer colors | `src/features/ux-reset/review/explorer-layer-palettes.ts` |
| Legend strip | `buildExplorerLegendModel` in `src/features/ux-reset/review/explorer-legend-model.ts`, rendered by `src/features/ux-reset/review/explorer-map-legend.tsx` |
| Map fill | `colorsByFips` from that paint, drawn by the Explorer MapLibre layer |

The map measure is `uninsured_percent_2022` (`EP_UNINSUR`). `uninsured_percentile_2022` (`EPL_UNINSUR`) is a separate 0 to 1 measure and is not the map layer. Admitted value states for this measure are `OBSERVED`, `ZERO`, and `MISSING`.

## As-found mapping

- Domain: fixed 0 to 100. Not the observed minimum and maximum, and not quantiles.
- Color: `mixExplorerScaleColor` from `hsl(266, 38%, 91%)` at 0 to `hsl(266, 48%, 30%)` at 100. Ratio is `(value - 0) / 100`.
- A single repeated number uses only the low color.
- Legend captions are the numeric ends (`0`, `100`). The title unit is `percent`.
- Note: "Percent of the civilian noninstitutionalized population on a 0 to 100 scale…"
- `MISSING` uses shared `var(--mint)`. `SUPPRESSED`, `UNAVAILABLE`, `NO_COUNTY_LINKED_RECORD`, and `NO_RECORDS` keep the shared state colors if a row reaches paint. Omitted counties use `var(--explorer-boundary)` labeled "No published value". `ZERO` is the low end of the numeric scale, not the missing swatch.

## Approved mapping

Anchors, low to high, equally spaced on the existing 0 to 100 percent ratio (0, 0.25, 0.5, 0.75, 1). They are palette stops, not new cutoffs.

| Ratio | Percent | Hex       |
| ----- | ------- | --------- |
| 0     | 0       | `#FCE4EC` |
| 0.25  | 25      | `#F7B6CF` |
| 0.5   | 50      | `#E66A9A` |
| 0.75  | 75      | `#BA3167` |
| 1     | 100     | `#740D3D` |

Between anchors, color is piecewise HSL. Exact anchor ratios keep the hex. Darker means a higher uninsured percentage.

- A valid 0 percent stays `#FCE4EC`.
- Uninsured `MISSING` is `#D1D5DB` with the existing "Missing (not zero and not a low value)" label. Other value states keep their existing colors and labels. Omitted counties stay "No published value".
- Legend captions: "Lower uninsured percentage" and "Higher uninsured percentage", with the existing numeric ends still visible. The visible unit stays `percent`.
- The note keeps the civilian noninstitutionalized population universe, the 0 to 100 percent scale, and the statement that this is not the uninsured percentile. It does not treat the percentage as healthcare access, reporting completeness, or Lyme risk.
- Gap-score, incidence, rurality, tick, pathogen, SVI, and completeness colors are unchanged.
