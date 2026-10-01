# Atlas Assistant entry points

## Product decision

When reviewed-literature chat is enabled (`NEXT_PUBLIC_KG_CHAT_ENABLED=true`):

| Surface | Role | When visible |
| --- | --- | --- |
| Floating launcher (`ChatLauncher`) | **Primary** in-flow entry | All analytical shell routes except `/assistant`. Opens the compact drawer; drawer footer links to the full workspace. Carries the **Early access** label. |
| Primary navigation link to `/assistant` | **Secondary** wayfinding | Only while the user is on the full workspace route, so the Research group reflects the active destination without competing with the launcher elsewhere. |
| Direct URL `/assistant` and legacy `/knowledge-graph` redirect | **Secondary** deep links | Always available; same workspace as the drawer handoff. |

When literature chat is disabled:

| Surface | Role |
| --- | --- |
| Primary navigation link to `/assistant` | **Only** entry; shows the shared Coming Soon treatment. |
| Floating launcher | Not rendered. |

This hierarchy keeps Assistant discoverable on mobile and desktop (launcher on explore workflows; nav + URL on the workspace) without two unexplained “Atlas Assistant” calls to action on the same screen.

## Implementation

- `src/lib/assistant-entry-points.ts` — visibility helpers consumed by the shell and launcher.
- `src/components/app-shell.tsx` — filters Research navigation using `shouldShowAssistantInPrimaryNavigation`.
- `src/components/chat-launcher.tsx` — respects `shouldShowAtlasAssistantLauncher` and launcher labeling.

## Related contracts

- [Navigation contract](./navigation.md) — route metadata and status semantics.
- [Web #271 route gap analysis](./web-271-route-gap-analysis.md) — canonical `/assistant` workspace and drawer handoff.
