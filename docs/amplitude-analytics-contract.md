# Privacy-safe Amplitude product analytics contract

Status: approved design contract for default-on product analytics with explicit opt-out. The typed Browser SDK allowlist is unchanged. [ADR 0022](adr/0022-default-on-amplitude-product-analytics.md) is the current decision and supersedes the opt-in-only posture in ADR 0014.

Owner: Atlas product, engineering, and privacy leads

Last reviewed: 2026-10-25

## Product purpose and boundary

Atlas needs to learn whether people can discover, explore, interpret, and use its public capabilities and the signed-in professional workspace. This contract permits measurement of **every intentional, user-facing Atlas product control** through a named semantic event. It does not permit surveillance of people or recording raw browser interaction data.

Atlas does not sell, rent, target advertising with, or build commercial behavioral profiles from product-analytics data. Analytics is never used to make a public-health, eligibility, diagnosis, treatment, or enforcement decision about a person.

The initial analytics implementation is deliberately session-scoped and pseudonymous. It supports aggregate feature adoption and within-session flow analysis, but not cross-session visitor profiling or anonymous-to-account stitching.

## Consent and identity model

The [privacy inventory](privacy-data-inventory.md) and `analytics-consent` module are the source of truth for whether analytics may run. [ADR 0022](adr/0022-default-on-amplitude-product-analytics.md) supersedes the opt-in-only posture in [ADR 0014](adr/0014-privacy-safe-amplitude-browser-analytics.md).

1. Analytics is on by default for public product routes and the signed-in professional workspace when browser storage is available and Do Not Track is off. A missing, expired, or invalid preference is not an opt-out. Do not require an explicit opt-in click before initializing the Browser SDK or emitting an allowlisted event.
2. Do not initialize, send an event, or create vendor storage when Do Not Track is enabled (`doNotTrack` of `1` or `yes`), the visitor has opted out, or browser storage is unavailable. Do Not Track overrides a stored allow and the default-on path. When storage is unavailable, do not substitute an identifier, cookie, or server-side profile.
3. When the visitor opts out, immediately stop tracking, clear the SDK's browser storage, and do not reinitialize unless the visitor explicitly allows analytics again.
4. Honor that result on public product routes and the signed-in professional workspace (`/explore`, `/compare`, `/askatlas`, and the remaining signed-in `/app/*` destinations). Exploration and signed-in work must remain fully usable when analytics is off. Do not use a consent wall. The documentation site stays free of analytics by default ([ADR 0020](adr/0020-atlas-documentation-site.md)).
5. Use session-only identity storage. Do not set an Amplitude `user_id`, custom `device_id`, group, or identify property. Do not pass an identity in a URL, and do not enable cross-domain tracking. A signed-in session does not change this rule and must not be linked to the analytics session.
6. Do not emit analytics for consent-choice, privacy-settings, support, or data-rights interactions.

The SDK's random session/device metadata is an allowed pseudonymous identifier only while analytics is allowed. It is not an Atlas account identifier and must not be linked to an account now or retroactively. Account-linked analytics still requires a new ADR, revised notice copy, the authenticated export/deletion implementation, and a processor review.

An explicit allow or opt-out is stored in the existing first-party preference (decision, decision time, expiry, and format version) and expires after 183 days. Expiry returns the visitor to the default-on state unless Do Not Track or storage failure applies. The default-on path does not require that preference record.

## Required vendor and SDK controls

The implementation must use the current `@amplitude/analytics-browser` Browser SDK (not the Unified SDK), pinned to an approved version and initialized from one client-only module. The public project API key is configuration, not a secret; it must still be scoped to this project and never used as a server credential.

