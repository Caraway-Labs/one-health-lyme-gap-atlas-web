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

The developer guide explains access. The API reference under `content/docs/api-reference` is generated from the pinned public contract in `contracts/public-openapi.json`, not from the first-party Web generator artifact and not from a hand-maintained endpoint list. `npm run docs:api:check` fails the build when that contract is missing, malformed, empty, checksum-mismatched, version-mismatched, or when the generated pages drift. MCP guidance stays limited to the released smoke tools.

`contracts/public-openapi.manifest.json` records the API repository commit whose `openapi.json` is the pinned public document, and the SHA-256 of those pinned bytes. Copy both that public file and the first-party generator input from the same API commit using [the contract sync procedure](first-party-openapi-sync.md). `npm run docs:api:drift` retrieves `https://api.onehealthatlas.org/openapi.json`, compares checksums, and exits with an error when they differ or the document cannot be retrieved. It does not rewrite the pin, the manifest, or the generated pages. Pull-request and production builds do not run it. The weekly Public OpenAPI drift workflow, and a manual run of the same command, are the maintainer signal that production and the pin have diverged. A drift failure does not revert a reviewed pin. Run `npm run generate:api` only when `contracts/openapi.json` changes, and `npm run docs:api` when the public pin changes. Broader developer-doc governance stays in WEB #377; this check is the one public-contract drift signal.

## Versioning and recovery

Current product help is served under `/docs`. If older API contracts must remain stable, they keep the versioning scheme owned by the API repository and are linked from the docs navigation; the web docs must not invent a second API version policy. Material product changes receive a release note or linked change entry.

The production readiness checklist is:

1. Confirm released-vs-planned language and scientific interpretation.
2. Confirm source, freshness, methodology/version, and limitations where the page makes data claims.
3. Run docs generation/checks, link checks, typecheck, lint, unit tests, and Playwright/Axe coverage.
4. Run the production build/container checks and review the generated route list.
5. Smoke-test `/docs`, search, a heading deep link, the Copy Markdown and View source actions, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, and one page's `.md` and `.mdx` exports after deployment. The exports are generated from the current docs source and must cite the pinned public OpenAPI commit rather than a copied contract.
6. Record the deployed commit and retain the last successful deployment for rollback.

Screenshots are intentionally avoided in the launch page so UI changes cannot silently leave stale visual guidance. Future screenshots require a named owner, stable behavior, and an update check in the same change.
