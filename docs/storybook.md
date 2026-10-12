# Atlas component explorer

Public catalog (after review, merge and Pages activation): <https://caraway-labs.github.io/one-health-lyme-gap-atlas-web/>. Owned by Atlas Web maintainers; delivery story [#549](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/549).

## Local use

Node 22.13+ and npm, from the repository directory:

```sh
npm ci
npm run storybook
# http://localhost:6006
npm run build-storybook
npx playwright install chromium
npm run test:storybook
```

The static artifact is `storybook-static/`. To inspect it under the actual project subpath, run `node scripts/serve-storybook.mjs` and open `http://127.0.0.1:6007/one-health-lyme-gap-atlas-web/`. Use HTTP, not `file://`. The browser works independently of the Atlas app on Windows, macOS and mobile.

## Coverage and adding stories

The original catalog remains:

- Button: variants, sizes, disabled, Lucide icon.
- Card: information panel and compact spacing.
- Input: keyboard editing, disabled and invalid state.
- AtlasPriorityBadge: four legacy review-priority treatments.
- AtlasStatusMessage: empty, loading and error announcements.
- AtlasDataStamp: snapshot and inline provenance presentation.

[#567](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/567) is expanding the catalog to 46 approved components. The first group adds shared fixtures and rows 01–08: Evidence object, Evidence state strip, Release evidence state strip, Evidence provenance inspect, Tier 1 surveillance priority panel, Investigate evidence hierarchy, Reset professional shell, and County preview panel. Later groups stay on that issue. A partial catalog does not close #567.

Storybook aliases three modules so stories do not call production services: the surveillance-priority request hook, Ask Atlas chrome, and the brand mark. The brand substitute bundles `public/android-chrome-192x192.png` because an absolute public URL does not resolve on the project subpath, and `staticDirs` stays empty so `public/` is not published. Vitest and the Next.js app keep the real modules. Each story loader clears the professional sidebar key, per-story sidebar keys, and the knowledge-chat storage key. Shell stories pass a storage key unique to the story id and the declared open state, so docs frames do not share a collapsed preference. Normal evidence stories use the synthetic release `alpha-2026`. The named release-mismatch story is the withheld cross-release case. Shell and hierarchy docs render in separate frames so repeated anchors and the navigation id stay unique.

Add `stories/name.stories.tsx`, importing the canonical production component. Use `Meta`/`StoryObj` from `@storybook/nextjs-vite`, a descriptive title, useful `args`/`argTypes`, and a component description. Follow existing story examples. Use local fixtures and narrowly scoped deterministic provider/router mocks when needed. Never import the production providers, routes, API, auth, analytics or environment secrets. Do not put real protected records into fixtures. Scores and provenance examples must explicitly disclose synthetic data and limitations. Geographic fixtures use the lower 48 states and the District of Columbia. Add representative coverage to `tests/storybook/` when extending the catalog. Stories reuse production CSS and its system font stacks; no separate theme or web-font service is needed.

## Pages deployment and human activation

`.github/workflows/storybook-pages.yml` builds and browser-tests PRs independently of production CI. Main pushes build the same artifact, upload it and deploy via supported Pages actions to the `github-pages` environment. Manual dispatch also requires `main`. No secrets are passed. Only the deployment job has `pages: write` and `id-token: write`; builds have `contents: read`. Relative asset URLs support the project subpath and query-based direct story links, for example `?path=/story/primitives-button--primary`.

An administrator must open **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. Ensure Pages is available for the repository's visibility/organization plan and that a public catalog is permitted. Under **Settings → Environments → github-pages**, allow deployments from `main` only; retain any required reviewer approvals. Do not change the production environment. After merge, inspect **Actions → Storybook Pages**, approve the Pages environment if required, and record the run URL and `page_url` from deployment. Verify the public index, direct story link, refresh, controls, styles and mobile rendering. The 2026-10-11 read-only repository inspection confirmed a public repository with `has_pages: false`; the Pages endpoint returned HTTP 404. Pages activation and successful public deployment remain an explicit release gate.

## Troubleshooting

- Build/install: use Node 22 and `npm ci`; preserve the lockfile. Run `npm run typecheck` and `npm run build-storybook` for configuration errors.
- Missing styles: import the production stylesheet in preview; ensure new class names are statically discoverable by Tailwind. Do not duplicate tokens.
- Pages 404/configure failure: check Source is GitHub Actions and organization Pages policy/plan. Do not auto-enable or bypass administrator controls.
- Deployment pending: inspect `github-pages` reviewers and branch rules.
- Broken assets: inspect the published artifact and project subpath with the local static server; keep Vite `base: "./"`, and use relative story assets.
- Browser tests: install Chromium; ports 6006/6007 must be free. Screenshots and failure traces are in `test-results/storybook/` (ignored).

Final story acceptance requires a reachable public deployment after merge.
