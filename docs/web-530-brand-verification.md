# WEB #530 shared Summit Compass North branding

Initial base: `f537ccd88669f9963f6cf35f7b59874601c79d6c`. Updated base after inspecting the approved About merge: `cb4ac32ff3a27f35f26024be70f0964bf90a03b7` (origin/main). Branch: `codex/web-530-brand-integration`. Isolated standard Git worktree: `C:/codex_programming/topx_One_Health_Lyme_Gap_Atlas/web-530-brand-integration`. The primary checkout and unrelated worktrees are preserved.

## Scope and contracts

Implement the owner-approved placement inventory from #530 using #528's existing `/android-chrome-192x192.png`. Next Image serves the exact PNG with `unoptimized`; there is no transformed asset, artwork generation, filter, border, crop, or new dependency. SHA-256: `a5ffcfffec0dd7dcb7aafdc143abc99785831ace83820d9636c9f19dd6a9d9ae`. The mark is decorative. Product text or the containing link supplies the name.

Affected presentation contracts: `docs/DESIGN_SYSTEM.md`, `docs/navigation.md`, `docs/UX_RESET_CONSTITUTION.md`, and the accepted #524 navigation/#522 footer specifications. Applicable decisions: workspace ADRs 0001/0002/0003, web ADR 0014 optional accounts, and ADR 0020 documentation. This implements existing decisions; no architecture or API contract changes.

| Placement | Delivery | Preserved behavior |
| --- | --- | --- |
| Professional expanded/collapsed/mobile sidebar | Canonical 28px mark replaces + | One Health Atlas, separate toggle, routes, state, keyboard and drawer dismissal |
| Public shared header | Canonical 28px mark replaces + | Existing name and destination |
| Public/legacy SiteFooter | Canonical 32px mark replaces + | Disclosures, links and privacy controls |
| Professional trust footer | Canonical 24px mark precedes attribution | Navy, matching typography, centered links, 62px band and responsive stacking |
| Existing sign-in identity region | Canonical 32px mark | Current wording, provider order, email/OAuth handlers and recovery notice |
| Docs identity | Canonical 28px mark replaces + | Fumadocs navigation/search, text and routes |
| Onboarding | Deferred: #405/#436/#437 | No shipped onboarding screen/identity component on base |
| About Caraway Labs | Inherits canonical mark through PublicLayout and SiteFooter | Approved page content untouched; anonymous route and attribution journey retained |

#482 is open and owns the approved email-first redesign and recovery increment. The existing sign-in screen is Google-first. This branding-only PR does not claim that redesign is shipped or alter authentication ordering, copy, or routing. #522's live About/Settings journey acceptance remains separate (#527).

PR #532 was the only open PR at preflight. It merged while this task ran, as `cb4ac32ff3a27f35f26024be70f0964bf90a03b7`. Its page, route registration and global CSS do not overlap this story's component edits. The incoming diff was inspected before incorporating it; this story adds no About content and makes no global CSS edit. #524 is merged/closed; #522's approved footer code is merged; #528's canonical assets are merged and accepted.

**Active overlap:** #482 PR #533, head `296c84a89b11ba1f8848a05494edde70adc71f67`, replaces the existing sign-in page with `sign-in-entrance.tsx`. It is unmerged and not incorporated. Preserve `BrandMark` in that redesign's identity slot when reconciling the two PRs, and port the branded auth-state coverage to the approved new wording. This PR does not approve or implement that separate auth redesign.

The public Front Porch hero/header, favicon assets/metadata, functional navigation icons, scientific logic, API client, auth handlers and deployment configuration are outside this diff. No credentials or live authentication requests are needed. Rollback is a reviewed revert through the existing release pipeline, after release authorization.

## Evidence

Before/after desktop and mobile captures are in `docs/evidence/web-530/`. They use the existing local development E2E shell mode, not a real authenticated production session. Browser captures and test results do not authorize release.

### Local results (2026-10-10 America/Denver)

- `npm ci`: passed, zero reported vulnerabilities.
- `npm run generate:api` and generated-contract diff check: passed, zero contract/client changes.
- `npm run format`, `npm run lint`, `npm run typecheck`, `npm run docs:check`, `npm run check:design-system`, `npm run check:ux-reset`: passed. Windows CRLF checkouts initially failed the LF format check; the formatter normalized local bytes, and verified unchanged blobs were refreshed in this worktree's index. No unrelated content is staged or committed.
- Initial full `npm test -- --maxWorkers=1`, before the About main update: **952 passed, 4 failed** across 117 files. The Review-scope tests for mismatched counties and a failed refetch, plus the shadcn CLI consumer test, reproduce on an untouched `git archive` of base `f537ccd`: **42 passed, 3 failed** in those two files. `npx` with `shell: false` cannot start on Windows in the CLI test. The additional blank-county-name Review test passed alone both on approved main and with the final branded code. No unrelated failure was bypassed or fixed here.
- Final focused Vitest run on updated base: **37 passed** across nine files (brand integrity, provider fixtures, sign-in exit, professional navigation/footer, Docs, About, navigation registry and middleware). The blank-county-name isolated branded retest also passed (one selected test; 40 excluded by the explicit name filter).
- Initial professional-navigation/public-footer browser regression: **15 passed**, six viewport-inapplicable cases skipped, one new lazy-image assertion failed before scrolling the footer into view. The assertion was corrected. A subsequent desktop capture was interrupted by a local development-server restart; the stable rerun passed. No product change was needed for either test issue.
- Final Playwright run: **14 passed**, desktop and Pixel 7, including canonical image loading, empty alt/accessibility names, axe, overflow, drawer Escape/focus return, Docs shell, About anonymous access/200% zoom/new-tab journey, professional trust-link geometry/focus and analytics-consent preservation. The earlier #524 navigation checks separately passed expanded/collapsed layout, compact rows, active/hover, keyboard/tooltips, state persistence and mobile behavior.
- Before captures: four original placement captures/tests passed, plus two About captures on updated approved main. After captures and [native-size sheet](evidence/web-530/canonical-native-sizes.png) were visually inspected. [Screenshot inventory](evidence/web-530/README.md) contains 27 PNGs: 13 before/after pairs and the 16/24/28/32px light/navy sheet.
- Local Docker build is blocked by the unavailable `dockerDesktopLinuxEngine` named pipe. Hosted CI must supply the container build and secret scan.
- Production build: passed through the production Playwright web-server build/start. Front Porch production comparisons: **3 passed, 2 failed**. Desktop snapshots (1440/1280px) and the signed-in responsive header boundary passed. All four live approved-reference comparisons and geometry assertions passed; stored hero snapshots at 390/320px exceeded the 2% threshold on this Windows runner. This is not established as an untouched-base failure. Front Porch source, global CSS and snapshots have zero diff; none were changed to bypass the failure. Hosted Linux visual checks remain required.

Logs are retained locally in `test-results/web-530-*.log`; untouched source archives are retained outside the source tree in this chat's visualization evidence directory. They are not committed.

These tests use local E2E fixtures and mocked providers. No live email/OAuth or authenticated production acceptance is claimed.

## Release boundary

Leave the PR open for product-owner review. No merge, deployment, issue closure, Project Done mutation, or worktree/branch deletion is authorized by this stage. After explicit approval, verify reviewed SHA, latest-main overlap, required checks, merged source and ACTIVE production SHA, then perform owner acceptance and the requested safe closure/cleanup.
