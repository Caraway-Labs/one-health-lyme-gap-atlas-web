# one-health-lyme-gap-atlas-web

Public single-page One Health Lyme Gap Atlas built with React, strict TypeScript, Next.js App Router, MapLibre, TanStack Query, and an OpenAPI-generated API client.

## Approved stack

- React + TypeScript + Next.js (App Router)
- The browser consumes the Python REST API only; it never connects directly to Snowflake.

Read the workspace [agent instructions](../AGENTS.md) and [technology and governance baseline](../TECHNOLOGY_AND_GOVERNANCE.md) before implementation. They define the required API, provenance, accessibility, security, testing, and decision-record rules.

```powershell
npm ci
npm run generate:api
npm run typecheck
npm run lint
npm run check:design-system
npm run build
npm run dev
```

The public frontend may use `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AMPLITUDE_API_KEY`, and the Supabase publishable project URL/key. Treat those values as public. Never add Snowflake configuration, service-role keys, or other secrets to this repository or to `NEXT_PUBLIC_*` variables.

## Geographic explorer

Open **Explore → Geographic Explorer** (`/geographic_explorer`) to use geographic tiles, small multiples, the county evidence matrix, ranked dots, synchronized maps, map-linked scatterplots, and up to five county comparison profiles. Filters, selection, score assumptions, and the requested release are shareable in the URL. The release-trends view explains the current historical-data prerequisite. See [the geographic explorer contract](contracts/geographic-explorer.md) for interpretation, accessibility, and acceptance details.

## Feature-gated assistant demo

`/assistant` is a local, fixture-only assistant-ui demonstration. Enable it locally with `NEXT_PUBLIC_ATLAS_ASSISTANT_DEMO_ENABLED=true`. It has no model/provider SDK or live Atlas request; future work must extend `src/features/assistant`, retain structured sources, and register rich UI through an explicit allowlist.
