# UX Reset bounded cross-page context

**Story:** [#408](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/408)  
**Product rules:** [UX_RESET_CONSTITUTION.md](./UX_RESET_CONSTITUTION.md) (when merged)  
**Route namespace:** `/app/*` ([#406](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/406))

## Purpose

Users move **Review → Investigate → Compare/Action** without rebuilding geography, release, or compare selections. Context lives in **validated, canonical URL search parameters** so direct links and reloads stay reproducible.

**Browser back/forward** depends on the shell pushing real history entries when navigating; that wiring ships with the authenticated shell ([#406](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/406) / PR #439). This contract defines what belongs in each URL; it does not by itself integrate history.

Implementation: `src/features/ux-reset/` — path authority in `routes.ts`, parsing in `context-params.ts`, handoff in `context-handoff.ts`.

## Route path authority

Path strings for Review, Explore, Investigate, Compare, Action, Assistant, Feed, and Settings are exported from `routes.ts` (`RESET_REVIEW_PATH`, …). **Docs** use `/docs` (`DOCS_PATH`) and are not part of the `/app` query handoff surface.

Shell handoff entry point:

```ts
import { uxResetShellHandoffHref } from "@/features/ux-reset";

const href = uxResetShellHandoffHref(
  "/app/investigate",
  pathname,
  searchParams
);
```

## Shared context keys (bounded)

| Key | Meaning | Validation |
| --- | --- | --- |
| `scope` | Originating **Review** geography scope (national `ALL` or two-letter state) | Trimmed `ALL` or `[A-Z]{2}`; conflicting values → `ALL` |
| `county` | Selected county | Exactly one five-digit FIPS; any invalid or duplicate FIPS param → no selection |
| `compare` | Compare set (**two counties** in V1; issues 398, 418) | Comma-separated FIPS, de-duplicated, max 2 |
| `dataset` | Governed release ID | `^[A-Za-z0-9._-]{1,64}$` |
| `period` | Reporting period anchor (when a page supports periods) | Real calendar `YYYY-MM-DD` (invalid dates rejected). Release-specific period availability is out of scope. |

`scope` is the **Review scope** preserved across destinations; Explore map framing uses page-local `map_scope` and does not overwrite `scope` during handoff.

Parsing is canonical in `parseUxResetSharedContext` and must match `loadUxResetSharedContext` (`createLoader` over the same nuqs parsers).

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

Explore `selected` maps into `compare` **only** when the destination accepts `compare` and `compare` is not already set.

## Route-to-route handoff matrix

**Destination acceptance** (`UX_RESET_HANDOFF_ACCEPTANCE`) and **source export** (`UX_RESET_HANDOFF_EXPORT`) are both enforced. Effective handoff is the intersection.

| Source \\ Dest | Review | Explore | Investigate | Compare | Action | Assistant | Feed | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Review** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Explore** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | county, dataset | — | — |
| **Investigate** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Compare** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period² | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Action** | scope, county, dataset, period | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Assistant** | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | — | — |
| **Feed** | —³ | — | — | — | — | — | — | — |
| **Settings** | —³ | — | — | — | — | — | — | — |

¹ `compare` is synthesized from Explore `selected` when needed.  
² `compare` is **not** copied onto Investigate (dropped explicitly).  
³ Feed and Settings **export no shared context** even if the URL contains query params.

**Docs** (`/docs`) and legacy analytical routes (`/`, `/geographic_explorer`, `/investigate`) use their own contracts (`analytical-navigation-handoff`, `assistant-context-handoff`).

## Review county preview and return (#412)

Selecting a county on Review updates shared `county` and shows a preview on Review: county identity, why it is in the review set, availability, one material caveat, and **Open Investigate**. Selection does not open Investigate. The open control uses `uxResetShellHandoffHref` with the current Review search params, so the destination receives only the shared keys Investigate accepts.

A score status of `SUPPRESSED` follows the shared evidence contract: the preview availability is Limited, and the caveat states that the input is suppressed or privacy-protected. Suppression is not shown as Available and is not treated as zero cases.

Browser Back and Forward restore the originating Review history entry. That entry keeps shared context (`scope`, `county`, `dataset`, `period`) and Review-local `sort` and `page` when those keys were already on the entry. The selected county row is scrolled into view. When the user left through Open Investigate, keyboard focus returns to that county's rank-row control. When the county is outside the first 40, return opens the complete county list and focuses that county's table control.

Practical limit: the pixel scroll offset inside the county list is not stored in the URL. Return reveals the selected row. The Investigate return link and shell links rebuild Review from shared context only, so they restore scope, county, dataset, and period, and they do not restore `sort` or `page`. Those Review-only keys are not added to the global handoff to make return work. If Review had `compare`, `sort`, or `page`, the preview states that Investigate does not carry them.

## Tests

- `tests/ux-reset-context-handoff.test.ts` — canonical serialization, nuqs parity, source export restrictions, calendar dates, two-county compare cap.
