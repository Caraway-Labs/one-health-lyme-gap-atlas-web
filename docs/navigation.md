# Atlas navigation contract

## Scope

This contract owns primary movement between Atlas workflows and the route metadata used by the application shell. It is implemented by `src/lib/navigation.ts` and consumed by the desktop sidebar, collapsed icon rail, mobile drawer, route chrome, page metadata, and global footer. It does not own page-local filters, tabs, score controls, map controls, or in-page anchors.

## Information architecture

The initial hierarchy is task-oriented for epidemiologists and public-health professionals. It exposes only current or intentionally started capabilities:

| Group | Destination | Route | Status | Placement |
| --- | --- | --- | --- | --- |
| Public | One Health Atlas | `/` | Available | Not in the analytical sidebar |
| Explore | Atlas overview | `/overview` | Available | Sidebar |
| Explore | Geographic Explorer | `/geographic_explorer` | Available | Sidebar |
| Explore | Investigation Workspace | `/investigate` | Available | Sidebar |
| Research | Atlas Assistant | `/assistant` | Early access when enabled; Coming Soon when disabled | Sidebar when chat is off, or on `/assistant` when chat is on (see [Assistant entry points](./assistant-entry-points.md)) |
| Reference | Docs | `https://carawaylabs.com/docs` | Available | Sidebar, new tab |
| Utility | Account | `/account` | Available | Top utility bar |
| Trust | Privacy | `/privacy` | Available | Global footer |
| Trust | AI Ethics | `/ai-ethics` | Available | Global footer, new tab |

Future Surveillance, Intelligence, and Outputs destinations need product-owned routes and meaningful implementation before they are added. Backlog or vision issues do not create visible links or speculative stub pages.

## Route inventory and shell decisions

| Route family | Navigation role | Status | Shell | Rationale |
| --- | --- | --- | --- | --- |
| `/` | Public Front Porch | Available | None | Qualitative public introduction. It does not use the analytical sidebar or require sign-in. |
| `/overview`, `/geographic_explorer`, `/investigate` | Primary sidebar | Available | Analytical | Released public Atlas workflows. The Investigation Workspace is the promoted wide-workbench county investigation experience. |
| `/assistant` | Primary sidebar or launcher handoff | In development | Analytical | Literature-only chat is feature-gated. When enabled, the floating launcher is the primary entry on other analytical routes; the sidebar link appears on `/assistant` for wayfinding. See [Assistant entry points](./assistant-entry-points.md). |
| `/knowledge-graph` | Legacy deep link | Hidden | Analytical | Redirects to `/assistant`, preserving the local conversation selector. |
| `/variant_6` | Legacy deep link | Hidden | Analytical | Redirects to `/investigate`, preserving supported analytical query state. |
| `/account` | Global utility | Available | Analytical | Optional account functionality is user-facing and usable. |
| `/auth/sign-in` | Account-specific | Hidden from navigation | Analytical | User-facing sign-in adopts the shell without becoming primary navigation. |
| `/privacy`, `/ai-ethics` | Footer/trust | Available | Lightweight public | Trust pages do not need the persistent analytical sidebar. |
| `/docs` and nested docs routes | Sidebar destination / docs layout | Available | Docs | Sidebar selection opens the canonical docs site in a new tab; direct internal docs URLs remain available. |
| `/variant_1`–`/variant_5`, `/variant_7` | Direct-link-only | Experimental | None | Remaining experimental workflows stay routable and isolated from production navigation and shell. |
| `/design-system` | Internal/developer | Hidden | None | Unlinked reference gallery. |
| Former `/ux-lab/**` | Retired persona prototypes | Not registered | Unmatched | Requests return the app 404. No redirect and no prototype shell (#504). |
| `/auth/callback`, `/auth/confirm` | Technical auth utility | Hidden | None | Route handlers, not human navigation surfaces. |
| `/api/search` | Technical/API | Hidden | None | Fumadocs search route, never human navigation. |

## Status and visibility semantics

The typed metadata model supports four explicit statuses:

- `available`: a released, usable destination that may render normally.
- `inDevelopment`: a meaningful near-term capability that may be shown with a Coming Soon status treatment. Direct entry must use the same bounded Coming Soon page when the capability is not enabled.
- `experimental`: a direct-link route retained for evaluation; it is absent from normal navigation and the production analytical shell.
- `hidden`: an internal, technical, auth, or backlog-only route with no visible navigation item.

The status is metadata, not a page-specific conditional. The sidebar renders the status badge in expanded mode and includes it in the accessible label and tooltip in collapsed mode.

## Active-route rules

- Exact routes match only their own pathname. Query strings do not affect the result, so shareable analytical state remains intact.
- Prefix routes match the route and nested paths. This keeps direct docs pages associated with their parent metadata.
- Dynamic route patterns use bracketed segments such as `/reports/[id]` and match one non-empty path segment per bracket.
- `none` never becomes active. Auth callbacks, APIs, internal routes, and experimental direct-link routes are not represented as active primary items.
- The longest matching route wins when nested prefixes exist.
- External destinations such as Docs still use the same metadata for labels, status, and active-context rules while resolving their configured external URL from `src/lib/docs-config.ts`.

## State, privacy, and accessibility

The shell persists only the boolean expanded/collapsed sidebar presentation preference under `atlas-sidebar-open`. It never stores analytical URL state, profile values, credentials, or sensitive data. Focus mode temporarily forces the sidebar compact without changing or overwriting that preference; exiting focus mode restores the user's normal shell choice. Responsive mobile rules take precedence over desktop preference and use an accessible drawer.

Primary navigation between `/overview`, `/geographic_explorer`, and `/investigate` copies supported query parameters from the current URL into each destination link via `src/lib/analytical-navigation-handoff.ts`. Shared county (`county`), release (`dataset`), and Overview or Investigation Workspace filters are preserved when the target route accepts them. Geographic Explorer-only parameters (`view`, `metric`, `selected`, `page`) are not invented on other routes, and other routes do not silently drop a validated county FIPS when the destination can represent it.

The shell provides navigation landmarks, `aria-current="page"`, keyboard focus containment for the mobile drawer, visible focus, status text that does not rely on color alone, reduced-motion-compatible transitions, and the same route behavior across desktop and mobile presentations.

## Open decisions

- Future Surveillance, Intelligence, and Outputs destinations require product approval and real implementation before visible navigation is added.
- Future authenticated or role-aware destinations must use explicit metadata capability fields; presentation must not infer authorization from labels or route names.

## Route taxonomy audit (#195)

The full App Router inventory, `ATLAS_ROUTES` reconciliation, classification table, and rename recommendations for epic [#194](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/194) live in [atlas-route-taxonomy-audit.md](./product/atlas-route-taxonomy-audit.md). That document is audit-only; implement route changes only after [#196](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/196) approves a compatibility contract.
