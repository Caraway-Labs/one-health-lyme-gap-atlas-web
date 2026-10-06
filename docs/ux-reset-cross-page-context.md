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
| Compare     | `metric`, `return`                                |
| Action      | `plan`, `role`                                    |
| Assistant   | `conversation`                                    |
| Feed        | `tab`                                             |
| Settings    | _(none)_                                          |

Explore `selected` maps into `compare` **only** when the destination accepts `compare` and `compare` is not already set.

## Route-to-route handoff matrix

**Destination acceptance** (`UX_RESET_HANDOFF_ACCEPTANCE`) and **source export** (`UX_RESET_HANDOFF_EXPORT`) are both enforced. Effective handoff is the intersection.

| Source \\ Dest | Review | Explore | Investigate | Compare | Action | Assistant | Feed | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Review** | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Explore** | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | county, dataset | — | — |
| **Investigate** | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Compare** | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Action** | scope, county, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Assistant** | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | — | — |
| **Feed** | —² | — | — | — | — | — | — | — |
| **Settings** | —² | — | — | — | — | — | — | — |

¹ `compare` is synthesized from Explore `selected` when needed.  
² Feed and Settings **export no shared context** even if the URL contains query params.

**Docs** (`/docs`) and legacy analytical routes (`/`, `/geographic_explorer`, `/investigate`) use their own contracts (`analytical-navigation-handoff`, `assistant-context-handoff`).

## Review county preview and return (#412)

Selecting a county on Review updates shared `county` and shows a preview on Review: county identity, why it is in the review set, suggested follow-up, and **Open Investigate**. Selection does not open Investigate. The open control uses `uxResetShellHandoffHref` with the current Review search params, so the destination receives only the shared keys Investigate accepts.

The preview why line is the review-priority rationale only. It does not say that county inputs are available, and it does not treat a missing tick or pathogen record as biological absence. When the score row is limited or unavailable, the preview shows that evidence state through the shared evidence strip and an Inspect provenance control. A `SUPPRESSED` status is Limited under the shared contract, including when evidence completeness is 100. A row whose human, tick, and pathogen statuses are all absent is Unavailable only when evidence completeness is zero. Completeness above zero means other scored inputs still provide governed signal, so that aggregate state is Limited. A county score summary does not include source family, observation period, evidence type, or provenance for that status, so those fields stay Unavailable and the caveat states the metadata limitation. The page release strip remains release-level. Governed observation rows stay on Investigate.

Browser Back and Forward restore the originating Review history entry. That entry keeps shared context (`scope`, `county`, `dataset`, `period`) and Review-local `sort` and `page` when those keys were already on the entry. The selected county row is scrolled into view. When the user left through Open Investigate or Compare, keyboard focus returns to that county's rank-row control. When the county is outside the first 40, return opens the complete county list and focuses that county's table control. The session fallback for that return is cleared after focus is restored, so a later fresh Review URL for the same county does not reuse it.

Practical limit: the pixel scroll offset inside the county list is not stored in the URL. Return reveals the selected row. The Investigate return link and shell links rebuild Review from shared context only, so they restore scope, county, dataset, and period, and they do not restore `sort` or `page`. Those Review-only keys are not added to the global handoff to make return work. If Review had `sort` or `page`, the preview states that those keys stay on Review. A validated `compare` pair is copied onto Investigate with the selected county.

## Compare entry and return (#420)

Review and Investigate open Compare through `buildCompareEntryHref` in `compare-entry.ts`. That helper is the Compare entry URL. The pair is still the shared `compare` serializer.

A validated two-county `compare` list is kept, so the selected county is not added as a third. One saved county is replaced by the county selected now, and remains only when no county is selected. When the list is empty, the selected county is written as the only member. Compare does not choose a second county. The Compare page asks for the missing county. Clearing or editing the pair on Compare changes `compare` on the Compare URL. It does not rewrite the Review or Investigate history entry the user left.

`return` is page-local to Compare. Entry links set it to `review` or `investigate`. Any other value is ignored. A direct Compare link without `return` stays usable and does not show a return control. The return link is a normal handoff of the visible pair: Review does not receive `compare`, and Investigate receives the pair currently on screen. Compare edits do not change the originating `county`.

## Investigate next step and export (#417)

Investigate keeps **Return to Review** in the county header. The next-step section offers **Compare** only after the published county or its evidence bundle has resolved. A well-formed identifier that is not in the published list does not start a comparison. **Return to Compare** remains when the URL has a validated two-county `compare` set, including when the county on screen did not resolve. That pair arrives through the normal handoff, including from the Compare workspace links.

**Continue to Action** is not offered. `/app/action` still renders the placeholder page, so a loaded county without a pair has no second cross-page control. The page does not choose Surveillance Planning or an Evidence Brief.

**PDF unavailable.** `GET /v1/counties/{fips}/report.pdf` returns an opaque PDF for the county, release, template, and score settings. It does not carry the requested period, observation period, source family, or observation caveat shown on this page. Investigate does not offer export, and it does not send a second mapping, until a report contract can be compared with that visible context. `downloadPdfReport` still discards an empty file and a response that arrives after the caller drops it. Those guards stay for callers whose contract can be checked.

## Tests

- `tests/ux-reset-context-handoff.test.ts` — canonical serialization, nuqs parity, source export restrictions, calendar dates, two-county compare cap.
