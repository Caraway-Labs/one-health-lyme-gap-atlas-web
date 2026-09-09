# Optional-account MVP onboarding contract

**Implements planning scope:** web issue #78
**Status:** Ready for review; implementation is blocked on hosted-project provisioning and the policy gates below.

## MVP outcome and boundaries

This release is a technical proof that Atlas can integrate optional Supabase
authentication with a private, server-mediated user profile. It does not
promise a personalized workspace or new account benefit. Guests continue to
use every existing public Atlas workflow without an account.

In scope:

- Google and passwordless-email-link account entry;
- a skippable profile form;
- one mutable role, optional state, and only policy-approved optional fields;
- an explicit Save profile action; and
- a future-compatible state default after sign-in.

Out of scope:

- saved views, counties, notifications, email sharing, organization workspaces,
  role-based authorization, and persona-specific content;
- any change to public evidence, scores, methodology, or provenance; and
- browser access to Snowflake or Supabase Postgres.

## Profile model

| Field | MVP behavior | Storage rule |
| --- | --- | --- |
| Role | Optional; choose one value; mutable | Validated enum |
| State | Optional; selected from controlled US-state list | Postal abbreviation |
| Organization | Policy gate: do not implement until free-text decision is resolved | N/A |
| Job title | Policy gate: do not implement until free-text decision is resolved | N/A |
| Notification preference | Visible only as a non-interactive future capability, if shown at all | Do not persist |

The general-public path is shorter: it shows only the optional role and state
steps. Epidemiology roles may see the same data fields with role-appropriate
explanatory copy, but no extra data collection in this MVP.

## Guest-to-account flow

1. A guest chooses **Sign in** or a future profile/persistence action.
2. The entry surface gives **Continue with Google** and **Email me a sign-in
   link** equal prominence, plus a clear **Not now** action.
3. Cancellation returns the guest to their unchanged public route and URL
   state. No existing public action is blocked.
4. After validated authentication, the app restores the safe intended return
   path and presents the skippable onboarding form.
5. The user can exit onboarding. Selecting values alone makes no API write.
6. **Save profile** validates and persists the profile through FastAPI. Success
   confirms only that the profile was saved; it does not promise a product
   capability.
7. A returning authenticated user can open Profile, edit values, and press
   **Save profile**. A later release may select the stored state as the initial
   Atlas state filter after sign-in.

## Required states

- loading session;
- authentication unavailable;
- OAuth denied or cancelled;
- magic link sent, expired, invalid, or re-requested;
- safe-return-path rejection;
- profile validation failure;
- profile save in progress, success, and controlled failure; and
- sign out.

All states need keyboard operation, visible focus, programmatic labels, error
summary/live announcement where applicable, focus restoration, and a mobile
layout. Authentication errors must not reveal account existence, raw tokens,
magic links, or provider details.

## Data handling and measurement

Do not collect or transmit PHI, health data, diagnosis/treatment information,
exact address, county/FIPS, role/jurisdiction analytics, prompt/chat content,
or browser/session identifiers for product analytics. Selected state is private
profile data, not analytics data.

Only after explicit analytics consent, the approved telemetry boundary may emit
allowlisted lifecycle events without profile values: account-entry shown,
authentication completed/cancelled/failed, onboarding skipped, and profile-save
success/failure. The event catalogue and negative privacy tests must be updated
before such events are implemented.

## Prerequisites and policy gates

Before feature code begins:

1. The admin provisions separate Supabase Development and Production projects,
   Google OAuth, magic-link sender/domain, exact redirect allow-lists, and the
   approved secret-store references required by issue #79.
2. Decide organization/job-title handling: allow both as tightly bounded text,
   replace them with controlled selections, or defer them.
3. Decide whether a year of inactivity automatically deletes an account or
   triggers an administrative review.
4. Decide the child-data compliance approach for no-age-restriction accounts
   without date-of-birth collection.
5. Define the deletion/export service details and no-backup operational
   implications before public release. The requested email ZIP export is a
   later API and delivery capability, not an MVP dependency.

## Verification plan

- Unit tests for enum/state validation, safe return paths, no write before
  Save profile, and public guest cancellation.
- API integration tests for issuer/audience/signature/JWKS validation,
  ownership isolation, private no-store responses, and public-route regression.
- Database migration and RLS tests proving cross-user access is denied.
- Playwright and Axe tests covering both sign-in methods at their safe boundary,
  onboarding skip/save/edit, session expiry, sign out, failures, and keyboard
  recovery.
- Development smoke test for both sign-in methods, then a production smoke test
  after exact redirect and secret configuration is verified.
