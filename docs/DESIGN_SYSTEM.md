# Lyme Atlas design system

This is the Lyme Atlas application design system. It is organized so later extraction is possible, but it is not a shared Caraway Labs package.

**UX Reset:** Product and page-job rules for the professional workspace reset live in [UX_RESET_CONSTITUTION.md](./UX_RESET_CONSTITUTION.md). This document remains the source for tokens, primitives, and visual architecture; the constitution governs evidence semantics, destination boundaries, and agent product guardrails.

Recorded refinement decisions (issue #24, owner-authorized 2026-09-03):

1. Atlas-only system, named for later extraction.
2. Small visual consistency is allowed; this is not a product redesign.
3. Keep the serif display + sans UI pairing as formal typography roles.
4. Use a 4px / Tailwind spacing scale; arbitrary spacing is for viz/layout.
5. Semantic tokens for chrome; explicit domain/viz tokens for maps, evidence, rankings, and severity.
6. No dark-mode product feature; token architecture remains remappable.
7. Markdown docs plus an unlinked `/design-system` gallery. WEB #549 supersedes the original no-Storybook tooling choice with an independent public [component explorer](storybook.md); see [ADR 0021](adr/0021-storybook-component-explorer.md). Production components and styling remain canonical.
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
- **Domain / viz:** `--navy`, `--teal`, `--mint`, `--action-plan-surface`, `--action-plan-border`, `--priority-*`, `--map-ramp-*`, `--atlas-action-primary`. Do not flatten these into `primary`.
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

`src/components/ui` owns Button, Badge, Card, Dialog, DropdownMenu, Input, Popover, Progress, Select, Slider, Table, and Tooltip. Search there before creating a control. Do not add a second component framework. Slider is a native range input (`data-slot="slider"`) for shared assumption controls. Popover is the click, keyboard, and touch disclosure; Tooltip stays hover and focus only. The visual-first primitives added for the Explorer are listed in the next subsection.

### Visual-first primitives (WEB #788)

These shadcn (`base-nova`) wrappers over Base UI also live in `src/components/ui`. Each has a `/design-system` specimen and a Storybook story (`Primitives/*`).

| Primitive | Use it for | Choose it over |
| --- | --- | --- |
| `Tabs` | Switch sibling panels in one place (Shortlist / County). Arrow keys move focus, Enter or Space selects. | Anchors, which navigate to a different page or section. Tabs never change the URL by themselves. |
| `ToggleGroup` / `Toggle` | One choice from a short set (Map / Split / Table, evidence filter) or an on/off option. Exposes `aria-pressed`. | `Select` for long option lists. `Tabs` when each choice owns a panel. |
| `Meter` | A value inside a known range (0-100 score, evidence completeness). Exposes `role="meter"` with min, max, and now. | `Progress`, which stays for task progress (loading, upload, steps). Meter never animates severity. |
| `Collapsible` / `Accordion` | Progressive disclosure. A single `Collapsible` or a grouped `Accordion` replaces each native `<details>` in the Explorer. Triggers expose `aria-expanded`. | Native `<details>` in the Explorer. Native `<details>` remains acceptable outside it. |
| `Sheet` | Edge-anchored secondary panel on desktop (scenario controls, provenance). Built on the Base UI dialog: focus trap, Escape, focus return, and a named Close button. | `Dialog` for short blocking confirmations or forms. `Drawer` for touch swipe. |
| `Drawer` | Touch-first swipe-to-dismiss panel on mobile (shortlist). Always keep a Close button. | `Sheet` when swipe is not needed. |
| `Breadcrumb` | Geography readout: United States > Alabama > Bullock County. The last item is `aria-current="page"`. | A text path built by hand. |
| `Combobox` | Searchable single-choice picker (county search). | A hand-rolled `role="combobox"` with a custom list. |
| `HoverCard` | Optional hover or focus preview (map readout). Wraps Base UI Preview Card. | `Tooltip` for a one-line label. `Popover` when a click must open it. A preview never holds the only copy of a fact. |
| `ScrollArea` | A bounded scroll region (shortlist, rail) with a focusable viewport. | Raw `overflow-auto` on a bespoke wrapper. |
| `Separator` | A thin divider with `role="separator"` and an orientation. | Per-card borders. |
| `Spinner` | Neutral loading (`role="status"`, name "Loading"). Stops spinning under reduced motion. | A value-shaped skeleton, which can read as a real value. |
| `InputGroup`, `Textarea` | Input with inline icons, buttons, or text. A shared multi-line field. | Bespoke input wrappers. |

Compose these with Atlas meaning in `src/components/atlas-*` or feature code. Do not add scoring or provenance logic to `src/components/ui`.

## Atlas icon vocabulary

Use Lucide only, and use one icon per concept everywhere. Icons always accompany a text label or an accessible name. Never use an icon alone to carry meaning.

| Concept | Icon | Concept | Icon |
| --- | --- | --- | --- |
| Human surveillance | `Users` | Tick / vector | `Bug` |
| Pathogen | `Microscope` | Environment | `TreePine` |
| Available | `CircleCheck` | Limited | `CircleDashed` |
| Unavailable | `CircleOff` | Caveat / warning | `TriangleAlert` |
| Compare | `GitCompareArrows` | Ask Atlas | `Sparkles` |
| Export | `Download` / `FileDown` | Release / source | `Database` |
| Period | `Calendar` | Scenario | `SlidersHorizontal` |
| Layers | `Layers` | Map / Table views | `Map` / `Table2` |
| Follow-up checklist | `ListChecks` | Resources | `BookOpen` |
| Reset | `RotateCcw` | Loading | `LoaderCircle` |

Decorative icons use `aria-hidden="true"` beside a visible label. An icon-only control needs an accessible name, for example `aria-label` or a visually hidden label.

## Evidence-state visual grammar

The evidence states keep the governed words **Available**, **Limited**, and **Unavailable**. The words come only from API metadata (see [ux-reset-evidence-contract.md](./ux-reset-evidence-contract.md)). Visual treatment adds a second and third cue (icon and pattern) so state never depends on color alone (WCAG color-independence).

| State | Icon | Treatment | Never |
| --- | --- | --- | --- |
| **Available** | `CircleCheck` | Solid fill | n/a |
| **Limited** | `CircleDashed` | Solid fill plus an outline ring | Tinted as a warning red |
| **Unavailable** | `CircleOff` | Diagonal hatch plus a dashed border | `0`, a bare dash, or a grey that reads as a low value |
| **Observed zero** | `CircleCheck` plus the value `0` | Solid and numeric | Hatched |

Rules:

- Loading and error are **not** Unavailable. Show a neutral `Spinner`, never a value-shaped skeleton or placeholder.
- Absence is not zero. Only a governed observed zero renders the numeral `0`.
- Pair every treatment with its word. The icon and pattern support the label and do not replace it.

CSS utility contract (implemented in `src/features/ux-reset/evidence/evidence-state.css`; `EvidenceStateGlyph` pairs the icon with the word; this document is the contract):

| Class | Meaning | Treatment |
| --- | --- | --- |
| `.atlas-state-available` | Available | Solid fill, no pattern |
| `.atlas-state-limited` | Limited | Solid fill plus an outline ring. Not a warning-red tint |
| `.atlas-state-unavailable` | Unavailable | Diagonal hatch (`repeating-linear-gradient`) plus a dashed border |

Use semantic or documented evidence tokens in these utilities, with no new hardcoded hex outside the files `scripts/check-design-system.mjs` allows. Map fills for unavailable counties use the matching hatch pattern.

## Explorer type scale

The Explorer uses five type steps. Sub-12px text is removed from body content.

| Step | Class | Size | Use |
| --- | --- | --- | --- |
| 1 | `text-xs` | 12px (0.75rem) | Captions, units, dense table meta. The minimum for any body text. |
| 2 | `text-sm` | 14px (0.875rem) | Default UI and table text, section labels. |
| 3 | `text-base` | 16px (1rem) | Primary reading text, key values. |
| 4 | `text-xl` | 20px (1.25rem) | Panel and card titles. |
| 5 | `text-3xl` | 30px (1.875rem) | The county name only. |

- No body text below 12px. Do not add arbitrary sizes such as `text-[10.4px]`.
- Reserve the serif display face (`--font-display`) for **one** element per view: the county name or the page title.
- Section headings are `text-sm font-semibold` labels with a Lucide icon from the vocabulary above, not large serif headings.

## Atlas domain patterns

These compose primitives and domain CSS. They are not rename-wrappers:

- `AtlasSectionHeader` — eyebrow, heading, optional description/aside
- `AtlasDataStamp` — governed snapshot / version stamp
- `AtlasStatusMessage` — loading, error, and empty copy
- `AtlasMapLegend` — review-priority ramp with non-map caption
- `ExplorerMapLegend` — Explorer map color key. Discrete layers share one segmented pill. The seven-color gap-score bar is the reference for bar height (0.55rem), fully rounded outer ends, and segment width. Fewer categories make a shorter pill and are not stretched to that seven-color width. At a normal desktop width each discrete segment is one seventh of the legend. Segments meet inside the rounded clip; category colors stay discrete. End captions for a discrete pill sit under that pill. Continuous ramps keep one rounded gradient, with a thin gray no-data segment when that layer already has one. Colors, order, labels, thresholds, popovers, and no-data meaning stay on the layer contract. Segment hit targets stay at least 1.75rem tall. Rurality's ordered ramp uses the same pill; its separate "No data" control stays beside that ramp and uses one fully rounded segment. A segment outline, when the layer defines one, is drawn on the visible pill. Keyboard focus draws the ring on the segment button, including segments whose color span is hidden by the pill.
- `AtlasPriorityBadge` — `Badge` plus `.priority-pill` severity colors
- `EvidenceObject`, `EvidenceStateStrip`, `EvidenceProvenanceInspect` — UX Reset shared evidence/provenance presentation (`src/features/ux-reset/evidence/`; see [ux-reset-evidence-contract.md](./ux-reset-evidence-contract.md))

### Atlas Explorer layout (WEB #788)

The `/explore` browse view is one map-led stage and a companion rail. The audit behind it is [product/ux-audit-explore-page.md](./product/ux-audit-explore-page.md).

- **Context bar** (`ExplorerCountyToolbar`): a `Breadcrumb` is the single readout of geography (United States > state > county). The State `Select`, county combobox, and Available data `Select` are the inputs. Scenarios (`Sheet`), Official resources (`Popover`), Export (`DropdownMenu`), and the Release badge (`Sheet`) sit in one trailing group. Below 640px the group shows icons with visually hidden labels.
- **Map stage**: the canvas fills the stage height (`clamp(32rem, 100dvh - 21rem, 60rem)` at 1100px and wider). The layer `Select` floats over the top-left of the map. The legend is a compact strip under the canvas so it never covers a county. A `Scenario colors, not published` badge appears in the map header whenever the colors are browser scenario values.
- **Rail** (`ExplorerBrowseRail`): `Tabs` switch between **List** and **County**. Choosing a county, from the list, the map, the county search, or the URL, opens County. Clearing it returns to List. Returning from county evidence shows List so focus can land on the county row.
- **Shortlist rows**: each row is one button with rank, full county name, review-priority bar (the same ramp color as the map), and an evidence-completeness `Meter`. Counties with no published score show a hatched `No score` chip. Sort (Priority, Name, Evidence) is a viewing aid; the default order stays the governed ranking.
- **County summary card**: name, state badge, FIPS, a score ramp with the `Review priority · not disease risk` qualifier, an evidence-completeness `Meter`, a surveillance fingerprint (one `EvidenceStateGlyph` per family, using the state the shared evidence model already derives), the existing four marks, then one primary action and an icon row (follow-up, compare, PDF). The rationale rows sit behind one `Collapsible` (`Evidence behind this review`).
- **Follow-up**: `CountyActionChecklist` shows one action line per domain with an `Accordion` for the full governed text. It renders only when a county is selected.
- **Scenario**: a non-modal `Sheet` keeps the map live while sliders move. `Scenario active` and a quick reset sit beside the trigger whenever settings differ from the published defaults.
### Atlas Explorer layout (WEB #788)

The `/explore` browse view is one map-led stage and a companion rail. The audit behind it is [product/ux-audit-explore-page.md](./product/ux-audit-explore-page.md).

- **Context bar** (`ExplorerCountyToolbar`): a `Breadcrumb` is the single readout of geography (United States > state > county). The State `Select`, county combobox, and Available data `Select` are the inputs. Scenarios (`Sheet`), Official resources (`Popover`), Export (`DropdownMenu`), and the Release badge (`Sheet`) sit in one trailing group. Below 640px the group shows icons with visually hidden labels.
- **Map stage**: the canvas fills the stage height (`clamp(32rem, 100dvh - 21rem, 60rem)` at 1100px and wider). The layer `Select` floats over the top-left of the map. The legend is a compact strip under the canvas so it never covers a county. A `Scenario colors, not published` badge appears in the map header whenever the colors are browser scenario values.
- **Rail** (`ExplorerBrowseRail`): `Tabs` switch between **List** and **County**. Choosing a county, from the list, the map, the county search, or the URL, opens County. Clearing it returns to List. Returning from county evidence shows List so focus can land on the county row.
- **Shortlist rows**: each row is one button with rank, full county name, review-priority bar (the same ramp color as the map), and an evidence-completeness `Meter`. Counties with no published score show a hatched `No score` chip. Sort (Priority, Name, Evidence) is a viewing aid; the default order stays the governed ranking.
- **County summary card**: name, state badge, FIPS, a score ramp with the `Review priority · not disease risk` qualifier, an evidence-completeness `Meter`, a surveillance fingerprint (one `EvidenceStateGlyph` per family, using the state the shared evidence model already derives), the existing four marks, then one primary action and an icon row (follow-up, compare, PDF). The rationale rows sit behind one `Collapsible` (`Evidence behind this review`).
- **Follow-up**: `CountyActionChecklist` shows one action line per domain with an `Accordion` for the full governed text. It renders only when a county is selected.
- **Scenario**: a non-modal `Sheet` keeps the map live while sliders move. `Scenario active` and a quick reset sit beside the trigger whenever settings differ from the published defaults.
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
