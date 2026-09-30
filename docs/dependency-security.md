# Dependency security baseline: Web #234

Audited 2026-09-27 from `origin/main` commit `54ba53c867c93c00df388973f919c712b5703fed` after a clean `npm ci` on Node 22.23.2. Counts below are npm's vulnerable **package** counts, not advisory counts; some packages have multiple advisories, and `vitest`/`orval` are counted in the full audit because they depend on vulnerable packages. The production-only npm graph includes `shadcn` paths because it is declared under `dependencies`, although Atlas uses it for development tooling and the deployed Next.js standalone image does not copy the CLI.

| Audit                | Critical | High | Moderate | Low | Total |
| -------------------- | -------: | ---: | -------: | --: | ----: |
| Before, full         |        2 |    4 |        3 |   0 |     9 |
| Before, `--omit=dev` |        2 |    3 |        1 |   0 |     6 |
| After, full          |        0 |    0 |        0 |   0 |     0 |
| After, `--omit=dev`  |        0 |    0 |        0 |   0 |     0 |

## Advisory disposition

All versions below are the installed versions in the audited base lockfile. `→` names the version selected in this change; each selection is at or above the first patched version. “Production graph” describes npm's `--omit=dev` classification, while the exposure column describes Atlas execution.

| Advisory | Vulnerable package and severity | Dependency path and classification | Atlas exposure and disposition |
| --- | --- | --- | --- |
| [GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579) | `maplibre-gl` 5.24.0; critical; fixed in 6.4.1 | Direct, production graph | Browser map bundle. The advisory concerns untrusted HTML attribution; Atlas constructs an empty style and disables the attribution control, limiting the present path. Upgraded to 6.4.1 to remove the vulnerable sanitizer. MapLibre 6 needs its worker and shared module served together; the `predev`/`prebuild` copy script provides them from the installed package. |
| [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) | `next` 16.3.1; critical; fixed in 16.3.3 | Direct, production graph | Server rendering/runtime. This RCE requires Windows hosting; the deployed container uses Linux, but local Windows development can use the server. Upgraded to 16.3.3. |
| [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) | `next` 16.3.1; critical; fixed in 16.3.3 | Direct, production graph | Public Next.js image optimization API can process AVIF; the Linux runtime is relevant. Upgraded to 16.3.3. |
| [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | `sharp` 0.35.3; high; fixed in 0.35.4 | `next` → `sharp`; transitive, production graph | Next.js server image processing through libheif is a material runtime path. Resolved lockfile to 0.35.5. |
| [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8), [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc), [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf), [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | `fast-uri` 3.1.5; high; fixed in 3.1.6 | `orval` → `@scalar/openapi-parser` → `ajv` → `fast-uri`; also `shadcn` → `@dotenvx/dotenvx` → `conf` → `ajv` and `shadcn` → `@modelcontextprotocol/sdk` → `ajv`. Transitive, production graph by manifest. | URI validation in API generation and the shadcn CLI, not Atlas browser or deployed server execution. Resolved lockfile to 3.1.8. |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | `js-yaml` 4.3.1; high; fixed in 4.3.2 | `orval` → `js-yaml`; also `shadcn` → `cosmiconfig` → `js-yaml` and dev-only `eslint-config-next` → `eslint` → `@eslint/eslintrc` → `js-yaml`. Transitive; production graph through shadcn, development graph through Orval/ESLint. npm also counts `orval` as an affected high package in the full audit. | YAML parsing in generated API/lint/CLI tooling. Atlas generates from a checked-in OpenAPI file; untrusted YAML is not a public runtime input. Orval 8.24.0 pins 4.3.1; a compatible Orval upgrade changed generated API output. A child-only `orval` → `js-yaml` 4.3.2 override removes the finding while retaining generated-client stability. Remove the override when a compatible Orval release preserves the checked-in client. |
| [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | `qs` 6.15.3; moderate; fixed in 6.16.0 | `shadcn` → `@modelcontextprotocol/sdk` → `express` / `body-parser` → `qs`; transitive, production graph by manifest. | Express query parsing in shadcn tooling, not the deployed Atlas Next.js server or browser. Resolved lockfile to 6.16.0. |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `@vitest/mocker` 3.2.7; moderate; fixed in 4.1.11 | Direct dev dependency `vitest` 3.2.7 → transitive `@vitest/mocker`; dev-only. npm also counts `vitest` as affected moderate. | Test mock redirects can read local files if given malicious paths. No public runtime path; test runner handles repository tests. Upgraded Vitest to the first fixed 4.x, 4.1.11, and validated the test suite. |

The direct manifest changes are Next.js 16.3.1 → 16.3.3, MapLibre 5.24.0 (resolved from `^5.7.0`) → 6.4.1, and Vitest 3.2.7 → 4.1.11. Overrides are scoped to Orval's pinned `js-yaml` and, after the 2026-09-30 refresh below, `minimatch@3` → `brace-expansion` 1.1.21. Remaining lockfile updates are required dependencies and the targeted `fast-uri`, `qs`, and `sharp` fixes. MapLibre's documented [Next.js worker setup](https://maplibre.org/maplibre-gl-js/docs/#installation) requires the two version-matched module assets; `scripts/copy-maplibre-worker.mjs` copies them into ignored `public/maplibre/` before development and production builds.

## 2026-09-30 transitive advisory refresh

Audited from `origin/main` commit `a25b8de67ace6bdfb70bd8fd550eb6e331173330` (same findings on Web #285 before remediation; `package-lock.json` was unchanged on that PR). After a clean `npm ci` on Node 22.22.2:

| Audit                | High | Moderate | Total vulnerable packages |
| -------------------- | ---: | -------: | ------------------------: |
| Before, full         |    1 |        2 |                         3 |
| Before, `--omit=dev` |    1 |        1 |                         2 |
| After, full          |    0 |        0 |                         0 |
| After, `--omit=dev`  |    0 |        0 |                         0 |

| Advisory | Vulnerable package and severity | Dependency path and classification | Atlas exposure and disposition |
| --- | --- | --- | --- |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `brace-expansion` 1.1.18 and 5.0.9; high; fixed in 1.1.21 / 5.0.12 | `eslint-config-next` → `eslint-plugin-import` → `minimatch@3` → `brace-expansion` (dev-only full graph); `orval` → `typedoc` → `minimatch@10` → `brace-expansion` (dev-only); `shadcn` → `ts-morph` → `minimatch@10` → `brace-expansion` (production graph by manifest, CLI-only). | Glob expansion in ESLint, Orval/Typedoc API generation, and the shadcn CLI—not Atlas browser bundles or the deployed Next.js standalone server. Lockfile `npm audit fix` resolved 5.x to 5.0.12; a `minimatch@3` → `brace-expansion` 1.1.21 override clears the ESLint 1.x path without a major ESLint upgrade. |
| [GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv), [GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw) | `ip-address` 10.7.0; moderate; fixed in 10.7.2 | `shadcn` → `@modelcontextprotocol/sdk` / `socks` → `ip-address`; production graph by manifest. | IP parsing in shadcn/MCP tooling, not Atlas runtime. Resolved lockfile to 10.7.2 via `npm audit fix`. |
| [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r) | `markdown-it` 14.3.0; moderate; fixed in 14.3.1 | `orval` → `typedoc` → `markdown-it`; dev-only. | Markdown parsing in Typedoc during API generation from checked-in OpenAPI; not a public runtime input. Resolved lockfile to 14.3.2 via `npm audit fix`. |

There are **no residual audit findings or accepted advisory exceptions** after this refresh.

## Regression control and reproduction

The existing quality workflow runs `npm audit --audit-level=moderate` immediately after `npm ci`. Any future moderate, high, or critical advisory in the locked full graph fails the PR, including all production high/critical findings. Low findings remain visible in audit output. No advisories are ignored. Review a future finding by its actual production/build/test reachability before changing dependencies or proposing a narrowly scoped risk acceptance.

From the web repository with Node >=22.13.0:

```sh
npm ci
npm audit
npm audit --json
npm audit --omit=dev
npm audit --omit=dev --json
npm ls maplibre-gl next sharp fast-uri js-yaml orval qs vitest @vitest/mocker --all
```

`npm audit` exits nonzero when it reports a vulnerability. Re-run both audit variants after any lockfile change; advisory feeds may change without a commit. Roll back this dependency update by reverting its commit and redeploying the prior reviewed web image if a compatibility regression is found.
