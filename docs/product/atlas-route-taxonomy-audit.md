# Atlas route taxonomy audit (#195)

**Epic:** [#194 — Rationalize Atlas route taxonomy while preserving URL compatibility](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/194)  
**Story:** [#195 — Audit Atlas route taxonomy and recommend canonical classifications](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/195)  
**Follow-on:** [#196 — Approve route migration and compatibility contract](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/196)  
**Baseline:** `main` at `dd062da3b5d3e94299f41afc548e94728b071594` (2026-10-02)  
**Scope:** Audit and recommendations only. **No route behavior changes** in this story.  
**Retirement note (#504):** The `/ux-lab/**` persona prototype routes inventoried below were removed after this audit. Those sections describe the pre-retirement baseline. Direct requests now return 404, with no redirect and no prototype shell.

## Executive summary

The production user-facing Atlas taxonomy is already encoded in `src/lib/navigation.ts` (`ATLAS_ROUTES`) and summarized in [navigation.md](../navigation.md). This audit inventories every App Router surface under `src/app`, reconciles it with `ATLAS_ROUTES`, and classifies each route family for epic #194.

**Headline findings**

1. **Canonical production workflows** are three analytical Explore routes (`/`, `/geographic_explorer`, `/investigate`), one Research route (`/assistant`), Reference docs (`/docs` + sidebar handoff to configured public docs URL), utility Account (`/account`), and trust pages (`/privacy`, `/ai-ethics`).
2. **Legacy aliases** are implemented and should remain: `/knowledge-graph` → `/assistant` (conversation query preserved) and `/variant_6` → `/investigate` (308 permanent redirect with analytical query preservation).
3. **Experimental variants** (`/variant_1`–`/variant_5`, `/variant_7`) are intentionally outside production navigation; they are not default cleanup targets.
4. **UX Lab** (`/ux-lab/**`) is a large, `noindex` prototype namespace with its own shells; only a single `ATLAS_ROUTES` prefix entry covers it. Two adjunct concepts (`geography-first-v2`, `people-plus-workspace`) exist in the App Router but are absent from the UX Lab comparison index contract—documentation drift, not a production taxonomy gap.
5. **Material rename candidates** (snake_case analytical paths, duplicate Geographic Explorer at `/variant_7`) carry high compatibility cost; this audit **does not recommend implementing renames** without an explicit #196 approval and migration contract.

---

## Methodology

| Source | Role |
| --- | --- |
| `src/app/**/page.tsx` and `route.ts` | Authoritative App Router inventory |
| `src/lib/navigation.ts` (`ATLAS_ROUTES`) | Production shell, labels, status, placement, active matching |
| [navigation.md](../navigation.md) | Human-readable navigation contract |
| [assistant-entry-points.md](../assistant-entry-points.md) | Assistant launcher vs workspace hierarchy |
| `src/lib/analytical-navigation-handoff.ts` | Shareable query state across analytical routes |
| `src/lib/feedback-context.ts`, `src/lib/atlas-analytics.ts` | Stable route IDs for feedback and analytics |
| `src/features/ux-lab/prototype-contract.ts` | UX Lab concept registry and session route list |
| `src/app/robots.ts`, `src/app/sitemap.ts` | Crawler policy |

Inventory command used for verification:

```bash
find src/app -type f \( -name 'page.tsx' -o -name 'route.ts' \) | sort
```

---

## Taxonomy classification legend

| Classification | Meaning |
| --- | --- |
| **Canonical user-facing** | Intended production destination; may appear in shell navigation or global chrome |
| **Legacy / alias candidate** | Old URL kept for deep links; should redirect or alias to a canonical route |
| **Experimental / direct-link-only** | Routable for evaluation; excluded from production shell and primary IA |
| **Trust / public informational** | Lightweight public pages (privacy, ethics) |
| **Account / auth** | Optional account and Supabase auth flows |
| **Docs** | Fumadocs documentation site under `/docs` |
| **Internal / developer** | Unlinked engineering references |
| **Technical / API** | Route handlers and search APIs, not human destinations |

---

## Proposed canonical route map (for #196 review)

This is the **recommended production taxonomy** assuming URLs stay as implemented today. #196 should approve or reject each _change_ from this map—not re-litigate whether these paths are already canonical.

| Group | Canonical path | `ATLAS_ROUTES` id | Navigation | Notes |
| --- | --- | --- | --- | --- |
| Explore | `/` | `overview` | Sidebar | Atlas overview / county surveillance entry |
| Explore | `/geographic_explorer` | `geographic-explorer` | Sidebar | Linked map, table, chart, evidence views |
| Explore | `/investigate` | `investigation-workspace` | Sidebar | Wide investigation workspace |
| Research | `/assistant` | `assistant` | Sidebar (conditional) | Literature chat workspace; see assistant entry points |
| Reference | `/docs` (+ nested slugs) | `docs` | Sidebar (opens configured public `/docs` in new tab) | Internal Fumadocs tree; sidebar uses `NEXT_PUBLIC_DOCS_URL` |
| Utility | `/account` | `account` | Utility bar | Optional profile |
| Trust | `/privacy` | `privacy` | Footer | Privacy commitments |
| Trust | `/ai-ethics` | `ai-ethics` | Footer (new tab) | AI and evidence accountability |
| Legacy alias | `/knowledge-graph` | `evidence-library-legacy` | None | Redirect to `/assistant` |
| Legacy alias | `/variant_6` | `variant-6-legacy` | None | 308 → `/investigate` |

**Explicitly non-canonical (retain as-is unless #196 approves a scoped change)**

| Namespace | Policy |
| --- | --- |
| `/variant_1`–`/variant_5`, `/variant_7` | Experimental; direct-link-only |
| `/ux-lab/**` | Product research; `robots` disallow; not production IA |
| `/design-system` | Internal gallery |
| `/auth/*` | Auth utilities |
| `/api/search` | Docs search API |

---

## Reconciliation: App Router vs `ATLAS_ROUTES`

`ATLAS_ROUTES` defines **22 metadata entries** (including six experimental variants as separate rows). The App Router defines **52 human-facing or technical endpoints** (pages + route handlers), because UX Lab and docs use nested segments.

### Coverage summary

| App Router area | `ATLAS_ROUTES` entry | Match quality |
| --- | --- | --- |
| `/`, `/geographic_explorer`, `/investigate`, `/assistant` | One row each, `match: exact` | **Aligned** |
| `/knowledge-graph`, `/variant_6` | Hidden legacy rows | **Aligned** (behavior: redirect) |
| `/variant_1`–`/variant_5`, `/variant_7` | Six experimental rows | **Aligned** |
| `/account`, `/privacy`, `/ai-ethics` | One row each | **Aligned** (`/account` uses `match: prefix`; no nested account pages exist today) |
| `/docs`, `/docs/*` | One row, `match: prefix`, `shell: docs` | **Aligned** |
| `/auth/sign-in`, `/auth/callback`, `/auth/confirm` | Three hidden rows | **Aligned** |
| `/design-system`, `/design-system/*` | One row, `match: prefix` | **Aligned** |
| `/ux-lab`, `/ux-lab/**` | One row, `match: prefix` | **Aligned at namespace level**; individual UX Lab concepts are not separate `ATLAS_ROUTES` rows (by design) |
| `/api/search` | One row | **Aligned** |

### Gaps and drift (metadata vs filesystem)

| Finding | Severity | Recommendation |
| --- | --- | --- |
| `/ux-lab/geography-first-v2/**` and `/ux-lab/people-plus-workspace/**` exist in App Router with tests, but are **not** listed in `UX_LAB_CONCEPTS` or `UX_LAB_SESSION_ROUTES` | Low (UX Lab only) | Update prototype contract or UX Lab index copy in a **non-route** follow-up; do not fold into production taxonomy |
| UX Lab index page copy references “six” concepts while filesystem has **eight** concept roots (including v2 and people-plus) | Low | Editorial fix when UX Lab maintenance is scheduled |
| Sidebar Docs link is `external: true` to `getDocsUrl()` while `/docs/*` remains served in-app | Informational | Documented in [navigation.md](../navigation.md); not a duplicate product route—two delivery surfaces for the same content corpus |
| `findRouteMetadata("/ux-lab/persona-gateway")` inherits `/ux-lab` hidden metadata via prefix | Expected | Longest-prefix wins; nested UX Lab paths do not need per-route `ATLAS_ROUTES` rows unless shell behavior diverges |

### App Router endpoints without a dedicated `ATLAS_ROUTES` row

All such endpoints are children of a prefix-covered family (`/docs/*`, `/ux-lab/**`, `/design-system/*`) or are dynamic segments inside UX Lab. None are missing from the **production** navigation contract.

---

## Full classification table

### Canonical user-facing (production)

| Route family | Example paths | `ATLAS_ROUTES` | Shell | Shareable state / deep links |
| --- | --- | --- | --- | --- |
| Atlas overview | `/` | `overview` | analytical | County, dataset, filters via `OVERVIEW_INVESTIGATE_HANDOFF_PARAMS`; handoff from sidebar to `/geographic_explorer` and `/investigate` |
| Geographic Explorer | `/geographic_explorer` | `geographic-explorer` | analytical | Above plus `view`, `metric`, `selected`, `page` (`GEOGRAPHIC_EXPLORER_HANDOFF_PARAMS`) |
| Investigation Workspace | `/investigate` | `investigation-workspace` | analytical | Same shared params as overview; promoted wide workbench |
| Atlas Assistant | `/assistant` | `assistant` | analytical | `conversation`, validated `county` / `dataset`; feature-gated via `NEXT_PUBLIC_KG_CHAT_ENABLED` |
| Documentation | `/docs`, `/docs/<slug>` | `docs` | docs | Content slugs from `content/docs/meta.json`; search via `/api/search` |
| Account | `/account` | `account` | analytical | Auth session; no analytical query contract |

### Trust / public informational

| Route family | Path         | `ATLAS_ROUTES` | Shell  |
| ------------ | ------------ | -------------- | ------ |
| Privacy      | `/privacy`   | `privacy`      | public |
| AI Ethics    | `/ai-ethics` | `ai-ethics`    | public |

### Account / auth

| Route family | Path | Handler type | Classification |
| --- | --- | --- | --- |
| Sign in | `/auth/sign-in` | page | Account / auth; hidden from nav |
| OAuth callback | `/auth/callback` | route | Technical auth; preserves `next` redirect target |
| Email confirm | `/auth/confirm` | route | Technical auth |

### Legacy / alias candidate (implemented)

| Current URL | Canonical target | Mechanism | Query / state preservation |
| --- | --- | --- | --- |
| `/knowledge-graph` | `/assistant` | `redirect()` in `knowledge-graph/page.tsx` | `conversation` and other string search params via `assistantWorkspaceHref` |
| `/variant_6` | `/investigate` | `permanentRedirect()` in `variant_6/page.tsx` | `investigationWorkspaceHref` copies supported analytical params |

**Policy recommendation for #196:** Treat both as **indefinite compatibility aliases** unless product retires them with explicit telemetry review (bookmarks, emails, external docs).

### Experimental / direct-link-only

| Path | Label (metadata) | Implementation | Relationship to canonical |
| --- | --- | --- | --- |
| `/variant_1` | County review | `ExperimentAtlas` variant `decision` | Pre-promotion county review experiment |
| `/variant_2` | Guided review | variant `guided` | Guided stepper experiment |
| `/variant_3` | Evidence workspace | variant `workbench` | Narrow workbench; **not** the same as `/investigate` |
| `/variant_4` | Score explained | variant `explain` | Scoring explanation experiment |
| `/variant_5` | County comparison | variant `compare` | Comparison experiment |
| `/variant_7` | Geographic explorer legacy route | Full `GeographicExplorer` component | **Duplicate surface** of `/geographic_explorer` with experimental shell (`shell: none`) |

All use `status: experimental`, `placement: direct`, `shell: none` in `ATLAS_ROUTES`. **Do not** remove or redirect these in a taxonomy cleanup pass without product approval and link inventory.

### Internal / developer

| Path | Purpose |
| --- | --- |
| `/design-system` | Unlinked shadcn / Atlas UI reference gallery (`status: hidden`) |

### Technical / API

| Path          | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `/api/search` | Fumadocs documentation search (`docs-search-api`) |

### UX Lab (`/ux-lab/**`) — product research namespace

**Classification:** Internal / developer at the production taxonomy level (`ATLAS_ROUTES`: `ux-lab`, `status: hidden`, `shell: none`). **Not** canonical user-facing product.

**Crawler policy:** `robots.ts` disallows `/ux-lab`. Prototype layouts set `robots: { index: false, follow: false }` via `uxLabMetadata()`.

#### Registered first-class concepts (`UX_LAB_CONCEPTS`)

| Concept id | Base path | Dynamic segments |
| --- | --- | --- |
| `persona-gateway` | `/ux-lab/persona-gateway` | `/[audience]`, `/[audience]/[topic]` (`public`, `clinician`, `public-health`) |
| `public-first` | `/ux-lab/public-first` | `/clinical`, `/surveillance` |
| `three-lanes` | `/ux-lab/three-lanes` | `/[lane]` (`learn`, `clinical`, `intelligence`), `/[lane]/[item]` |
| `geography-first` | `/ux-lab/geography-first` | (static) |
| `public-site-pro-app` | `/ux-lab/public-site-pro-app` | Route groups: `(site)/*`, `(workspace)/app/*` |
| `people-first-hub` | `/ux-lab/people-first-hub` | `/living-with-lyme`, `/learn`, `/local-context`, `/clinicians`, `/public-health` |

#### Adjunct concepts (filesystem + tests; not in `UX_LAB_CONCEPTS`)

| Base path | Nested routes | Notes |
| --- | --- | --- |
| `/ux-lab/geography-first-v2` | `/clinicians`, `/evidence` | Second iteration of geography-first IA; shares handoff links to live `/investigate` and `/geographic_explorer` in sample data only |
| `/ux-lab/people-plus-workspace` | `/education`, `/living-with-lyme`, `/local`, `/clinicians`, `/workspace`, `/workspace/evidence`, `/outreach-preview` | People-first + professional workspace hybrid prototype |

#### UX Lab paths that mirror production naming (intentional confusion risk)

These are **prototype-only** paths and must not be promoted to canonical without a #196 contract:

| UX Lab path | Resembles | Risk |
| --- | --- | --- |
| `/ux-lab/public-site-pro-app/app/investigation` | `/investigate` | Name collision in research sessions |
| `/ux-lab/public-site-pro-app/app/evidence` | Assistant / evidence language | Conceptual overlap with `/assistant` |
| `/ux-lab/geography-first*` | `/geographic_explorer` | Geography-first framing vs production explorer |
| Live handoff links inside prototypes | `/`, `/geographic_explorer`, `/investigate` | Correct pattern: prototypes link **out** to production canonical routes |

---

## Duplicate or confusing route concepts

| # | Concepts | Why confusing | Current mitigation | Recommended action |
| --- | --- | --- | --- | --- |
| 1 | `/geographic_explorer` vs `/variant_7` | Same `GeographicExplorer` feature, different shells and URLs | `/variant_7` experimental metadata; not in nav | **Keep both** until explorer URL strategy is approved; if consolidating, use #196 migration (redirect + param audit) |
| 2 | `/investigate` vs `/variant_3` vs `/variant_6` | “Workbench” naming across investigation experiments and legacy wide route | `/variant_6` redirects to `/investigate`; `/variant_3` isolated experimental | **No rename** of `/investigate`; keep `/variant_6` alias |
| 3 | `/assistant` vs `/knowledge-graph` | Historical “knowledge graph” and “evidence library” naming | Redirect preserves `conversation` | **Keep** `/knowledge-graph` alias; feedback still maps pathname to `evidence_library` route id for `/knowledge-graph` only |
| 4 | snake_case (`/geographic_explorer`) vs kebab-case (`/ux-lab/...`) | Inconsistent URL style across production vs lab | Long-standing public URLs | **Defer** mechanical rename; see recommendation R2 |
| 5 | Docs sidebar external URL vs `/docs` on same host | Two ways to reach documentation | `NEXT_PUBLIC_DOCS_URL` defaults to `https://carawaylabs.com/docs` | **No route merge**; clarify in #196 if marketing canonical is always external |
| 6 | UX Lab “investigation” paths vs `/investigate` | Researchers may bookmark prototype URLs | `noindex`, disallow in robots | Label in UX Lab only; no production redirect |
| 7 | `geography-first` vs `geography-first-v2` | Two similar concepts in one namespace | v2 not on comparison index | Register or retire v2 in prototype contract (non-route work) |

---

## Rename / consolidation recommendations

Only changes that **materially** improve clarity are listed. **None are approved for implementation in #195.**

### R1 — Retain current canonical paths (default)

**Rationale:** Production IA matches epidemiologist workflows in [navigation.md](../navigation.md); shell migration (#108) is complete; tests and E2E assert current paths.

**Compatibility if ignored:** None (status quo).

### R2 — Defer renaming `/geographic_explorer` (and other snake_case analytical paths) to kebab-case

**Rationale:** Aesthetic consistency with `/ux-lab` is insufficient justification alone.

| Impact area | Assessment |
| --- | --- |
| Deep links / shared state | High — bookmarks, slide decks, and handoff URLs use snake_case today |
| Docs / content | MDX and help docs reference `/geographic_explorer` and `/investigate` |
| Tests | Extensive Vitest and Playwright coverage keyed to current paths |
| SEO | Production analytical routes are app experiences; sitemap currently lists docs only |
| Analytics / feedback | `FeedbackSubmissionRequestRouteId.geographic_explorer` and related enums |

**Recommendation for #196:** **Reject** unless paired with permanent redirects and a published deprecation window.

### R3 — Do not redirect `/variant_7` → `/geographic_explorer` without inventory

**Rationale:** `/variant_7` is an intentional experimental entry with `shell: none`; some stakeholders may use it to compare shell-less explorer behavior.

| Impact area  | Assessment                                    |
| ------------ | --------------------------------------------- |
| Deep links   | Unknown external usage; treat as experimental |
| Query params | Same explorer param model as canonical route  |
| Product      | Collapsing loses A/B shell comparison         |

**Recommendation for #196:** **Reject** consolidation by default; optional **approve** only if telemetry shows zero meaningful traffic and product signs off.

### R4 — Keep `/knowledge-graph` and `/variant_6` as permanent aliases

**Rationale:** Already implemented with state preservation; low maintenance cost.

| Impact area | Assessment |
| --- | --- |
| Deep links | Historical marketing, chat launcher copy, and feedback schema references |
| Redirect semantics | `/variant_6` uses **308 permanent** — clients and caches will prefer `/investigate` |
| Tests | `tests/navigation.test.ts`, E2E redirect specs |

**Recommendation for #196:** **Approve** indefinite alias policy; document in compatibility contract.

### R5 — Promote `/assistant` from `inDevelopment` when literature chat GA’s

**Rationale:** Metadata status, not a URL change.

| Impact area  | Assessment                                                  |
| ------------ | ----------------------------------------------------------- |
| Navigation   | `navigationItemsForGroup("research")` and Coming Soon badge |
| Feature flag | `NEXT_PUBLIC_KG_CHAT_ENABLED`                               |

**Recommendation for #196:** Track as **metadata-only** follow-up when product declares GA (no URL impact).

### R6 — Register UX Lab adjunct concepts in `prototype-contract.ts` (non-route)

**Rationale:** Reduces researcher confusion; does not change URLs.

**Recommendation for #196:** **Approve** documentation/contract update in a separate story; **not** a route migration.

---

## Compatibility reference matrix (for approved future changes)

Use this template in #196 when a route change is approved:

| Concern | What to verify |
| --- | --- |
| Deep links | Bookmarks, emailed links, PDFs, grant appendices |
| Query parameters | `src/lib/analytical-navigation-handoff.ts`, `assistant-context-handoff.ts`, explorer model |
| Shared analytical state | County FIPS, dataset release, evidence/scoring filters |
| Docs links | `content/docs/*.mdx`, `docs/*.md` |
| SEO canonicals | `metadata` from `pageMetadataForRoute`, UX Lab `canonical: null` |
| Auth callbacks | `next` parameter on `/auth/callback` and `/auth/confirm` |
| Tests | `tests/navigation.test.ts`, `tests/e2e/atlas.spec.ts`, route-specific E2E |
| External references | README, Caraway marketing site, OpenAPI examples (API paths separate) |
| Analytics / feedback | `feedbackRouteIdFromPathname`, Amplitude route controls |

---

## Related contracts (unchanged by this audit)

- [navigation.md](../navigation.md) — production navigation contract
- [assistant-entry-points.md](../assistant-entry-points.md) — Assistant launcher hierarchy
- [web-271-route-gap-analysis.md](../web-271-route-gap-analysis.md) — prior `/assistant` / `/knowledge-graph` consolidation record

When #196 approves changes, update `navigation.md` and `ATLAS_ROUTES` together in the implementation story—never one without the other.

---

## Verification record (#195)

| Check | Result |
| --- | --- |
| App Router inventory from `src/app` on `main` | 52 `page.tsx` / `route.ts` endpoints enumerated |
| `ATLAS_ROUTES` count and hrefs | 22 entries; reconciled to filesystem families above |
| Redirect behavior | `/knowledge-graph` → `/assistant`; `/variant_6` → `/investigate` confirmed in source |
| Production route changes in this PR | **None** (documentation only) |
