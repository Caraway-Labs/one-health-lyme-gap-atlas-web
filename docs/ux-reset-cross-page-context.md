# UX Reset bounded cross-page context

**Story:** [#408](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/408)  
**Product rules:** [UX_RESET_CONSTITUTION.md](./UX_RESET_CONSTITUTION.md) (when merged)  
**Route namespace:** `/app/*` ([#406](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/406))

## Purpose

Users move **Review → Investigate → Compare/Action → back** without rebuilding geography, release, or compare selections. Context lives in **validated URL search parameters** so direct links, reloads, and browser back/forward stay reproducible.

Implementation: `src/features/ux-reset/` (`uxResetNavigationHref`, `uxResetContextHandoffSearchParams`, shared nuqs parsers).

## Shared context keys (bounded)

| Key | Meaning | Validation |
| --- | --- | --- |
| `scope` | Originating **Review** geography scope (national `ALL` or two-letter state) | `ALL` or `[A-Z]{2}` |
| `county` | Selected county | Five-digit FIPS |
| `compare` | Compare set (up to five counties) | Comma-separated FIPS |
| `dataset` | Governed release ID | `^[A-Za-z0-9._-]{1,64}$` |
| `period` | Reporting period anchor (when a page supports periods) | ISO date `YYYY-MM-DD` |

`scope` is the **Review scope** preserved across destinations; Explore map framing uses page-local `map_scope` and does not overwrite `scope` during handoff.

## Page-local keys (never copied)

| Destination | Local keys (dropped on navigation)                |
| ----------- | ------------------------------------------------- |
| Review      | `sort`, `page`                                    |
| Explore     | `view`, `metric`, `page`, `selected`, `map_scope` |
| Investigate | `evidence`, `eco`, `breakpoint`, `missing`, `q`   |
| Compare     | `metric`                                          |
| Action      | `plan`, `role`                                    |
| Assistant   | `conversation`                                    |
| Feed        | `tab`                                             |
| Settings    | _(none)_                                          |

Explore `selected` maps into `compare` **only** when the destination is **Compare** (or Action) and `compare` is not already set.

## Route-to-route handoff matrix

Rows: **source → destination**. Cells list **shared** keys copied when present and valid. Empty cells mean no shared context is accepted on that destination.

| Source \\ Dest | Review | Explore | Investigate | Compare | Action | Assistant | Feed | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Review** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Explore** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | county, dataset | — | — |
| **Investigate** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Compare** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period² | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Action** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Assistant** | —³ | —³ | —³ | —³ | —³ | county, dataset | — | — |
| **Feed / Settings** | — | — | — | — | — | — | — | — |

¹ `compare` is synthesized from Explore `selected` when needed.  
² `compare` is **not** copied onto Investigate (dropped explicitly).  
³ Assistant only hands off `county` and `dataset` to other destinations; other sources do not inherit Assistant `conversation`.

**Docs** (`/docs`) and legacy analytical routes (`/`, `/geographic_explorer`, `/investigate`) use their own contracts (`analytical-navigation-handoff`, `assistant-context-handoff`).

## Shell integration

```ts
import { uxResetNavigationHref } from "@/features/ux-reset";

const href = uxResetNavigationHref("/app/investigate", pathname, searchParams);
```

Use `uxResetSharedContextParsers` with `useQueryStates` on each Reset page for shared fields; keep page-local parsers separate so handoff can drop them predictably.

## Tests

- Unit/integration: `tests/ux-reset-context-handoff.test.ts`
- Regression guard for acceptance table: `UX_RESET_HANDOFF_ACCEPTANCE` in `context-handoff.ts`
