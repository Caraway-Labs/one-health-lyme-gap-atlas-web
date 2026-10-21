# Six-page workspace route migration

**Story:** [#196](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/196)  
**Canonical URLs:** [#608](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/608)  
**Epic:** [#194](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/194)  
**Machine-readable map:** `src/features/ux-reset/workspace-route-migration.ts` (`recordedWorkspaceMigration`)  
**Canonical path constants:** `ATLAS_EXPLORER_PATH`, `RESET_COMPARE_PATH`, and `RESET_ASSISTANT_PATH` in `src/features/ux-reset/routes.ts`

This document records the compatibility map. [#197](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/197) installs it from middleware after the auth guard. [#608](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/608) sets the canonical workspace URLs to `/explore`, `/compare`, and `/askatlas` and changes the installed redirect status to HTTP 308. The Explorer view ([#413](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/413)) and the dedicated Ask Atlas page ([#424](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/424)) are the landing surfaces. [#198](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/198) updated product links and docs to the six destinations; #608 retargets those links to the canonical paths. There is one redirect function. `next.config` host redirects stay separate because they cannot apply this query map.

The October 11, 2026 workspace is six destinations: **Atlas Explorer, Compare, Ask Atlas, Feed, Settings, Docs**. Atlas Explorer is map-led review and exploration, expandable county evidence, and Suggested follow-up on one URL. There is no separate Overview, Review, Explore, Investigate, Action, or Assistant side panel in that destination list. This redirect map does not retarget those six destinations. [#657](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/657) adds Data Provenance at `/data-provenance` beside them. That page is not an alias in this map.

## Canonical workspace URLs

| Destination | Constant | Canonical path | Former path |
| --- | --- | --- | --- |
| Atlas Explorer | `ATLAS_EXPLORER_PATH` | `/explore` | `/app/review` (`RESET_REVIEW_PATH`) |
| Compare | `RESET_COMPARE_PATH` | `/compare` | `/app/compare` (`LEGACY_COMPARE_PATH`) |
| Ask Atlas | `RESET_ASSISTANT_PATH` | `/askatlas` | `/app/assistant` (`LEGACY_ASSISTANT_PATH`) |

`/explore` renders the existing Review experience. Signed-in Front Porch entry uses it (`frontPorchExploreHref`). Settings default jurisdiction still applies to an Explorer open that omits `scope` and `county`. Compare's `return=review` resolves to `/explore`. `/app` is still the placeholder workspace home, not the map. `/app/explore` remains the historical measure-browser alias. A `/app/explorer` path is not part of this map. Public `/assistant` is not Ask Atlas.

The live shell labels are the six destinations in the table below.

## Destination inventory

| Destination | Canonical path | Current label in `RESET_ROUTES` | This map |
| --- | --- | --- | --- |
| Atlas Explorer | `/explore` | Atlas Explorer | Canonical. Aliases below redirect here. |
| Compare | `/compare` | Compare | Canonical dedicated page. |
| Ask Atlas | `/askatlas` | Ask Atlas | Canonical dedicated page. |
| Feed | `/app/feed` | Feed | Path and placeholder scope stay. |
| Settings | `/app/settings` | Settings | Path and profile/account scope stay. |
| Docs | `/docs` and nested docs slugs | Docs | Path and scope stay. Nested docs are the same destination. |

These are not workspace destinations and this map does not retarget them:

| Path | Current behavior | Recorded treatment |
| --- | --- | --- |
| `/` | Front Porch, unless a legacy analytical query is present | Stays the Front Porch. A legacy analytical query is an Overview deep link and maps to Explorer browse. |
| `/assistant` | Public literature workspace | Stays. It is not the signed-in Ask Atlas route. |
| `/knowledge-graph` | Already redirects to `/assistant`, preserving `conversation` | Stays that alias. This map does not send it to `/askatlas`. |
| `/app/ai-responsible-use` | Signed-in trust page | Stays. Not a seventh destination. |
| `/account`, `/auth/*`, `/privacy`, `/ai-ethics`, `/about/caraway-labs`, `/design-system`, `/api/search` | Existing utility, trust, and technical routes | Out of scope. |
| `/variant_1`–`/variant_7` | HTTP 404 since #550, including `/variant_6` | **Retired. Do not revive and do not redirect.** |
| `/ux-lab/**` | HTTP 404 since #504 | Retired. Do not revive. |

`UX_RESET_DESTINATION_IDS` still lists the pre-cutover Reset routes (`review`, `explore`, `investigate`, `compare`, `action`, `assistant`, `feed`, `settings`). #197 changes live handoff ids. This story does not.

## Alias → Explorer state

Browse is the current Review surface: map, list, and compact preview when `county` is a single valid FIPS. `mode` is omitted.

`mode=evidence` is expanded county evidence. `mode=follow-up` is that same expanded county opened at Suggested follow-up. `/explore` reads one exact token and renders that view. An invalid or repeated `mode` is removed. Middleware redirects the aliases below. They do not render their old pages.

| Source | Recorded target | State |
| --- | --- | --- |
| `/app/review` | `/explore` | Same surface. Supported Review keys stay: `scope`, `county`, `compare`, `dataset`, `period`, `sort`, `page`, `mode`, `selection`, `layer`, `focus`. Other keys are dropped. |
| `/app/compare` | `/compare` | Same surface. Supported Compare keys stay, including `return` and `mode`. |
| `/app/assistant` | `/askatlas` | Same surface. `county`, `dataset`, and `conversation` stay. Obsolete `page_ref` is dropped. |
| `/app`, `/app/explore` | `/explore` | Browse. Historical alias query rewrite, not the same-surface copy. |
| `/app/investigate`, `/investigate` | `/explore` | `mode=evidence` when `county` is one valid FIPS. Otherwise browse with no county. |
| `/app/action` | `/explore` | `mode=follow-up` when `county` is one valid FIPS. Otherwise browse with no county. |
| `/overview` | `/explore` | Browse. A county stays a preview selection, not expanded evidence. |
| `/geographic_explorer` | `/explore` | Browse. |
| `/` with a legacy Overview/Investigate query (`breakpoint`, `compare`, `county`, `dataset`, `eco`, `evidence`, `missing`, `q`, `state`) | `/explore` | Browse. Plain `/` stays the Front Porch. `/` with only Geographic Explorer keys (`metric`, `view`, `selected`, `page`) also stays the Front Porch, matching `legacyAnalyticalOverviewHref`. |

A `/` request that carries a legacy analytical query redirects straight to `/explore`. It does not stop at `/overview`. Plain `/` stays the Front Porch.

Bare `/investigate` and `/app/investigate` do **not** carry the Investigation Workspace nuqs default county `06037`. That default is applied only when `atlasSearchParams` parses a missing `county`. The map reads the raw query. A missing, blank, invalid, or repeated county opens county selection and does not substitute another county. The same rule applies to Action.

## Query mapping

Shared Reset parsers in `src/features/ux-reset/context-params.ts` decide what is valid. The map does not add a second parser.

| Source key | Copied when | Explorer key |
| --- | --- | --- |
| `scope` | Present. `ALL` or `[A-Z]{2}` is kept. Any other token becomes explicit `scope=ALL`, matching `parseUxResetSharedContext`. | `scope` |
| `state` | Present and `scope` is absent. Same validation as `scope`. Overview and Investigation Workspace use `state` for this. | `scope` |
| `county` | Exactly one five-digit FIPS. Invalid or more than one distinct FIPS is omitted, and the redirect writes `selection=required` so Explorer browse does not substitute another county. A URL that never included `county` does not get that marker. | `county` |
| `compare` | Valid FIPS, de-duplicated, capped at two (`UX_RESET_COMPARE_COUNTY_LIMIT`). | `compare` |
| `selected` | From `/app/explore`, only when `compare` did not yield a pair. From `/geographic_explorer`, a non-empty `selected` list wins over `compare`, because that page reads and updates `selected`. Same two-county cap. | `compare` |
| `dataset` | One value matching `^[A-Za-z0-9._-]{1,64}$`. This is the release id. | `dataset` |
| `period` | One real `YYYY-MM-DD`. | `period` |
| `metric` | Explore measure ids and Geographic Explorer view metrics (`score`, `completeness`). Atlas Explorer does not read a measure, so every `metric` value is dropped. | dropped |

Omitted `scope` stays omitted. The redirect must not write `scope=ALL` just because the parser's default is national. A written `scope=ALL` is an explicit location and blocks the saved starting view.

`compare` is preserved on the Explorer URL even though today's Review handoff acceptance drops it. #197 reconciles that acceptance when Explorer is the page. This story does not change `UX_RESET_HANDOFF_ACCEPTANCE`.

Geographic Explorer `metric=score` and `metric=completeness` are view metrics, not governed measure ids. Atlas Explorer has no measure control, so the redirect drops every `metric` value, including a governed measure id such as `reported-cases`. It must not be replaced with the first catalog measure. `resolveRequestedMeasureId` still substitutes a default on today's Explore page; the cutover must not copy that substitution into Explorer.

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
| `page` | Geographic Explorer and Review list position | Kept on `/app/review` → `/explore`. Dropped from any historical alias. |
| `sort` | Review list control | Kept on `/app/review` → `/explore`. Dropped from any historical alias. |
| `map_scope` | Explore map framing | Must not overwrite Review `scope`. |
| `plan`, `role` | Action. Only `plan` is parsed. `evidence-brief` is the one workflow id. `role` is unread. | Other Action links redirect to suggested follow-up and drop `plan`. One `plan=evidence-brief` stays on `/app/action` so the evidence brief remains reachable until that workflow renders in follow-up. |
| `return` | Compare (`review` or `investigate`) | Kept on `/app/compare` → `/compare`. `return=review` targets `/explore`. `return=investigate` targets Atlas Explorer `mode=evidence`. |
| `conversation` | `/assistant`, `/app/assistant`, `/askatlas`, `/knowledge-graph` | Kept on the Assistant URLs. `/app/assistant` redirects to `/askatlas` with this key. Not copied to Explorer. |
| `page_ref` | `/app/assistant`, `/askatlas` | Obsolete. Dropped on the `/app/assistant` redirect. A direct `/askatlas` link ignores it and removes it from the address bar. `conversation` and other supported parameters stay. It is not a shared key, not a chat request field, and not retrieved evidence. |
| `tab` | Named on Feed, not read | Feed does not redirect. |
| `release` | Not a URL key. Release identity is `dataset`. | Dropped. Not aliased onto `dataset`. |
| `layer` | Review map layer. `/app/explore` uses `metric` instead. | Kept on `/app/review` → `/explore`. Dropped from any historical alias. Not aliased onto `metric`. |
| `fips` | Not a URL key. The county key is `county`. | Dropped. |
| `mode` on an alias | Explorer view, and Compare's return restoration | Kept on `/app/review` → `/explore` and on `/app/compare` → `/compare`. Compare reads `mode` only to restore that Explorer view on return. Historical aliases drop an incoming `mode`; the source path chooses `evidence` or `follow-up`. |

Hashes are not copied. `#atlas`, `#methods`, and `#scoring` are legacy Overview fragments (`legacyAnalyticalFragmentHref`). They are not Explorer anchors. The recorded redirect does not append a hash. `mode=follow-up` is the Suggested follow-up restoration target so a missing hash cannot jump to the top of the page.

## Serializers and link consumers

Reset shared context: `context-params.ts`, `context-handoff.ts`. Page parsers: `review-search-params.ts`, `explore-search-params.ts`, `investigate-search-params.ts` (shared keys only), `compare-search-params.ts`, `action-search-params.ts` (`plan` only).

Legacy analytical context: `atlas-search-params.ts`, `geographic-explorer/model.ts` (`explorerParams`), `analytical-navigation-handoff.ts`.

Assistant context: `assistant-context-handoff.ts`, `assistant-conversation-url.ts`, `ask-atlas/workspace-href.ts`. Inherited Ask Atlas fields (`geography`, `measure`, `period`, `release`, `source`) are page context, not URL keys.

Compare entry: `compare-entry.ts` (`buildCompareEntryHref`, `return`).

Arrival: `resolve-review-scope.ts`, `use-apply-profile-starting-scope.ts`, `profile/default-jurisdiction-contract.ts`.

Product links after #197 and #198:

| Consumer | Where it goes |
| --- | --- |
| `paths.ts` `RESET_ROUTES` | Sidebar: Atlas Explorer, Compare, Ask Atlas, Feed, Data Provenance, Settings, Docs. Explore, Investigate, and Action stay alias metadata, not sidebar entries. |
| `professional-shell.tsx` | Those destinations. Data Provenance sits after Feed and before Settings. |
| `front-porch-copy.ts` | Signed-in entry to `/explore`. |
| `review-county-preview.ts` | County evidence on `/explore` with `mode=evidence`. |
| `reset-explore-experience.tsx` | **View county evidence** on `/explore?mode=evidence`. Compare stays `/compare`. |
| `reset-investigate-experience.tsx` | **Return to Atlas Explorer** for browse. **Suggested follow-up** is `/explore?mode=follow-up`. |
| `reset-action-experience.tsx` | **Return to county evidence** on `/explore?mode=evidence`. The evidence brief itself stays on `plan=evidence-brief`. |
| `ask-atlas/workspace-href.ts` | Ask Atlas links use the shell handoff. They do not add `page_ref`. |
| `compare-entry.ts`, `use-compare-workspace.ts` | Compare stays dedicated. `return=investigate` opens `mode=evidence`. |
| `settings-account-controls.tsx` | Account return `/app/settings`. |
| `middleware.ts` | Unauthenticated `/app` → sign-in `next`, then this map. |
| `return-path.ts` `accountFreeContinueHref` | Professional paths, including `/explore`, `/compare`, and `/askatlas`, → `/explore`. |

#198 retargets those product links and the user docs. It does not add a redirect.

## Auth, arrival, and failure

Order at cutover: the existing auth guard runs first. `shouldRedirectUnauthenticatedAppRoute` sends `/app` and `/app/*` to `/auth/sign-in?next=` with the **original** path and query (`signInHrefForReturnPath`). Compatibility redirect runs only after that return, so sign-in still round-trips the alias and its query. Production still requires a session. The non-production `ATLAS_E2E` bypass stays as it is.

| Arrival | Contract to preserve |
| --- | --- |
| Completed user, explicit URL | `hasExplicitReviewLocation`: a `scope` or `county` parameter blocks the saved starting view. Direct county, scope, dataset, and period intent stays. |
| Confirmed save, no explicit location | A profile object with a confirmed jurisdiction is the next Explorer open that omits `scope` and `county` (`reviewStartForSelection`). National `state_code: null` is a confirmed United States default. #437 owns the onboarding flow; its arrival path is `ATLAS_EXPLORER_PATH`. |
| Incomplete profile | `profile: null` or an unrecognized state code is incomplete. The start is the United States fallback, not a saved national default and not a chosen county. |
| Session or profile failure | Existing generation, 401, and unavailable-list rules stay. A pending or failed profile must not clear an explicit URL and must not select a county. An unavailable state list uses the national fallback only when the URL has no explicit location. |

Account-free continue sends professional paths to Atlas Explorer. Public aliases such as `/overview` stay intact so the compatibility redirect can preserve their query.

## History, focus, and loops

When #197 installs the map:

- Cross-route redirects use HTTP **308** and **replace** the history entry. Back returns to the page before the alias, not to the alias. #608 is the permanent canonical URL decision, so 308 is the installed status. Unauthenticated sign-in redirects stay HTTP 307 and are not cached as the workspace destination.
- Same-path query cleanup on `/explore` uses history replace, the same way Action already uses `history: "replace"`. It must not navigate to a different path.
- Applying the map to a redirect target returns `kind: "unchanged"`. Canonical destinations are fixed points. Tests in `tests/ux-reset-workspace-route-migration.test.ts` lock that.
- `/variant_*` and `/ux-lab/**` are not nodes in the redirect graph.
- `/knowledge-graph` is not chained through Explorer.

Focus and anchor restoration, verified by #197 once #413 has the view:

| Landing state | Focus |
| --- | --- |
| Browse with a county the user left from Review | Existing `markReviewReturnFocus` county row, or the published-county picker when the county is outside the first page. |
| Browse with no county | The county-selection prompt. Do not focus a fabricated row. |
| `mode=evidence` | The expanded evidence heading on `/explore`. |
| `mode=follow-up` | The Suggested follow-up section on `/explore`. |

No hash is added for those states. #413's in-page section links can be hashes on the canonical URL after the targets exist. Until the targets exist, a hash is not a successful restore.

## Test plan before cutover

Already covered by `tests/ux-reset-workspace-route-migration.test.ts`:

- Six destinations, canonical paths `/explore`, `/compare`, and `/askatlas`, live destination ids unchanged.
- No production file imports the map.
- Every alias row above, including bare investigate/action without `06037`.
- Unsupported keys, scope-versus-state, dropped measure ids, two-county cap, evidence-brief staying on Action, and `selection=required` for an invalid county.
- Retired variants and `/ux-lab` stay unmapped.
- One redirect then a fixed point.
- 308 and history replace are the installed redirect policy. Sign-in redirects stay 307.

Still required in #197, and not claimed here:

- Unauthenticated alias → sign-in `next` equals the original URL → after auth, the mapped Explorer URL.
- Confirmed-save arrival omits `scope` and `county` and shows the saved scope. An explicit county link is unchanged by that profile.
- Session expiry and profile failure do not change county.
- Browser Back/Forward across an alias does not loop and does not show the retired page.
- Keyboard focus matches the table above on desktop and mobile.
- Shell lists the six mapped destinations plus Data Provenance. #413 and #424 are present, so the redirect does not land on a placeholder.
- `/variant_1` through `/variant_7` still return 404.

## Geography

County coverage stays the published directory: lower 48 and the District of Columbia. This map does not add Alaska or Hawaii pages, geometry, or a schematic grid. The Geographic Explorer state grid that draws AK and HI is an existing illustration, not a route, and this story does not extend it.
