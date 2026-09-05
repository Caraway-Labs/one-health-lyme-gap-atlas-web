# Geographic explorer view contract

Route: `/variant_7`. Entry: **Variants → Geographic explorer**. Epic: [web #51](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/51).

## User outcome

Explore county surveillance evidence through geographic tiles, geographic small multiples, an evidence matrix, ranked dots, synchronized maps, a map-linked scatterplot, and up to five county comparison profiles. A release-trends view explicitly reports the absence of comparable historical data.

The primary county map and variants 1–6 retain their existing behavior. New code lives in `src/features/geographic-explorer`; it adds no visualization dependencies or alternate backend.

## Data and interpretation

- Use the generated Python REST client and generated runtime validators for metadata and score collections. Require matching dataset and methodology identifiers. Fetch geometry only when a map is selected, independently of scores, with the existing GeoJSON contract and payload budget.
- Pin `dataset` in the URL. A requested unavailable version fails explicitly; only **Use current release** opts into the current snapshot. Do not silently relabel old data as current.
- Use only counties marked `in_contiguous_tick_scope`. State tiles include all states and DC schematically, with Alaska/Hawaii identified as insets and absent results disabled. Layout positions are approximate and have no distance meaning.
- State tiles count matching county records. These are UI result counts, not state-level epidemiological aggregates or new scores. Small multiples plot individual counties, not derived state estimates.
- Geographic grids retain the national overview under text/evidence filtering; selecting a state filters county charts, maps and the exact-values table. Explain this distinction beside the table.
- Review score uses 0–100. Completeness is the rounded percentage of six scored inputs available, on a fixed 0–100% scale; it is not evidence quality or a confidence interval. This follows the Alpha source build_atlas_data.py definition round(usable / 6 * 100), verified against the current API release. The new page interprets the most-data-available filter as at least 83% (five of six inputs), matching the original Alpha source UI; it does not copy the older shared helper count threshold of 5. Small-multiple vertical offsets only separate dots.
- Missing, no-record and published-floor evidence states retain their API meaning. They are not replaced with zero or disease absence. Scatterplot associations are descriptive and may reflect shared score inputs.
- Show sources/vintages, release generation/load times, methodology, scope, score settings and limitations. Do not invent a source retrieval date when the API provides only release timestamps.

## Shared state and interactions

Use the existing validated nuqs parameters for county FIPS, state, evidence, query and score assumptions. Additional parameters: `view` (eight allowlisted choices), `metric` (score/completeness), `selected` (up to five unique five-digit FIPS), and `page` (positive bounded integer). Discard comparison IDs not in the included release. Clamp page after filtering. Deterministic sorting uses metric descending, then FIPS ascending.

County selection persists across views and filters; the summary explains when selection is outside current filters. Comparisons intentionally persist across filters. Map selection and scatterplot selection update the same county summary and URL. Both maps synchronize center, zoom, bearing and pitch without replay loops.

## Accessibility, errors and performance

Shared semantic UI primitives, visible focus, labeled axes and controls, descriptive color-independent text and exact-values table. Table pagination makes every result reachable, with 20 rows per page. Geographic grid/table scrolling is keyboard accessible on narrow screens. Honor reduced motion; no autoplay.

Loading, no-results, unavailable release, schema/release mismatch, geometry fetch error, WebGL error and retry states are explicit. Map failure does not remove non-map evidence. Query cancellation prevents obsolete requests from replacing current state. MapLibre is dynamically loaded only for map views; source data updates do not recreate map instances.

## Historical trends prerequisite

Story [#59](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/59) is not satisfied by the unavailable-history UI. The current API service `_require_version` rejects any release other than its active snapshot. Real trends require a recorded contract/architecture decision for retained release access, a source of comparable historical snapshots, point-in-time county definitions, and reviewed methodology comparability. No invented timelines or dates, interpolation, or client-side archives substitute for those prerequisites.

## Acceptance evidence

Focused model tests cover comparison validation, sorting, zero/missing semantics, full pagination and unique geography layout. Playwright covers desktop/mobile Variants navigation, grids, filters, exact-value parity, URL reload, comparisons, maps/scatterplot keyboard selection, unavailable releases, geometry failure and axe without exclusions. Run the repository generation, formatting, lint, typecheck, unit, E2E, build and hosted Docker gates before completion. Report protected deployment/live validation separately.
