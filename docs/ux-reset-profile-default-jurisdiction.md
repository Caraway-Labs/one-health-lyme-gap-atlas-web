# UX Reset profile and default jurisdiction

**Stories:** [#427](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/427) (Settings), reused by [#436](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/436) and [#437](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/437)  
**Owning API:** `GET /v1/me/profile` (`get_profile_v1_me_profile_get`) and `PUT /v1/me/profile` (`save_profile_v1_me_profile_put`)  
**Generated schemas:** `UserProfileResponse`, `UserProfile`, `UserProfileWrite` in `contracts/openapi.json` (do not hand-edit `src/generated/`)

## What this contract is

Settings and later onboarding share one adapter. There is no second preference store, no browser-storage default, and no completion flag in the generated profile.

| Module | Role |
| --- | --- |
| `src/features/ux-reset/profile/default-jurisdiction-contract.ts` | Mapping, completion, and the Review start helper |
| `src/features/ux-reset/profile/saved-profile-client.ts` | Read and write through the generated client |
| `src/features/ux-reset/profile/use-saved-profile.ts` | Shared React Query cache for Settings and Review |

Route authority stays in `src/features/ux-reset/routes.ts` (`RESET_SETTINGS_PATH` = `/app/settings`) and `src/features/ux-reset/context-params.ts`. Explicit Review `scope` stays authoritative via `hasExplicitReviewScopeParam` and `resolveStartingReviewScope`. This contract does not add a parallel route helper.

## National versus unselected

`UserProfile.state_code` is optional `string | null` with max length 2. The schema has no national sentinel. Postal abbreviations are state selections. `null` is not a second copy of "no profile".

| Persisted `UserProfileResponse` | Selection | Completion | Fresh Review start when `scope` is omitted |
| --- | --- | --- | --- |
| `profile: null` | Unselected. No saved default. | Incomplete | United States as a fallback, not a saved national default |
| Profile object, `state_code` null or omitted | Explicit national default | Complete | United States, confirmed |
| Profile object, `state_code` is a two-letter code in the current metadata state list | That state | Complete | That state |
| Profile object, `state_code` present but the state list is still loading | Unverified | Unavailable | Not applied yet |
| Profile object, `state_code` present but the state list failed to load | Unverified | Unavailable | United States fallback |
| Profile object, `state_code` present but not in the loaded state list, including an empty list | Unrecognized | Incomplete | United States fallback |

`assessSavedProfile` is the only mapping for Settings display, completion, and fresh Review start. A postal code is not complete until the loaded state list contains it. Loading and an unavailable list are not the same as a code confirmed to be outside coverage.

Completion follows only that jurisdiction mapping. Role, organization, and job title are optional and never mark completion, block the workspace, or stand in for a default. A legacy account save that stores a profile with `state_code: null` ("No state selected") is the same persisted shape as an explicit national default.

The profile cache key includes the authenticated user id. Sign-out, expiry, and account changes drop the previous cache and the open draft. A read or write checks the session again before its result is kept. A read and a write each send the access token from the same session snapshot as the account identity, so a later session lookup cannot attach a different account's bearer. A response that crosses an authentication generation — a different account or a refreshed token for the same account — is discarded. A save that is still in flight when that generation moves does not apply its outcome and does not overwrite the open draft. The editor leaves the saving state so that same draft can be submitted again. A 401 clears the editor only when it still belongs to the current authentication snapshot. A stale account's 401 does not, and a 401 for an older token does not block the refreshed session.

Writes for one account run one at a time, and overlap tracking is per account. One account's save does not discard another account's read. A newer save supersedes an older in-flight save for that same account, and the older response cannot mark itself saved. A read that overlaps that account's write is discarded. The discard checks generation, overlap, and abort again after the session lookup returns. If the cache for that account is still empty, the read is retried after that account's write settles.

A pristine Settings draft follows the governed assessment. When the state list recovers, an untouched draft is filled from that assessment again. Edits the user has already made stay in the form.

A save is confirmed only when HTTP 200 returns a profile object whose mapped selection and optional fields echo the write, or a later read already shows that same profile. A completed HTTP 200 that echoes the previous profile can say the saved default is unchanged, because that response is the server's finished result.

A lost response, non-200, or unreadable body stays unresolved. A follow-up read that still shows the previous profile cannot prove the attempt will not commit: `UserProfile` has no version or idempotency key, a missing row is null, and PUT upserts. The editor keeps the draft and the last confirmed profile and says the save could not be confirmed. It does not say the saved default is unchanged. The next Save is an explicit retry that sends the desired value again. A dropped request can still commit after that retry; this contract does not treat the earlier attempt as settled. Editing the draft does not clear that warning. A retry whose body differs from the unresolved attempt does not mark the editor saved, clear the draft, or replace the account cache. Only a retry of that same payload may settle the warning. If a success notice is already showing and a later read does not echo that announced profile, the notice is cleared and the desired draft stays.

## Boundaries

- Changing the saved default affects the next Review open that omits `scope`. It does not rewrite an existing explicit Review URL.
- Scope changes on Review do not call `PUT /v1/me/profile`.
- Onboarding (#436 / #437) must import this adapter instead of inventing completion storage.
- API credential management stays out of this surface until a backend token contract exists.
