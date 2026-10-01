# Web #284 — Atlas Web → API dependency migration inventory

Parent epic: [Web #283](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/283) (Migrate Atlas Web public-data consumers to the canonical API).

**Baseline:** Web `main` at `ab7565f4dc425e73c1091fc73bc8b73d6a639beb` (2026-10-01, includes [Web #285 / PR #327](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/pull/327) canonical OpenAPI + Orval regeneration). Authoritative browser contract: [`contracts/openapi.json`](../contracts/openapi.json) (legacy application routes **and** canonical public resources). Canonical policy: [API #52](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/52) / [API #51](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/51).

**Scope of this document:** inventory and classification only. No runtime or contract changes are made in Web #284.

## Summary

| Metric | Count |
| --- | --: |
| OpenAPI paths in `contracts/openapi.json` | **25** |
| Paths with **production browser** consumers (legacy application API) | **13** |
| Paths with **no** production browser consumer | **12** (health ×2, privacy status GET, canonical public routes ×9) |
| Canonical routes added by Web #285 | **9** — Orval functions, models, and Zod in `src/generated/`; covered by [`tests/canonical-api-client.test.ts`](../tests/canonical-api-client.test.ts) |
| Production UI calls to canonical routes today | **0** (client generation landed; runtime cutover is Web #286+) |
| Classification **migrate** (legacy public data, not yet cut over) | 3 endpoint families |
| Classification **migrate** (canonical targets, generated only) | 9 path patterns |
| Classification **retain** (legacy/current application) | 2 |
| Classification **private** | 4 |
| Classification **action-specific** | 3 |
| Classification **separate ownership** (assistant / RAG) | 1 |
| Classification **unresolved** | 1 (`GET /v1/atlas/ranking.csv`) |

Classification counts for **legacy migrate / retain / private / action / RAG / unresolved** are **endpoint families** on routes the product already calls. **Canonical rows** are migration **targets** with generated clients but no production browser consumer yet.

All **production** Atlas HTTP traffic still uses **legacy application** endpoints listed in the matrix below. There are **no** server-side fetches to the Python Atlas API (App Router pages use local search/auth redirects only).

### Web #285 status (generated client — done)

[Web #285](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/285) merged on `main` as PR #327 (`ab7565f4`). The pinned OpenAPI now includes canonical `GET /v1/indicators`, `/v1/measures`, `/v1/observations`, `/v1/sources`, `/v1/methodologies/{id}`, and `/v1/geographies/{geography_type}/{geography_id}` (and detail/list variants). Orval emits typed callers (for example `indicatorsV1IndicatorsGet`, `observationsV1ObservationsGet`) and Zod schemas under `src/generated/`.

**Inventory implication:** migration is no longer blocked on client generation. The remaining work is **consumer cutover** (Web #286+) with parity evidence—not new endpoints in this repo.

### Transport and auth conventions

| Layer | Role |
| --- | --- |
| [`src/lib/public-config.ts`](../src/lib/public-config.ts) | Validates `NEXT_PUBLIC_API_BASE_URL` (HTTP/S). |
| [`src/lib/api-mutator.ts`](../src/lib/api-mutator.ts) | Default transport for Orval-generated callers. Attaches Supabase `Authorization: Bearer` only for `/v1/me/*` and `/v1/feedback`. Canonical public reads use the same mutator **without** bearer (anonymous per API #52). Parses JSON, GeoJSON, PDF blobs, and text; surfaces `AtlasApiError` / `ProblemDetails`. |
| [`src/lib/pdf-export.ts`](../src/lib/pdf-export.ts) | **Bypass:** direct `fetch(apiBaseUrl + path)` for county/state PDFs (no bearer). |
| [`src/app/atlas-home-page.tsx`](../src/app/atlas-home-page.tsx) | **Bypass:** ranking CSV via `<a href={apiBaseUrl + url}>` (no bearer, no mutator). |
| TanStack Query ([`src/app/providers.tsx`](../src/app/providers.tsx)) | Default `staleTime: 300_000` ms, `retry: 2`. Legacy routes use imperative `useQuery` + Orval **functions** (not generated `useMetadata*` hooks). |
| [`src/lib/api-response-validation.ts`](../src/lib/api-response-validation.ts) | Runtime Zod validation for selected **legacy** responses via `@/generated/zod/atlas`; canonical observation/indicator shapes validated in unit tests. |

### Workflow areas (requirement mapping)

| Product area | Routes / surfaces | Endpoints involved |
| --- | --- | --- |
| **Home county/state exploration** | `/` (`AtlasHomePage`) | metadata, geometry, scores, county detail, ranking CSV |
| **Geographic Explorer** | `/geographic_explorer`, `/variant_7` | metadata, scores, geometry (conditional) |
| **Investigation Workspace & variants** | `/investigate`, `/variant_1`–`/variant_5` (`ExperimentAtlas`) | metadata, geometry, scores, county detail; PDF via shared export |
| **Metadata / provenance UI** | `MethodsSection`, `AtlasFilters`, release copy on above routes | metadata (+ fields embedded in county detail) |
| **PDF / export actions** | `PdfExportButton` → `downloadPdfReport` | county/state report PDF URLs |
| **Account / private** | `/account` | profile GET/PUT; privacy-requests POST/confirm/export |
| **Feedback** | Global `FeedbackProvider` / dialog (app shell) | `POST /v1/feedback` |
| **Conversational (KG / Research Assistant)** | `/assistant`, drawer — [`use-evidence-chat.ts`](../src/components/evidence-chat/use-evidence-chat.ts) | `POST /v1/knowledge-graph/chat` |
| **Assistant county handoff (literature UI)** | `/assistant` — [`AssistantCountyContextNotice`](../src/components/assistant-county-context.tsx) | legacy **metadata + scores** only (validates FIPS in release; **not** canonical observations) |

Knowledge Graph / Research Assistant chat APIs are **explicitly out of scope** for canonical observation migration (see [RAG boundary](#rag--knowledge-graph-boundary)).

---

## Canonical replacement reference (API #52)

Use these links **only** where the current endpoint carries **canonical public-data semantics**. Do not force private, action, or literature endpoints into the observation model.

| Canonical resource (in OpenAPI after Web #285) | Semantics |
| --- | --- |
| `GET /v1/indicators`, `GET /v1/indicators/{indicator_id}` | Public-health indicator discovery |
| `GET /v1/measures`, `GET /v1/measures/{measure_id}` | Measure identity, units, methodology hooks |
| `GET /v1/observations` | Bounded measure × geography × time observations with explicit value states |
| `GET /v1/geographies/{geography_type}/{geography_id}` | Typed geography identity (county FIPS, state FIPS) |
| `GET /v1/sources`, `GET /v1/sources/{source_id}` | Source provenance resources |
| `GET /v1/methodologies/{methodology_id}` | Methodology / version resources |

Display map geometry remains a **separate delivery concern** per API #52 / API #85 (not replaced by geography identity resources).

---

## Migration matrix — legacy application routes (production consumers today)

Each row is one **HTTP method + path** consumer contract. Orval operation names refer to [`src/generated/atlas.ts`](../src/generated/atlas.ts).

### Health (operations — not used by Web UI)

| Current endpoint | Consumer | Response contract | Auth / cache | Canonical replacement | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /health/live` | None in production browser | `LiveHealthLiveGet200` | N/A | None (ops) | **retain** (no Web consumer) | None | None |
| `GET /health/ready` | None in production browser | `ReadyHealthReadyGet200` | N/A | None (ops) | **retain** (no Web consumer) | None | None |

Generated Orval hooks exist but are unused; no migration work until a Web surface depends on them.

### Private account and data rights (`/v1/me/*`)

| Current endpoint | Consumer | Response contract | Auth / cache | Canonical replacement | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/me/profile` | [`src/app/account/page.tsx`](../src/app/account/page.tsx) — `getProfileV1MeProfileGet` | `UserProfileResponse` | Bearer when Supabase session present; imperative load in `useEffect` | None — stays authenticated private API ([API #52](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/52)) | **private** | Low (out of epic scope) | [`tests/account-page.test.tsx`](../tests/account-page.test.tsx) |
| `PUT /v1/me/profile` | Same — `saveProfileV1MeProfilePut` | `UserProfileResponse` | Bearer required for meaningful save | None | **private** | Low | Mocked in account-page tests |
| `POST /v1/me/privacy-requests` | [`src/components/account-data-rights.tsx`](../src/components/account-data-rights.tsx) | `PrivacyRequestCreated` | Bearer; no-store semantics on API | None | **private** | Low | [`tests/account-data-rights.test.tsx`](../tests/account-data-rights.test.tsx) |
| `POST /v1/me/privacy-requests/{id}/confirm` | Same | `PrivacyRequestStatus` | Bearer | None | **private** | Low | account-data-rights tests |
| `GET /v1/me/privacy-requests/{id}` | **No production consumer** (generated only) | `PrivacyRequestStatus` | Bearer | None | **private** | None | None |
| `GET /v1/me/privacy-requests/{id}/export` | account-data-rights — `downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet` | JSON export (client triggers download) | Bearer | None | **private** | Low | account-data-rights tests |

### Public atlas application data (`/v1/atlas/*`, counties)

| Current endpoint | Consumer(s) | Response contract used | Auth / cache expectations | Canonical replacement (API #51/#52) | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/atlas/metadata` | `/`, `/geographic_explorer`, `/investigate`, variants, `/assistant` county context — `metadataV1AtlasMetadataGet`; UI: `AtlasFilters`, `MethodsSection` | `AtlasMetadata` (release id, sources, limitations, methodology labels) | Anonymous; TanStack keys `["metadata"]`, `["explorer-metadata", …]`, `["assistant-county-context-metadata"]`; Zod `MetadataV1AtlasMetadataGetResponse` | **Runtime cutover:** compose from `GET /v1/indicators`, `/v1/measures`, `/v1/sources`, `/v1/methodologies/{methodology_id}` (+ release/version semantics). **Generated callers exist** (Web #285); bundle/adaptor shape for UI parity still **unresolved** (Web #286). | **migrate** | **Medium** — provenance/freshness copy must remain equivalent | E2E atlas + geographic-explorer; [`tests/generated-client.test.ts`](../tests/generated-client.test.ts), [`tests/api-mutator.test.ts`](../tests/api-mutator.test.ts) |
| `GET /v1/atlas/geometry` | Home, Investigation Workspace, Geographic Explorer (maps/scatter) — `geometryV1AtlasGeometryGet` | GeoJSON `FeatureCollection` (typed in app) | Anonymous; `staleTime: Infinity` on home/experiment; explorer validates structure manually | **None for identity** — retain display geometry endpoint per API #52 / #85 (geography resource ≠ map geometry) | **retain** | Low if left on current route; **Medium** if CRS/bounds drift vs map | E2E atlas + geographic-explorer |
| `GET /v1/atlas/scores` | Same routes + `/assistant` county context — `scoresV1AtlasScoresGet` | `ScoreCollection` / `CountyScoreSummary[]` with `ScoreSettings` query params | Anonymous; keys include release + scoring triple; Zod + completeness checks (explorer); `placeholderData` on home/experiment | **`GET /v1/observations`** for constituent measures **plus** composition into priority/ranking semantics. Composite Atlas score is **not** a single observation; measure ID mapping **unresolved** (API/data). **Generated** `observationsV1ObservationsGet` available; no UI consumer. | **migrate** | **High** — ranking, color, priority pills, URL scoring params | E2E both specs; generated-client URL test |
| `GET /v1/counties/{fips}` | `/`, `/investigate`, variants — `countyV1CountiesFipsGet` | `CountyDetail` (evidence panels, action plan, profile) | Anonymous; enabled when FIPS selected; Zod `CountyV1CountiesFipsGetResponse` | **`GET /v1/observations`** (multi-measure) + **`GET /v1/geographies/county/{fips}`** + linked sources/methodologies. Investigation Workspace is the highest-visibility consumer ([`/investigate`](../src/app/investigate/page.tsx)). | **migrate** | **High** — mixed evidence, environmental context, missingness | E2E atlas |
| `GET /v1/atlas/ranking.csv` | Home CSV link — `getRankingCsvV1AtlasRankingCsvGetUrl` + anchor href | CSV file (not JSON) | Anonymous; full navigation download; scoring + filter query params from URL state | **Unresolved.** API #52 separates bulk download from interactive queries. No canonical CSV equivalent; may **retain** as action/export or gain a future release-download API. | **unresolved** | Medium — export parity, filename, column order | E2E atlas (download) |

### Action-oriented exports

| Current endpoint | Consumer(s) | Response contract | Auth / cache | Canonical replacement | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/counties/{fips}/report.pdf` | [`src/lib/pdf-export.ts`](../src/lib/pdf-export.ts) via `PdfExportButton` | PDF `Blob` | Anonymous; direct fetch (not mutator); scoring query params | None — **action-specific** report generation ([API #52](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/issues/52)) | **action-specific** | Low | [`tests/pdf-export.test.tsx`](../tests/pdf-export.test.tsx); E2E |
| `GET /v1/states/{state}/report.pdf` | Same | PDF `Blob` | Same | None | **action-specific** | Low | pdf-export tests; E2E |

### Feedback

| Current endpoint | Consumer | Response contract | Auth / cache | Canonical replacement | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /v1/feedback` | [`src/components/feedback-dialog.tsx`](../src/components/feedback-dialog.tsx) — global shell | `FeedbackSubmissionRequest` → `FeedbackSubmissionResponse` | Bearer when logged in; idempotency / rate limits on API | None — operational feedback channel, not public observation data | **action-specific** | Low | [`tests/feedback-dialog.test.tsx`](../tests/feedback-dialog.test.tsx); E2E [`tests/e2e/feedback.spec.ts`](../tests/e2e/feedback.spec.ts) |

### RAG / Knowledge Graph boundary

| Current endpoint | Consumer | Response contract | Auth / cache | Canonical replacement | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /v1/knowledge-graph/chat` | [`use-evidence-chat.ts`](../src/components/evidence-chat/use-evidence-chat.ts) — `/assistant` + drawer | `KnowledgeChatRequest` → `KnowledgeChatResponse`; Zod on success/error | Feature gate `NEXT_PUBLIC_KG_CHAT_ENABLED` | **Separate ownership** — keep literature/RAG contract; do **not** route through `/v1/observations`. Future mixed evidence may **reference** canonical evidence IDs without collapsing schemas | **separate ownership** (treat as **retain** for migration epic) | Low for this epic | [`tests/evidence-chat.test.tsx`](../tests/evidence-chat.test.tsx); E2E evidence-chat |

See also [`docs/web-43-gap-analysis.md`](web-43-gap-analysis.md) for EvidenceChat contract history.

---

## Migration matrix — canonical public routes (Web #285, no production UI consumer yet)

These paths are **in scope for epic #283** as migration **targets**. They are classified **migrate** because legacy rows above map to them; the Web app does **not** call them in production yet.

| Canonical endpoint | Generated caller (examples) | Production browser consumer | Auth / cache | Replaces (legacy) | Classification | Migration risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/indicators` | `indicatorsV1IndicatorsGet` | None | Anonymous; public cache policy on API | Part of `/v1/atlas/metadata` decomposition | **migrate** (target) | Medium when wired to UI | [`tests/canonical-api-client.test.ts`](../tests/canonical-api-client.test.ts) |
| `GET /v1/indicators/{indicator_id}` | `indicatorV1IndicatorsIndicatorIdGet` | None | Anonymous | Metadata / indicator detail | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/measures` | `measuresV1MeasuresGet` | None | Anonymous | Metadata / measure catalog | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/measures/{measure_id}` | `measureV1MeasuresMeasureIdGet` | None | Anonymous | Metadata | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/sources` | `sourcesV1SourcesGet` | None | Anonymous | `AtlasMetadata.sources` / provenance | **migrate** (target) | Medium — provenance copy parity | canonical-api-client tests |
| `GET /v1/sources/{source_id}` | `sourceV1SourcesSourceIdGet` | None | Anonymous | Source cards in `MethodsSection` | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/methodologies/{methodology_id}` | `methodologyV1MethodologiesMethodologyIdGet` | None | Anonymous | Methods / release methodology labels | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/geographies/{geography_type}/{geography_id}` | `geographyV1GeographiesGeographyTypeGeographyIdGet` | None | Anonymous | County identity leg of `CountyDetail` (not map geometry) | **migrate** (target) | Medium | canonical-api-client tests |
| `GET /v1/observations` | `observationsV1ObservationsGet` | None | Anonymous; bounded query + pagination on API | `/v1/atlas/scores`, `/v1/counties/{fips}` (partial) | **migrate** (target) | **High** when used for scores/county UI | canonical-api-client tests (value states, provenance) |

---

## Client access pattern reconciliation

| Access pattern | Used in production? | Notes |
| --- | --- | --- |
| Orval legacy functions (`metadataV1AtlasMetadataGet`, …) | **Yes** — all **current** product data loads | Wrapped by `apiMutator` except PDF/CSV |
| Orval canonical functions (`indicatorsV1IndicatorsGet`, …) | **No** in UI | Available after Web #285; use in Web #286+ cutover |
| Orval generated React Query hooks | **No** | Safe to ignore until a consumer adopts them |
| Manual `fetch` | **Yes** — PDF + ranking CSV | Intentional bypass |
| TanStack Query | **Yes** | Custom query keys per route |
| Server Components / Route Handlers calling Atlas API | **No** | Preserves browser→Python boundary (workspace AGENTS.md / ADR 0002) |
| Hand-written API models | **No** — types from `@/generated/models` | Keep `npm run generate:api` as source of truth |

---

## Gaps and ambiguous dependencies (documented, not inferred)

1. **`GET /v1/atlas/ranking.csv`** — No canonical bulk/interactive equivalent. Status **unresolved** until API owners define a governed export or document permanent retention.
2. **Composite Atlas score** — `ScoreCollection` is not one `measure_id`. Observation migration requires an explicit measure catalog and composition spec (**unresolved**).
3. **`CountyDetail` vs observations** — Field-level parity matrix required before Investigation Workspace cutover (**high risk** without spec).
4. **Metadata bundle adaptor** — Canonical discovery endpoints are generated, but UI still expects `AtlasMetadata` shape; adapter design for Web #286 is **unresolved** (not a client-generation gap).
5. **`GET /v1/me/privacy-requests/{request_id}`** — Generated only; no UI consumer.
6. **Transport inconsistency** — PDF and CSV bypass `apiMutator`. Hygiene only.

---

## Recommended first migration workflow (low risk / high value)

**Primary recommendation (runtime cutover, post–Web #285):** switch **`GET /v1/atlas/metadata` consumers** to canonical **metadata discovery** calls (`indicatorsV1IndicatorsGet`, `measuresV1MeasuresGet`, `sourcesV1SourcesGet`, `methodologyV1MethodologiesMethodologyIdGet`, etc.) behind a thin adaptor that preserves provenance/freshness UX.

**Provenance surfaces in scope:** [`MethodsSection`](../src/components/methods-section.tsx), [`AtlasFilters`](../src/components/atlas-filters.tsx), [`AtlasDataStamp`](../src/components/atlas-data-stamp.tsx). County-level provenance from **`CountyDetail`** stays in wave 2.

| Factor | Rationale |
| --- | --- |
| Risk | **Medium-low** among migrate rows — read-only; no map/scoring URL state |
| Value | First end-to-end proof of canonical resources in the product UI |
| Preconditions | **Met:** generated client + Zod ([Web #285](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/285)). **Open:** adaptor parity spec (Web #286) |
| Coverage | Legacy metadata guarded by Zod today; extend with canonical-api-client + E2E after cutover |

**Second wave:** Investigation Workspace **`GET /v1/counties/{fips}`** → **`GET /v1/observations`** (+ geography resource) once measure mapping and `CountyDetail` parity exist.

**Explicitly defer:** geometry (**retain**), PDF/feedback/private/KG chat (**action-specific / private / separate ownership**), ranking CSV (**unresolved**). Assistant county context may keep legacy scores until wave 2 unless explicitly scoped in Web #286.

---

## Bounded follow-up work (discovered during inventory)

| Suggested follow-up | Owner | Notes |
| --- | --- | --- |
| ~~Web #285 — generated canonical client~~ | Web | **Done** (PR #327, `ab7565f4`) |
| [Web #286](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/286) — first runtime migration slice | Web | Metadata/provenance adaptor + parity evidence |
| Field-level `CountyDetail` ↔ observations parity checklist | Web + API | Prerequisite for Investigation Workspace |
| Atlas composite score → measure ID registry | API / data | Prerequisite for scores migration |
| Decision on `ranking.csv` vs future bulk/release download | API product | Resolves **unresolved** row |

---

## Acceptance criteria checklist (Web #284)

- [x] Every production Web API dependency has an explicit classification.
- [x] Every OpenAPI path is classified (legacy matrix + canonical target table).
- [x] Canonical replacements linked only where semantically appropriate.
- [x] Private `/v1/me/*`, PDF/action endpoints, and assistant/RAG endpoints not forced into the observation model.
- [x] Gaps documented instead of inferred.
- [x] First runtime migration slice identified (metadata → canonical discovery; clients unblocked by #285).
- [x] No production behavior changes in this story.

---

## Inventory verification (2026-10-01)

Re-audited against Web `origin/main` at `ab7565f4dc425e73c1091fc73bc8b73d6a639beb` and [`contracts/openapi.json`](../contracts/openapi.json) (**25** paths). Cross-checked [API `public-api-v1-contract.md`](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/blob/main/docs/public-api-v1-contract.md).

| Check | Result |
| --- | --- |
| Legacy `@/generated/atlas` imports in `src/` | **9** modules with **legacy** live calls; **0** production calls to canonical `indicators*` / `observations*` |
| Canonical client generation | **Present** — Web #285 / PR #327 |
| OpenAPI path count | **25** (9 canonical + 16 legacy/ops/private/action) |
| Private / action / RAG forced to observations | **None** |
| Gaps (ranking.csv, composite score, CountyDetail) | **Documented** |
| First slice | Metadata → canonical discovery (**runtime** cutover; not blocked on #285) |

---

## Related documents

- [Web #283 epic](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/283)
- [Web #285](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/285) (merged — PR #327)
- [API canonical public V1 contract (API #52)](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/blob/main/docs/public-api-v1-contract.md)
- [API layer inventory (server-side mirror)](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/blob/main/docs/api-layer-inventory.md)
- [Geographic explorer contract](../contracts/geographic-explorer.md)
- [Web #43 KG gap analysis](web-43-gap-analysis.md)
