# Atlas Data Export and Deletion Workflow

Status: pre-launch product and operations contract

Owner: One Health Lyme Gap Atlas product and engineering leads

Last reviewed: 2026-09-07

## Scope and boundaries

This contract applies only after authenticated Atlas accounts and their user-scoped services are launched. It does not create an account, accept a privacy request, or authorize a processor. Until that point, the public privacy page must say that **Export my data** and **Remove all data** are planned controls.

No export or deletion request may alter a public Atlas dataset, methodology, release, score, evidence record, or public-health provenance. A request affects only the requester’s user data and approved processors listed below.

## Data inventory and treatment

| Store / processor | User data in scope | Export | Delete / exception | Owner |
| --- | --- | --- | --- | --- |
| Atlas account service (Supabase) | account ID, email, verified-authentication metadata, account settings | Yes, excluding credentials and security secrets | Delete account profile and revoke sessions after confirmation; retain security/audit record only as below | API + web |
| Atlas personalization service | saved views, jurisdictions, user-created labels, preferences | Yes | Delete all user-scoped records | API + web |
| Atlas feedback service and Snowflake feedback storage | feedback contact fields, request metadata, status, outcome | Yes | Delete contact and request linkage; retain original submitted feedback text and a redacted, non-identifying operational record when integrity, safety, or legal retention requires it | API + data |
| Approved product-analytics processor | approved pseudonymous analytics identity and allowlisted events | Yes when the processor supports an account-linked export | Delete linked identity and events according to the approved processor contract | Web + API |
| Browser-only Atlas preferences | analytics choice, local evidence-chat history | Browser-specific; not part of an account export unless explicitly linked after approval | User clears local chat history or browser storage; account deletion cannot silently control another device | Web |
| Operational security/audit systems | request ID, action, actor class, timestamps, result, redacted failure code | Not included in self-service export | Retain the minimum redacted record needed for security, fraud prevention, and compliance; publish the retention period before launch | Platform |

No export contains passwords, access/refresh tokens, secrets, internal service credentials, another person’s data, hidden moderation material, or raw operational logs.

## Request and authorization state machine

| State | Entry condition | Required behavior | Exit / audit evidence |
| --- | --- | --- | --- |
| Requested | Signed-in user starts Export or Remove all data | Bind the request to the current authenticated subject; record request ID and target action. Do not process an unverified or replayed request. | Verification challenge issued |
| Verified | Recent reauthentication or approved step-up verification succeeds | Confirm the requester owns the subject and show the exact action, scope, exceptions, and completion target. | Explicit confirmation or cancellation |
| Confirmed | User explicitly confirms the summarized request | Queue idempotent processor work. A deletion confirmation must name the irreversible account effect. | In progress with immutable audit event |
| In progress | A worker claims the request | Execute each processor step with least-privilege service identity; retry transient failures with bounded backoff. | Completed, partial failure, or failed |
| Completed | Required export artifact is available, or all required deletion/reconciliation checks pass | Notify the authenticated requester. Exports are time-limited downloads and never sent to an unverified email address. | Redacted completion audit event |
| Needs support | Permanent processor failure, unresolvable identity conflict, or retained-record exception | Do not silently close the request. Show the requester a support path and a non-sensitive reason. | Operator resolution and final audit event |

Requests must be single-subject and idempotent. The API must reject unauthenticated requests, a subject ID that differs from the authenticated subject, expired confirmations, reused confirmation nonces, and worker callbacks without their signed service identity.

## Timing, retries, and communication

The future product must publish the completion target before launch. The initial target is **30 calendar days** from a verified, confirmed request, with prompt notice if a processor delay or lawful exception prevents completion. Workers retry only transient failures; retries must preserve the same request ID and never duplicate an export or deletion.

The confirmation screen and completion notice must name:

1. the action (export or deletion);
2. covered stores and processors;
3. the expected timing;
4. retained feedback/original-record and security-audit exceptions;
5. the support escalation route; and
6. the fact that public Atlas data and methodology are unaffected.

## Export format

The export is a UTF-8 JSON document wrapped in a versioned envelope. It is generated server-side, scoped to one authenticated subject, encrypted at rest while staged, and exposed through a short-lived authenticated download URL.

```json
{
  "schema_version": "atlas-user-data-export/v1",
  "generated_at": "2026-09-07T00:00:00Z",
  "request_id": "opaque-request-id",
  "subject": { "account_id": "opaque-account-id" },
  "sources": [
    {
      "system": "atlas-account-service",
      "retrieved_at": "2026-09-07T00:00:00Z"
    }
  ],
  "data": {
    "account": {},
    "personalization": [],
    "preferences": {},
    "feedback_contact": [],
    "analytics": []
  },
  "omissions": []
}
```

Every populated record includes its source system and retrieval timestamp. `omissions` records a processor that is not yet connected, an approved exception, or a failed retrieval without exposing secrets or another person’s data.

## Deletion propagation and reconciliation

Deletion runs in this order: revoke active sessions → delete account-linked application records → delete Supabase account/profile data → delete or de-identify feedback contact data while retaining only approved immutable feedback text → send deletion to the approved analytics processor → remove staged export artifacts → reconcile every processor outcome.

The worker records only request ID, processor, attempt count, timestamps, outcome, and redacted error class. It does not copy exported data or secret values into logs. A request reaches `Completed` only when every required processor reports completion or a documented exception is approved. Reconciliation runs after completion and daily for pending/partial requests; it compares the internal request ledger to processor confirmations and reopens discrepancies for an operator.

## Launch gates and runbook

Before enabling either control, the owning stories must provide:

1. authenticated API endpoints with subject authorization, recent-authentication verification, confirmation nonce, rate limiting, and idempotency;
2. role-restricted worker/service identities and a processor-by-processor integration test;
3. tests that reject cross-user, unauthenticated, expired-confirmation, replay, and duplicate-worker attempts;
4. a support runbook for identity mismatch, partial deletion, processor outage, and retained-record exception;
5. a published retention schedule for the security/audit ledger and each exception; and
6. production reconciliation evidence for a synthetic account before release.

Changes to this contract, a new user-data processor, account identity linkage, a retention exception, or an export schema version require product and engineering review and the applicable governed decision record.
