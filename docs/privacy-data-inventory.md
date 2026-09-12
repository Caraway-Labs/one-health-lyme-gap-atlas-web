# Atlas Privacy Data Inventory

Status: current implementation inventory

Owner: One Health Lyme Gap Atlas product and engineering leads

Last reviewed: 2026-09-11

## Purpose and policy

One Health Lyme Gap Atlas collects the minimum information needed to operate public Atlas capabilities, protect the service, and—only after the applicable privacy contract is approved—measure product adoption. Atlas does not sell, rent, or use user data for advertising, audience targeting, or commercial behavioral profiling.

Public-health datasets displayed by Atlas are not user data. They retain their own provenance, licensing, and governance contracts.

Product analytics must never contain private health information, medical history, diagnosis or treatment information, chat prompts/responses, feedback text, raw search terms, email addresses, credentials, tokens, or arbitrary URL parameters.

## Current data flows

| Flow | Purpose | Current data | Storage / processor | Retention and user control | Status |
| --- | --- | --- | --- | --- | --- |
| Public Atlas API requests | Render public maps, scores, county detail, and CSV downloads; protect reliability | Requested public resource, governed dataset/method settings, request context required for API operation | Atlas API and its redacted operational logging/OTel pipeline | Governed by API/operations retention; no account or browser product identity | Live |
| Browser URL state | Make a selected geography and Atlas controls reproducible/shareable | State, county FIPS, controlled evidence filter, score settings, dataset version | Browser address bar only | Visitor controls it through the URL | Live |
| Evidence-chat request | Retrieve reviewed evidence through the controlled Atlas API | Question, conversation ID/token, response/citations | Atlas API and knowledge-graph service | Server policy is 30 days; do not treat chat content as product analytics | Feature-gated |
| Evidence-chat local history | Let a visitor resume recent chats in the same browser | Up to five conversation transcripts, titles, timestamps, response metadata, token | Browser local storage | Expires after 30 days; visitor can clear the local history in the chat workspace | Feature-gated |
| Product analytics | Understand aggregate feature adoption and improve Atlas | Allowlisted semantic events after explicit consent; session-only Amplitude identity; no account linkage | Amplitude Browser SDK; first-party preference in `localStorage` | Events retained 90 days; preference expires after 183 days; visitor can decline or withdraw | Live |
| In-product feedback | Receive voluntary usability/data/feature feedback | None | None | None | Planned: web #63, API #42-43, data #129-130 |
| Optional accounts | Persist an optional profile after explicit Save | Role enum, optional state code, optional bounded organization/job title, Auth email | Hosted Supabase Auth + `atlas_accounts.user_profiles` via FastAPI `/v1/me` | Self-service export/deletion from account settings; dormant deletion after one year is a separate ops step | Live profile; saved views not launched |

## Planned data controls

Before product analytics, feedback, or accounts launch, the owning stories must define and implement:

1. a public plain-language notice that matches deployed behavior;
2. data classification, explicit purpose, allowed fields, and retention for every new field;
3. consent and opt-out behavior for non-essential browser telemetry;
4. processor/access review and incident procedures;
5. authenticated export and deletion workflows, including deletion propagation to approved processors; and
6. automated tests that reject prohibited telemetry fields and prove no non-essential telemetry leaves the browser before consent or after opt-out.

## Optional analytics consent contract

This contract governs non-essential browser product analytics. The consent-gated Amplitude Browser SDK may start only after an explicit Granted decision.

| State | Entry condition | Browser analytics behavior | Visitor control |
| --- | --- | --- | --- |
| Not decided | First visit, expired preference, or corrupted preference | Off. No SDK initialization, identifier, cookie, local-storage analytics item, or event egress. | Privacy settings offers an equally prominent allow or decline decision. |
| Denied | Visitor declines or withdraws | Off. A later vendor integration must not initialize or transmit. | Visitor can revisit Privacy settings. |
| Granted | Visitor explicitly selects allow and Do Not Track is not enabled | On. The approved Browser SDK may start and emit allowlisted events only. | Visitor can withdraw in Privacy settings at any time. |
| Do Not Track | Browser sends `doNotTrack` as `1` or `yes` | Off, including when a previously saved grant exists. | Browser setting controls this state; Atlas keeps its own optional analytics off. |
| Storage unavailable | Browser blocks storage or storage access throws | Off; Atlas does not substitute identifiers, cookies, or a server-side profile. | Public exploration remains available. |

The first-party preference record is created only after the visitor chooses allow or decline. It contains a decision, decision time, expiry time, and format version—no identifier, route history, or behavior data. It expires after 183 days and is removed if malformed or expired. It is not synchronized across browsers or devices, because Atlas has no account linkage today.

Privacy settings is available from every page footer without account creation. The contract applies to every visitor regardless of location; no consent wall, regional dark pattern, or degraded public exploration is permitted. The owning engineering team is accountable for the implementation and this inventory; future processor access, retention, deletion, and audit evidence must be defined by the vendor and governance story before data collection begins.

## Change control

Changes to this inventory require product and engineering review. A new third-party telemetry processor, browser identifier, public API contract, identity linkage, or change to data classification requires the corresponding governed decision/ADR before implementation.

The authenticated [data-rights workflow](data-rights-workflow.md) is implemented for live account/profile data. Unconnected processors (saved views, feedback contact, Amplitude identity, browser-only preferences) appear as export `omissions[]`. The Amplitude allowlist is maintained in [Privacy-safe Amplitude product analytics contract](amplitude-analytics-contract.md) and [ADR 0014](adr/0014-privacy-safe-amplitude-browser-analytics.md). Execution of export and deletion is recorded in [ADR 0016](adr/0016-authenticated-data-rights-execution.md).
