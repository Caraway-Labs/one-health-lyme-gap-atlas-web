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
npm run build
npm run dev
```

Only `NEXT_PUBLIC_API_BASE_URL` is public configuration. Never add Snowflake configuration or secrets to this repository.
