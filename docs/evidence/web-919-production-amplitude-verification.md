# WEB #919: Production Amplitude professional-workspace verification

Verification date: **2026-10-25**. Project: **Atlas Web - Production (`856061`)**. No Browser API key is recorded in this note.

This is the execution record for the professional-workspace checklist in [the Amplitude contract](../amplitude-analytics-contract.md). It does not expand the event allowlist.

## Deployment under test

| Item | Observed value |
| --- | --- |
| Hosts | `https://onehealthatlas.org` and `https://carawaylabs.com` (same DigitalOcean app origin) |
| App | `one-health-lyme-gap-atlas-web` (`48160ff6-ce65-4e60-abab-e097e80daecf`) |
| Active deployment | `54d7f8f9-4f36-4496-9d69-713dc89755b0`, phase `ACTIVE`, healthy web replica |
| Deployment updated | 2026-10-25T07:03:42Z, manual spec update |
| Source commit | `d7d10e0acf7a5b70282502d7533ae7ecdf1a918e` (main, includes #918) |
| `NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET` | `production` (BUILD_TIME) |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | BUILD_TIME binding present on the spec. The client bundle shows the value was empty at build time |

Stories #913–#918 are in this commit. This note is the #919 check of that deploy.

## Related key configuration (#380 / #381)

[#380](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/380) is the production key epic. [#381](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/381) recorded on 2026-10-02 that GitHub Actions and DigitalOcean had the production key, that deployment `de1f7a33-4e9b-4834-9647-91db8f85004e` of commit `dd062da3b5d3e94299f41afc548e94728b071594` contained a non-empty key, and that browser ingestion into project `856061` was still pending. This 2026-10-25 check is that follow-up. It does not close #380 or #381. The current bundle no longer contains a key, so the 2026-10-02 bundle result does not describe the active deploy.

## Checklist and results

### 1. Build-time key in the production bundle

Spot-check procedure. Do not copy the key into git, issues, logs, or screenshots.

1. Read the active DigitalOcean deployment. Confirm the commit, `NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET=production`, and a BUILD_TIME `NEXT_PUBLIC_AMPLITUDE_API_KEY` binding.
2. Open `https://onehealthatlas.org/` with DevTools, or download the `/_next/static/chunks/*.js` files the document loads.
3. In the chunk that contains `atlas_route_viewed`, find the compiled key reader (the export beside the all-zero synthetic-key comparator). A configured build returns a non-empty string from `.trim()`. `"".trim()` means the image was built without the key.
4. The same chunk must still pass `autocapture: false`, `defaultTracking: false`, `identityStorage: "sessionStorage"`, and disabled IP, language, and platform tracking.

**Result: key absent.** Homepage scripts loaded on 2026-10-25 include `37un5yj9yz47f.js`. That chunk contains the allowlisted event names and the minimized `init` options above. Its key reader is compiled as `return"".trim()||void 0`. Across the 34 scripts loaded with the homepage there was one 32-character hex literal, the all-zero synthetic comparator, and no non-zero key. `api2.amplitude.com` was not loaded. `https://carawaylabs.com/` serves the same app and the same chunk URLs.

Because `start` returns immediately when the key is missing, the Browser SDK chunk is never requested.

### 2. Fresh browser emits `atlas_route_viewed` on `/explore` without an opt-in click

Procedure:

1. Use a fresh profile. Leave Do Not Track off and leave storage available. Do not set `atlas.analytics-preference.v1`.
2. Sign in, then open `https://onehealthatlas.org/explore`. Do not click Allow analytics.
3. In DevTools → Network, filter `amplitude`. Expect an HTTP 2xx within a few seconds whose event is `atlas_route_viewed` and whose `route_id` is `atlas_explorer`, with only allowlisted properties.
4. In project `856061`, confirm that event (segmentation grouped by `route_id`, or User Lookup / Event Stream when the role allows it).

**Result: not observed.**

- Unsigned `/explore` and `/app/settings` redirect to `/auth/sign-in` (`next=%2Fexplore` and `next=%2Fapp%2Fsettings`). This run has no production session, so the signed-in `/explore` load was not performed.
- A fresh headless Chromium profile (`navigator.doNotTrack === null`, no preference) loaded `https://onehealthatlas.org/` and then the unsigned `/explore` redirect. Both produced **zero** Amplitude requests. That matches the empty key: default-on does not call `init`.
- Project `856061` has no block or drop filter on `atlas_route_viewed`. The event is `unexpected` (ingested, not in the tracking plan). `firstSeen` `2026-10-02T04:31:33.509Z`, `lastSeen` `2026-10-24T20:45:25.646Z`, 30-day volume **2**. `atlas_ui_interaction` has never been ingested.
- Last 90 days of `atlas_route_viewed` totals by `route_id`: `atlas_home` **1** (the 2026-10-02 ingestion) and `front_porch` **1** (2026-10-24). No `atlas_explorer`, `compare`, `ask_atlas`, `intelligence_feed`, or `settings`.

The 2026-10-24 `front_porch` event predates deployment `54d7f8f9`. It is not evidence for this deploy.

### 3. Settings opt-out suppresses later egress

Procedure:

1. From the signed-in session that just emitted on `/explore`, open `/app/settings` (workspace footer **Privacy settings**).
2. Choose **Turn off optional analytics**.
3. Reload `/explore`. Expect no further Amplitude request. Vendor `AMP_` / `amplitude` storage keys are cleared. `atlas.analytics-preference.v1` remains with `decision` `denied`.

**Result: not run on Settings.** Unsigned `/app/settings` redirects to sign-in. There was also no production egress to suppress: the fresh profile's request count was already zero before any opt-out.

A public Front Porch check only confirmed the preference write. **Privacy settings** → **Turn off optional analytics** stored `{ decision: "denied", version: 1 }` in `atlas.analytics-preference.v1`. That is the same preference Settings uses. It does not substitute for the Settings reload check above.

### 4. What is still unverified

Restore a non-empty production Browser API key as DigitalOcean `NEXT_PUBLIC_AMPLITUDE_API_KEY` (BUILD_TIME) and the matching GitHub Actions secret from #381, then rebuild so the key is inlined. Do not commit the key. Then:

1. Repeat the bundle spot-check and record that the compiled reader is a non-empty trimmed string.
2. In a fresh signed-in browser, Do Not Track off, open `/explore` with no opt-in click. Confirm `atlas_route_viewed` / `route_id` `atlas_explorer` in project `856061`.
3. Turn analytics off on `/app/settings`, reload `/explore`, and confirm no later Amplitude request and cleared vendor storage.
4. Append the deployment SHA, timestamp, and event names to this record.

Until those three observations exist, project `856061` does not show professional-workspace adoption for the active deploy.

## Local coverage that is not this check

#918 covers the policy in Vitest and desktop Playwright with the synthetic all-zero key: default-on requests on `/explore`, and zero requests after opt-out and under Do Not Track. Those tests do not call project `856061`.

No product UI changed for this verification.
