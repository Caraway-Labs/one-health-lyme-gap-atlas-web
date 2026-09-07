# Atlas Privacy Data Inventory

Status: current implementation inventory and pre-release contract

Owner: One Health Lyme Gap Atlas product and engineering leads

Last reviewed: 2026-09-07

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
| Product analytics | Understand feature adoption and improve Atlas | None | None | None | Not implemented |
| In-product feedback | Receive voluntary usability/data/feature feedback | None | None | None | Planned: web #63, API #42-43, data #129-130 |
| Optional accounts and personalization | Save user-owned views, preferences, and jurisdictions | None | None | None | Planned: web #77-84 |

## Planned data controls

Before product analytics, feedback, or accounts launch, the owning stories must define and implement:

1. a public plain-language notice that matches deployed behavior;
2. data classification, explicit purpose, allowed fields, and retention for every new field;
3. consent and opt-out behavior for non-essential browser telemetry;
4. processor/access review and incident procedures;
5. authenticated export and deletion workflows, including deletion propagation to approved processors; and
6. automated tests that reject prohibited telemetry fields and prove no non-essential telemetry leaves the browser before consent or after opt-out.

## Change control

Changes to this inventory require product and engineering review. A new third-party telemetry processor, browser identifier, public API contract, identity linkage, or change to data classification requires the corresponding governed decision/ADR before implementation.
