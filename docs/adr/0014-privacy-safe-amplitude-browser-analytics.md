# 0014: Privacy-safe direct Amplitude Browser analytics

Status: Accepted Date: 2026-09-07 Decision owner: One Health Lyme Gap Atlas product and engineering leads

## Context

Atlas needs evidence about public-feature adoption but its public-interest mission requires a high-trust posture: no advertising, sale of visitor data, or quiet behavioral surveillance. The approved consent contract defaults to no optional analytics and honours Do Not Track. Amplitude has been selected as the prospective product-analytics processor.

The decision is whether to use Amplitude's direct Browser SDK or add a first-party event proxy, and what data/identity boundary applies.

## Decision

Use the direct `@amplitude/analytics-browser` Browser SDK only after explicit consent, with the versioned allowlist in [`../amplitude-analytics-contract.md`](../amplitude-analytics-contract.md).

The SDK is initialized from one client-only boundary after consent. It receives only typed, curated, session-scoped pseudonymous events. It must disable automatic interaction/page/form/session/file/attribution capture, Session Replay, visual labeling, IP/location, language, device/browser/user-agent context, referrer/URL/UTM capture, persistent storage, cross-domain identity, and anonymous-to-authenticated identity linkage. It must not set an Amplitude user ID or custom device ID.

The initial implementation uses one production project and one synthetic-data development project, both owned and access-controlled as defined in the contract. Production retention starts at 90 days. No analytics event is emitted before consent or after a decline, Do Not Track signal, storage failure, or withdrawal.

## Consequences

This is the lowest-operational-complexity path for a small, explicit event schema. It allows aggregate feature-adoption measurement but intentionally cannot measure cross-session journeys, build account funnels from identified users, or recover analytics data by person without a future governed change.

Amplitude remains a third-party processor, so a consented visitor's approved event payload travels directly from the browser to Amplitude. The public privacy notice, vendor review, access control, retention, and rights workflow are release gates rather than paperwork after the fact.

## Alternatives considered

- **First-party proxy:** Centralizes filtering, audit logging, and vendor isolation; it is preferred if Atlas needs server-enforced field stripping, multiple destinations, account-linked deletion orchestration, or stronger egress auditability. It adds an ingestion service, security and reliability surface, and a deployment-topology decision, so it is deferred. Adopting it requires a superseding ADR.
- **Autocapture or Session Replay:** Faster initial visibility but would collect incidental interaction metadata inconsistent with the explicit purpose and minimization policy.
- **No analytics:** Maximizes minimization but leaves feature adoption entirely unobservable and prevents evidence-based product improvement.
- **Pre-consent anonymous measurement:** Rejected for the initial release. It complicates user trust and regional compliance while providing less trustworthy behavioral metrics.

## Acceptance criteria

- The tracking plan is versioned, typed, and CI-enforced before the SDK package or project key is added.
- A browser has no Amplitude storage or egress until consent and none after decline/withdrawal/DNT.
- Production events contain only the allowlisted schema and no prohibited automatic or identifying context.
- Vendor project controls, analyst access, retention, bot/internal filters, deletion/export support, and incident procedure are reviewed before production activation.
- The privacy notice and account data-rights contract remain accurate after every analytics change.

## Rollout, observability, and rollback

Release the typed boundary with analytics disabled, validate the acceptance scenarios against a development Amplitude project with synthetic data, then activate production only after the vendor checklist and privacy review pass. Monitor aggregate schema-rejection and delivery-health counts without logging payloads.

Roll back by disabling the client initialization switch and clearing vendor storage on the next privacy-preferences evaluation. Do not replace a disabled direct SDK with a server-side collector or proxy without a new decision record.

## Links to affected contracts and tests

- [`../amplitude-analytics-contract.md`](../amplitude-analytics-contract.md)
- [`../privacy-data-inventory.md`](../privacy-data-inventory.md)
- [`../data-rights-workflow.md`](../data-rights-workflow.md)
- `src/lib/analytics-consent.ts` and future typed analytics-boundary tests
