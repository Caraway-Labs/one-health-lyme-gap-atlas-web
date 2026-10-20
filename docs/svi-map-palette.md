# Social vulnerability map palette

Spec for GitHub #748. Recorded from `origin/main` at `738685a` before the palette change. The percentile domain, breakpoints, units, and source year stay as they are. No quantiles and no scoring change.

## Code paths

| Concern | Path |
| --- | --- |
| Layer id and label | `src/features/ux-reset/review/explorer-map-layers.ts` (`svi`, "Social vulnerability") |
| Measure, domain, unit, year | `src/features/ux-reset/review/explorer-map-observation.ts` (`svi_percentile_2022`, `RPL_THEMES`, minimum 0, maximum 1, unit `percentile`, vintage 2022, ACS 2018-01-01 through 2022-12-31) |
| Admitted states | `OBSERVED`, `ZERO`, `MISSING` on the county-context contract |
| Paint and legend entries | `paintReadyObservationLayer` → `paintQuantity` in `src/features/ux-reset/review/explorer-map-layer-scale.ts` |
| Shared per-layer colors | `src/features/ux-reset/review/explorer-layer-palettes.ts` |
| Legend strip | `buildExplorerLegendModel` in `src/features/ux-reset/review/explorer-legend-model.ts`, rendered by `src/features/ux-reset/review/explorer-map-legend.tsx` |
| Map fill | `colorsByFips` from that paint, drawn by the Explorer MapLibre layer |

There is no classified bin scale. `NUMERIC_SCALE.svi` is a two-stop mix on the fixed 0 to 1 domain. Lyme incidence already uses its own five-anchor ramp. Uninsured, rurality, tick status, pathogen status, completeness, and the six gap-score colors stay on their own definitions.

## As-found mapping

- Domain: fixed 0 to 1. Ratio is `(value - 0) / (1 - 0)`. Observed zero is the low end, not a missing value.
- Color: `mixExplorerScaleColor` from `hsl(142, 38%, 88%)` to `hsl(152, 58%, 22%)`.
- Legend captions are the numeric ends (`0`, `1`). The title unit is `percentile`.
- Note: "National county percentile from the 2022 SVI product, on a 0 to 1 scale. Not a percentage of people…"
- Period already names the source vintage: ACS 2018–2022, vintage 2022, national county percentile from 0 to 1.
- `MISSING` uses shared `var(--mint)`. Other non-numeric states keep the shared state colors and labels. Omitted counties use `var(--explorer-boundary)` labeled "No published value".

## Approved mapping

Anchors, low to high, equally spaced on the existing 0 to 1 percentile (0, 0.25, 0.5, 0.75, 1). They are palette stops, not new cutoffs.

| Percentile ratio | Hex       |
| ---------------- | --------- |
| 0                | `#FEEBE2` |
| 0.25             | `#FDC9A9` |
| 0.5              | `#FDA06B` |
| 0.75             | `#E56B2F` |
| 1                | `#A63603` |

Between anchors, color is piecewise HSL through the shared ramp mixer. Exact anchor ratios keep the hex. Anchor lightness decreases monotonically.

- Valid zero at the low end stays `#FEEBE2`.
- `MISSING` and omitted "No published value" use `#D1D5DB`, outside the ordered scale. Their labels stay distinct. `SUPPRESSED`, `UNAVAILABLE`, `NO_RECORDS`, and `NO_COUNTY_LINKED_RECORD` keep their existing colors and labels if a row carries them.
- Legend captions: "Lower social vulnerability" and "Higher social vulnerability", with the numeric percentile ends still visible. The unit stays `percentile`, not a percent of residents.
- The note names the 2022 CDC/ATSDR overall percentile (`RPL_THEMES`) as a rank of the county among U.S. counties in that product.
- Gap-score, Lyme incidence, rurality, tick, pathogen, uninsured, and completeness colors are unchanged.
