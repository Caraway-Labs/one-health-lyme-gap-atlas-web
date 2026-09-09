# 0014: Optional Accounts with Hosted Supabase

**Status:** Accepted
**Date:** 2026-09-08
**Decision owner:** One Health Lyme Gap Atlas product and engineering leads

## Context

The public Atlas is intentionally usable without an account. The product now
needs a small, optional account capability to validate a hosted identity
integration and to persist a user's mutable profile preferences. ADR 0002
correctly established the public, read-only Alpha API, but its statement that
end-user authentication is deferred no longer applies to this bounded feature.

## Decision

Use separate hosted Supabase Development and Production projects for:

- Supabase Auth with Google OAuth and passwordless, single-use email links;
- Supabase Postgres for minimum necessary account-profile records.

The browser may communicate directly with Supabase **only** for the approved
authentication/session flow using the project URL and publishable key. It must
not access Supabase Postgres directly, use a service-role key, or receive any
other server credential. All profile reads and writes go through explicit,
authenticated FastAPI `/v1/me/*` endpoints. FastAPI validates Supabase JWTs
against trusted issuer, audience, expiry, signature, and rotating JWKS keys;
the authenticated subject, not a client-provided ID, owns every record.

Existing public Atlas routes remain unauthenticated and retain their existing
cache behavior. User-scoped responses use `Cache-Control: private, no-store`.
Snowflake remains accessible only through the existing Python API boundary;
account data does not alter evidence, scores, provenance, or public-health
interpretation.

The MVP is an integration-validation release. It may persist a profile only;
it must not promise personalized product benefits, notifications, email
sharing, saved views, organizations/workspaces, or role-based data access.

## Initial profile contract

The profile is editable and saved only after an explicit **Save profile**
action. The intended role is exactly one nullable enum:

- `general_public_citizen`
- `district_level_epidemiologist`
- `state_level_epidemiologist`
- `state_director_level_epidemiologist`
- `national_level_epidemiologist`

An optional US state is stored as a validated postal abbreviation. Future
versions may use the state as an initial UI selection after sign-in, but never
as an access-control, scoring, evidence, or analytics input.

Optional organization and job-title fields are allowed as user-entered text,
each limited to 120 characters. They remain skippable and must not be used as
professional-verification claims, authorization inputs, or analytics values.

Atlas is a general-audience service, not a child-directed service. The account
flow has no age gate and collects no date of birth or child-status data. This
decision does not alter obligations that arise if Atlas becomes child-directed
or has actual knowledge that it is collecting personal information from a child.

## Privacy and lifecycle rules

- Do not collect PHI, health status, diagnosis/treatment information, exact
  addresses, professional-verification claims, arbitrary free text, or county
  identifiers in the MVP.
- Selected jurisdictions are private account data. Do not use them for
  advertising, identity inference, or analytics.
- Do not send role or jurisdiction values to product analytics. Any lifecycle
  telemetry is consent-gated, aggregate-safe, and uses the existing approved
  privacy contract.
- Users need a self-service deletion path. The later self-service export flow
  may asynchronously deliver a ZIP by email; it is out of scope for this
  integration-validation MVP and needs a separate authenticated delivery
  contract.
- Delete dormant accounts and their profile data automatically after one year
  of inactivity. Deletion is irreversible from Atlas's perspective.
- No application-managed backups are planned; deleted profile data need not be
  recoverable by Atlas. Provider-managed recovery behavior, if any, does not
  change that Atlas policy.

## Consequences

- The allowed public web configuration expands only to the Supabase project URL
  and publishable key required for authentication. Server-only credentials,
  Google secrets, SMTP credentials, and Supabase service-role keys remain in
  approved secret stores.
- The API OpenAPI contract and generated TypeScript client must change before
  the profile can be implemented.
- New profile tables require version-controlled migrations, Row Level Security,
  owner-isolation tests, and a server-side least-privilege data-access path.
- Separate Development and Production projects, exact redirect allow-lists,
  operational ownership, pause/resume handling, and credential rotation are
  prerequisites for provisioning story #79.

## Alternatives considered

- **Keep all account work deferred:** rejected because it cannot validate the
  optional-account integration.
- **Direct browser database access:** rejected because it weakens the Atlas
  application boundary and makes ownership controls harder to verify.
- **Mandatory authentication:** rejected because public Atlas exploration
  remains a no-login experience.

## Rollout, observability, and rollback

Start with a development-only, account-optional pilot. The authentication entry
must offer a clear cancellation path, preserve public exploration, and expose a
controlled unavailable state if the hosted project is paused. Record only
privacy-approved, consent-gated lifecycle outcomes. Roll back by disabling the
account entry and private API routes; public Atlas routes continue unchanged.

## Links to affected contracts and tests

- Workspace ADR 0001: Frontend Platform
- Workspace ADR 0002: Public API and Snowflake Access (superseded only for
  optional end-user identity and profile persistence)
- Web issue #77: Optional accounts and personalized workspaces
- Web issue #78: Guest-to-account personalization UX and measurement plan
- Web issue #79: Hosted Supabase provisioning
- Web issue #80: Schema, RLS, and data lifecycle
- Web issue #81: Next.js authentication and account UI
- Web issue #82: FastAPI JWT verification and private APIs
