# 0022: Default-on Amplitude product analytics with explicit opt-out

Status: Accepted Date: 2026-10-24 Decision owner: Matthew Caraway, product owner

## Context

[ADR 0014](0014-privacy-safe-amplitude-browser-analytics.md) selected the direct Amplitude Browser SDK and a minimized, session-scoped event model, and it required an explicit opt-in before any analytics storage or egress. That posture also left the signed-in professional workspace unmeasured. Production ingestion is already configured. Product learning stays blind on the routes where signed-in users work.

Epic [#912](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/912) asks for default-on product analytics with explicit opt-out, including the professional workspace, without relaxing minimization. On 2026-10-24, product owner Matthew Caraway directed that change and ordered the work on epic #912: this governance record first (#913), then the consent, workspace, allowlist-coverage, copy, test, and production-verification stories (#914 through #919).

## Decision

Supersede only the opt-in-only posture and the professional-workspace exclusion in ADR 0014. Product analytics is on by default for public Atlas product routes and the signed-in professional workspace, including `/explore`, `/compare`, `/askatlas`, and the remaining signed-in `/app/*` destinations.

Analytics stays off, with no SDK initialization and no egress, in these cases:

- The visitor explicitly opts out or withdraws a previous allow.
- The browser sends Do Not Track as `1` or `yes`. Do Not Track overrides a stored allow and the default.
- Browser storage is unavailable or throws. Atlas does not substitute an identifier, cookie, or server-side profile.

A missing, expired, or invalid preference is not an opt-out. When storage works and Do Not Track is off, the Browser SDK may initialize and emit allowlisted events without an opt-in click. An explicit allow or opt-out is still stored in the existing first-party preference and expires after 183 days. Expiry returns the visitor to this default unless Do Not Track or storage failure applies. Opt-out stops tracking immediately and clears vendor storage. Analytics stays off until the visitor explicitly allows it again.

The signed-in workspace does not change identity rules. The following minimization constraints from ADR 0014 remain in force:

- One typed allowlist, in the Amplitude contract. No expansion of event meaning in this record.
- Session-scoped pseudonymous identity only. No Amplitude `user_id`, custom device id, cross-session profile, or anonymous-to-account stitching.
- No autocapture, Session Replay, heatmaps, surveys, or a second analytics vendor.
- No first-party analytics proxy.
- No analytics on consent-choice, privacy-settings, support, or data-rights events.
- Production event retention stays 90 days.
- Atlas does not sell, rent, or use this data for advertising or commercial behavioral profiling.

Public exploration and signed-in work stay fully usable when analytics is off. There is no consent wall. ADR 0020's choice to keep the documentation site free of analytics by default is unchanged.

## Consequences

Aggregate feature adoption can be measured on public routes and in the professional workspace, still only within a session and still without account identity. An explicit opt-out expires with the existing 183-day preference, after which the default applies again.

Amplitude remains a third-party processor. Allowed event payloads still travel directly from the browser to Amplitude. Person-level export or deletion of analytics stays impossible while events have no account identity; those events age out under the 90-day retention and remain export omissions.

This record does not change runtime behavior. Stories #914 through #919 implement the client, workspace coverage, typed route and control coverage, public copy, tests, and production verification.

Regional or legal review is a release gate if default-on collection requires it. Privacy-owner review of this decision must be recorded on #913 before those implementation stories merge to production.

## Alternatives considered

- **Keep ADR 0014's opt-in-only posture.** Rejected. It leaves professional-workspace adoption unobservable after the owner direction on 2026-10-24.
- **Default-on without opt-out, or ignoring Do Not Track.** Rejected. Explicit opt-out and Do Not Track still suppress all egress.
- **Durable opt-out that ignores the 183-day preference expiry.** Not selected. The preference record already expires at 183 days, and a missing preference is the default-on state.
- **Account-linked identity, autocapture, Session Replay, a second vendor, or a first-party proxy.** Rejected. Each still requires its own ADR.
- **Analytics on the documentation site.** Not changed. ADR 0020 still keeps docs free of analytics by default.

## Acceptance criteria

- ADR 0014 is marked superseded for its opt-in-only posture, and this record is the current analytics decision.
- The Amplitude contract consent section describes default-on, explicit opt-out, Do Not Track, and storage-unavailable behavior, including the professional workspace.
- The privacy inventory and data-rights references stay accurate: session-scoped identity, 90-day event retention, and no sale or advertising use.
- Consent-choice events remain outside the allowlist.

## Rollout, observability, and rollback

Ship the governance documents first. Do not treat this ADR as a production behavior change. Implementation follows #914 through #919 and must preserve zero egress on opt-out, Do Not Track, and storage failure.

Roll back the policy by restoring the ADR 0014 opt-in gate in a superseding record and disabling client initialization. The production kill switch remains blanking `NEXT_PUBLIC_AMPLITUDE_API_KEY` and redeploying. Do not replace a disabled direct SDK with a server-side collector or proxy without a new decision record.

## Links

- [ADR 0014](0014-privacy-safe-amplitude-browser-analytics.md), superseded for the opt-in-only posture
- [ADR 0016](0016-authenticated-data-rights-execution.md) and [ADR 0020](0020-atlas-documentation-site.md)
- [`../amplitude-analytics-contract.md`](../amplitude-analytics-contract.md)
- [`../privacy-data-inventory.md`](../privacy-data-inventory.md)
- [`../data-rights-workflow.md`](../data-rights-workflow.md)
- Epic [#912](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/912) and story [#913](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/913)
