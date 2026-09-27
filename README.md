# one-health-lyme-gap-atlas-web

Public single-page One Health Lyme Gap Atlas built with React, strict TypeScript, Next.js App Router, MapLibre, TanStack Query, and an OpenAPI-generated API client.

## Approved stack

- React + TypeScript + Next.js (App Router)
- The browser consumes the Python REST API only; it never connects directly to Snowflake.

Read the workspace [agent instructions](../AGENTS.md) and [technology and governance baseline](../TECHNOLOGY_AND_GOVERNANCE.md) before implementation. They define the required API, provenance, accessibility, security, testing, and decision-record rules.

```powershell
npm ci
npm run generate:api
npm run docs:check
npm run typecheck
npm run lint
npm run check:design-system
npm run build
npm run dev
```

## Documentation

The public help center is part of this Next.js application and is available at `/docs`. Fumadocs MDX content lives in `content/docs`; generated Fumadocs source files are created by `npm run docs:generate` and are intentionally ignored. `npm run docs:check` validates required page metadata, navigation references, and internal Atlas/docs links. The existing DigitalOcean App Platform service deploys the docs with the web app; no separate repository or infrastructure is required.

The public frontend may use `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AMPLITUDE_API_KEY`, and the Supabase publishable project URL/key. Treat those values as public. Never add Snowflake configuration, service-role keys, or other secrets to this repository or to `NEXT_PUBLIC_*` variables.

## Geographic explorer

Open **Explore → Geographic Explorer** (`/geographic_explorer`) to use geographic tiles, small multiples, the county evidence matrix, ranked dots, synchronized maps, map-linked scatterplots, and up to five county comparison profiles. Filters, selection, score assumptions, and the requested release are shareable in the URL. The release-trends view explains the current historical-data prerequisite. See [the geographic explorer contract](contracts/geographic-explorer.md) for interpretation, accessibility, and acceptance details.

## Feature-gated Atlas Assistant

`/assistant` is the feature-gated Atlas Assistant for questions grounded in reviewed PubMed and PMC Open Access literature. Enable its full workspace and compact drawer locally with `NEXT_PUBLIC_KG_CHAT_ENABLED=true`. The browser uses the Python REST API; `/knowledge-graph` redirects to `/assistant` for existing deep links. The internal fixture-only demo components remain for development tests and are not a user-facing route.
