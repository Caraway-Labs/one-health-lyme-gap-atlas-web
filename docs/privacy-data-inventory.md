# Atlas Privacy Data Inventory

Status: current implementation inventory

Owner: One Health Lyme Gap Atlas product and engineering leads

Last reviewed: 2026-10-25

## Purpose and policy

One Health Lyme Gap Atlas collects the minimum information needed to operate public Atlas capabilities, protect the service, and—only after the applicable privacy contract is approved—measure product adoption. Atlas does not sell, rent, or use user data for advertising, audience targeting, or commercial behavioral profiling.

Public-health datasets displayed by Atlas are not user data. They retain their own provenance, licensing, and governance contracts.

Product analytics must never contain private health information, medical history, diagnosis or treatment information, chat prompts/responses, feedback text, raw search terms, email addresses, credentials, tokens, or arbitrary URL parameters. Feed item detail opens emit `atlas_feed_item_detail_opened` with the closed values `entry_surface` (`feed_card_details` or `feed_card_read_more`) and `source_family` (`cdc_mmwr`, `cdc_eid`, `cdc_other`, `nih_niaid`, `pubmed`, `state_local`, or `other`). That event does not include an item id, PMID, title, or URL. Panel close, retry, PubMed, and NCBI copyright controls use `atlas_ui_interaction` control ids and no item text.

## Current data flows

| Flow | Purpose | Current data | Storage / processor | Retention and user control | Status |
| --- | --- | --- | --- | --- | --- |
| Public Atlas API requests | Render public maps, scores, county detail, and CSV downloads; protect reliability | Requested public resource, governed dataset/method settings, request context required for API operation | Atlas API and its redacted operational logging/OTel pipeline | Governed by API/operations retention; no account or browser product identity | Live |
| Browser URL state | Make a selected geography and Atlas controls reproducible/shareable | State, county FIPS, controlled evidence filter, score settings, dataset version | Browser address bar only | Visitor controls it through the URL | Live |
| Evidence-chat request | Retrieve reviewed evidence through the controlled Atlas API | Question, conversation ID/token, response/citations | Atlas API and knowledge-graph service | Server policy is 30 days; do not treat chat content as product analytics | Feature-gated |
| Evidence-chat local history | Let a visitor resume recent chats in the same browser | Up to five conversation transcripts, titles, timestamps, response metadata, token | Browser local storage | Expires after 30 days; visitor can clear the local history in the chat workspace | Feature-gated |
| Product analytics | Understand aggregate feature adoption and improve Atlas | Allowlisted semantic events, on by default for public product routes and the signed-in professional workspace; session-only Amplitude identity; no account linkage; not sold or used for advertising | Amplitude Browser SDK; first-party preference in `localStorage` only after an explicit allow or opt-out | Events retained 90 days; an explicit choice expires after 183 days and returns to the default; visitor can opt out | Policy accepted in ADR 0022. The client is default-on with explicit opt-out (#914–#918). Production ingestion is recorded in [web #919](evidence/web-919-production-amplitude-verification.md) |
| In-product feedback | Receive voluntary usability/data/feature feedback | None | None | None | Planned: web #63, API #42-43, data #129-130 |
| Optional accounts | Persist an optional profile after explicit Save | Role enum, optional state code, optional bounded organization/job title, Auth email | Hosted Supabase Auth + `atlas_accounts.user_profiles` via FastAPI `/v1/me` | Self-service export/deletion from Account and professional Settings; dormant deletion after one year is a separate ops step | Live profile; saved views not launched. The signed-in professional workspace does not store saved views, saved investigations, or an artifact library |

## Planned data controls

Before product analytics, feedback, or accounts launch, the owning stories must define and implement:

1. a public plain-language notice that matches deployed behavior;
2. data classification, explicit purpose, allowed fields, and retention for every new field;
3. consent and opt-out behavior for non-essential browser telemetry;
4. processor/access review and incident procedures;
5. authenticated export and deletion workflows, including deletion propagation to approved processors; and
6. automated tests that reject prohibited telemetry fields and prove no non-essential telemetry leaves the browser when analytics is off (opt-out, Do Not Track, or storage unavailable).

## Product analytics consent contract

This contract governs non-essential browser product analytics. [ADR 0022](adr/0022-default-on-amplitude-product-analytics.md) supersedes the opt-in-only posture in [ADR 0014](adr/0014-privacy-safe-amplitude-browser-analytics.md). The client implements the states below. Production bundle and project `856061` verification is recorded in [web #919](evidence/web-919-production-amplitude-verification.md).

| State | Entry condition | Browser analytics behavior | Visitor control |
| --- | --- | --- | --- |
| Not decided | First visit, expired preference, or corrupted preference, with storage available and Do Not Track off | On by default. The approved Browser SDK may start and emit allowlisted events only. No opt-in click. | Privacy settings offers an explicit opt-out. |
| Opted out | Visitor opts out or withdraws | Off. No SDK initialization or transmission. Vendor storage is cleared. | Visitor can allow analytics later in Privacy settings. |
| Allowed | Visitor explicitly selects allow and Do Not Track is not enabled | On. The approved Browser SDK may start and emit allowlisted events only. | Visitor can opt out in Privacy settings at any time. |
| Do Not Track | Browser sends `doNotTrack` as `1` or `yes` | Off, including when a stored allow exists and including the default-on path. | Browser setting controls this state; Atlas keeps product analytics off. |
| Storage unavailable | Browser blocks storage or storage access throws | Off; Atlas does not substitute identifiers, cookies, or a server-side profile. | Public exploration and signed-in work remain available. |

The first-party preference record is created when the visitor explicitly allows analytics or opts out. The default-on path does not require it. The record contains a decision, decision time, expiry time, and format version—no identifier, route history, or behavior data. It expires after 183 days and is removed if malformed or expired, which returns the visitor to the default-on state unless Do Not Track or storage failure applies. It is not synchronized across browsers or devices, because Atlas has no account linkage.

Privacy settings is available from every public page footer without account creation. The signed-in workspace footer opens `/app/settings` in the same tab, where the same `PrivacyPreferences` choice is shown inline. Both surfaces read and write one browser preference and honor Do Not Track the same way. The contract applies to public product routes and the signed-in professional workspace, for every visitor regardless of location. No consent wall, regional dark pattern, or degraded exploration is permitted. Atlas does not sell, rent, or use these events for advertising. The owning engineering team is accountable for the implementation and this inventory.

## Change control

Changes to this inventory require product and engineering review. A new third-party telemetry processor, browser identifier, public API contract, identity linkage, or change to data classification requires the corresponding governed decision/ADR before implementation.

The authenticated [data-rights workflow](data-rights-workflow.md) is implemented for live account/profile data. Unconnected processors (saved views, feedback contact, Amplitude identity, browser-only preferences) appear as export `omissions[]`. Amplitude events stay session-scoped, carry no account identity, are retained for 90 days, and are not sold or used for advertising, so a privacy request does not promise person-level analytics lookup or deletion. The Amplitude allowlist is maintained in [Privacy-safe Amplitude product analytics contract](amplitude-analytics-contract.md). [ADR 0022](adr/0022-default-on-amplitude-product-analytics.md) is the current consent decision and supersedes the opt-in-only posture in [ADR 0014](adr/0014-privacy-safe-amplitude-browser-analytics.md). Execution of export and deletion is recorded in [ADR 0016](adr/0016-authenticated-data-rights-execution.md).
