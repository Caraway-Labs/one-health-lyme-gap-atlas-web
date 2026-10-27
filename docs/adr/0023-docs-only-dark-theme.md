# 0023: Accessible dark theme for public docs only

Status: Accepted Date: 2026-10-26 Decision owner: product owner, recorded for issue #950

## Context

Developers read the public docs for long stretches, and many use a dark color scheme. ADR 0020 kept the docs theme switch off so the docs surface matched the light-only Atlas app. The signed-in product still ships light only. Issue #950 asks for an accessible docs dark theme that does not change the rest of the site.

## Decision

Enable a light, dark, and system theme switch in the public docs header. Persist the choice in `localStorage` under `atlas-docs-theme`. Default to the operating system preference. Scope every dark token to `.dark .atlas-docs-root` so `/docs` can be dark while the signed-in app, its semantic tokens, and its domain tokens stay on the light palette. Remove the `dark` class when the docs layout unmounts. Apply the class before the docs root paints so a reload does not flash the other theme.

This records the product decision to turn dark mode on for docs while the main app stays light.

## Alternatives considered

- A site-wide `.dark` palette would restyle the signed-in workspace. That is out of scope.
- Leaving the Fumadocs theme disabled keeps one visual system, and it leaves the docs bright for readers who work in dark mode.

## Consequences

- Docs components, code blocks, callouts, tables, search, and the API reference must meet WCAG AA contrast in both themes.
- App routes must not inherit the docs theme class or the docs token overrides.
- A future app dark theme is a separate decision. It is not authorized here.
