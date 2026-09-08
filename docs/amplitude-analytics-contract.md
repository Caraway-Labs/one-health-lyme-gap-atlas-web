# Privacy-safe Amplitude product analytics contract

Status: approved design contract; no Amplitude SDK, key, or event transmission is enabled by this document.

Owner: Atlas product, engineering, and privacy leads

Last reviewed: 2026-09-07

## Product purpose and boundary

Atlas needs to learn whether people can discover, explore, interpret, and use its public capabilities. This contract permits measurement of **every intentional, user-facing Atlas product control** through a named semantic event. It does not permit surveillance of people or recording raw browser interaction data.

Atlas does not sell, rent, target advertising with, or build commercial behavioral profiles from product-analytics data. Analytics is never used to make a public-health, eligibility, diagnosis, treatment, or enforcement decision about a person.

The initial analytics implementation is deliberately session-scoped and pseudonymous. It supports aggregate feature adoption and within-session flow analysis, but not cross-session visitor profiling or anonymous-to-account stitching.

## Consent and identity model

The [privacy inventory](privacy-data-inventory.md) and `analytics-consent` module are the source of truth for a visitor's choice.

1. Do not load or initialize the Browser SDK before an explicit `Granted` decision.
2. Do not initialize, send an event, or create vendor storage when Do Not Track is enabled, a visitor declines, a preference is absent or invalid, or browser storage is unavailable.
3. When consent is withdrawn, immediately stop tracking, clear the SDK's browser storage, and do not reinitialize unless the visitor grants a new choice.
4. Honour the choice for all public routes. Public exploration must remain fully usable when analytics is off.
5. Use session-only identity storage. Do not set an Amplitude `user_id`, custom `device_id`, group, or identify property. Do not pass an identity in a URL, and do not enable cross-domain tracking.

The SDK's random session/device metadata is an allowed pseudonymous identifier only after consent. It is not an Atlas account identifier and must not be linked to an account now or retroactively. A future account-analytics change requires a new ADR, revised consent copy, the authenticated export/deletion implementation, and a processor review.

## Required vendor and SDK controls

The implementation must use the current `@amplitude/analytics-browser` Browser SDK (not the Unified SDK), pinned to an approved version and initialized from one client-only module. The public project API key is configuration, not a secret; it must still be scoped to this project and never used as a server credential.

| Area | Required setting or behavior | Reason |
| --- | --- | --- |
| Collection start | Initialize only after consent; no pre-consent queue | An SDK can create storage at initialization. |
| Events | Explicit calls from the typed allowlist below | Semantics are reviewable and stable. |
| Autocapture | Disable page, session, element, form, file-download, attribution, page-URL-enrichment, and visual-labeling autocapture | Prevents incidental clicks, labels, form interactions, URLs, and referrers from becoming analytics data. |
| Replay and experimentation | Do not install or enable Session Replay, heatmaps, surveys, Guides, Experiment, or feature flags | They are outside this adoption-measurement purpose. |
| Network/location | Disable IP address collection. Do not send city, country, region, DMA, latitude, longitude, or inferred geography. | Public-health context makes location minimization especially important. |
| Device context | Disable language, platform, OS/version, browser/user-agent parsing, device model/family/manufacturer, carrier, screen, connection, and battery properties. | These fields are not needed to answer the approved product questions. |
| URL/referral/marketing | Send only a controlled `route_id`; do not send full URL, query string, fragment, referrer, UTM, campaign, link text, or link URL. | URLs and referral parameters can contain identifiers or sensitive context. |
| Cross-site behavior | Keep `deviceIdFromUrlParam`/equivalent disabled; do not share identity across domains or subdomains. | Atlas has no need to follow visitors outside a single session. |
| Storage | Session-only identity; no cookie or local-storage fallback for persistent analytics identity. Clear vendor storage on opt-out. | Limits continuity to the consented browser session. |
| Error handling | Drop an invalid event locally; never retry it by serializing arbitrary UI state or error text. | A failure path must not become a data-exfiltration path. |

