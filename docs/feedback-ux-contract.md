# In-product feedback UX and context contract

Status: approved engineering contract for Epic #63 Wave 1 (web #64); UI implementation is web #65.

Owner: Atlas product and engineering leads

Last reviewed: 2026-09-26

## Product purpose and boundary

Atlas needs one combined in-product channel for voluntary product and data feedback. The browser opens a dialog, builds a bounded JSON body, and submits it to `POST /v1/feedback` through the existing Orval client and `apiMutator`. The API validates the body, optionally verifies a Supabase bearer token, and persists through Snowflake procedures owned by the data repository.

This document freezes the browser-facing contract so API #42 and data #129 can implement without guessing fields, privacy copy, or failure behavior. It does not implement the form, OpenAPI, or generated client. Schema version is the constant `feedback/v1`.

Atlas does not use feedback submissions for advertising, commercial profiling, public-health eligibility, diagnosis, treatment, or enforcement decisions about a person.

## Entry points

| Surface | Control | Behavior |
| --- | --- | --- |
| Analytical `AppShell` header | Label **Feedback**, placed next to Account | Opens the shared feedback dialog with no category preset |
| Geographic explorer | Label **Report a data issue** | Opens the same dialog with `category` preset to `data_issue` |
| Public footer on `/privacy` and `/ai-ethics` | Footer feedback control | Opens the same dialog with no category preset |

There is no feedback control on the docs shell. There is no second floating action button beside `ChatLauncher` (fixed bottom-right). Mobile and desktop both use the header or footer entry points so the dialog does not collide with chat.

## Categories

Closed enum. The form always exposes these five values; the explorer preset only selects the initial value.

| `category` | Meaning |
| --- | --- |
| `data_issue` | Suspected problem with Atlas data, geography, or evidence presentation |
| `usability` | Difficulty using the product |
| `bug` | Suspected software defect |
| `feature_idea` | Requested capability |
| `general` | Other feedback that fits none of the above |

## Request fields and lengths

The browser supplies only the fields below. The request model uses `extra="forbid"`. The browser must not send `feedback_id`, `received_at`, `account_id`, profile fields, cookies, tokens, or any extra property.

| Field | Rules |
| --- | --- |
| `submission_token` | UUID generated in memory when the dialog opens. Sent in the body, not a header. |
| `category` | One of the five enum values above. |
| `message` | Trimmed, NFC-normalized for fingerprinting, 10–2000 characters. Stored text keeps the trimmed original. |
| `contact_email` | Omitted or null when absent. When present: trimmed, max 254 characters, exactly one `@`, no spaces. Never copied from the account profile. |
| `route_id` | Closed enum: `overview` \| `geographic_explorer` \| `evidence_library` \| `assistant` \| `account` \| `privacy` \| `ai_ethics`. These match `navigation.ts` route ids, with `evidence-library` normalized to `evidence_library`. |
| `context` | Object or null. Closed schema below; not a free map. |
| `app_version` | Literal prefix `atlas-web/` plus 1–32 characters of `[A-Za-z0-9._-]`, taken from `ANALYTICS_RELEASE_VERSION` in `atlas-analytics.ts`. Do not add a new `NEXT_PUBLIC_*` variable. |

### Closed context allowlist

Every key is optional in the sense that it may be null or omitted when empty. Unknown keys are rejected by the API. Web #65 builds this object from pathname and existing page parsers; it omits empty optional fields and does not read `localStorage`.

| Key | Allowed values |
| --- | --- |
| `state` | `ALL`, a two-letter postal code, or null |
| `county_fips` | `^\d{5}$` or null |
| `compare_county_fips` | `^\d{5}$` or null |
| `selected_county_fips` | At most 5 distinct five-digit FIPS strings |
| `dataset` | Governed release id already shown in the URL; max 64; charset `[A-Za-z0-9._-]`; or null. Not free text. |
| `evidence_view` | `all` \| `ecological` \| `human` \| `complete` or null |
| `explorer_view` | `tiles` \| `multiples` \| `matrix` \| `ranking` \| `maps` \| `scatter` \| `compare` \| `trends` or null |
| `explorer_metric` | `score` \| `completeness` or null |
| `ecological_share` | Integer 40–85 step 5, or null |
| `low_incidence_breakpoint` | Integer 5–25, or null |
| `missing_human_weakness` | Integer 40–90 step 5, or null |
| `source_ids` | At most 8 strings; each max 64; charset `[A-Za-z0-9._:-]`. V1 leaves empty. |
| `evidence_item_ids` | Same constraints as `source_ids`. V1 leaves empty. |
| `item_ids` | Same constraints as `source_ids`. V1 leaves empty. |

### Explicit exclusions

The browser must never send:

- `q` search text
- chat prompts or chat history
- raw URLs, query strings, or fragments
- cookies, bearer tokens, or session identifiers in the body
- account profile fields (name, account email, settings)
- email prefilled from the signed-in account
- client-supplied `feedback_id`, `received_at`, or `account_id`

