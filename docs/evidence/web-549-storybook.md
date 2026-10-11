# WEB #549 implementation acceptance record

Date: 2026-10-11. Branch: `codex/web-549-storybook-pages`. Initial base: `1b23d7f35d6d7e29617206536362b42dc7683024`. Rebased without conflicts onto `origin/main` at `4c85d536eade2e7228e9fe042df1a26f42e3a271` before submission; subsequently merged concurrent main commits `d04e27bbd032b7a8b2bd48c264cc8b3caa356c17` (route retirement) and `f0ed6013000616a6c547da5110a271b868018017` (Action evidence brief) without conflicts. Owning repo: Atlas Web. Scope: independent developer/reviewer tooling only. Affected decisions: [design system](../DESIGN_SYSTEM.md), [proposed ADR 0021](../adr/0021-storybook-component-explorer.md).

## Acceptance matrix

| Criterion | Evidence / status |
| --- | --- |
| At least five existing components | Six production components; static index contains 17 stories. Button, Card, Input, AtlasPriorityBadge, AtlasStatusMessage, AtlasDataStamp. |
| Theme, typography, no live services | Production `globals.css`, system sans/Georgia stacks, existing Base UI primitives and Lucide icon. All six canvases checked against the Atlas teal token, zero external requests and zero browser errors. Synthetic provenance disclosed. |
| Navigable static project site | `npm run build-storybook` passed; relative Vite base. Browser server mounts only artifact at `/one-health-lyme-gap-atlas-web/`. Direct story/canvas URLs and refresh passed. |
| Controls and accessibility | `npm run test:storybook`: 20 passed after rebase, desktop and Pixel 7 mobile. Text and variant controls update Button; keyboard Input editing/focus ring, disabled button, invalid input, loading/error roles and Autodocs rendering verified. All six components pass axe in both viewports with no horizontal overflow. |
| Representative visual review | Inspected desktop/mobile Card and mobile Input, DataStamp and Storybook shell screenshots. Production typography, semantic/domain colors and wrapping retained. Chromium mobile emulation; no claim of physical-device or macOS testing. |
| Local usage and adding stories | Dev server starts at port 6006 and returns catalog index; [operations guide](../storybook.md) covers usage, story authoring, components, troubleshooting and public limitations. |
| Application remains intact | No diff in `src`, generated API/contracts, existing production workflow or DigitalOcean spec. Post-rebase production build passed; 24 existing Playwright checks passed initially (design-system, Front Porch, docs), then 12 design-system/Front Porch checks passed again after rebase on desktop/mobile. |
| Permissions and public contents | YAML parsed; builds `contents: read`, deploy only `pages: write`/`id-token: write`, main-only deploy guard. No secrets, production env or application assets passed; `staticDirs: []`. Only `storybook-static` uploaded. |
| Automatic public deployment | Configuration implemented; **not yet accepted**. Repo metadata confirms `has_pages: false`. Owner activation, review/merge, successful deployment and public verification required. |

## Repository gates

- `npm run typecheck`: passed (also production-build TypeScript passed).
- `npm run lint`: passed after targeted formatting; `npm run format` was run, and unrelated formatter-only changes were discarded in this isolated worktree.
- `npm run check:design-system`, `npm run check:ux-reset`: passed.
- `npm run generate:api` plus `git diff --exit-code -- contracts src/generated`: passed, no generated diff.
- `npm run build`: passed, 39 static pages generated after main retired the variant routes. Existing middleware deprecation warning remains outside scope.
- `npm run build-storybook`: passed. Vite reports expected ignored `use client` directives and large Storybook/docs chunks; no build error.
- `npm run test:storybook`: 20 passed after rebase.
- `npm run test:e2e -- tests/e2e/design-system.spec.ts tests/e2e/front-porch.spec.ts tests/e2e/docs.spec.ts`: 24 passed.
- Post-rebase `npm run test:e2e -- tests/e2e/design-system.spec.ts tests/e2e/front-porch.spec.ts`: 12 passed. Typecheck, lint, both governance guards, API regeneration, production build and static Storybook build also passed again after rebase.
- `npm audit --audit-level=moderate`: passed, zero vulnerabilities.
- `npm ci`: passed from the submitted lockfile; 975 packages installed, zero vulnerabilities, docs generation passed.
- Integrated on `4c85d53`, `npm test -- --maxWorkers=2`: **1,055 passed / 1 failed** across 126 files. The sole failure is the unchanged Windows `spawnSync("npx", ..., shell: false)` check returning null; direct `npx shadcn --help` passed. All prior async UI failures passed in this integrated standalone run. Earlier runs and rechecks remain in ignored local logs. The initial base's [hosted Linux quality run](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/actions/runs/38162793409) passed; no local failure is represented as a pass. Hosted quality must pass before merge.
- Final synchronized gates on `f0ed601`: typecheck, lint, design-system/UX Reset guards, API regeneration and production build passed again. Static Storybook build and all 20 desktop/mobile browser checks passed again against the final rebuilt artifact.
- Final application browser recheck: `npm run test:e2e -- tests/e2e/design-system.spec.ts tests/e2e/front-porch.spec.ts tests/e2e/variant-routes-retired.spec.ts tests/e2e/ux-reset-action.spec.ts`: **52 passed**, desktop/mobile, against synchronized `f0ed601`.
- Latest-main affected unit rechecks: 36 route/navigation/analytics tests passed after `d04e27b`; 22 Action/evidence-brief/handoff tests passed after `f0ed601`.
- Local Docker validation is unavailable: Docker Desktop Linux engine pipe `dockerDesktopLinuxEngine` is absent. Existing hosted Docker gate is unchanged.

## PR review follow-up

The late peer-review comment on Input Autodocs identified shared example IDs. The story renderer now uses per-instance React `useId` for input/label/help associations; production Input is unchanged. A focused desktop/mobile Autodocs regression checks unique IDs, each label target, per-example validation descriptions and label focus. Post-fix typecheck, lint and static build passed; `npm run test:storybook` passed **22 checks**. Hosted readiness is recorded on PR #554 for its exact reviewed head rather than conflated with public deployment.

## Release gate

The issue stays open until final Pages verification. Administrator steps are in [storybook.md](../storybook.md). After merge, record the **Storybook Pages** run URL, deployed SHA and Pages `page_url`; verify public navigation, direct links, refresh, assets/fonts/styles, keyboard and mobile behavior. This PR does not merge, enable Pages, bypass environment reviewers, or deploy unreviewed branches.