| Area | Required setting or behavior | Reason |
| --- | --- | --- |
| Collection start | Initialize when analytics is allowed: the default-on path, or an explicit allow. No queue while the visitor is opted out, while Do Not Track is on, or when storage is unavailable. | An SDK can create storage at initialization. |
| Events | Explicit calls from the typed allowlist below | Semantics are reviewable and stable. |
| Autocapture | Disable page, session, element, form, file-download, attribution, page-URL-enrichment, and visual-labeling autocapture | Prevents incidental clicks, labels, form interactions, URLs, and referrers from becoming analytics data. |
| Replay and experimentation | Do not install or enable Session Replay, heatmaps, surveys, Guides, Experiment, or feature flags | They are outside this adoption-measurement purpose. |
| Network/location | Disable IP address collection. Do not send city, country, region, DMA, latitude, longitude, or inferred geography. | Public-health context makes location minimization especially important. |
| Device context | Disable language, platform, OS/version, browser/user-agent parsing, device model/family/manufacturer, carrier, screen, connection, and battery properties. | These fields are not needed to answer the approved product questions. |
| URL/referral/marketing | Send only a controlled `route_id`; do not send full URL, query string, fragment, referrer, UTM, campaign, link text, or link URL. | URLs and referral parameters can contain identifiers or sensitive context. |
| Cross-site behavior | Keep `deviceIdFromUrlParam`/equivalent disabled; do not share identity across domains or subdomains. | Atlas has no need to follow visitors outside a single session. |
| Storage | Session-only identity; no cookie or local-storage fallback for persistent analytics identity. Clear vendor storage on opt-out. | Limits continuity to the browser session in which analytics is allowed. |
| Error handling | Drop an invalid event locally; never retry it by serializing arbitrary UI state or error text. | A failure path must not become a data-exfiltration path. |

