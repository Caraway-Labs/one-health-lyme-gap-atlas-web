# Privacy operations runbook

Owner: One Health Lyme Gap Atlas product and engineering leads  
Last reviewed: 2026-09-11

## Disable product analytics

1. Remove or blank `NEXT_PUBLIC_AMPLITUDE_API_KEY` in GitHub Actions secrets and DigitalOcean App Platform build-time env.
2. Redeploy the web app. The client will not initialize Amplitude without a key.
3. Visitors can opt out in Privacy settings; that clears vendor storage in the browser. Default-on collection, Do Not Track, and storage-unavailable behavior are governed by [ADR 0022](adr/0022-default-on-amplitude-product-analytics.md). Events stay session-scoped, are retained 90 days, and are not sold or used for advertising.

Do not replace the disabled Browser SDK with a server collector or proxy without a new ADR.

## Processor access review

Review Amplitude project access quarterly and on role change. Analyst access is named, least-privilege, aggregate-first. Disable User Lookup/user-stream. Production retention is 90 days.

Supabase service-role keys remain in approved secret stores only.

## Retention

| Data | Retention | Control |
| --- | --- | --- |
| Amplitude allowlisted events | 90 days | Vendor project setting |
| Analytics preference | 183 days | First-party `localStorage` |
| Evidence-chat local history | 30 days / five conversations | Browser storage; user can clear |
| Account profile | Until self-delete or 1-year dormant deletion (ops step) | `/v1/me` + Auth admin |
| Privacy-request ledger | Security/audit record; redacted error class only | `atlas_accounts.privacy_requests` |

## Data-rights incidents

| Symptom | Operator action |
| --- | --- |
| Identity mismatch / 404 on another subject | Expected. Do not look up another user’s request id in logs that contain email. |
| `needs_support` after confirm | Inspect redacted `error_class` (`upstream_http`, `auth_admin_unavailable`, `processor_failure`, `stale_in_progress`). Retry only with the same request id after the processor recovers. |
| Supabase Auth admin outage | Account features return 503. Public Atlas remains available. Pause export/deletion UI copy if outage persists. |
| Partial deletion | Auth user delete is the connected processor. If it fails, the request stays `needs_support` and the account remains. Do not manually delete public Atlas rows. |
| Export download expired | Exports are available for one hour after completion. The user can start a new export. |

Privacy-request actions are not Amplitude events.

## Vendor checklist (Amplitude)

- Production and development projects are separated; tests use `synthetic-development-key` only.
- Autocapture, session replay, IP, language, platform, and persistent identity remain disabled in the typed client boundary.
- Person-level deletion/export APIs are **not applicable** while events have no account identity.
- Incident contact: privacy owner plus Amplitude account owner.
- DigitalOcean App Platform and GitHub Actions both supply `NEXT_PUBLIC_AMPLITUDE_API_KEY` as a build-time value (see `.do/app.yaml`).

## Mobile privacy E2E (#126)

Playwright sets `ATLAS_E2E=1` so `next.config.ts` hides the Next.js development indicator. The default bottom-left `nextjs-portal` indicator otherwise intercepts footer Privacy clicks on mobile viewports even when no runtime error exists. A browser `console.error` opens that same portal during `next dev`. Playwright's all-zero Amplitude key is rejected by ingestion, and the SDK would log that rejection at error level. The client silences SDK logs for that key only, while still initializing so default-on requests stay observable. Do not force-click around the portal.

## Rollback

Disable account privacy controls in the web UI and/or blank the Amplitude key. Leave the privacy-request ledger intact.
