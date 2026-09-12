# 0016: Authenticated data-rights execution

**Status:** Accepted  
**Date:** 2026-09-11  
**Decision owner:** One Health Lyme Gap Atlas product and engineering leads

## Context

The approved [data-rights workflow](../data-rights-workflow.md) requires
authenticated **Export my data** and **Remove all data** with a request ledger,
confirmation, processor propagation, and a 30-day completion maximum. Optional
accounts now persist a profile through FastAPI `/v1/me/profile` and hosted
Supabase Auth. There is no job queue, object store, or extra App Platform
worker. Amplitude events are session-scoped and must not receive an account
`user_id` ([ADR 0014](0014-privacy-safe-amplitude-browser-analytics.md)).
Feedback capture and saved views are not launched.

## Decision

Implement data-rights as additive private `/v1/me/privacy-requests*` endpoints
on the existing Python API. Store an append-friendly request ledger in
`atlas_accounts.privacy_requests`, accessible only with the server-side
Supabase secret key.

- State machine: Requested → (fresh session) Verified/Confirmed → In progress →
  Completed or Needs support.
- Execute currently connected processors **synchronously in the confirm
  request**. Thirty calendar days is the published maximum, not a reason to add
  a DigitalOcean worker for a seconds-scale profile export or Auth-user delete.
- Reconcile stale `in_progress` rows on later authenticated status reads.
- Serve the export JSON from the ledger over an authenticated GET. Do not add
  object storage or email a ZIP.
- Require a recently issued access token (`iat` within 15 minutes) before
  confirm. The UI reauthenticates; Atlas does not invent a second identity
  system.
- Processors that are not connected complete as documented `omissions[]`:
  personalization/saved views, feedback contact, Amplitude (no account
  linkage), and browser-only preferences.
- Deleting the Supabase Auth user remains the connected deletion processor and
  cascades the profile. The ledger row is **not** foreign-keyed with
  `ON DELETE CASCADE`, so a redacted audit record remains.

Do not set Amplitude `user_id`, do not add a first-party analytics proxy, and
do not add an App Platform worker without a superseding ADR.

## Consequences

- OpenAPI and the generated web client gain private privacy-request operations.
- Account settings can offer Export and Remove without changing public Atlas
  datasets, Snowflake access, or the browser-to-API boundary.
- Person-level Amplitude export/deletion stays impossible until a future ADR
  approves identity linkage.
- Operators handle `needs_support` through the data-rights runbook rather than
  silent retries that could duplicate deletion.

## Alternatives considered

- **New DigitalOcean worker/queue:** Matches a long-running processor model but
  changes deployment topology (ADR 0004/0009) without a current processor that
  needs hours or days.
- **In-process FastAPI BackgroundTasks only:** Would lose the request on
  restart and would not leave a durable ledger.
- **Amplitude User Privacy API with account stitching:** Would enable
  person-level analytics deletion but contradicts the accepted analytics ADR.

## Acceptance criteria

- Unauthenticated, cross-user, expired-nonce, replay, and stale-session
  confirms are rejected.
- A confirmed export returns `atlas-user-data-export/v1` with live account
  fields and explicit omissions for unconnected processors.
- A confirmed deletion revokes the Auth user and does not alter public Atlas
  data.
- Confirm and status responses never include secrets, tokens, or another
  subject’s data. Logs record request id, action, processor, and redacted
  error class only.

## Rollout, observability, and rollback

Apply the ledger migration to Development, verify with a synthetic account,
then promote the same migration to Production. Deploy the API before the web
account UI. Roll back by disabling the account privacy controls in the web app;
leave the ledger intact.

## Links to affected contracts and tests

- `docs/data-rights-workflow.md`
- `docs/privacy-data-inventory.md`
- ADR 0014 optional accounts; web ADR 0014 Amplitude
- API `/v1/me/privacy-requests*` contract tests
