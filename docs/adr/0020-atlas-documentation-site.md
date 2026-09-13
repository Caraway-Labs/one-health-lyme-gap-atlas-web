# 0020: Atlas documentation in the existing web application

Status: Accepted Date: 2026-09-13 Decision owner: One Health Lyme Gap Atlas product and engineering leads

## Context

Atlas needs a public help center for onboarding, data interpretation, methods, trust, and future developer guidance. The first release intentionally needs one working page and must not create another repository or service. The existing web application is already a Next.js App Router application deployed by the DigitalOcean App Platform workflow.

## Decision

Use Fumadocs MDX (`fumadocs-core`, `fumadocs-mdx`, and `fumadocs-ui`) inside the existing web repository. Store source content in `content/docs`, generate the Fumadocs source during install/typecheck/build, and render it through a route-scoped `/docs` layout with static parameters. Keep docs pages outside the Atlas application shell while sharing the existing Next.js build and DigitalOcean service.

Use `https://carawaylabs.com/docs` as the canonical public URL. The Atlas app references it through the single public `NEXT_PUBLIC_DOCS_URL` configuration value, with the same URL as the safe local/default fallback. The Help/Docs control opens a new tab with `target="_blank"` and `rel="noopener noreferrer"`; the original route and query state remain intact.

Use Fumadocs built-in navigation, heading anchors, code rendering, and static search backed by the local `/api/search` route. Disable the optional theme switch so the docs surface remains consistent with the current Atlas light-only design. Do not add analytics to docs by default.

## Alternatives considered

- A dedicated Fumadocs repository or DigitalOcean service would provide stronger deployment isolation but violates the current scope and adds infrastructure before content volume justifies it.
- Hand-authored Next.js Markdown/MDX would avoid a dependency but would require us to recreate navigation, search, content metadata, and page rendering that Fumadocs already provides.
- A hosted documentation platform would add an external content/deployment boundary and would make the requested same-application `/docs` URL less direct.

## Consequences

- The docs build is part of the existing web quality/deploy pipeline, while static docs rendering has no dependency on the Python API, Snowflake, or authenticated user state.
- A web deployment rollback rolls back docs and Atlas together. If docs scale or release cadence later demands independent rollback, revisit this ADR with measured evidence rather than creating infrastructure speculatively.
- API and MCP documentation remain links or generated artifacts from their owning contracts; this repository does not become a second schema source.

## Acceptance criteria

- `npm run docs:generate`, `npm run docs:check`, `npm run typecheck`, and `npm run build` are reproducible in the existing repository.
- `/docs` has required metadata, navigation, search, stable heading anchors, responsive layout, and representative accessibility coverage.
- The application shell exposes one secure, centrally configured Docs link.
- No docs route calls the Atlas API or requires a sign-in.

## Rollout and rollback

The existing quality workflow runs docs validation before the normal tests, build, container build, and deploy gate. Production verification checks `/docs`, `/robots.txt`, `/sitemap.xml`, the page title, and the new-tab link behavior. Rollback uses the last successful DigitalOcean App Platform deployment through the existing production process; no separate docs service or DNS change is required.
