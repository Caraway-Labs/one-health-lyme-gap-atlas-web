# WEB #574: published county exploration

Implementation of [WEB #574](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/574), following the [WEB #570 peer-reviewed audit](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/570#issuecomment-6115960560).

## Isolation and scope

- Starting `origin/main`: `3c2089b4ffe9aa7a41852fa4ba9fb15a3bdcd658`.
- Dedicated branch: `codex/web-574-county-discovery`.
- Dedicated worktree: `C:\codex_programming\web-574-county-discovery`.
- Existing checkouts and audit worktrees were inspected and left untouched.
- Frontend identity, selection, factual preview, URL/context and tests only. No API/model/rule, deployment, credential, environment-file, or legacy-view changes. No merge, deploy, or issue closure is authorized by this evidence.

## Acceptance evidence

| Control | Implementation and verification |
| --- | --- |
| Published county identity | Existing generated-client directory loader validates release; Review filters state code and five-digit state FIPS, deduplicates through the existing directory projection, and sorts alphabetically. Scores are not consumed as recommendations. |
| Zero candidates | Selection, map callback, URL retention, factual preview and Investigate handoff use published identity. Actual candidate previews and authoritative shortlist/rationale remain separate. |
| Canonical URL | Existing nuqs history and bounded handoff builders retain scope, county, dataset and supported period. Invalid county removal waits for successful directory resolution. State-prefix rejection remains immediate. |
| Ask Atlas | Selected published county identity supplies inherited geography, including when recommendation county naming is absent; unresolved/failed release or directory supplies no factual geography. |
| Factual county preview | Existing county record loader rejects county/release mismatches. Shared evidence components show a 2023 human floor, tick/pathogen status and population. Missing human values are not zero. No records is not pathogen absence. Observation period is not inferred from source vintage. |
| Request/stale states | Directory and profile loading/error/settled-empty states are distinct. Failed refreshes withhold cached facts and identity; directory error does not erase URL selection. Profile failure does not prevent valid identity handoff. |
| Scientific governance | Review recommendations remain unsupported when returned as such. No client ranking, candidates, risk scores or rule activation. Existing Tier 1 release safeguards remain intact; factual discovery does not expose incompatible priority output. |
| Accessibility | Shared Select keyboard/non-map picker; real MapLibre canvas clicks against explicitly synthetic test geometry; map aria-busy follows existing idle callback. Return focus uses candidate row or published county picker. Desktop/mobile axe checks cover changed picker/preview. Existing Review action styling preserves CTA contrast. |

## Public production HTTP evidence

On 2026-10-11 (America/Denver), read-only unauthenticated API probes confirmed:

- Current release: `governed-2026-10-06-nlcd-demo-cohort`.
- Alabama directory: 67 published identities after explicit state filtering of the 3,144-county national response. The scores endpoint's `state=AL` query did not narrow its response, so Review does not rely on it.
- Alabama Review: unsupported; 67 assessed; zero eligible, evaluated or candidates; all four rule coverage entries disabled.
- Autauga `01001`: null human count / no county-linked record; Established ticks; pathogen No records; population 58,761.
- Baldwin `01003`: **2023 published count floor 5**, Established ticks; pathogen No records; population 233,420.
- Barbour `01005`: null human count / no county-linked record; Established ticks; pathogen No records; population 24,877.
- The current `api.onehealthatlas.org` host independently confirmed Baldwin's release, floor/status, tick status and population. The captured profiles use the retained `api.carawaylabs.com` host.

Recorded response fixture provenance is in `tests/fixtures/review-al-public-responses.md`. Generated validators and the existing real loader accept these responses and reject county/release mismatches.

## Verification commands and limits

Commands run from the dedicated worktree. Final results are recorded in the PR and issue evidence comment, including the reviewed commit SHA.

Local final results:

- Install: 975 packages, zero reported vulnerabilities.
- Generation/drift, formatting/lint, typecheck, both static guards and production build: passed.
- Full Vitest run: 1,254 passed, one existing Windows launcher failure in `fast-glob-consumer-contracts.test.ts` (`spawnSync("npx", ..., shell:false)` reports `ENOENT`). The test is unchanged. Direct `npx shadcn --help` passed. Hosted Linux verification is required.
- Latest focused run after final human-state safeguards: 24 passed (19 county UI tests plus five real-loader contract tests). Five additional conservative human-state cases were run after the full suite.
- Review browser sweep: 65 passed, one existing skip, six failures in the initial 72-case run. All failing cases were corrected or diagnosed against retained traces; the final eight-case desktop/mobile rerun passed. Causes included missing directory fixtures, CTA hover contrast, and a mobile popup interrupted while source files were changing. Stable-source rerun confirmed the existing interaction. No sleeps, forced clicks or axe-rule exclusions were added. The rerun used the same three affected spec files with `--grep 'exposes result reproducibility|67 county picker|rejects unpublished|keeps the current state review'`.
- Local Docker command attempted and blocked by missing Linux engine pipe.

`origin/main` advanced during verification to `690397fcb408b0f1f0e0f322e337e42fea9e6c6e` (developer documentation and Storybook work). Those changes were inspected: no overlapping feature paths, and the professional-shell production sidebar defaults are unchanged. The PR targets current `main`; hosted checks verify integration.

```powershell
npm ci
npm run generate:api
git diff --exit-code -- contracts src/generated
npm run format
npm run typecheck
npm run lint
npm run check:design-system
npm run check:ux-reset
npm test -- --maxWorkers=2 --testTimeout=20000
npx playwright test --config test-results/web574-playwright.config.ts tests/e2e/ux-reset-review-published-counties.spec.ts tests/e2e/ux-reset-review-operating-picture.spec.ts tests/e2e/ux-reset-review-preview.spec.ts tests/e2e/ux-reset-review-scope.spec.ts tests/e2e/ux-reset-review-state-navigation.spec.ts --timeout=120000
$env:NEXT_PUBLIC_API_BASE_URL = 'https://api.onehealthatlas.org'
npm run build
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.carawaylabs.com .
```

The ignored local Playwright config inherits repository settings, uses isolated port 3174, and keeps artifacts in this worktree's `test-results/`. Longer local timeouts accommodate the multi-mount scope regression and cold Next route compilation; assertions still wait for actual UI/URL state, without fixed sleeps or forced clicks. The committed tests use the standard config in CI.

On Windows, byte-pinned `contracts/public-openapi.json` and generated `content/docs/api-reference/*` initially had checkout CRLF conversion. Restoring their exact committed bytes locally resolved checksum/reference gates without changing generated contracts or manifests.

Local Docker is blocked by missing `dockerDesktopLinuxEngine` pipe. Hosted quality includes the Docker build and secret scan. Browser tests use the existing `ATLAS_E2E` professional-shell test mode, recorded public responses and synthetic geometry. They are **not authenticated production verification**. No credential or authentication evidence was fabricated. After approved merge/deploy, the owner must verify deployed SHA and a signed-in journey against the real release and geography before closing #574. #570 remains open.

## Independent peer-review guidance and findings

Independent Codex peer review covers the full candidate-dependent chain, facts versus recommendations, URL/handoff/Ask Atlas, stale/release guards, accessibility, API compatibility and lean scope. Early material findings were addressed: factual returns focus the county picker, and evidence type stays Unavailable without governed catalog metadata. Review-requested explicit stale refresh, directory failure/empty and real-loader mismatch tests were added. Final inspected SHA, outcome and dispositions are recorded in the PR.
