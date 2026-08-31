<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design-system rules

- Use the semantic Tailwind/shadcn tokens in `src/app/globals.css` for UI surfaces, text, actions, borders, and focus states; do not introduce arbitrary new UI colors.
- Use shared primitives from `@/components/ui` before creating new one-off controls.
- Keep Atlas domain and visualization tokens (map ramps, evidence/risk colors, navy/teal brand values) independent when their data meaning is important.

## Atlas web instructions

Before material work, read the workspace [AGENTS.md](../AGENTS.md), the
[technology and governance baseline](../TECHNOLOGY_AND_GOVERNANCE.md), this
repository's `README.md`, and the applicable workspace ADRs—especially
[0001 frontend platform](../docs/adr/0001-frontend-platform.md),
[0002 public API and Snowflake access](../docs/adr/0002-public-api-and-snowflake-access.md),
and [0003 geospatial delivery](../docs/adr/0003-geospatial-delivery.md).

- `contracts/openapi.json` and `src/generated/` are generated from the API's
  OpenAPI contract. Do not hand-edit generated output or make handwritten API
  models authoritative. Run `npm run generate:api` for contract changes and
  review the resulting diff.
- Preserve the browser-to-Python-API boundary. `NEXT_PUBLIC_API_BASE_URL` is
  the only public configuration; never add credentials, Snowflake access, or
  query logic to browser code.
- Keep atlas state reproducible in validated URL parameters. Affected map
  findings must retain equivalent table, text, or download access, plus
  provenance, freshness, methodology, and limitation information.
- Add focused Vitest coverage and, for user-visible flows, Playwright coverage
  including axe checks for map/filter, URL state, provenance, and non-map
  parity as applicable.

Run the CI-equivalent checks before handoff:

```powershell
npm ci
npm run generate:api
git diff --exit-code -- contracts src/generated
npm run typecheck
npm run lint
npm test
npm run build
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.carawaylabs.com .
```
