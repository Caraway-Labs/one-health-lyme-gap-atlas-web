# County display versus analysis geography (web client)

Atlas counties are identified in every public contract by **five-digit FIPS** (`GeographyIdentity`). Map rendering uses a separate **display geometry** resource; it is not embedded in score, observation, or geography metadata payloads.

| Representation | Purpose | Browser exposure |
| --- | --- | --- |
| FIPS / `GeographyIdentity` | Stable joins for scores, environmental context, assistant handoffs | All county-aware API responses |
| Display geometry (`GET /v1/atlas/geometry`) | Generalized CDC/ATSDR SVI 2022 polygons (EPSG:4326) for maps | Loaded only through `fetchCountyDisplayGeometry` |
| Analysis geometry (2025 TIGER/Line) | Raster/grid aggregation on the data platform | **Not** published to the web client |

## Client guardrails

- Map and scatter views call `fetchCountyDisplayGeometry` in [`src/lib/county-geography.ts`](../src/lib/county-geography.ts).
- TanStack Query caches use `countyDisplayGeometryQueryKey` so display geometry is not confused with identity or context fetches.
- `parseCountyDisplayGeometry` rejects analysis-tagged collection metadata when present.
- Environmental or canonical observation records join to county UI state with `indexCountyContextByFips` / `joinCountyScoresWithContextByFips` (FIPS only).

Related API contract: `Caraway-Labs/one-health-lyme-gap-atlas-api#85`. Data platform split: `Caraway-Labs/one-health-lyme-gap-atlas-data#424`.
