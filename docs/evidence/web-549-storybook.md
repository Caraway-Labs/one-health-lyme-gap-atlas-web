# WEB #549 implementation acceptance record

Date: 2026-10-11. Branch: `codex/web-549-storybook-pages`. Base: `origin/main` at `1b23d7f35d6d7e29617206536362b42dc7683024`. Owning repo: Atlas Web. Scope: independent developer/reviewer tooling only. Affected decisions: [design system](../DESIGN_SYSTEM.md), [proposed ADR 0021](../adr/0021-storybook-component-explorer.md).

## Acceptance matrix

| Criterion | Evidence / status |
| --- | --- |
| At least five existing components | Six production components; static index contains 17 stories. Button, Card, Input, AtlasPriorityBadge, AtlasStatusMessage, AtlasDataStamp. |
| Theme, typography, no live services | Production `globals.css`, system sans/Georgia stacks, existing Base UI primitives and Lucide icon. All six canvases checked against the Atlas teal token, zero external requests and zero browser errors. Synthetic provenance disclosed. |
| Navigable static project site | `npm run build-storybook` passed; relative Vite base. Browser server mounts only artifact at `/one-health-lyme-gap-atlas-web/`. Direct story/canvas URLs and refresh passed. |
| Controls and accessibility | `npm run test:storybook`: 18 passed, desktop and Pixel 7 mobile. Text and variant controls update Button; keyboard Input editing/focus ring, disabled button, invalid input, loading/error roles verified. All six components pass axe in both viewports with no horizontal overflow. |
| Representative visual review | Inspected desktop/mobile Card and mobile Input, DataStamp and Storybook shell screenshots. Production typography, semantic/domain colors and wrapping retained. Chromium mobile emulation; no claim of physical-device or macOS testing. |
| Local usage and adding stories | Dev server starts at port 6006 and returns catalog index; [operations guide](../storybook.md) covers usage, story authoring, components, troubleshooting and public limitations. |
| Application remains intact | No diff in `src`, generated API/contracts, existing production workflow or DigitalOcean spec. Production build passed; 24 existing Playwright checks passed on desktop/mobile (design-system, Front Porch, docs). |
| Permissions and public contents | YAML parsed; builds `contents: read`, deploy only `pages: write`/`id-token: write`, main-only deploy guard. No secrets, production env or application assets passed; `staticDirs: []`. Only `storybook-static` uploaded. |
| Automatic public deployment | Configuration implemented; **not yet accepted**. Repo metadata confirms `has_pages: false`. Owner activation, review/merge, successful deployment and public verification required. |

## Repository gates

- `npm run typecheck`: passed (also production-build TypeScript passed).
- `npm run lint`: passed after targeted formatting; `npm run format` was run, and unrelated formatter-only changes were discarded in this isolated worktree.
- `npm run check:design-system`, `npm run check:ux-reset`: passed.
- `npm run generate:api` plus `git diff --exit-code -- contracts src/generated`: passed, no generated diff.
- `npm run build`: passed, all 46 static pages generated. Existing middleware deprecation warning remains outside scope.
- `npm run build-storybook`: passed. Vite reports expected ignored `use client` directives and large Storybook/docs chunks; no build error.
- `npm run test:storybook`: 18 passed.
- `npm run test:e2e -- tests/e2e/design-system.spec.ts tests/e2e/front-porch.spec.ts tests/e2e/docs.spec.ts`: 24 passed.
- `npm audit --audit-level=moderate`: passed, zero vulnerabilities.
- `npm ci`: passed from the submitted lockfile; 975 packages installed, zero vulnerabilities, docs generation passed.
- `npm test`: 1,029 passed / 18 failed during concurrent builds. Full rerun with `--maxWorkers=2`: 1,042 passed / 5 failed (four async UI failures in unchanged Compare/Review tests, plus the existing Windows `spawnSync("npx", ..., shell: false)` check returning null). Direct `npx shadcn --help` passed. Isolated UI recheck results and hosted Linux quality status are recorded in the PR.
- Local Docker validation is unavailable: Docker Desktop Linux engine pipe `dockerDesktopLinuxEngine` is absent. Existing hosted Docker gate is unchanged.

## Release gate

The issue stays open until final Pages verification. Administrator steps are in [storybook.md](../storybook.md). After merge, record the **Storybook Pages** run URL, deployed SHA and Pages `page_url`; verify public navigation, direct links, refresh, assets/fonts/styles, keyboard and mobile behavior. This PR does not merge, enable Pages, bypass environment reviewers, or deploy unreviewed branches.
