# 0021: Public Storybook component explorer

Status: Proposed (owner review in WEB #549 PR) Date: 2026-10-11 Decision owner: Atlas product and engineering leads

## Context

[WEB #549](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/549) explicitly authorizes Storybook and GitHub Pages for independent component review. This supersedes only the earlier no-Storybook tooling choice in design-system decision #24. The frontend platform and production deployment remain unchanged.

## Decision

Use Storybook 10 with the Next.js Vite adapter as development tooling. Import existing React components and `src/app/globals.css`; preserve Base UI, semantic and domain tokens, system sans/Georgia font stacks, and production behavior. Discover only `stories/**/*.stories.tsx`. Publish only `storybook-static`, never the application, authenticated routes, `public/`, or production configuration. Fixtures are deterministic and clearly illustrative; no API/auth/analytics providers or live services are imported. Storybook telemetry is disabled.

Use a separate GitHub Pages Actions workflow. PRs build and test; only `main` deploys with Pages/OIDC write permissions scoped to the deployment job. Use relative assets to support project-site URLs. The existing DigitalOcean and Fumadocs deployment is unchanged. Pages administrator activation is a human gate.

## Consequences and alternatives

The existing internal `/design-system` gallery remains useful for application checks. Storybook adds a public independent controls surface without another UI library. A custom gallery would duplicate controls/navigation tooling. Third-party hosting and paid services are outside scope. Development dependencies increase install size; no Storybook entry point is imported by the production app.

## Acceptance and rollback

Static builds and desktop/mobile Playwright checks cover six components, relative paths, refresh, controls, keyboard/focus, accessibility and no external requests. Run existing application gates too. Final release acceptance requires owner review, merge, successful Pages deployment and public direct-link verification. Disable the Pages workflow/site or revert this tooling change to roll back; production application rollback is independent.

## References

- [Component explorer operations](../storybook.md)
- [Design system](../DESIGN_SYSTEM.md)
- Workspace ADR 0001 frontend platform and ADR 0002 API boundary
- Repository ADR 0020 documentation in the existing application
