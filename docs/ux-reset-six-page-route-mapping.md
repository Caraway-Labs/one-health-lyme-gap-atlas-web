# Six-page workspace route migration

**Story:** [#196](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/196)  
**Epic:** [#194](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/194)  
**Machine-readable map:** `src/features/ux-reset/workspace-route-migration.ts` (`recordedWorkspaceMigration`)  
**Canonical path constant:** `ATLAS_EXPLORER_PATH` in `src/features/ux-reset/routes.ts`

This document records the compatibility map. It does not install redirects, rename navigation, or replace Review, Explore, Investigate, or Action. Cutover is [#197](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/197), and only after the Explorer view ([#413](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/413)) and the dedicated Ask Atlas page ([#424](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/424)) exist. [#198](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/198) updates product links and docs after that.

The October 11, 2026 workspace is six destinations: **Atlas Explorer, Compare, Ask Atlas, Feed, Settings, Docs**. Atlas Explorer is map-led review and exploration, expandable county evidence, and Suggested follow-up on one URL. There is no separate Overview, Review, Explore, Investigate, Action, or Assistant side panel in that destination list. This map does not add a seventh destination.

## Canonical Explorer URL

`ATLAS_EXPLORER_PATH` is `/app/review` (`RESET_REVIEW_PATH`).

Review is the existing map, ranked list, and county-preview route. Signed-in Front Porch entry already uses it (`frontPorchExploreHref`). Settings default jurisdiction already applies to a Review open that omits `scope` and `county`. Compare's `return=review` already resolves to this path. `/app` is still the placeholder workspace home, not the map. `/app/explore` is the measure browser that Explorer will absorb. A new `/app/explorer` path is not part of this map.

The display name Atlas Explorer does not require a different path. Live shell labels stay as they are until #197.

## Destination inventory

| Destination | Canonical path | Current label in `RESET_ROUTES` | This map |
| --- | --- | --- | --- |
| Atlas Explorer | `/app/review` | Review | Canonical. Aliases below redirect here at cutover. |
| Compare | `/app/compare` | Compare | Stays a dedicated page. |
| Ask Atlas | `/app/assistant` | Assistant | Stays this path. #197 may change the label. |
| Feed | `/app/feed` | Feed | Path and placeholder scope stay. |
| Settings | `/app/settings` | Settings | Path and profile/account scope stay. |
| Docs | `/docs` and nested docs slugs | Docs | Path and scope stay. Nested docs are the same destination. |

These are not workspace destinations and this map does not retarget them:

| Path | Current behavior | Recorded treatment |
| --- | --- | --- |
| `/` | Front Porch, unless a legacy analytical query is present | Stays the Front Porch. A legacy analytical query is an Overview deep link and maps to Explorer browse. |
| `/assistant` | Public literature workspace | Stays. It is not the signed-in Ask Atlas route. |
| `/knowledge-graph` | Already redirects to `/assistant`, preserving `conversation` | Stays that alias. This map does not send it to `/app/assistant`. |
| `/app/ai-responsible-use` | Signed-in trust page | Stays. Not a seventh destination. |
| `/account`, `/auth/*`, `/privacy`, `/ai-ethics`, `/about/caraway-labs`, `/design-system`, `/api/search` | Existing utility, trust, and technical routes | Out of scope. |
| `/variant_1`–`/variant_7` | HTTP 404 since #550, including `/variant_6` | **Retired. Do not revive and do not redirect.** |
| `/ux-lab/**` | HTTP 404 since #504 | Retired. Do not revive. |

`UX_RESET_DESTINATION_IDS` still lists the pre-cutover Reset routes (`review`, `explore`, `investigate`, `compare`, `action`, `assistant`, `feed`, `settings`). #197 changes live handoff ids. This story does not.

## Alias → Explorer state

Browse is the current Review surface: map, list, and compact preview when `county` is a single valid FIPS. `mode` is omitted.

`mode=evidence` is expanded county evidence. `mode=follow-up` is that same expanded county opened at Suggested follow-up. Neither value is read by production pages yet. #413 owns the view. Until it does, a bookmarked `mode` on `/app/review` is inert, and the aliases below still render their current pages.

| Source | Recorded target | State |
| --- | --- | --- |
| `/app`, `/app/review`, `/app/explore` | `/app/review` | Browse. Review is already canonical, so it does not redirect. |
| `/app/investigate`, `/investigate` | `/app/review` | `mode=evidence` when `county` is one valid FIPS. Otherwise browse with no county. |
| `/app/action` | `/app/review` | `mode=follow-up` when `county` is one valid FIPS. Otherwise browse with no county. |
| `/overview` | `/app/review` | Browse. A county stays a preview selection, not expanded evidence. |
| `/geographic_explorer` | `/app/review` | Browse. |
| `/` with a legacy Overview/Investigate query (`breakpoint`, `compare`, `county`, `dataset`, `eco`, `evidence`, `missing`, `q`, `state`) | `/app/review` | Browse. Plain `/` stays the Front Porch. `/` with only Geographic Explorer keys (`metric`, `view`, `selected`, `page`) also stays the Front Porch, matching `legacyAnalyticalOverviewHref`. |

Today `/` with a legacy analytical query still redirects to `/overview`. The recorded target skips that intermediate hop. The running app is unchanged.

Bare `/investigate` and `/app/investigate` do **not** carry the Investigation Workspace nuqs default county `06037`. That default is applied only when `atlasSearchParams` parses a missing `county`. The map reads the raw query. A missing, blank, invalid, or repeated county opens county selection and does not substitute another county. The same rule applies to Action.

## Query mapping

Shared Reset parsers in `src/features/ux-reset/context-params.ts` decide what is valid. The map does not add a second parser.

| Source key | Copied when | Explorer key |
| --- | --- | --- |
| `scope` | Present. `ALL` or `[A-Z]{2}` is kept. Any other token becomes explicit `scope=ALL`, matching `parseUxResetSharedContext`. | `scope` |
| `state` | Present and `scope` is absent. Same validation as `scope`. Overview and Investigation Workspace use `state` for this. | `scope` |
| `county` | Exactly one five-digit FIPS. Invalid or more than one distinct FIPS is omitted. | `county` |
| `compare` | Valid FIPS, de-duplicated, capped at two (`UX_RESET_COMPARE_COUNTY_LIMIT`). | `compare` |
| `selected` | Only from `/app/explore` or `/geographic_explorer`, and only when `compare` did not yield a pair. Same two-county cap. | `compare` |
| `dataset` | One value matching `^[A-Za-z0-9._-]{1,64}$`. This is the release id. | `dataset` |
| `period` | One real `YYYY-MM-DD`. | `period` |
| `metric` | Only from `/app/explore`, one token matching `^[A-Za-z0-9._-]{1,128}$`, excluding the Geographic Explorer enums `score` and `completeness`. | `metric` |

Omitted `scope` stays omitted. The redirect must not write `scope=ALL` just because the parser's default is national. A written `scope=ALL` is an explicit location and blocks the saved starting view.

`compare` is preserved on the Explorer URL even though today's Review handoff acceptance drops it. #197 reconciles that acceptance when Explorer is the page. This story does not change `UX_RESET_HANDOFF_ACCEPTANCE`.

Geographic Explorer `metric=score` and `metric=completeness` are view metrics, not governed measure ids. They are dropped. A measure id that is not in the loaded catalog must also be dropped at render time (#413). It must not be replaced with the first catalog measure. `resolveRequestedMeasureId` still substitutes a default on today's Explore page; the cutover must not copy that substitution into Explorer.

`selected` never becomes `county`. A five-county Geographic Explorer selection keeps the first two valid FIPS and records truncation. Later counties are not a five-county compare.

`scope` wins when both `scope` and `state` are present. Lowercase `state=ny` is invalid and becomes explicit `scope=ALL`. The URL parser does not uppercase state codes.

`scope=AK` or `scope=HI` is still only a two-letter token. This map does not add Alaska or Hawaii routes, insets, or coverage. Recognition stays the metadata state list (`isAtlasStateCode`). An unpublished FIPS stays the existing unsupported county recovery.

### Unsupported keys

These are dropped when an alias redirects. They are not Explorer state:

| Key | Where it lives today | Why it is unsupported |
| --- | --- | --- |
| `breakpoint`, `eco`, `missing` | `atlasSearchParams` score assumptions | Scoring controls, not governed evidence. |
| `evidence` | `atlasSearchParams` (`all`, `ecological`, `human`, `complete`) | Legacy evidence filter. Reset Investigate does not read it. |
| `q` | Legacy text filter | Not a Reset query. |
| `view` | Geographic Explorer enum (`tiles`, `multiples`, `matrix`, `ranking`, `maps`, `scatter`, `compare`, `trends`); also parsed and unread on `/app/explore` | Not an Explorer mode. |
| `page` | Geographic Explorer and Review/Explore list position | Page-local. Not copied across routes. |
| `sort` | Review list control | Stays on `/app/review` because that path does not redirect. Dropped from any alias. |
| `map_scope` | Explore map framing | Must not overwrite Review `scope`. |
| `plan`, `role` | Action. Only `plan` is parsed. `evidence-brief` is the one workflow id. `role` is unread. | Suggested follow-up is the destination. The evidence-brief deep link is not a seventh page. |
| `return` | Compare (`review` or `investigate`) | Stays on `/app/compare`. `return=review` already targets `/app/review`. `return=investigate` still targets `/app/investigate` until #197 points that return at `mode=evidence`. |
| `conversation` | `/assistant`, `/app/assistant`, `/knowledge-graph` | Stays on the Assistant URLs. Not copied to Explorer. |
| `tab` | Named on Feed, not read | Feed does not redirect. |
| `release` | Not a URL key. Release identity is `dataset`. | Dropped. Not aliased onto `dataset`. |
| `layer` | Not a URL key. `/app/explore` uses `metric`. | Dropped. Not aliased onto `metric`. |
| `fips` | Not a URL key. The county key is `county`. | Dropped. |
| `mode` on an alias | Not a current route contract | The source path chooses `evidence` or `follow-up`. An incoming `mode` does not override that. |

Hashes are not copied. `#atlas`, `#methods`, and `#scoring` are legacy Overview fragments (`legacyAnalyticalFragmentHref`). They are not Explorer anchors. The recorded redirect does not append a hash. `mode=follow-up` is the Suggested follow-up restoration target so a missing hash cannot jump to the top of the page.

## Serializers and link consumers

Reset shared context: `context-params.ts`, `context-handoff.ts`. Page parsers: `review-search-params.ts`, `explore-search-params.ts`, `investigate-search-params.ts` (shared keys only), `compare-search-params.ts`, `action-search-params.ts` (`plan` only).

Legacy analytical context: `atlas-search-params.ts`, `geographic-explorer/model.ts` (`explorerParams`), `analytical-navigation-handoff.ts`.

Assistant context: `assistant-context-handoff.ts`, `assistant-conversation-url.ts`, `ask-atlas/workspace-href.ts`. Inherited Ask Atlas fields (`geography`, `measure`, `period`, `release`, `source`) are page context, not URL keys.

Compare entry: `compare-entry.ts` (`buildCompareEntryHref`, `return`).

Arrival: `resolve-review-scope.ts`, `use-apply-profile-starting-scope.ts`, `profile/default-jurisdiction-contract.ts`.

Link consumers that still point at pre-cutover paths:

| Consumer | Paths it builds |
| --- | --- |
| `paths.ts` `RESET_ROUTES` | Shell entries for `/app`, Review, Explore, Investigate, Compare, Action, Assistant, Feed, Settings, Docs |
| `professional-shell.tsx` | Those shell links, including the workspace mark to `/app` |
| `front-porch-copy.ts` | Signed-in entry to `/app/review` |
| `review-county-preview.ts` | Open Investigate |
| `reset-investigate-experience.tsx` | Return to Review, Compare, Continue to Action |
| `reset-explore-experience.tsx`, `explore-committed-navigation.tsx` | Investigate and Review |
| `reset-action-experience.tsx` | Return to Investigate |
| `compare-entry.ts`, `use-compare-workspace.ts` | Compare entry and Investigate return |
| `settings-account-controls.tsx` | Account return `/app/settings` |
| `middleware.ts` | Unauthenticated `/app` → sign-in `next` |
| `app/page.tsx` | `/` plus a legacy analytical query → `/overview` |
| `knowledge-graph/page.tsx` | `/knowledge-graph` → `/assistant` |
| `return-path.ts` `accountFreeContinueHref` | Professional paths → `/overview` for the account-free exit |

#197 has to retarget those consumers. #198 retargets prose. This story leaves them in place.

## Auth, arrival, and failure

Order at cutover: the existing auth guard runs first. `shouldRedirectUnauthenticatedAppRoute` sends `/app` and `/app/*` to `/auth/sign-in?next=` with the **original** path and query (`signInHrefForReturnPath`). Compatibility redirect runs only after that return, so sign-in still round-trips the alias and its query. Production still requires a session. The non-production `ATLAS_E2E` bypass stays as it is.

| Arrival | Contract to preserve |
| --- | --- |
| Completed user, explicit URL | `hasExplicitReviewLocation`: a `scope` or `county` parameter blocks the saved starting view. Direct county, scope, dataset, and period intent stays. |
| Confirmed save, no explicit location | A profile object with a confirmed jurisdiction is the next Explorer open that omits `scope` and `county` (`reviewStartForSelection`). National `state_code: null` is a confirmed United States default. #437 owns the onboarding flow; its arrival path is `ATLAS_EXPLORER_PATH`. |
| Incomplete profile | `profile: null` or an unrecognized state code is incomplete. The start is the United States fallback, not a saved national default and not a chosen county. |
| Session or profile failure | Existing generation, 401, and unavailable-list rules stay. A pending or failed profile must not clear an explicit URL and must not select a county. An unavailable state list uses the national fallback only when the URL has no explicit location. |

Account-free continue still sends professional paths to `/overview` until #197 points that helper at Explorer.

## History, focus, and loops

When #197 installs the map:

- Cross-route redirects use HTTP **307** and **replace** the history entry. Back returns to the page before the alias, not to the alias. Do not use 308 in that change; permanent redirects are cached before the replacement views are known to be the ones users should keep.
- Same-path query cleanup on `/app/review` uses history replace, the same way Action already uses `history: "replace"`. It must not navigate to a different path.
- Applying the map to a redirect target returns `kind: "unchanged"`. Canonical destinations are fixed points. Tests in `tests/ux-reset-workspace-route-migration.test.ts` lock that.
- `/variant_*` and `/ux-lab/**` are not nodes in the redirect graph.
- `/knowledge-graph` is not chained through Explorer.

Focus and anchor restoration, verified by #197 once #413 has the view:

| Landing state | Focus |
| --- | --- |
| Browse with a county the user left from Review | Existing `markReviewReturnFocus` county row, or the published-county picker when the county is outside the first page. |
| Browse with no county | The county-selection prompt. Do not focus a fabricated row. |
| `mode=evidence` | The expanded evidence heading, after #413 renders it. |
| `mode=follow-up` | The Suggested follow-up section, after #413 renders it. |

No hash is added for those states. #413's in-page section links can be hashes on the canonical URL after the targets exist. Until the targets exist, a hash is not a successful restore.

## Test plan before cutover

Already covered by `tests/ux-reset-workspace-route-migration.test.ts`:

- Six destinations, canonical path `/app/review`, live destination ids unchanged.
- No production file imports the map.
- Every alias row above, including bare investigate/action without `06037`.
- Unsupported keys, scope-versus-state, measure id versus geographic metric, two-county cap.
- Retired variants and `/ux-lab` stay unmapped.
- One redirect then a fixed point.
- 307 and history replace are the recorded install policy, with redirects not installed.

Still required in #197, and not claimed here:

- Unauthenticated alias → sign-in `next` equals the original URL → after auth, the mapped Explorer URL.
- Confirmed-save arrival omits `scope` and `county` and shows the saved scope. An explicit county link is unchanged by that profile.
- Session expiry and profile failure do not change county.
- Browser Back/Forward across an alias does not loop and does not show the retired page.
- Keyboard focus matches the table above on desktop and mobile.
- Shell lists only the six destinations. #413 and #424 are present, so the redirect does not land on a placeholder.
- `/variant_1` through `/variant_7` still return 404.

## Geography

County coverage stays the published directory: lower 48 and the District of Columbia. This map does not add Alaska or Hawaii pages, geometry, or a schematic grid. The Geographic Explorer state grid that draws AK and HI is an existing illustration, not a route, and this story does not extend it.
