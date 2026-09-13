# Documentation governance and release checklist

## Change ownership

- Product workflow help is reviewed by the web owner against released UI.
- Data definitions, source vintages, provenance, freshness, and methodology are reviewed against the owning API/data contracts and in-app methodology surfaces.
- Privacy and AI Ethics links are checked against the approved public pages.
- REST/OpenAPI and MCP content is generated or linked from the owning service; a hand-authored duplicate schema is not accepted.
- Release notes identify the released commit/issue and never describe planned or prototype behavior as available.

Docs-only wording and navigation changes may ship independently. A product, API, data, privacy, or AI contract change must update its owning source and docs in the same release or leave an explicit linked follow-up before release.

## Automated checks

`npm run docs:generate` validates Fumadocs frontmatter/navigation and creates ignored `.source` files. `npm run docs:check` additionally requires a page title and description, verifies `content/docs/meta.json`, rejects JavaScript links, and checks internal `/docs` and Atlas route links. The standard typecheck, lint, unit, Playwright/Axe, production build, Docker build, and secret scan remain required.

The initial developer page links directly to the API-owned OpenAPI artifact and labels MCP guidance as unavailable until the owning service has a released contract. When those contracts are published, CI or a review check must fail or raise an explicit signal when generated/link-based references drift.

## Versioning and recovery

Current product help is served under `/docs`. If older API contracts must remain stable, they keep the versioning scheme owned by the API repository and are linked from the docs navigation; the web docs must not invent a second API version policy. Material product changes receive a release note or linked change entry.

The production readiness checklist is:

1. Confirm released-vs-planned language and scientific interpretation.
2. Confirm source, freshness, methodology/version, and limitations where the page makes data claims.
3. Run docs generation/checks, link checks, typecheck, lint, unit tests, and Playwright/Axe coverage.
4. Run the production build/container checks and review the generated route list.
5. Smoke-test `/docs`, search, a heading deep link, `/robots.txt`, and `/sitemap.xml` after deployment.
6. Record the deployed commit and retain the last successful deployment for rollback.

Screenshots are intentionally avoided in the launch page so UI changes cannot silently leave stale visual guidance. Future screenshots require a named owner, stable behavior, and an update check in the same change.
