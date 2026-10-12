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
| Review      | `sort`, `page`, `mode`                            |
| Explore     | `view`, `metric`, `page`, `selected`, `map_scope` |
| Investigate | `evidence`, `eco`, `breakpoint`, `missing`, `q`   |
| Compare     | `metric`, `return`                                |
| Action      | `plan`, `role`                                    |
| Assistant   | `conversation`, `page_ref`                        |
| Feed        | `tab`                                             |
| Settings    | _(none)_                                          |

Explore `selected` maps into `compare` **only** when the destination accepts `compare` and `compare` is not already set.

Review `mode` is the in-page Atlas Explorer county view. Omitted means browse. `evidence` opens county evidence. `follow-up` opens that same view at Suggested follow-up. Any other token is removed. Handoff does not copy `mode`. Compare copies one exact `mode` onto a Review return link when that Compare URL already carried it.

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

**Published county exploration (#574).** For a supported state and confirmed release, the published county directory validates selection independently of the authoritative recommendation list. The alphabetical Published county picker and MapLibre clicks select the same in-state identities, including when Review is `unsupported` with zero candidates. A supplied county is retained while the directory loads or fails; a successful directory response clears unpublished or out-of-state identities. A release change requests a new directory and profile before showing facts. No candidate, ranking, or eligibility is derived from the directory's score fields.

An actual candidate keeps its existing recommendation preview. Other published counties have a small factual preview using the existing release-checked county record loader and shared evidence components, with Open Investigate available independently of profile request success. The fixed 2023 human count field is explicitly a published floor, never an exact case total; missing counts are not zero, and pathogen No records is not pathogen absence. Unknown observation periods and evidence types remain Unavailable rather than inferred from source vintage. Failed requests remain operational errors; failed refreshes withhold cached facts. The existing Tier 1 release guard remains unchanged.

The canonical `county`, `scope`, `dataset`, and supported `period` handoff stays the existing shared context contract. Ask Atlas inherits only the selected, validated published identity, independent of candidate naming. Returning from Investigate focuses the candidate row when one exists, otherwise the Published county picker. A fresh URL without a county does not auto-select a factual county; the existing first-candidate default applies only to published candidates.

Selecting a county on Review updates shared `county` and shows a preview on Review: county identity, why it is in the review set, suggested follow-up, **View county evidence**, and **Open Investigate**. Selection does not open Investigate and does not expand evidence. **View county evidence** sets Review-local `mode=evidence` and replaces the map, list, and preview with the in-page county view. **Back to map** clears `mode` and restores that browse surface. **Open Investigate** still uses `uxResetShellHandoffHref` with the current Review search params, so the destination receives only the shared keys Investigate accepts. `mode` is not one of those keys.

The preview why line is the review-priority rationale only. It does not say that county inputs are available, and it does not treat a missing tick or pathogen record as biological absence. When the score row is limited or unavailable, the preview shows that evidence state through the shared evidence strip and an Inspect provenance control. A `SUPPRESSED` status is Limited under the shared contract, including when evidence completeness is 100. A row whose human, tick, and pathogen statuses are all absent is Unavailable only when evidence completeness is zero. Completeness above zero means other scored inputs still provide governed signal, so that aggregate state is Limited. A county score summary does not include source family, observation period, evidence type, or provenance for that status, so those fields stay Unavailable and the caveat states the metadata limitation. The page release strip remains release-level. Governed observation rows stay on Investigate.

Browser Back and Forward restore the originating Review history entry. That entry keeps shared context (`scope`, `county`, `dataset`, `period`) and Review-local `sort` and `page` when those keys were already on the entry. The selected county row is scrolled into view. When the user left through Open Investigate or Compare, keyboard focus returns to that county's rank-row control. When the county is outside the first 40, return opens the complete county list and focuses that county's table control. The session fallback for that return is cleared after focus is restored, so a later fresh Review URL for the same county does not reuse it.

Practical limit: the pixel scroll offset inside the county list is not stored in the URL. Return reveals the selected row. The Investigate return link and shell links rebuild Review from shared context only, so they restore scope, county, dataset, and period, and they do not restore `sort` or `page`. Those Review-only keys are not added to the global handoff to make return work. If Review had `sort` or `page`, the preview states that those keys stay on Review. A validated `compare` pair is copied onto Investigate with the selected county.

## Compare entry and return (#420)

Review and Investigate open Compare through `buildCompareEntryHref` in `compare-entry.ts`. That helper is the Compare entry URL. The pair is still the shared `compare` serializer.

A validated two-county `compare` list is kept, so the selected county is not added as a third. One saved county is replaced by the county selected now, and remains only when no county is selected. When the list is empty, the selected county is written as the only member. Compare does not choose a second county. The Compare page asks for the missing county. Clearing or editing the pair on Compare changes `compare` on the Compare URL. It does not rewrite the Review or Investigate history entry the user left.

`return` is page-local to Compare. Entry links set it to `review` or `investigate`. Any other value is ignored. A direct Compare link without `return` stays usable and does not show a return control. The return link is a normal handoff of the visible pair: Review does not receive `compare`, and Investigate receives the pair currently on screen. Compare edits do not change the originating `county`.

## Investigate next step and export (#417)

Investigate keeps **Return to Review** in the county header. The next-step section offers **Compare** only after the published county or its evidence bundle has resolved. A well-formed identifier that is not in the published list does not start a comparison. **Return to Compare** remains when the URL has a validated two-county `compare` set, including when the county on screen did not resolve. That pair arrives through the normal handoff, including from the Compare workspace links.

**Continue to Action** is offered once the county evidence bundle has loaded ([#421](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/421)). A failed measure catalog does not create that bundle. Investigate may still show a published county finding from a synthetic view after the county request settles, including a settled 404, and that view does not offer Action, does not mark Ask Atlas measure, source, or period as loaded, and does not enable the PDF export. The link is the shared handoff, so Action receives `scope`, `county`, `compare`, `dataset`, and `period`. Investigate-local keys stay on Investigate. Action loads that county's governed evidence again and shows the same finding sentence, limitation sentence, availability, and release. A governed unavailable observation with no caveat stays on Action through the shared evidence row. Compare does not offer this link; a two-county comparison does not choose one county for follow-up. A requested `period` is stale only when accepted observation intervals exist and the date falls outside them. No returned interval leaves the period unverified. Direct links and reloads use the same URL context. **Return to Investigate** hands the shared context back.

Surveillance Planning is not a working workflow while its API dependency is deferred. Evidence brief is the one working Action workflow ([#423](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/423)). It opens only after the county evidence bundle has loaded, including from a direct `plan=evidence-brief` link, and it repeats the Investigate finding and limitation sentences. The county PDF is the same `county-v2` export context Investigate already builds. A note the user types is labeled as local context, stays on the page, and is not saved, sent, or included in that PDF. A withheld catalog stand-in does not open the brief or the PDF. Action does not choose the workflow, and it does not list placeholder categories. Any other `plan` value, including `brief`, is an unsupported direct link. `plan` and `role` stay page-local and are not copied onward.

**Contextual PDF export (#460).** For a loaded supported county, Investigate offers the server-owned `county-v2` report for every published canonical measure that shares one county, release, and exact observation interval and has source, lineage, provenance, and version fields. The button lists those measures and names each left-out measure with a short reason. An unsupported or unqueried period is not described as unpublished, and an empty bounded response describes that county and period only. The request sends only the county, dataset release, full inclusive interval, and those canonical measure IDs through the generated client. Fresh uncached reads before and after rendering must match the included observations. Published missing and no-county-linked states stay in the report. Failures never reuse an earlier artifact or fall back to `county-v1`. Only a nonempty HTTP 200 `application/pdf` response with `no-store` may download; page context changes and unmount cancel late downloads. See [Investigate PDF export](investigate-pdf-export.md). Representative tick fixture support does not establish production availability.

## Tests

- `tests/ux-reset-context-handoff.test.ts` — canonical serialization, nuqs parity, source export restrictions, calendar dates, two-county compare cap.
