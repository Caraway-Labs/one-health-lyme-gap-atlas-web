# Atlas Assistant entry points

## Product decision

When reviewed-literature chat is enabled (`NEXT_PUBLIC_KG_CHAT_ENABLED=true`):

| Surface | Role | When visible |
| --- | --- | --- |
| Floating launcher (`ChatLauncher`) | **Primary** in-flow entry | All analytical shell routes except `/assistant`. Opens the compact drawer; drawer footer links to the full workspace with validated `county` and `dataset` query parameters when present. Carries the **Early access** label. |
| Primary navigation link to `/assistant` | **Secondary** wayfinding | Only while the user is on the full workspace route, so the Research group reflects the active destination without competing with the launcher elsewhere. |
| Direct URL `/assistant` and legacy `/knowledge-graph` redirect | **Secondary** deep links | Always available; same workspace as the drawer handoff. Accepts validated `county` and `dataset` deep links and shows an explicit fallback when a FIPS cannot be represented. |

When literature chat is disabled:

| Surface | Role |
| --- | --- |
| Primary navigation link to `/assistant` | **Only** entry; shows the shared Coming Soon treatment. |
| Floating launcher | Not rendered. |

This hierarchy keeps Assistant discoverable on mobile and desktop (launcher on explore workflows; nav + URL on the workspace) without two unexplained “Atlas Assistant” calls to action on the same screen.

## Implementation

- `src/lib/assistant-entry-points.ts` — visibility helpers consumed by the shell and launcher.
- `src/lib/assistant-context-handoff.ts` — copies validated county and release context into `/assistant` links from analytical routes.
- `src/components/assistant-county-context.tsx` — county identification and fallback messaging in the chat workspace and drawer.
- `src/components/app-shell.tsx` — filters Research navigation using `shouldShowAssistantInPrimaryNavigation`.
- `src/components/chat-launcher.tsx` — respects `shouldShowAtlasAssistantLauncher` and launcher labeling.

## Drawer and workspace continuity

`EvidenceChat` uses one shared conversation model (`useEvidenceChat`) and one shared transcript/composer surface (`EvidenceChatConversationContent`). Layout shells differ only by presentation:

| Shell | History | Transcript | Handoff |
| --- | --- | --- | --- |
| Drawer (`ChatLauncher`) | No persistent rail; resumes the latest saved local conversation | Compact spacing in `.evidence-chat-drawer` | **Open full workspace** links to `/assistant?conversation=<id>` when the active chat has at least one saved turn |
| Workspace (`/assistant`) | Recent-chat rail (desktop) or sheet (mobile) | Full-height scrollable transcript with docked composer | URL `?conversation=` deep links; missing IDs show an explicit recoverable notice |

**Not preserved across handoff:** composer text that has not been submitted yet, in-flight requests if the drawer is closed mid-flight, and conversations saved in another browser or after local storage was cleared. The drawer footer states when workspace handoff requires a saved answer; invalid deep links never silently start a different saved chat.

## Related contracts

- [Navigation contract](./navigation.md) — route metadata and status semantics.
- [Web #271 route gap analysis](./web-271-route-gap-analysis.md) — canonical `/assistant` workspace and drawer handoff.
