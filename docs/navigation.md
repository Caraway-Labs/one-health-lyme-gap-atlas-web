# Atlas navigation contract

## Scope

This contract owns primary movement between Atlas workflows and the route metadata used by the application shell. It is implemented by `src/lib/navigation.ts` and consumed by the desktop sidebar, collapsed icon rail, mobile drawer, route chrome, page metadata, and global footer. It does not own page-local filters, tabs, score controls, map controls, or in-page anchors.

## Information architecture

The initial hierarchy is task-oriented for epidemiologists and public-health professionals. It exposes only current or intentionally started capabilities:

| Group | Destination | Route | Status | Placement |
| --- | --- | --- | --- | --- |
| Explore | Atlas overview | `/` | Available | Sidebar |
| Explore | Geographic Explorer | `/geographic_explorer` | Available | Sidebar |
| Research | Evidence library | `/knowledge-graph` | Coming Soon / in development | Sidebar |
| Research | Talk with the Atlas | `/assistant` | Coming Soon / in development | Sidebar |
| Reference | Docs | `https://carawaylabs.com/docs` | Available | Sidebar, new tab |
| Utility | Account | `/account` | Available | Top utility bar |
| Trust | Privacy | `/privacy` | Available | Global footer |
| Trust | AI Ethics | `/ai-ethics` | Available | Global footer, new tab |

Future Surveillance, Intelligence, and Outputs destinations need product-owned routes and meaningful implementation before they are added. Backlog or vision issues do not create visible links or speculative stub pages.

## Route inventory and shell decisions

| Route family | Navigation role | Status | Shell | Rationale |
| --- | --- | --- | --- | --- |
| `/`, `/geographic_explorer` | Primary sidebar | Available | Analytical | Released public Atlas workflows. |
| `/assistant`, `/knowledge-graph` | Primary sidebar | In development | Analytical | Meaningful implementation exists; unavailable states use the shared Coming Soon contract. |
| `/account` | Global utility | Available | Analytical | Optional account functionality is user-facing and usable. |
| `/auth/sign-in` | Account-specific | Hidden from navigation | Analytical | User-facing sign-in adopts the shell without becoming primary navigation. |
| `/privacy`, `/ai-ethics` | Footer/trust | Available | Lightweight public | Trust pages do not need the persistent analytical sidebar. |
| `/docs` and nested docs routes | Sidebar destination / docs layout | Available | Docs | Sidebar selection opens the canonical docs site in a new tab; direct internal docs URLs remain available. |
| `/variant_1`–`/variant_7` | Direct-link-only | Experimental | None | Existing experimental workflows remain routable and isolated from production navigation and shell. |
| `/design-system` | Internal/developer | Hidden | None | Unlinked reference gallery. |
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
- Prefix routes match the route and nested paths. This keeps nested evidence workspaces and direct docs pages associated with their parent metadata.
- Dynamic route patterns use bracketed segments such as `/reports/[id]` and match one non-empty path segment per bracket.
- `none` never becomes active. Auth callbacks, APIs, internal routes, and experimental direct-link routes are not represented as active primary items.
- The longest matching route wins when nested prefixes exist.
- External destinations such as Docs still use the same metadata for labels, status, and active-context rules while resolving their configured external URL from `src/lib/docs-config.ts`.

## State, privacy, and accessibility

The shell persists only the boolean expanded/collapsed sidebar presentation preference under `atlas-sidebar-open`. It never stores analytical URL state, profile values, credentials, or sensitive data. Focus mode temporarily forces the sidebar compact without changing or overwriting that preference; exiting focus mode restores the user's normal shell choice. Responsive mobile rules take precedence over desktop preference and use an accessible drawer.

The shell provides navigation landmarks, `aria-current="page"`, keyboard focus containment for the mobile drawer, visible focus, status text that does not rely on color alone, reduced-motion-compatible transitions, and the same route behavior across desktop and mobile presentations.

## Open decisions

- Future Surveillance, Intelligence, and Outputs destinations require product approval and real implementation before visible navigation is added.
- Future authenticated or role-aware destinations must use explicit metadata capability fields; presentation must not infer authorization from labels or route names.
