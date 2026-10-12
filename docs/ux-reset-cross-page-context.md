# UX Reset bounded cross-page context

**Story:** [#408](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/408)  
**Product rules:** [UX_RESET_CONSTITUTION.md](./UX_RESET_CONSTITUTION.md) (when merged)  
**Route namespace:** `/app/*` ([#406](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/406))

## Purpose

Users move among **Atlas Explorer, Compare, and Ask Atlas** without rebuilding geography, release, or compare selections. Context lives in **validated, canonical URL search parameters** so direct links and reloads stay reproducible. Atlas Explorer is the Review path (`/app/review`). Explore, Investigate, and Action are compatibility aliases that redirect there ([#197](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/197)).

**Browser back/forward** depends on the shell pushing real history entries when navigating; that wiring ships with the authenticated shell ([#406](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/406) / PR #439). This contract defines what belongs in each URL; it does not by itself integrate history.

Implementation: `src/features/ux-reset/` — path authority in `routes.ts`, parsing in `context-params.ts`, handoff in `context-handoff.ts`.

## Route path authority

Path strings for Review, Explore, Investigate, Compare, Action, Assistant, Feed, and Settings are exported from `routes.ts` (`RESET_REVIEW_PATH`, …). **Docs** use `/docs` (`DOCS_PATH`) and are not part of the `/app` query handoff surface.

Shell handoff entry point:

```ts
import { uxResetShellHandoffHref } from "@/features/ux-reset";

const href = uxResetShellHandoffHref("/app/review", pathname, searchParams);
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
| Review      | `sort`, `page`, `mode`, `selection`               |
| Explore     | `view`, `metric`, `page`, `selected`, `map_scope` |
| Investigate | `evidence`, `eco`, `breakpoint`, `missing`, `q`   |
| Compare     | `metric`, `return`                                |
| Action      | `plan`, `role`                                    |
| Assistant   | `conversation`, `page_ref`                        |
| Feed        | `tab`                                             |
| Settings    | _(none)_                                          |

Explore `selected` maps into `compare` **only** when the destination accepts `compare` and `compare` is not already set.

Review `mode` is the in-page Atlas Explorer county view. Omitted means browse. `evidence` opens county evidence. `follow-up` opens that same view at Suggested follow-up. Any other token is removed. Handoff does not copy `mode`. Compare copies one exact `mode` onto a Review return link when that Compare URL already carried it.

Review `selection=required` marks an alias that named `county` but did not yield one FIPS. Browse does not select a county until the user chooses one. Handoff does not copy `selection`.

## Route-to-route handoff matrix

**Destination acceptance** (`UX_RESET_HANDOFF_ACCEPTANCE`) and **source export** (`UX_RESET_HANDOFF_EXPORT`) are both enforced. Effective handoff is the intersection.

| Source \\ Dest | Review | Explore | Investigate | Compare | Action | Assistant | Feed | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Review** | scope, county, compare, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Explore** | scope, county, compare¹, dataset, period | scope, county, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | scope, county, compare¹, dataset, period | county, dataset | — | — |
| **Investigate** | scope, county, compare, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Compare** | scope, county, compare, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Action** | scope, county, compare, dataset, period | scope, county, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | scope, county, compare, dataset, period | county, dataset | — | — |
| **Assistant** | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | county, dataset | — | — |
| **Feed** | —² | — | — | — | — | — | — | — |
| **Settings** | —² | — | — | — | — | — | — | — |

¹ `compare` is synthesized from Explore `selected` when needed.  
² Feed and Settings **export no shared context** even if the URL contains query params.

**Docs** (`/docs`) and legacy analytical routes (`/`, `/geographic_explorer`, `/investigate`) use their own contracts (`analytical-navigation-handoff`, `assistant-context-handoff`).

## Review county preview and return (#412)

**Published county exploration (#574).** For a supported state and confirmed release, the published county directory validates selection independently of the authoritative recommendation list. The alphabetical Published county picker and MapLibre clicks select the same in-state identities, including when Review is `unsupported` with zero candidates. A supplied county is retained while the directory loads or fails; a successful directory response clears unpublished or out-of-state identities. A release change requests a new directory and profile before showing facts. No candidate, ranking, or eligibility is derived from the directory's score fields.

An actual candidate keeps its existing recommendation preview. Other published counties have a small factual preview using the existing release-checked county record loader and shared evidence components. County evidence opens on Atlas Explorer even when the profile request has not succeeded. The fixed 2023 human count field is explicitly a published floor, never an exact case total; missing counts are not zero, and pathogen No records is not pathogen absence. Unknown observation periods and evidence types remain Unavailable rather than inferred from source vintage. Failed requests remain operational errors; failed refreshes withhold cached facts. The existing Tier 1 release guard remains unchanged.

The canonical `county`, `scope`, `dataset`, and supported `period` handoff stays the existing shared context contract. Ask Atlas inherits only the selected, validated published identity, independent of candidate naming. Returning from county evidence focuses the candidate row when one exists, otherwise the Published county picker. A fresh URL without a county does not auto-select a factual county; the existing first-candidate default applies only to published candidates.

Selecting a county on Atlas Explorer updates shared `county` and shows a preview: county identity, why it is in the review set, suggested follow-up, **View county evidence**, and **Compare**. Selection does not leave Atlas Explorer and does not expand evidence until the user asks. **View county evidence** sets `mode=evidence` and replaces the map, list, and preview with the in-page county view. **Back to map** clears `mode` and restores that browse surface. The county-evidence link stays on `/app/review` and keeps the shared keys that page accepts. `mode` is Explorer state, not a separate destination.

The preview why line is the review-priority rationale only. It does not say that county inputs are available, and it does not treat a missing tick or pathogen record as biological absence. When the score row is limited or unavailable, the preview shows that evidence state through the shared evidence strip and an Inspect provenance control. A `SUPPRESSED` status is Limited under the shared contract, including when evidence completeness is 100. A row whose human, tick, and pathogen statuses are all absent is Unavailable only when evidence completeness is zero. Completeness above zero means other scored inputs still provide governed signal, so that aggregate state is Limited. A county score summary does not include source family, observation period, evidence type, or provenance for that status, so those fields stay Unavailable and the caveat states the metadata limitation. The page release strip remains release-level. Governed observation rows stay on Investigate.

Browser Back and Forward restore the originating Atlas Explorer history entry. That entry keeps shared context (`scope`, `county`, `dataset`, `period`) and browse-local `sort` and `page` when those keys were already on the entry. The selected county row is scrolled into view. When the user left through county evidence or Compare, keyboard focus returns to that county's rank-row control. When the county is outside the first 40, return opens the complete county list and focuses that county's table control. The session fallback for that return is cleared after focus is restored, so a later fresh Explorer URL for the same county does not reuse it.

Practical limit: the pixel scroll offset inside the county list is not stored in the URL. Return reveals the selected row. The county-evidence return link and shell links rebuild Atlas Explorer from shared context only, so they restore scope, county, dataset, and period, and they do not restore `sort` or `page`. Those browse-only keys are not added to the global handoff to make return work. If browse had `sort` or `page`, the preview states that those keys stay on browse. A validated `compare` pair stays with the selected county on Atlas Explorer. It is not dropped.

## Compare entry and return (#420)

Review and Investigate open Compare through `buildCompareEntryHref` in `compare-entry.ts`. That helper is the Compare entry URL. The pair is still the shared `compare` serializer.

A validated two-county `compare` list is kept, so the selected county is not added as a third. One saved county is replaced by the county selected now, and remains only when no county is selected. When the list is empty, the selected county is written as the only member. Compare does not choose a second county. The Compare page asks for the missing county. Clearing or editing the pair on Compare changes `compare` on the Compare URL. It does not rewrite the Review or Investigate history entry the user left.

`return` is page-local to Compare. Entry links set it to `review` or `investigate`. Any other value is ignored. A direct Compare link without `return` stays usable and does not show a return control. The return link is a normal handoff of the visible pair. Atlas Explorer (the Review path) receives `compare`. `return=review` opens Explorer browse, copying one exact `mode` when the Compare URL already carried it. `return=investigate` opens Explorer `mode=evidence`. Compare edits do not change the originating `county`.

## County evidence, suggested follow-up, and export (#417)

County evidence keeps **Return to Atlas Explorer** for browse. **Compare** is offered only after the published county or its evidence bundle has resolved. A well-formed identifier that is not in the published list does not start a comparison. **Return to Compare** remains when the URL has a validated two-county `compare` set, including when the county on screen did not resolve. That pair arrives through the normal handoff, including from the Compare workspace links. Compare does not choose one county for follow-up.

**Suggested follow-up** is offered once the county evidence bundle has loaded ([#421](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/421)). The link stays on Atlas Explorer at `mode=follow-up` and keeps `scope`, `county`, `compare`, `dataset`, and `period`. A failed measure catalog does not create that bundle. A published county finding from a synthetic view after the county request settles, including a settled 404, does not offer suggested follow-up, does not mark Ask Atlas measure, source, or period as loaded, and does not enable the PDF export. A requested `period` is stale only when accepted observation intervals exist and the date falls outside them. No returned interval leaves the period unverified. Direct links and reloads use the same URL context.

Surveillance Planning is not a working workflow while its API dependency is deferred. The evidence brief remains reachable from a direct `plan=evidence-brief` address ([#423](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/423)). It is not a workspace destination. It repeats the county finding and limitation sentences. **Return to county evidence** hands the shared context back to Atlas Explorer `mode=evidence`. The county PDF is the same `county-v2` export context county evidence already builds. A note the user types is labeled as local context, stays on the page, and is not saved, sent, or included in that PDF. A withheld catalog stand-in does not open the brief or the PDF. Any other `plan` value, including `brief`, redirects with the other action aliases. `plan` and `role` stay page-local and are not copied onward.

**Contextual PDF export (#460).** For a loaded supported county, county evidence offers the server-owned `county-v2` report for every published canonical measure that shares one county, release, and exact observation interval and has source, lineage, provenance, and version fields. The button lists those measures and names each left-out measure with a short reason. An unsupported or unqueried period is not described as unpublished, and an empty bounded response describes that county and period only. The PDF is unavailable when Atlas cannot verify parity with the displayed county, observations, sources, period, and caveats. That unavailable state does not mean the report contains none of a period. The request sends only the county, dataset release, full inclusive interval, and those canonical measure IDs through the generated client. Fresh uncached reads before and after rendering must match the included observations. Published missing and no-county-linked states stay in the report. Failures never reuse an earlier artifact or fall back to `county-v1`. Only a nonempty HTTP 200 `application/pdf` response with `no-store` may download; page context changes and unmount cancel late downloads. See [Investigate PDF export](investigate-pdf-export.md). Representative tick fixture support does not establish production availability.

## Tests

- `tests/ux-reset-context-handoff.test.ts` — canonical serialization, nuqs parity, source export restrictions, calendar dates, two-county compare cap.
