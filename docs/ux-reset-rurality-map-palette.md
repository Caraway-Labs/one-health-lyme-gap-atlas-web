# Rurality map palette

Spec for the Atlas Explorer Rurality layer (`/explore?layer=rurality`). Desktop only. Other layer palettes stay on their current definitions.

## Source

The layer is the 2023 USDA ERS Rural-Urban Continuum Code, not a grouped rural/urban rollup.

| Item | Current path |
| --- | --- |
| Layer id | `rurality` in `src/features/ux-reset/review/explorer-map-layers.ts` |
| Observation spec | `EXPLORER_OBSERVATION_SPECS.rurality` in `src/features/ux-reset/review/explorer-map-observation.ts` |
| Measure | `rucc_2023` |
| Source field | `RUCC_2023` |
| Vintage | `2023` |
| Grain | `VINTAGE_YEAR` (no observation dates) |
| Admitted codes | Integers 1 through 9. A value outside that range is rejected before paint. |
| Category text | Published `county_context.category_label` for each observed code. Example live labels: code 1 `Metro: area population at least 1 million`, code 2 `Metro: area population 250,000 to 1 million` (`GET /v1/observations`, Adams and Boulder counties). |
| Fallback labels | `RUCC_2023_LABELS` in `src/features/ux-reset/review/review-rationale.ts`, used only when a code is absent from the current load. Those strings are not a second classification and are not rewritten by this change. |

County-card rurality text, review rationale, scoring, and `rucc_2023` values stay as they are.

## Current paint and legend

Paint is `paintRurality` in `src/features/ux-reset/review/explorer-map-layer-scale.ts`. Map fills and legend swatches both read `RUCC_COLORS`. The legend model is `buildExplorerLegendModel` in `src/features/ux-reset/review/explorer-legend-model.ts`, rendered by `ExplorerMapLegend`.

| RUCC | Current fill         |
| ---- | -------------------- |
| 1    | `hsl(210, 55%, 42%)` |
| 2    | `hsl(28, 78%, 48%)`  |
| 3    | `hsl(140, 40%, 36%)` |
| 4    | `hsl(350, 62%, 50%)` |
| 5    | `hsl(174, 42%, 36%)` |
| 6    | `hsl(280, 28%, 46%)` |
| 7    | `hsl(330, 52%, 62%)` |
| 8    | `hsl(24, 32%, 40%)`  |
| 9    | `hsl(200, 8%, 52%)`  |

These are nine unrelated hues. The legend is a contiguous nine-swatch strip with endpoint captions `1` and `9` (or `No data` and `9` when a missing key is present). Hover exposes `"{code}. {published or fallback label}"`.

Missing treatment today:

- Present non-observed states use `STATE_COLOR` (`MISSING`, `SUPPRESSED`, `UNAVAILABLE`, `NO_COUNTY_LINKED_RECORD`, `NO_RECORDS`) and separate legend labels.
- An omitted requested county, or a row that is not painted, adds one `No published value` swatch colored `var(--explorer-boundary)` (`#e4e9ea`).
- Geometry counties with no paint entry fall back to that same boundary token in `review-national-picture.tsx`.

County and state outlines are shared map chrome in `src/components/atlas-map.tsx` (`GEOGRAPHIC_STATE_OUTLINE` `#000000`, selected county `#000000` at a constant width `5`). This change does not recolor them.

## Final mapping

One shared definition, `src/features/ux-reset/review/rurality-palette.ts`, supplies map fills and legend swatches. Codes stay discrete. Nothing is interpolated, combined, or reclassified.

| RUCC | Fill      |
| ---- | --------- |
| 1    | `#F2F0F7` |
| 2    | `#E5E0EF` |
| 3    | `#D5CCE5` |
| 4    | `#BFB1D5` |
| 5    | `#A590C4` |
| 6    | `#8B6EB0` |
| 7    | `#74529B` |
| 8    | `#5D3985` |
| 9    | `#46216E` |

Legend:

- Nine contiguous swatches, light on the left through dark on the right, in code order.
- Endpoint captions under the scale: `More urban` and `More rural`.
- Visible explanation: `Rural–Urban Continuum Codes classify counties by population size and proximity to metropolitan areas.`
- Each swatch keeps the exact code and source description on hover and in the accessible name.
- The About note states that a higher code is not a proportional increase in rurality, Lyme risk, or review priority, and that the colors are not a risk gradient.
- Scale mode stays `segments`.

Missing and unavailable values, including an omitted requested county, use `#D1D5DB` and one legend swatch labeled `No data`, outside the ordered scale. That gray is never a RUCC shade. Counties with no rurality paint entry on this layer use the same gray instead of `--explorer-boundary`.

## Acceptance checks

- Codes 1–9 keep their published or fallback descriptions and receive the hex above.
- Legend swatches match county fills.
- `No data` is gray and outside the purple scale.
- Gap score, incidence, tick status, pathogen status, SVI, uninsured, and completeness palettes are untouched.
- Desktop Explorer layout stays compact. Mobile is out of scope.
