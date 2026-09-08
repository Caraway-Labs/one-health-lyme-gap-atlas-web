# Atlas navigation contract

## Scope

This contract owns primary movement between Atlas workflows. It is implemented by `src/lib/navigation.ts` and is consumed by both desktop and mobile shell presentations. It does not own page-local filters, tabs, score controls, map controls, or in-page anchors.

## Initial information architecture

| Group | Destination | Route | Notes |
| --- | --- | --- | --- |
| Explore | Atlas overview | `/` | Primary public county-review starting point. |
| Explore | Geographic Explorer | `/geographic_explorer` | Linked geography workspace; map results retain a non-map equivalent. |
| Intelligence | County review | `/variant_1` | Workflow prototype. |
| Intelligence | Guided review | `/variant_2` | Workflow prototype. |
| Intelligence | Evidence workspace | `/variant_3` | Workflow prototype. |
| Intelligence | Score explained | `/variant_4` | Workflow prototype. |
| Intelligence | County comparison | `/variant_5` | Workflow prototype. |
| Intelligence | Wide workspace | `/variant_6` | Workflow prototype. |
| Research | Evidence library | `/knowledge-graph` | Feature-gated reviewed-literature workspace. |

## Active-route rules

- The listed analytical routes use exact matching, so a variant never appears active merely because another route shares a text prefix.
- The Evidence Library uses prefix matching so child workspace routes can keep the parent item current.
- A current item is exposed with `aria-current="page"` by shell renderers.

## State and privacy

The shell keeps only in-session presentation state. It does not add browser storage, telemetry, authorization assumptions, or backend dependencies. Query parameters remain owned by the destination route and are preserved by ordinary browser navigation.

On Geographic Explorer and Wide Workspace, focus mode temporarily compacts the desktop navigation without changing the route or its query state. Focus mode takes precedence over the user's expanded/collapsed preference while it is active; exiting restores that preference. It is intentionally unavailable on mobile, where the primary navigation remains an off-canvas drawer and workspace width is already constrained by the viewport.

## Open decisions

- Future Surveillance and Outputs destinations need product-approved routes before they are added to primary navigation.
- Future authenticated capabilities must use an explicit capability field in this metadata contract rather than inferring access from labels or routes.
