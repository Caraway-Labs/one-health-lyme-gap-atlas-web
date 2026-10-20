# Workspace connecting screen

Web #769. The navy three-dot screen is the application-owned wait for session and workspace readiness. Web #770 owns loading inside the map viewport after this screen is gone.

## When it starts

The screen may mount while either of these is unresolved:

- Direct entry to a professional route (`/explore`, `/app/*`, `/compare`, `/askatlas`, `/data-provenance`) before `StartingViewGate` has a completed saved profile.
- The post-sign-in continuation at `/auth/continue` before that same profile read classifies the account.

React Suspense around those trees uses the same component. The first paint stays empty.

## When it becomes visible

Visibility waits `450` ms (`WORKSPACE_CONNECTING_DELAY_MS`). If readiness arrives first, the timer is cleared and the screen never paints. There is no minimum display time and no wait for the bounce cycle.

## When the shell is ready

`StartingViewGate` renders the professional shell as soon as the profile read proves `startingViewVersion === 1`. Map geometry, layer data, and MapLibre render stay inside `ExploreMapPanel` (`data-loading-boundary="map-viewport"`). That local status can still say the map is loading. #770 replaces that viewport treatment and must not move the wait back onto this screen.

County, layer, and in-app navigation do not mount this screen. Back-forward session concealment keeps the existing “Checking session” cover.

## When it fails

A rejected session renders the existing sign-in alert. A failed profile read renders the existing retry alert. Neither path leaves the dots mounted. `/auth/continue` keeps the sign-in entrance chrome for those same failures. The starting-view form keeps its own “Checking your starting view…” status; that page is setup, not this transition.

## Accessibility

One polite `role="status"` contains the headline and supporting line. The dots are `aria-hidden`. Reduced motion, including `data-motion="reduced"`, stops the bounce and leaves the dots in place. The screen replaces the shell, so keyboard focus is not left on controls underneath it.

## Copy and color

- Headline: “Connecting the data.” — `rgb(255, 255, 255)` on `var(--navy)`.
- Support: “Preparing your Atlas workspace…” — `rgba(255, 255, 255, 0.85)`.
- Dots: `rgb(121, 212, 201)`, `0.55rem`, `1.1s` alternate bounce, delays `0s` / `0.2s` / `0.4s`.
- Typography: `type-card` and `type-body`.