Before a release, engineering must validate the exact configuration against the pinned SDK version by observing that (a) no Amplitude request or storage exists while analytics is off (opt-out, Do Not Track, or storage unavailable) and (b) an allowed event contains only the declared event and property schema. Amplitude documents that Browser SDK initialization can create cookies, that IP and device collection are configurable, and that its Browser SDK supports explicit post-consent initialization; the implementation must follow those controls rather than vendor defaults. [Amplitude privacy and consent guide](https://amplitude.com/docs/data/privacy-and-consent-implementation) and [IP/device controls](https://www.amplitude.com/docs/data/understand-ip-address-and-location) are the implementation references.

## Event allowlist

Event names use lower-case `snake_case`. One call represents one completed user-intentful action; page render, focus, hover, scroll, keystroke, retry, and raw click events are never inferred as product events. Instrument every Atlas feature only when that feature has an approved row in this table.

| Event | Trigger semantics | Product question | Allowed event properties |
| --- | --- | --- | --- |
| `atlas_route_viewed` | A visitor completes navigation to a supported Atlas route while analytics is allowed | Which product surfaces are used, including the professional workspace? | Common context only |
| `atlas_ui_interaction` | A visitor activates a catalogued user-facing control while analytics is allowed | Which controls and features are adopted? | `control_id`, `action` |
| `atlas_filter_panel_opened` | Visitor opens the filter controls | Are filters discoverable? | Common context only |
| `atlas_filter_applied` | Validated controlled filter state changes results | Which filters and combinations are useful? | `filter_dimension`, `filter_value`, `active_filter_count` |
| `atlas_filter_cleared` | Visitor clears one or all controlled filters | Do filters impede exploration? | `clear_scope`, `active_filter_count` |
| `atlas_geography_selected` | Visitor selects a state or county in a map or accessible list/table | Which public geographies are explored? | `geography_level`, `state_fips`, `county_fips`, `selection_surface` |
| `atlas_results_table_opened` | Visitor opens the accessible full-results table | Is the non-map path used? | `entry_surface` |
| `atlas_results_table_page_changed` | Visitor changes a results-table page | Do visitors browse beyond the first results? | `page_bucket` |
| `atlas_csv_export_requested` | Visitor activates the CSV export action after the browser request begins | Is structured data export adopted? | `export_scope`, `geography_level` |
| `atlas_summary_copied` | Browser copy succeeds from an Atlas-generated summary | Is the interpretive summary useful? | `summary_kind` |
| `atlas_score_controls_opened` | Visitor opens a score/scenario control | Are score controls discoverable? | `score_control` |
| `atlas_score_change_committed` | Visitor applies a validated scoring/configuration change | Which sanctioned scenario controls are used? | `score_control`, `score_value`, `change_source` |
| `atlas_methodology_opened` | Visitor opens approved methodology/limitations content | Do visitors seek interpretation context? | `content_surface` |
| `atlas_provenance_opened` | Visitor opens source, freshness, or provenance content | Do visitors inspect evidence context? | `content_surface` |
| `atlas_feedback_opened` | Visitor opens the future feedback flow | Is feedback discoverable? | `feedback_topic` |
| `atlas_feedback_submitted` | Future feedback API confirms a submission | Is voluntary feedback being used? | `feedback_topic`, `outcome` |
| `atlas_feedback_outcome_viewed` | Future feedback flow shows a controlled confirmation/outcome | Does the feedback closure path work? | `outcome` |
| `atlas_account_flow_started` | Future authenticated account flow starts | Are accounts adopted? | `account_flow` |
| `atlas_account_flow_completed` | Future authenticated account flow completes | Where do account funnels succeed? | `account_flow`, `outcome` |

Rows labelled future cannot be emitted until their owning account or feedback story is live and the event is reviewed in the tracking plan. Consent choice, privacy-dialog interactions, support requests, and data-rights requests are expressly **not** Amplitude events.

## Property schema and limits

Every event includes the following common context. A property omitted from this table is forbidden.

| Property | Classification | Values / maximum cardinality |
| --- | --- | --- |
| `schema_version` | operational | Literal `atlas-analytics/v1` |
| `release_version` | operational | Build release identifier; no branch, commit author, or host name |
| `methodology_version` | public Atlas provenance | Published methodology version |
| `route_id` | public product context | Closed enum in the route table below, not a URL |
| `geography_level` | public Atlas context | `national`, `state`, or `county` |
| `state_fips` | public Atlas context | Valid two-digit state FIPS only; absent when not selected |
| `county_fips` | public Atlas context | Valid five-digit county FIPS only; absent when not selected |
| `entry_surface` | product context | Closed enum such as `map`, `results_table`, `summary`, or `footer` |
| `selection_surface` | product context | Closed enum `map`, `results_table`, `ranked_list`, or `experiment` |
| `outcome` | operational | Closed enum `success`, `cancelled`, `validation_rejected`, or `service_unavailable` |

`control_id`, `action`, `filter_dimension`, `filter_value`, `score_control`, `score_value`, `feedback_topic`, `account_flow`, `content_surface`, `selection_surface`, `summary_kind`, `export_scope`, `clear_scope`, `change_source`, and `page_bucket` are each closed, versioned enums in the typed analytics boundary. A value that is not in that allowlist causes the event to be dropped. Every JSX control attribute is created through its typed helper, so an unapproved literal cannot compile. `atlas_ui_interaction` is the complete control catalogue: every meaningful button, link, menu, selector, map/list action, and committed scenario adjustment must have a stable `control_id` before it ships. It never records labels, raw DOM selectors, hover, scroll, pointer movement, keystrokes, or text input. `active_filter_count` is an integer from 0 through 10; `page_bucket` is `1`, `2-5`, `6-10`, or `11+`.

Intelligence Feed filters use the existing `atlas_filter_applied` and `atlas_filter_cleared` events with `route_id` `intelligence_feed` (`/app/feed`). They do not add event names. `filter_dimension` adds `feed_source` and `feed_published`. `filter_value` for `feed_source` is `all` or `source_selected` (never a source id or organization name). `filter_value` for `feed_published` is `7d`, `30d`, `90d`, or `all`. `clear_scope` is `single` (one chip removed) or `all` (Clear filters). Both events include `active_filter_count` after the change. Home state and evidence filters keep their existing `filter_dimension` and `filter_value` values. The source-catalog retry button emits `atlas_ui_interaction` with `control_id` `feed_sources_retry` and `action` `activated`. It does not send a source id or organization name.

### Route identifiers

`routeIdForPathname` is the only classifier. A query string, fragment, or trailing slash does not change the id and is never sent. A value outside this table is dropped locally and is not sent to Amplitude.

| `route_id` | Path | Notes |
| --- | --- | --- |
| `front_porch` | `/` | Public Front Porch |
| `atlas_home` | `/overview`, and any unmatched analytical path | Legacy Overview. Canonical UX Reset paths are not this id |
| `privacy` | `/privacy` |  |
| `knowledge_graph` | `/knowledge-graph` |  |
| `atlas_variant` | `/variant_*` | Retired URLs. Kept distinct from `atlas_home` |
| `account` | `/account` |  |
| `assistant` | `/assistant` and nested paths | Public literature workspace. Not Ask Atlas |
| `geographic_explorer` | `/geographic_explorer` |  |
| `ai_ethics` | `/ai-ethics` |  |
| `atlas_explorer` | `/explore` and nested paths | Canonical Atlas Explorer |
| `compare` | `/compare` and nested paths | Canonical Compare |
| `ask_atlas` | `/askatlas` and nested paths | Canonical Ask Atlas |
| `intelligence_feed` | `/app/feed` and nested paths | Canonical Feed |
| `settings` | `/app/settings` and nested paths | Canonical Settings. Consent, privacy-settings, and data-rights controls on this page are not analytics events |
| `resources` | `/resources` and nested paths |  |
| `data_provenance` | `/data-provenance` and nested paths |  |
| `documentation` | `/docs` and nested paths | Classifies the path only. ADR 0020 still keeps the documentation site free of the analytics client |

Redirect aliases such as `/app/review`, `/app/compare`, `/app/assistant`, `/investigate`, and `/app` stay on `atlas_home` until the browser is on the canonical path above.

### Professional workspace controls

These `control_id` values extend the existing catalogue for Explorer, Compare, Ask Atlas, Settings, Feed, and the professional shell. `action` remains `activated`. Ask Atlas conversation controls keep the existing `evidence_chat_*` ids; `route_id` `ask_atlas` distinguishes that workspace from the public assistant. County PDF export reuses `pdf_export`. An unknown `control_id` still drops the event locally.

| `control_id` | Control |
| --- | --- |
| `nav_brand` | Professional shell wordmark |
| `nav_atlas_explorer` | Sidebar Atlas Explorer |
| `nav_compare` | Sidebar Compare |
| `nav_ask_atlas` | Sidebar Ask Atlas |
| `nav_feed` | Sidebar Research & News |
| `nav_resources` | Sidebar Resources |
| `nav_settings` | Sidebar Settings |
| `nav_data_provenance` | Sidebar Data Provenance |
| `nav_docs` | Sidebar Docs |
| `workspace_sign_in` | Shell sign-in |
| `workspace_sign_out` | Shell or Settings sign-out. Not a data-rights event |
| `explorer_county_select` | Explorer county option |
| `explorer_county_clear` | Explorer clear county |
| `explorer_map_layer` | Explorer map layer choice |
| `explorer_us_view` | Explorer US view |
| `explorer_fit_map` | Explorer fit map |
| `explorer_view_county_evidence` | Open county evidence |
| `explorer_view_follow_up` | View county follow-up |
| `explorer_compare` | Open Compare for the selected county |
| `explorer_ask_atlas` | Open Ask Atlas from Explorer |
| `explorer_back_to_map` | Back to map |
| `explorer_retry_evidence` | Retry county evidence |
| `explorer_retry_directory` | Retry county list |
| `compare_state_filter` | Compare state filter choice |
| `compare_county_select` | Compare county choice |
| `compare_county_clear` | Clear one compare county |
| `compare_swap` | Swap the compare pair |
| `compare_clear_pair` | Clear both compare counties |
| `compare_edit_counties` | Change counties from the pinned pair |
| `compare_pdf_export` | Download the compare county PDFs |
| `settings_save_starting_view` | Save starting view |
| `settings_profile_retry` | Retry the saved starting-view read |
| `feed_item_open` | Open a feed item at its publisher. The event does not include the URL, title, or publisher |
| `feed_retry` | Retry the feed request |
| `feed_clear_filters` | Clear feed filters or show all dates |
| `feed_remove_filter` | Remove one feed filter chip |

The following are prohibited in event names, properties, user properties, groups, IDs, URLs, logs, and Amplitude Data: free text; raw search terms; feedback or chat content; email, name, phone, address, account ID, authentication/session token, IP address, cookie value, device ID, user agent, referrer, marketing parameter, exact timestamp supplied by the app, health information, diagnosis, treatment, accessibility preference, or arbitrary error message.

## Governance, access, retention, and rights

| Control | Contract |
| --- | --- |
| Environment separation | Use separate development and production Amplitude projects. Development receives synthetic test traffic only and never production browser data. |
| Tracking-plan control | Register this allowlist in Amplitude Data (or an equivalent versioned schema) and check the typed TypeScript event boundary in CI. A PR that adds an event or property must update this document, schema, tests, privacy inventory, and reviewer approval. |
| Ownership | Product owns the question and event semantics; engineering owns the typed boundary and tests; privacy owner approves data classification, vendor settings, access, retention, and exceptions. |
| Analyst access | Named least-privilege analyst roles only; no shared credentials. Configure aggregate-first dashboards and disable User Lookup/user-stream access. Review access quarterly and on role change. |
| Retention | Start at 90 days for production event data. A shorter period is preferred if adoption questions can still be answered. Any change requires a documented review because vendor TTL is irreversible. |
| Vendor review | Before production collection, record the Amplitude processing region, current processor/DPA terms, incident contact, Data Access Control availability, bot/internal-traffic filters, and supported deletion/export APIs. No vendor configuration is implied by this contract. |
| Data subject rights | The authenticated [data-rights workflow](data-rights-workflow.md) governs future export and deletion. Because initial events have no account identity and expire after 90 days, it will not promise person-level lookup. If account linkage is ever approved, the implementation must use Amplitude's supported deletion/export processes and reconcile them with Atlas records. |
| Incident response | Disable analytics initialization via the privacy-safe client boundary, preserve only redacted incident evidence, notify the privacy owner, assess vendor exposure, and correct/release before re-enabling. |

## Sampling and success measures

Send 100% of approved events from sessions where analytics is allowed. Do not compensate for opt-out by increasing collection elsewhere. If volume requires sampling, apply a documented deterministic session-level sample and keep it in the event schema. Never sample to hide an event category or re-identify a visitor.

The initial dashboard questions are: route adoption; filter-to-geography-selection completion; map versus accessible-table use; CSV and summary-copy uptake; methodology/provenance engagement; scoring-control use; and, when separately launched, feedback and account-flow completion. Use aggregate counts and session conversion rates where analytics is allowed; do not create individual behavioral profiles or cohorts for outreach.

## Operator verification (ingestion)

Use this checklist after deploy or when Amplitude shows zero events. It does not rely on GitHub ticket status.

### Build-time configuration

| Environment | `NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET` | Amplitude project (id) | API key source |
| --- | --- | --- | --- |
| Production (DigitalOcean / main deploy) | `production` | Atlas Web - Production (`856061`) | App Platform build secret `NEXT_PUBLIC_AMPLITUDE_API_KEY` (production project key) |
| Local development / Playwright | `development` | Atlas Web Development Project (`860994`) | Developer `.env.local` `NEXT_PUBLIC_AMPLITUDE_API_KEY` (development project key) |

Production and development must never share the same Browser SDK API key. The non-secret `NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET` label must match the key's project so mis-routing is visible during verification.

Confirm the key is baked into the client bundle (Next.js inlines `NEXT_PUBLIC_*` at build time):

1. Open a deployed Atlas build in the browser.
2. Open DevTools → Sources (or Network) and search the compiled client for `NEXT_PUBLIC_AMPLITUDE` — the **value** should be present as an inlined string when configured; an empty string means the Docker/CI build did not receive the build arg.

### Allowed analytics → browser request → Amplitude project

1. Use a fresh profile or clear site data for the Atlas origin. Leave Do Not Track off and leave storage available.
2. Reload a public route such as `/`, or a professional workspace route such as `/explore`, without an opt-in click.
3. In DevTools → Network, filter for `amplitude`. Expect at least one successful ingestion request (HTTP 2xx) within a few seconds.
4. In the Amplitude UI for the project that matches `NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET`, open **User Lookup** or **Event Stream** (if enabled for your role) and confirm a semantic event such as `atlas_route_viewed` or `atlas_ui_interaction` with only allowlisted properties (`schema_version`, `release_version`, `route_id`, etc.).
5. Record the verification timestamp and event name in the release or incident notes.

Opt-out check: turn analytics off in Privacy settings, reload, and confirm Amplitude requests stop and vendor `AMP_` / `amplitude` storage keys are cleared from session/local storage (the first-party preference key remains).

Do Not Track check: with `doNotTrack` of `1` or `yes`, confirm no Amplitude request, including when a stored allow exists. The same zero-egress result applies when browser storage is unavailable.

### Automated regression

- Vitest asserts `getAmplitudeBrowserInitOptions().offline` is `OfflineDisabled` (falsy), not a truthy string that suppresses delivery.
- Playwright loads a fresh session with a synthetic API key and expects at least one Amplitude network request without an opt-in click, and expects zero requests after opt-out and under Do Not Track. Test updates belong to the implementation stories, not to this policy record.

Live confirmation that events land in projects `856061` and `860994` uses the production project (event segmentation by `route_id`, or User Lookup / Event Stream when that role is enabled). Do not record the Browser API key.

### Professional workspace production check (#919)

Run this after a production deploy that includes the default-on client. The project is Atlas Web - Production (`856061`). The repeatable procedure and the latest execution note are in [the #919 verification record](evidence/web-919-production-amplitude-verification.md). Related key configuration is [#380](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/380) and [#381](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/381).

1. Bundle spot-check. On `https://onehealthatlas.org/`, the compiled API-key reader in the client chunks must return a non-empty trimmed string. `"".trim()` means the Docker build did not receive `NEXT_PUBLIC_AMPLITUDE_API_KEY`. Record presence only.
2. Fresh signed-in browser on `/explore`, Do Not Track off, storage available, no opt-in click. Expect an Amplitude HTTP 2xx whose body is `atlas_route_viewed` with `route_id` `atlas_explorer` and only allowlisted properties. Unsigned `/explore` stops at sign-in and is not this check.
3. On `/app/settings`, turn optional analytics off, reload `/explore`, and confirm no further Amplitude request. Vendor `AMP_` / `amplitude` keys are cleared. The first-party preference remains.
4. In project `856061`, confirm the `atlas_explorer` event, then record the deployment SHA, timestamp, and event names in the verification record.

## Pre-production acceptance tests

1. A fresh browser with storage available and Do Not Track off emits only allowlisted events, on a public route and on a signed-in professional workspace route, without an opt-in click.
2. Opt-out, Do Not Track, and unavailable storage have the same result: no SDK initialization and no egress. Opt-out also clears vendor storage.
3. An allowed test session emits only a typed allowlisted event with enumerated properties and no automatic page, click, form, session, URL, referrer, language, device, or IP fields.
4. Invalid event name, unknown enum, free-text property, raw URL, and direct SDK import outside the boundary fail tests or lint/CI checks.
5. The public privacy notice accurately lists Amplitude, its purpose, the 90-day retention, session-scoped identity, default-on collection, opt-out, and no-sale/no-ads commitments before activation.
6. A synthetic data-rights test proves the documented behavior for any future approved account linkage before that linkage is enabled.

## Retired identifiers

These `control_id` values are no longer in the typed allowlist. Historical Amplitude events may still contain them. Do not reuse a retired ID for a new control or a new meaning.

| Retired `control_id` | Former emitter | Why it left the allowlist |
| --- | --- | --- |
| `nav_home`, `nav_atlas`, `nav_scoring`, `nav_methods`, `nav_variants`, `nav_variant_link` | `SiteNav`, removed when the shell moved to route metadata (#203) | No remaining emitter or consumer |
| `summary_copy` | Never emitted. The live copy control is `county_summary_copy`, and the copy event remains `atlas_summary_copied` | Orphan catalogue entry |
| `assistant_demo_send`, `assistant_demo_stop` | Assistant demo composer, removed with the unreferenced demo fixture (#563) | No remaining emitter or consumer |

`route_id` `atlas_variant` stays. Numbered `/variant_*` URLs return HTTP 404 and are not registered routes, but unmatched paths still use the analytical shell, which records an `atlas_route_viewed` event when analytics is allowed. Classifying that view as `atlas_variant` keeps it distinct from Overview (`atlas_home`).

## Change control

This document, ADR 0014, and ADR 0022 are required review artifacts. ADR 0022 is the current consent decision. A new event, property, SDK plugin, vendor destination, persistent identity, account linkage, processor region, retention period, or proxy must be treated as a governed privacy change. It may not ship under a generic "analytics" change.