Before a release, engineering must validate the exact configuration against the pinned SDK version by observing that (a) no Amplitude request or storage exists before consent or after opt-out, and (b) a consented event contains only the declared event and property schema. Amplitude documents that Browser SDK initialization can create cookies, that IP and device collection are configurable, and that its Browser SDK supports explicit post-consent initialization; the implementation must follow those controls rather than vendor defaults. [Amplitude privacy and consent guide](https://amplitude.com/docs/data/privacy-and-consent-implementation) and [IP/device controls](https://www.amplitude.com/docs/data/understand-ip-address-and-location) are the implementation references.

## Event allowlist

Event names use lower-case `snake_case`. One call represents one completed user-intentful action; page render, focus, hover, scroll, keystroke, retry, and raw click events are never inferred as product events. Instrument every Atlas feature only when that feature has an approved row in this table.

| Event | Trigger semantics | Product question | Allowed event properties |
| --- | --- | --- | --- |
| `atlas_route_viewed` | A consented visitor completes navigation to a supported Atlas route | Which public surfaces are used? | Common context only |
| `atlas_ui_interaction` | A consented visitor activates a catalogued user-facing control | Which controls and features are adopted? | `control_id`, `action` |
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
| `route_id` | public product context | Closed enum of supported route IDs, not a URL |
| `geography_level` | public Atlas context | `national`, `state`, or `county` |
| `state_fips` | public Atlas context | Valid two-digit state FIPS only; absent when not selected |
| `county_fips` | public Atlas context | Valid five-digit county FIPS only; absent when not selected |
| `entry_surface` | product context | Closed enum such as `map`, `results_table`, `summary`, or `footer` |
| `outcome` | operational | Closed enum `success`, `cancelled`, `validation_rejected`, or `service_unavailable` |

`control_id`, `action`, `filter_dimension`, `filter_value`, `score_control`, `score_value`, `feedback_topic`, `account_flow`, `content_surface`, `selection_surface`, `summary_kind`, `export_scope`, `clear_scope`, `change_source`, and `page_bucket` are each closed, versioned enums in the typed analytics boundary. A value that is not in that allowlist causes the event to be dropped. Every JSX control attribute is created through its typed helper, so an unapproved literal cannot compile. `atlas_ui_interaction` is the complete control catalogue: every meaningful button, link, menu, selector, map/list action, and committed scenario adjustment must have a stable `control_id` before it ships. It never records labels, raw DOM selectors, hover, scroll, pointer movement, keystrokes, or text input. `active_filter_count` is an integer from 0 through 10; `page_bucket` is `1`, `2-5`, `6-10`, or `11+`.

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

Send 100% of approved events from consented sessions at launch; do not compensate for non-consent by increasing collection elsewhere. If volume requires sampling, apply a documented deterministic session-level sample and keep it in the event schema. Never sample to hide an event category or re-identify a visitor.

The initial dashboard questions are: route adoption; filter-to-geography-selection completion; map versus accessible-table use; CSV and summary-copy uptake; methodology/provenance engagement; scoring-control use; and, when separately launched, feedback and account-flow completion. Use aggregate counts and consented-session conversion rates; do not create individual behavioral profiles or cohorts for outreach.

## Pre-production acceptance tests

1. A fresh browser has no Amplitude network request, cookie, local/session storage, or event before consent.
2. Decline, Do Not Track, unavailable storage, and withdrawn-consent paths have the same result: no SDK initialization and no egress.
3. A consented test session emits only a typed allowlisted event with enumerated properties and no automatic page, click, form, session, URL, referrer, language, device, or IP fields.
4. Invalid event name, unknown enum, free-text property, raw URL, and direct SDK import outside the boundary fail tests or lint/CI checks.
5. The public privacy notice accurately lists Amplitude, its purpose, the 90-day retention, session-scoped identity, opt-out, and no-sale/no-ads commitments before activation.
6. A synthetic data-rights test proves the documented behavior for any future approved account linkage before that linkage is enabled.

## Change control

This document and the companion ADR are required review artifacts. A new event, property, SDK plugin, vendor destination, persistent identity, account linkage, processor region, retention period, or proxy must be treated as a governed privacy change. It may not ship under a generic "analytics" change.
