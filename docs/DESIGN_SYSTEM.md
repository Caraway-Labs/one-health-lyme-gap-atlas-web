# Lyme Atlas design system

This is the Lyme Atlas application design system. It is organized so later extraction is possible, but it is not a shared Caraway Labs package.

Recorded refinement decisions (issue #24, owner-authorized 2026-09-03):

1. Atlas-only system, named for later extraction.
2. Small visual consistency is allowed; this is not a product redesign.
3. Keep the serif display + sans UI pairing as formal typography roles.
4. Use a 4px / Tailwind spacing scale; arbitrary spacing is for viz/layout.
5. Semantic tokens for chrome; explicit domain/viz tokens for maps, evidence, rankings, and severity.
6. No dark-mode product feature; token architecture remains remappable.
7. Markdown docs plus an unlinked `/design-system` gallery; no Storybook.
8. `AGENTS.md` + static checks + focused Playwright a11y coverage.
9. Extract Atlas domain patterns only with genuine reuse.
10. WCAG 2.2 AA for reusable UI and key flows.
11. Tailwind-standard breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Shell CSS also has a compact-nav breakpoint at 800px.
12. Minimal motion, short durations, honor `prefers-reduced-motion`.

## Architecture

```text
Design tokens
    ↓
shadcn / Base UI
    ↓
src/components/ui
    ↓
Atlas domain patterns (src/components/atlas-*.tsx)
    ↓
Feature / page components
```

Map and data-visualization CSS may sit beside this hierarchy.

## Token conventions

- **Semantic chrome:** `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--success`, `--warning`, `--info`, `--border`, `--input`, `--ring`, radius, spacing, motion.
- **Domain / viz:** `--navy`, `--teal`, `--mint`, `--priority-*`, `--map-ramp-*`, `--atlas-action-primary`. Do not flatten these into `primary`.
- Consume semantic tokens in reusable UI. Do not add hardcoded chrome hex in feature components.
- Dark mode: remap the semantic variables on a future `.dark` class. Do not ship a dark theme from this document.

## Typography

| Role | Token / class | Family |
| --- | --- | --- |
| Display / hero | `--type-display-size`, `.type-display` | serif `--font-display` |
| Page / section | `--type-page-size`, `.type-page` | serif |
| Card heading | `--type-card-size`, `.type-card` | serif |
| Body | `--type-body-size`, `.type-body` | sans `--font-sans` |
| Small | `--type-small-size`, `.type-small` | sans |
| Eyebrow | `--type-eyebrow-size`, `.eyebrow` | sans |
| Metric | `--type-metric-size`, `.type-metric` | serif |

## Spacing and layout

Prefer `--space-1` (4px) through `--space-12` (48px) and `--control-height` (44px) for Atlas chrome controls. Layout clamps live as `--layout-inline`, `--layout-section-block`, `--layout-hero-block`, and `--layout-content-max`.

## Canonical primitives

`src/components/ui` owns Button, Badge, Card, Dialog, DropdownMenu, Input, Progress, Select, Table, and Tooltip. Search there before creating a control. Do not add a second component framework.

## Atlas domain patterns

These compose primitives and domain CSS. They are not rename-wrappers:

- `AtlasSectionHeader` — eyebrow, heading, optional description/aside
- `AtlasDataStamp` — governed snapshot / version stamp
- `AtlasStatusMessage` — loading, error, and empty copy
- `AtlasMapLegend` — review-priority ramp with non-map caption
- `AtlasPriorityBadge` — `Badge` plus `.priority-pill` severity colors

Keep scoring, filter, geography, and provenance logic in feature code.

## When custom CSS is acceptable

Keep CSS for MapLibre, SVG/charts, editorial hero/methods layout, rank rows, and documented native exceptions. Do not recreate generic `.button` / `.card` systems.

## How to add a component

1. Search `src/components/ui` and existing `atlas-*` patterns.
2. Compose primitives and semantic tokens.
3. Put domain meaning in `src/components`, not `src/components/ui`.
4. Add a gallery specimen on `/design-system` when the pattern is reusable.
5. Run `npm run check:design-system` plus the repository quality gates.

## Accessibility

Target WCAG 2.2 AA: keyboard access, visible focus, labeled controls, dialog and menu semantics, data-table alternatives to the map, and reduced motion. Playwright axe coverage excludes `.maplibre-atlas`.

## Motion

`--motion-duration-fast` (120ms) and `--motion-duration` (200ms) with `--motion-easing`. `prefers-reduced-motion: reduce` short-circuits transitions and animations globally.

## Correct vs incorrect

Correct: `Button`, `Card`, `Select`, `AtlasPriorityBadge`, `var(--primary)`, `var(--map-ramp-4)` for a legend.

Incorrect: `className="button"`, a new hex on a settings form, a custom `<select>` for chrome, wrapping `Button` only to rename it, putting ranking math inside `src/components/ui`.
