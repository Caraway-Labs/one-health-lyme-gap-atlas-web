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
| Profile object, `state_code` present but not a governed state code | Unrecognized | Incomplete | United States fallback |

Completion follows only that jurisdiction mapping. Role, organization, and job title are optional and never mark completion, block the workspace, or stand in for a default. A legacy account save that stores a profile with `state_code: null` ("No state selected") is the same persisted shape as an explicit national default.

Writes always send the full `UserProfileWrite` body (`role`, `state_code`, `organization`, `job_title`). Explicit national sends `state_code: null`. A save is confirmed only when HTTP 200 returns a profile object whose mapped selection and optional fields echo the write. `profile: null`, a mismatched echo, a non-200, or a superseded response is unconfirmed: the editor keeps the draft and must not describe the default as saved.

In-flight reads that overlap a write are discarded. The cache keeps the last confirmed profile until a read that started after the write settles. `UserProfile` has no version field, so a later read that the server answers with an older body cannot be detected from the payload alone.

## Boundaries

- Changing the saved default affects the next Review open that omits `scope`. It does not rewrite an existing explicit Review URL.
- Scope changes on Review do not call `PUT /v1/me/profile`.
- Onboarding (#436 / #437) must import this adapter instead of inventing completion storage.
- API credential management stays out of this surface until a backend token contract exists.