## Anonymous vs signed-in behavior

Anonymous submission is allowed. No `Authorization` header is sent when the visitor is signed out.

When the visitor is signed in, the client may attach the existing Supabase access token only because `apiMutator` is extended for `/v1/feedback` (web #65). The API derives `account_id` from the verified JWT `sub`. Invalid or expired credentials return 401; the call is not downgraded to anonymous, and no row is stored.

Signed-in UI copy must state that the report is linked to the visitor's Atlas account. Contact email remains optional, purpose-limited to feedback follow-up, and never promised as a support SLA. Email is typed by the user only; it is never copied from the account.

## Privacy and PHI guidance

Near the message field, the UI must tell the visitor not to submit medical details or other sensitive personal information. Feedback is voluntary product input, not a clinical channel and not a data-rights request form. Data-rights export and deletion remain on the account surface governed by [data-rights-workflow.md](data-rights-workflow.md).

## User-visible states

| State | Required behavior |
| --- | --- |
| Idle | Dialog open; fields editable; submit enabled when the form is not known-invalid. |
| Validation | Inline errors with `role="alert"`; typed text retained; no network call. |
| Submitting | Submit control disabled; same in-flight `submission_token`; typed text retained. |
| Success | `role="status"` confirmation; show a copyable `feedback_id` from the response; clear the draft after success. |
| 401 | Keep typed text and token; ask the user to sign in again; do not submit as anonymous. |
| 409 | Idempotency mismatch. Keep typed text; offer **Submit as a new report**, which rotates `submission_token` only after the user chooses that path. |
| 429 | Keep typed text and token; show retry guidance derived from `Retry-After`; do not log the body. |
| 5xx / offline | Keep typed text and token; retry reuses the same token and body. |

Preserve typed text and `submission_token` until success, an explicit discard control, or a user-chosen new token after 409. Closing and reopening the dialog must not lose a recoverable draft; hold draft state above the dialog (for example on `AppShell` / `PublicLayout`).

## Idempotency (browser expectations)

Idempotency for V1 is process-local and depends on a single API process. Distributed uniqueness is out of scope for this epic. The user-facing retry behavior still reuses the same `submission_token` and accepted body after timeouts, lost responses, 429, and 5xx.

Expected outcomes the UI must handle:

- First valid submit: success with `feedback_id` and `replayed=false`.
- Same token and same accepted payload (including a lost-response retry): success with the original id and `replayed=true`.
- Same token and a different accepted payload: 409; no second canonical row.
- Double-click: button disabled while submitting so a second mutation is not fired from the UI.

## Amplitude

Only the three events already reserved in [amplitude-analytics-contract.md](amplitude-analytics-contract.md) may be used for this feature:

| Event                           | Properties                  |
| ------------------------------- | --------------------------- |
| `atlas_feedback_opened`         | `feedback_topic`            |
| `atlas_feedback_submitted`      | `feedback_topic`, `outcome` |
| `atlas_feedback_outcome_viewed` | `outcome`                   |

`feedback_topic` is the category enum (`data_issue`, `usability`, `bug`, `feature_idea`, `general`). `outcome` is the closed set `success` \| `validation_error` \| `throttled` \| `unavailable` \| `dismissed`. Never send message text, contact email, account id, bearer token, raw URL, or free-text error strings in Amplitude properties.

## Accessibility and mobile

- Use the existing dialog primitive so focus is trapped while open and returned to the triggering control on close.
- Interactive targets meet the existing 44px minimum.
- Honour the existing `prefers-reduced-motion` CSS preference; do not add a separate motion system for feedback.
- Mobile layout uses header and footer entry points only. Do not place a feedback FAB in the bottom-right corner next to `ChatLauncher`.

## Retention and account deletion

This epic does not add a time-based purge and does not claim a fixed retention duration such as 24 months. Contact email and account linkage exist only for feedback follow-up and account-rights handling.

Account deletion, as described in [data-rights-workflow.md](data-rights-workflow.md), removes contact fields and account linkage for that account and retains the submitted message text (and a redacted non-identifying operational record when integrity or legal retention requires it). Operator redaction is a separate OWNER path that can replace message text for a single row; it is not the account-deletion path.

A future story may introduce time-based deletion only after a retention period is separately approved. Until then, do not publish a feedback retention clock in the UI.

## Out of scope for this document

- Dialog component, `apiMutator` changes, Orval generation, privacy-page launch copy updates, and tests (web #65)
- `POST /v1/feedback` models, middleware, and OpenAPI (API #42 / #43)
- Snowflake tables, procedures, and triage (data #129 / #130)
- Automatic GitHub issue creation, CAPTCHA, status portal, or a second floating launcher

## Change control

API #42 and data #129 must implement against this field list, context allowlist, privacy copy, and failure matrix. A change to categories, context keys, lengths, auth downgrade rules, Amplitude properties, or retention semantics requires an update to this document in the same change set as the owning repository work.
