# Investigate contextual PDF export — Web #460

Investigate uses the server-owned `county-v2` report from API #199 / PR #207. The generated client and validators consume the exact first-party OpenAPI artifact from API merge commit `03568c0056243ee635b1c1bf32dbe1d2da6de784`. Generation uses this repository's unchanged locked Orval toolchain.

Export is offered only for nonempty canonical observations for one county, release and exact complete observation interval, with one to twenty measures. The period is copied from the observations, not inferred from the URL or relabeled as a year. A selected handoff period must match the interval start. Every observation needs the backend's source, lineage, dataset, provenance and version fields. Mixed periods, incomplete loads, unavailable values, missing provenance and broad selections retain explicit PDF unavailable.

On click the generated observations client reads every selected measure with an exact date interval and a 500-item page size, without the browser/query cache. Empty or paginated responses fail. All canonical fields, including values, evidence states, source metadata, lineage, versions and every caveat, are compared with the visible observations. The report request sends only canonical selectors and `template=county-v2`; no browser-supplied source text, values or caveats enter the report. A second read after rendering rejects evidence changes during the request. The backend owns authoritative validation, template rendering and content-based cache identity; Web does not parse or construct PDF evidence. This relies on that accepted server contract, rather than adding a new atomic snapshot or evidence-digest contract.

The response must be HTTP 200, a nonempty PDF and `Cache-Control: no-store`. Errors and 304 responses cannot reuse an earlier artifact or fall back to v1. A page context change or unmount cancels the request and discards any late file. Failures show an accessible PDF unavailable message with an explicit retry action. Legacy county/state exports are unchanged.

The representative Tick survey fixture and caveat are test data only. Production contract availability does not prove that tick_survey is published. Supported production observations must independently satisfy the same eligibility checks.

## Verification and rollout

Focused Vitest tests cover success, mismatched identity/provenance/versions/values and caveats, changed evidence during rendering, pagination, cache safety, report errors and stale downloads. Playwright covers download selectors, mismatch/error states and axe on desktop/mobile; existing unsupported-selection tests remain. Required quality checks and independent PR review precede merge. Keep #460 open until hosted checks, review and accepted deployment are confirmed. Rollback is the previous Web release, which continues to withhold contextual export.

Contracts: [UX Reset constitution](UX_RESET_CONSTITUTION.md), [evidence contract](ux-reset-evidence-contract.md), and API `docs/county-report-investigate-contract.md`; workspace ADRs 0001/0002 apply. No authentication, access role, data classification, deployment topology or public-health interpretation changes are introduced.
