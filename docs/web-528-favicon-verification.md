# WEB #528: Summit Compass North favicon

The product owner approved the corrected raster package on 2026-10-10. All seven public files were copied byte-for-byte from `atlas_summit_compass_north_corrected_review`. No artwork was transformed. The master and review sheet remain outside public assets; no SVG is approved.

## Implementation and URL mapping

Files added: the seven `public/` paths in the table below and this verification document. Files updated: `src/app/layout.tsx`, `next.config.ts`, and `tests/e2e/atlas.spec.ts` (TC22 only). File removed: `public/favicon.svg`.

Next.js 16.3.8 App Router uses the existing root layout metadata. There are no filesystem icons to override it and no existing web app manifest. This change does not introduce a manifest or PWA functionality. The two Android assets are available for future approved manifest work, without adding metadata entries.

| Public path                   | Dimensions | Use                         |
| ----------------------------- | ---------- | --------------------------- |
| `/favicon.ico`                | 16/32/48   | Browser and legacy fallback |
| `/favicon-16x16.png`          | 16         | Browser                     |
| `/favicon-32x32.png`          | 32         | Browser                     |
| `/favicon-48x48.png`          | 48         | Browser                     |
| `/apple-touch-icon.png`       | 180        | Apple touch bookmark        |
| `/android-chrome-192x192.png` | 192        | Available static asset      |
| `/android-chrome-512x512.png` | 512        | Available static asset      |

The five declared metadata URLs append `?v=summit-compass-north-20261010` to bypass old browser icon caches, including the previous permanent ICO-to-SVG redirect. The canonical unversioned ICO path now returns the actual ICO. No cache rules for unrelated resources change. Browsers that retain bookmark/tab artwork may require a hard refresh or reopening the tab; existing installed/home-screen shortcuts may require recreating them.

Scope: shared icon identity for `/` and `/app/review`, under ADR-0001 frontend platform and the existing UX Reset constitution. No API, authentication, privacy, accessibility, navigation, or scientific interpretation contract changes. Rollback is the previous web release or a reviewed revert of this commit.

## Source integrity

Pillow decoded every deployed PNG and every ICO variant. PNG dimensions match the table; ICO directory contains exactly 16, 32, and 48 pixel variants. All public files match the supplied files byte-for-byte (SHA-256 below). The owner-supplied consistency preview shows the same navy tile and compass mark at all sizes, with transparent corners and no offset white border.

| File | SHA-256 |
| --- | --- |
| `favicon.ico` | `9a3f9ae0df3e926a33c2e8dbbabcf1c1b4770515ed75a7c673ad8304d7c98d19` |
| `favicon-16x16.png` | `edbe24ed4c0d8c0acc9bd84411913a11bac7989c6769e1759fe3b822f0af5215` |
| `favicon-32x32.png` | `f3a7cf6700682bd45787aa373d646cdc19507f99c744b80e63e0856bc2408a4e` |
| `favicon-48x48.png` | `009de66cdd65b17f58ef26621f2a05a25c00e8745a3e64988d87305424791af8` |
| `apple-touch-icon.png` | `0b14fd934c9fab3a73c47db4e8fcfa9baf1817c86993650b774eb123a90c6338` |
| `android-chrome-192x192.png` | `a5ffcfffec0dd7dcb7aafdc143abc99785831ace83820d9636c9f19dd6a9d9ae` |
| `android-chrome-512x512.png` | `3fe21d6b866612a6e32a2cc2253e672246ada76bfbd56ee33a2b72c711525a7f` |

## Regression and release boundary

### Local results (2026-10-10)

- `npm ci`: passed (zero reported vulnerabilities).
- `npm run generate:api` and generated-contract diff check: passed, no changes.
- `npm run format`, `npm run lint`, `npm run typecheck`: passed.
- `npm run docs:check`, `npm run check:design-system`, and `npm run check:ux-reset`: passed.
- `npm run build`: passed, all 45 static pages generated. The existing middleware-to-proxy deprecation warning remains outside this change.
- `npx playwright test tests/e2e/atlas.spec.ts --grep TC22 --reporter=list`: 2 passed (desktop and mobile), including both color preferences and reloads.
- Initial `npm test`: 902 passed, 47 failed while other gates ran. `npm test -- --maxWorkers=1`: 946 passed, 3 failed across 114 files/949 tests.
- The three remaining failures reproduce in an untouched `git archive HEAD` of base `1e62775` with the same installed dependencies: 42 passed, 3 failed in the two affected test files. These are the Review scope tests “normalizes mismatched counties on direct loads and scope changes before shell links publish” (5000ms timeout) and “hides a loaded review when a later refetch fails” (`review error was not shown`), plus the shadcn CLI consumer test (`spawnSync("npx", ..., shell: false)` returns `ENOENT` on Windows). No unrelated tests or product code were changed to bypass these failures.
- `docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.carawaylabs.com .`: blocked by the unavailable `dockerDesktopLinuxEngine` named pipe. Hosted Docker/quality verification remains required.

Local screenshots are in `test-results/web-528-visual/`: the exact served assets on light/dark backgrounds, public and Review captures for each browser color preference, and `metadata.json`. The assets were visually compared with the supplied consistency preview and inspected at native pixel sizes.

TC22 from WEB #231 checks public root and professional Review metadata, light and dark browser color preferences, and reloads. It checks all seven asset URLs with and without the version query for HTTP 200 without redirects, image MIME, exact served bytes, PNG dimensions, and ICO directory sizes. It rejects old SVG metadata and duplicate icon declarations.

Local workspace coverage uses the repository's existing development E2E mode; it is not evidence of a real authenticated production session. Browser color preference emulation does not capture native browser tab chrome.

Do not merge or deploy without explicit product-owner approval. Production verification remains pending that approval and deployment. Smoke-test URLs:

- <https://onehealthatlas.org/>
- <https://onehealthatlas.org/app/review> (owner-authenticated session)
- <https://onehealthatlas.org/favicon.ico>
- <https://onehealthatlas.org/favicon.ico?v=summit-compass-north-20261010>
- All six PNG paths above under `https://onehealthatlas.org`.

After deployment, check HTTP status/MIME, compare downloaded bytes with the committed hashes, and inspect browser tab/bookmark icons after reload in light and dark browser themes. Keep WEB #528 open until that production evidence exists.
