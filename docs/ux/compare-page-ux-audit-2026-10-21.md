# One Health Atlas: /compare page UX audit

**Date:** October 21, 2026 **Prepared as:** Senior UX audit for the Product Manager (non-technical summary) **Story:** [#829 Improve Compare Page Experience](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/829) (child of Epic [#398](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/398), milestone UX Reset Phase 1, in Lyme Atlas Project #1 as Backlog) **Audit branch / worktree:** `codex/web-compare-ux-audit` at `.worktrees/web-compare-ux-audit` (from `origin/main` at `a8f438c`) **Method:** Code reading only, plus the three production screenshots you pasted. No code changed. No server started. Nothing was clicked in the live app.

> **What I could not verify.** I did not see the live app run, so statements about how many counties are in the dropdown, how long the page is, or what the data looks like come from the code and your screenshots. Where I am inferring, I say so.

---

## 1. The short version

The Compare page does its job correctly: it is careful about honesty (it never turns "missing" into zero, never ranks one county against the other). But it reads like a **report in a database**, not a **decision tool**.

The five biggest problems:

1. **Picking counties is slow.** Each picker is a single long dropdown. There is no way to type "Adair" and jump to it, no filter by state, and no suggestions. The second picker is greyed out until the first is chosen.
2. **The answer is at the bottom.** The page opens with two pickers, then a long stack of text rows. The summary ("how many values are shared / differ / withheld") is placed _after_ the evidence, and it only counts a minor group of "additional observations".
3. **Every number is wrapped in text.** Under each value sits "Source unknown / Observation period unknown / Dataset vintage unknown" plus a "Sources and limitations" link. In your production screenshot this appears on **every** value, which drowns out the numbers (40.8 vs 32.4) that matter.
4. **Almost nothing is visual.** The page contains no charts, no gauges, no bars, no map. Every comparison is two blocks of text side by side.
5. **Internal labels leak through.** The code prints raw measure IDs (for example `case_count_floor_2023`) under headings in the "Additional observations" group. Those are system names, not user language.

The good news: **we already own most of the building blocks to fix this** (see section 5). We do not need a new design system.

---

## 2. What the page shows today (plain English)

Reading top to bottom, using your three screenshots:

| Step | What the user sees | Screenshot |
| --- | --- | --- |
| A | Page title "Two counties. A clearer picture." and one sentence of explanation. | 1 |
| B | Two dropdowns: **First county** and **Second county** (second is greyed out). A line says "Choose two counties to compare. Atlas will not select counties for you." | 1 |
| C | After picking one: the county name, state, and an ID number (FIPS), plus "Clear" and "View county evidence" links. | 2 |
| D | After picking two: a small colored label above each picker ("Monitor for changes"), a "Clear both" link, a loading message, then the heading "County comparison". | 3 |
| E | A big stack of sections, most collapsed: Review category and reasons, Human disease surveillance, County Surveillance Intelligence, Tick/vector/pathogen, Population and community, State-level context, Score components, Additional observations. | 3 |
| F | At the very bottom: three counts (shared / differing / withheld), "Shared release limitations", "How dates and releases work", "Release and coverage", and a button "Ask Atlas about this comparison". | not shown |

Important product rules that shape this page (and that any redesign must respect), from `docs/UX_RESET_CONSTITUTION.md` and Epic #398:

- The user **chooses both counties**. Atlas must never auto-pick the second one (even a "similar" or "neighboring" one).
- A **missing value is never shown as zero**.
- The **review category / score is not "disease risk"** and the page does **not rank** one county above the other.
- Top-level evidence words are **Available / Limited / Unavailable**. Do not rename them.
- No general tooltip tours or inline "?" help systems in this phase.
- No second design system. Use the existing tokens and components.

---

## 3. Component inventory: what each piece is and what the user sees

I grouped these by where they show up on the page. "Type" tells you whether it is a ready-made library part or something we built.

### 3.1 Page frame

| Component | Type | What it displays to the user |
| --- | --- | --- |
| **Page introduction** | Built by us | The headline "Two counties. A clearer picture." and the one-sentence description. |
| **Left navigation** | Shared app shell | Icons for Explorer, Compare, Ask Atlas, Feed, etc. Compare is highlighted. |
| **Footer** | Shared app shell | "One Health Atlas by Caraway Labs", Privacy, AI / Responsible Use, Privacy settings. |

### 3.2 County selection area

| Component | Type | What it displays to the user |
| --- | --- | --- |
| **County slot (x2)** | Built by us | One card per county: label ("First county"), a dropdown, then once chosen: county name, state, FIPS code, a "Clear" button, and a "View county evidence" link. |
| **Dropdown (Select)** | shadcn/ui on Base UI | A single list of every available county, sorted alphabetically as "Name County, State (FIPS)". Click to open, scroll to find. The same list is used in both slots, with the other slot's county disabled. |
| **Review-category badge** | shadcn `Badge` + our priority badge | A small colored pill above the picker once data loads (for example "Monitor for changes"). Colors are the shared priority colors. |
| **"Clear both" button** | shadcn `Button` | Removes both selections. |
| **Status line** | Built by us | Instruction text: "Choose two counties to compare" / "One county is selected. Choose a second county." (A slightly different sentence if you came from Explorer.) |

### 3.3 Loading and error messages (stacked between the pickers and the results)

| Component | Type | What it displays |
| --- | --- | --- |
| **Status message** (many variants) | Built by us | "Loading release metadata…", "Loading the published county list…", "County records are visible. Additional observations are still loading.", "Loading aligned evidence…", "Waiting for the server retry window…", and error versions with retry buttons. Up to **eight different messages** can appear in this strip. |

### 3.4 The comparison results

| Component | Type | What it displays |
| --- | --- | --- |
| **"County comparison" section** | Built by us | The main heading, then everything below. |
| **Evidence group (collapsible)** | Built by us (HTML disclosure) | A section header (for example "Human disease surveillance") that expands to show rows. Only the **first** group opens by default. |
| **Paired values (two columns)** | Built by us | Two side-by-side columns, county name on top of each, one value block per county. |
| **Compact evidence block** | Built by us | For each value: the **number or text**, then three tiny labels (Source / Observation period / Dataset vintage, often "unknown"), an optional caveat line, and a "Sources and limitations" expander. |
| **Reasons list** | Built by us | Under "Review reasons": short labels (for example "Published Lyme case data", "Tick presence") each with a "Full text for…" expander. |
| **Provenance inspector** | Built by us | The "Sources and limitations" expander: where the number came from, its period, and caveats. |
| **County Surveillance Intelligence table** | Built by us + shadcn `Table`, `Button` | A small table with four rows (Surveillance Gap Score, ML Review Priority, Surveillance Situation, Ecological Situation) and one column per county. Each row is a button that opens a longer explanation underneath. Followed by a guide paragraph explaining that the four views can disagree. |
| **Additional observations group** | Built by us | A catch-all group of extra catalog measures. Each shows its heading, the **raw measure ID**, a sentence like "Values differ by 3." or "Same value", and the two-column values. |
| **Comparison overview** | Built by us | Three plain numbers: shared comparable values, differing comparable values, comparisons withheld, plus an expander "How these counts are defined". Sits **below** the evidence. |
| **Shared release limitations** | Built by us | A collapsed note about limits that apply to both counties. |
| **"How dates and releases work"** | Built by us | A collapsed explanation of period and release rules. |

### 3.5 Footer area of the page

| Component | Type | What it displays |
| --- | --- | --- |
| **"Release and coverage" disclosure** | Built by us | A collapsed section: review scope, a sentence about reporting differences, and the release status strip. |
| **"Ask Atlas about this comparison" button** | shadcn `Button` (as a link) | Jumps to the assistant with the two counties as context. |

### 3.6 What data rows exist (the "content" behind the components)

Grouped as the page groups them:

- **Review:** review category, review reasons, published review score (a number like 40.8).
- **Human disease:** minimum reported cases, minimum reported incidence.
- **Ticks / pathogens:** _Ixodes scapularis_ status, _Ixodes pacificus_ status, _Borrelia burgdorferi_ status, overall tick status.
- **Community:** population, social vulnerability percentile, uninsured percent, rural-urban classification.
- **State context:** state-unallocated human records.
- **Score components:** human-data, ecological, community components.
- **Limitations:** release limitation text (shown only when the two counties differ).
- **Four intelligence perspectives:** Gap Score, ML Review Priority, Surveillance Situation, Ecological Situation.

That is roughly **20 distinct measures across 8 sections** for a single comparison.

---

## 4. UX audit findings

Severity: **High** = blocks the "decision-support" goal. **Medium** = hurts speed or comprehension. **Low** = polish.

### A. Choosing counties

| # | Finding | Severity |
| --- | --- | --- |
| A1 | **Dropdown only, no search.** Both pickers are a plain list. Finding one county among thousands means scrolling or hoping type-ahead works on the first letters of "Name County, State". (Inferred: the list is the full published directory from the API, sorted alphabetically.) The Explorer page already has a real county search; Compare does not reuse it. | High |
| A2 | **Name-first, state-last ordering is a poor mental model.** Epidemiologists usually think "Oklahoma, then county" or "my region, then county". There is no state step. | High |
| A3 | **Second picker is disabled until the first is filled** (screenshot 1). Users cannot see how the page works, and cannot start with either county. | Medium |
| A4 | **Same-name counties.** The US has many "Washington County" and "Adair County". The list label includes the state, which helps, but there is no confirming visual (state shape or location). | Medium |
| A5 | **No quick starts.** No "recent comparisons", no "compare with a county from my last search", no "Swap" button. Entry from Explorer carries one county, which is good, but there is no visible "you came from Explorer" cue other than a sentence. | Medium |
| A6 | **No way to see availability before choosing.** A user can pick a county that has almost no data, then see a page full of "Unavailable". | Medium |
| A7 | **The instructions are text.** "Choose two counties to compare. Atlas will not select counties for you." is correct but is the only guidance on an empty page; the rest of the screen is blank (screenshot 1). | Low |
| A8 | **After selection the pickers keep a lot of room** (name, state, FIPS, Clear, View evidence on 5 lines). On screenshot 3 they push the real content down. | Medium |

### B. Reading the comparison

| # | Finding | Severity |
| --- | --- | --- |
| B1 | **No visual encoding at all.** Every comparison is text. The eye cannot tell which county is higher, by how much, or whether two values are similar. | High |
| B2 | **Wrong order of information.** Pickers → long status messages → evidence → overview counts last. A decision maker needs the "headline" first. | High |
| B3 | **Metadata is louder than data.** Each value repeats "Source … / Observation period … / Dataset vintage …" even when the answer is "unknown" (screenshot 3, every cell). Provenance is required by project rules, but it should be one tap away or shown once per section, not repeated per number. | High |
| B4 | **Possible data gap hidden by the repetition.** In screenshot 3 the review category and score both show all three provenance fields as "unknown". If that is real data behavior rather than a loading artifact, it is a **provenance problem to raise with the API/data teams**, not a layout problem. I could not tell which from code alone. | High (needs investigation) |
| B5 | **Seven or eight collapsed sections** look like a wall of headings. Only the first is open. Users must open each to find out whether it is useful. | High |
| B6 | **The four intelligence perspectives are the most "decision-like" content, but they are buried** in the middle, in a plain table, and each needs a click to understand. | High |
| B7 | **Raw IDs shown to users** (for example `case_count_floor_2023`, `scapularis_status`) under headings in "Additional observations". | Medium |
| B8 | **"Additional observations" is hard to understand.** It means "extra measures that did not line up with the main rows", which is an internal concept. The summary counts at the bottom only describe this group, so a user may think they describe the whole comparison. | High |
| B9 | **Repeated disclaimers.** "Not a rank against the other county" appears under each review label; "Full text for…" repeats per reason. Important once, noise ten times. | Medium |
| B10 | **Status messages stack up** (up to eight possible) and move the content as they come and go. | Medium |
| B11 | **Two different "partial data" experiences**: some failures show a yellow/red message with a retry button, some show text inside a cell ("Couldn't load this evidence."). | Low |
| B12 | **Labels are dense and technical**: "Minimum reported cases", "Social vulnerability percentile", "Rural-urban classification", "Borrelia burgdorferi status". These are accurate; they need a short plain-language line or an icon to scan quickly. | Medium |
| B13 | **No "what is different" view.** Epidemiologists want to know "where do these two counties diverge?" The page cannot filter to differences. | High |
| B14 | **No export or share-as-image.** The URL is shareable (good), but there is no copy/download of the comparison for a report or briefing. (Explorer has a download; Compare does not appear to.) | Medium |
| B15 | **Context is far from the number.** The "how dates and releases work" and "shared release limitations" notes sit at the bottom, while the numbers they qualify are near the top. | Medium |

### C. Accessibility, mobile, and reliability (things you did not ask about, but must be in the story)

| # | Finding | Severity |
| --- | --- | --- |
| C1 | **Accessibility baseline is decent** (labelled fields, table headings, live-region announcements for intelligence). Any chart we add **must have an equivalent text/table path** (project rule: no map- or chart-only answers). | Requirement |
| C2 | **Color must not carry meaning alone.** If charts use two county colors, pair them with labels or patterns. | Requirement |
| C3 | **Narrow screens.** The page switches the two columns to one column on small screens (inferred from the layout rules). A stack of 20 paired rows will be extremely long on a phone. | Medium |
| C4 | **Keyboard path.** The long sequence of expanders is many tab stops. Fewer, smarter sections help everyone. | Medium |
| C5 | **Layout shift.** Status messages and late-loading "additional observations" push content around. Reserve space or use skeletons. | Medium |

---

## 5. What we already have in our libraries (and in our own code)

This is the answer to "use our existing libraries".

**From shadcn/ui (already in `src/components/ui`):** `Badge`, `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Popover`, `Progress`, `Select`, `Sidebar`, `Slider`, `Table`, `Tooltip`.

**From Base UI (already installed, v1.7):** the primitives under shadcn. Base UI also publishes a **Combobox/Autocomplete** (type-to-search picker), **Tabs**, **Toggle/Toggle Group**, **Meter**, and **Accordion/Collapsible**. These are not yet wrapped in our component folder, so the first build step would be to add the shadcn-style wrappers. _(I could not open the installed package in this worktree to confirm exact names; the build story should confirm.)_

**From Lucide:** icons for status (for example check, alert, minus-circle, info), swap arrows, map pin, bug/tick-style metaphors, download, share.

**From Tailwind v4 / our tokens:** the priority colors already exist (urgent / review / watch / lower), plus spacing and type tokens.

**Our own visuals we can reuse instead of inventing new ones:**

- A **ring gauge** already used in the county surveillance card (`county-summary-surveillance-card.tsx`) for scores.
- A **contiguous-US silhouette** (`contiguous-us-silhouette.tsx`) that could host a small "where are these two counties" locator.
- **Ranked dots, scatterplot, grid, and comparison charts** in `features/geographic-explorer/charts.tsx` (hand-built SVG, on the older Geographic Explorer page).
- The **priority badge** used for review category.
- Explorer's **county search** logic (`explorer-county-reference.ts`, shows up to 8 matches; also filters by state and by "available data").

**A decision for you / the team:** there is **no charting library** installed (no Recharts, etc.). shadcn's official chart component is built on Recharts. Two options:

1. **Stay lean:** build 4 or 5 simple visuals (paired bars, dot plot, ring gauge, status chips) from SVG and `Progress`, as the project already does. Fastest, no new dependency, and consistent with the "lean development" rule.
2. **Adopt shadcn Chart (Recharts):** richer later, but a new dependency, which per `TECHNOLOGY_AND_GOVERNANCE.md` needs a recorded decision (ADR).

I recommend **option 1** for this story.

---

## 6. Part 1: Recommendations for finding and selecting the two counties

Design goal: **a user should be able to land with an intent ("compare Adair, OK with Abbeville, SC"), type it, and be looking at results in under 10 seconds**, without the system ever choosing for them.

### 6.1 Replace the dropdown with a type-to-search picker

- Use a **Combobox** (Base UI primitive, shadcn style): click, start typing, see matches immediately.
- Match on county name, state name, state abbreviation, and FIPS (so "OK", "Oklahoma", "Adair", or "40001" all work).
- Show matches as rows with: **county, state, and a small availability indicator** (see 6.4).
- Keep the Explorer search's "up to 8 results" feel, but add a "Show more" at the end instead of a hard cut.

### 6.2 Make state a first-class filter

- A small **State** chip/filter at the top of the picker ("All states" by default). Typing a state name sets it.
- Group results by state when "All states" is active so same-name counties are easy to tell apart.

### 6.3 Show both pickers at once, enabled from the start

- Both slots active, either order. This also lets a user start from the county they care about most.
- Visually present the pair as **"County A ⇄ County B"** with a **Swap** button between them (Lucide arrows icon). Useful because the left column is read first.
- Use a distinct, consistent **identity color/shape** per county (for example a filled circle for A and a ring for B) that carries through every chart and column below. Pair color with a letter (A / B) so it works for color-blind users.

### 6.4 Help people choose counties that have data (without choosing for them)

Atlas must not auto-pick the second county. We _can_ still help the user choose:

- In the picker list, show a small **data-coverage indicator** per county (for example three tiny dots for Human / Tick / Community, filled when Available, half when Limited, outline when Unavailable). Uses the existing Available / Limited / Unavailable words.
- A "Show only counties with…" quick filter reusing Explorer's "available data" filter.
- Optional "Counties you've looked at" list (from the Explorer selection and recent compare pairs in the URL/session). This is a convenience list, not a recommendation.

### 6.5 Make the selected state compact and confirming

Replace the five-line block under each picker with a **compact county chip**:

```
[A] Adair County, OK     FIPS 40001     [Monitor for changes]   [View evidence ↗]  [x]
```

- One line, not five.
- A tiny US-silhouette locator dot (reusing the existing silhouette) confirms _which_ Adair County.
- "View county evidence" becomes an icon-link on the chip.

### 6.6 Entry points and empty state

- When arriving from Explorer, show a quiet chip: **"From Explorer: Adair County, OK"** in slot A, and put the cursor in slot B. Keep the existing rule: Atlas does not choose B.
- When arriving with nothing selected, use the empty area for useful content instead of blank space: a **two-step visual** ("1 Choose County A → 2 Choose County B → 3 Read the comparison") and a short list of "Counties you've looked at" if any. No tutorials or tours (constitution).

### 6.7 Keep the pair visible while scrolling

- Make the pair chips a **sticky header** (a thin bar with A and B names and Swap/Clear) so the user always knows who they are comparing when deep in the results. This also fixes the "which column is which" problem on small screens.

### 6.8 Make loading calm

- Collapse the up-to-eight status messages into **one status area** with a single line ("Loading county records… 3 of 5 sections ready") and a small `Progress` bar, with errors summarized and a single "Retry" action.
- Show section skeletons so the page does not jump.

---

## 7. Part 2: Recommendations for displaying county information

Design goal: **"See the picture in 5 seconds; open detail only when you need it."** This is the visual-first shift.

### 7.1 New information hierarchy (top to bottom)

```
┌───────────────────────────────────────────────────────────────┐
│ [A] Adair, OK  ⇄  [B] Abbeville, SC        (sticky)   Share ▾ │
├───────────────────────────────────────────────────────────────┤
│ 1. AT A GLANCE   (one screen, no clicking)                    │
│    ┌─ A ───────────────┐   ┌─ B ───────────────┐              │
│    │ Review: Monitor   │   │ Review: Monitor   │              │
│    │ Score ◔ 40.8      │   │ Score ◔ 32.4      │              │
│    │ Human ● Tick ◐    │   │ Human ◐ Tick ○    │              │
│    └───────────────────┘   └───────────────────┘              │
│    Data confidence strip: where we know / where we don't      │
├───────────────────────────────────────────────────────────────┤
│ 2. FOUR PERSPECTIVES (visual cards, side by side)             │
├───────────────────────────────────────────────────────────────┤
│ 3. WHAT THE EVIDENCE SHOWS (Human | Ticks | Community)        │
│    paired bars / dot plots / status chips, row by row         │
│    [Show only differences]  [Show only gaps]                  │
├───────────────────────────────────────────────────────────────┤
│ 4. WHAT WE DON'T KNOW  (gaps + limitations, one place)        │
├───────────────────────────────────────────────────────────────┤
│ 5. DETAILS & PROVENANCE (collapsed, one table)   Ask Atlas ▸  │
└───────────────────────────────────────────────────────────────┘
```

Everything that is currently at the bottom (counts, limitations, period notes) moves up into the right place, and everything currently repeated per value moves down into one detail view.

### 7.2 "At a glance" cards (new)

One card per county using `Card`, `Badge`, `Progress`/ring gauge, and Lucide icons:

- **Review category** badge (existing priority colors), with the sentence "A review priority label, not a disease risk" shown **once** here.
- **Published review score** as the existing ring gauge (0 to 100), not a bare "40.8".
- **Three evidence-coverage dots** (Human, Tick/pathogen, Community) in the Available / Limited / Unavailable vocabulary.
- Never a "winner" highlight. Both cards are visually equal. Order is the user's order.

### 7.3 Replace the 4-row table with four **perspective cards**

For Gap Score, ML Review Priority, Surveillance Situation, Ecological Situation:

- One compact tile each, with a **mini visual** (gauge for the score, tier chip for ML priority, small icon + label for each "situation").
- A and B shown **side by side inside each tile**, with the A/B identity marker.
- A one-line plain-language question per tile ("Do human reports match ecological evidence?").
- Click opens the existing details in a side panel or dialog (reuse `Dialog`/`Popover`) instead of expanding a table.
- Keep the existing reviewed guide sentence ("these answer different questions and may differ") **once**, directly above the tiles.

### 7.4 Turn text rows into visual rows

Per measure, pick the visual that fits the data type. Same A/B colors/markers everywhere.

| Data type | Examples | Visual (existing parts) |
| --- | --- | --- |
| Numeric counts/rates | Minimum reported cases, incidence floor, population | **Paired horizontal bars** on a shared scale (`Progress` styled, or SVG), value label at bar end |
| Percentiles / 0-100 | Social vulnerability percentile, review score, uninsured % | **Dot-on-a-line** (0 to 100) with both counties' dots (the pattern from `RankedDots`) |
| Categories | Tick species status, pathogen status, rural-urban class | **Status chips** (`Badge` + Lucide icon: present / not detected / unknown), A and B aligned |
| Text | Review reasons, limitations | **Short bullet chips** with an expander for the full text |
| Missing | No published record | A clear **"No record" hatched bar** or chip, **never an empty bar that looks like zero** |

Rules to preserve (from governance): published zero is shown as a real zero value with a label; missing is shown as missing; no arrows or colors that imply "worse" or "better" between counties; no calculated difference on the county-record rows unless product approves it (see decision 3 below).

### 7.5 Group by the question, not by data system

Today: eight sections named after data sources. Proposed three **tabs** (Base UI Tabs / shadcn Tabs) or three always-visible sections:

1. **Human reporting** (cases, incidence, state-unallocated note)
2. **Ticks and pathogens** (species, pathogen, tick status)
3. **Community context** (population, SVI, uninsured, rural-urban)

Score components move into the "At a glance" gauge detail. "Additional observations" disappears as a heading: items either merge into the right group (when they match) or sit in a plain **"More measures"** list with human-readable names, never raw IDs.

### 7.6 Add two filters that match how epidemiologists think

- **Show only differences** (hide rows where both are the same).
- **Show only evidence gaps** (rows where either county is Limited/Unavailable).

These reuse `Toggle`/`Switch` styling and count results ("12 of 20 rows").

### 7.7 Provenance: move from "every number" to "one place, one tap"

- Show **source + period + vintage once per section** in a small caption line, only when they differ from the release default.
- The per-value "Sources and limitations" becomes a small **info icon** (`Popover`) next to the value, not a text link under it.
- A single **"Sources and methods" table** at the bottom lists every measure with source, period, vintage, and caveat for both counties. This keeps the project's provenance rule (source, retrieval time, geography, methodology/version, limitations stay retained and reachable) while removing the repetition.
- Never print "unknown" three times. If all three are unknown, show a single "Source details unavailable" chip. And raise the possible data issue in B4 with the data/API teams.

### 7.8 A "What we don't know" panel

Epidemiologists value gaps (this is the "Gap Atlas"). Combine now-scattered pieces into one panel:

- Per county: which measures are Unavailable / Limited and the stated reason (using existing reason codes).
- Shared release limitations and date/release rules (currently buried).
- The "A missing value is not zero" statement, once.

### 7.9 Summary counts: move up and fix their meaning

The "shared / differing / withheld" counts are useful, but only if they describe **the whole comparison**, and they should sit at the top of section 3 as a small summary strip with icons. Today they describe only the extra group.

### 7.10 Sharing and handoff

- **Copy link** (already supported by the URL) and **Download PNG/PDF snapshot** of the At a glance + evidence view, including release and limitations (so provenance travels with the screenshot).
- Keep "Ask Atlas about this comparison" but move it into the sticky header as a secondary action.

### 7.11 Small-screen behavior

- The sticky A/B header stays.
- At a glance: A and B cards stack, with the gauge first.
- Evidence rows: show one measure at a time as a mini card with both bars, rather than two long columns.

---

## 8. Things you didn't ask about but should plan for

1. **Accessibility parity.** Every visual needs a text equivalent (a "Table view" toggle is the simplest answer). Colors must not carry meaning alone; use A/B letters, shapes, and patterns.
2. **Do not imply risk or rank.** Gauges are a _review-priority label_, not risk. Use neutral A/B identity colors for county identity, and keep the existing priority colors only on the priority badge. Avoid red/green on comparisons.
3. **Performance.** The page requests data for each county separately (profile, evidence, and four intelligence views each). Skeleton states and parallel loading matter once visuals depend on the data.
4. **Analytics.** There is no obvious way today to know which sections users actually open. Add basic open/filter events (using the app's existing analytics helper) so the next round is evidence-based. Public analytics values must stay non-sensitive.
5. **Testing.** The page has many `data-testid` hooks that existing automated tests rely on. A redesign should plan test updates, and add visual (Storybook) examples for each new visual so designers/PMs can review without running the app.
6. **Print / report use.** Epidemiologists often paste into briefings. A print-friendly layout is cheap if planned early.
7. **Content design.** A short, consistent glossary of terms for the labels (for example what "Minimum reported cases" means) could live in the docs and be linked, not repeated inline (constitution bans a general tooltip/help system).
8. **Overlap with existing work.** Stories **#711** (Option A compact two-column selectors, approved), **#418** (Compare implementation), and **#511** (wireframe/visual acceptance) already cover parts of this. #711 and #418 are marked to ship together in one coordinated PR. Story #829 should be sequenced with them so we do not build two competing selectors.

---

## 9. Decisions needed from you (product)

1. **Chart approach:** lean SVG/`Progress` parts (recommended) or adopt shadcn Chart/Recharts (needs an ADR).
2. **Pickers:** approve moving from Select to a type-to-search Combobox. This revises the approved compact "Option A" selector design in #711, so confirm with the design owner.
3. **Show a difference?** Current rules say "no calculated difference" on county-record values. Epidemiologists will want to see magnitude. A paired-bar visual shows magnitude **without** printing a computed gap or verdict. Do you approve visual-only magnitude (no computed delta text)?
4. **Coverage dots in the picker:** approve showing per-county data coverage before selection (helps users, but needs the API to supply it cheaply for the whole directory; may require API work).
5. **Export:** is PNG/PDF export in scope for this story or a follow-up?
6. **B4 provenance "unknown":** who should investigate whether the "Source unknown / Observation period unknown" text in production is real data or a display problem?

---

## 10. Suggested way to break the work down

Proposed child stories/tasks under #829 (to create after you approve scope):

1. **Pair header and county picker** (type-to-search, state filter, swap, compact chips, sticky bar).
2. **At a glance cards** (review badge, ring gauge, coverage dots).
3. **Perspective cards** (replace the four-row table).
4. **Visual evidence rows** (paired bars, dot plot, status chips, missing-value treatment) with a Table-view toggle.
5. **Regroup into Human / Ticks / Community and remove raw IDs**; add "Show only differences / gaps" filters.
6. **Provenance consolidation** (info popovers, one sources table, "What we don't know" panel).
7. **Loading and error consolidation** (single status area, skeletons).
8. **Share/export** (optional).
9. **Investigation:** "unknown" provenance values in production (B4).
10. **Tests, Storybook, and accessibility verification** for all of the above.

---

## 11. Evidence: files I reviewed

All under `one-health-lyme-gap-atlas-web` (worktree `web-compare-ux-audit`):

- `src/app/compare/page.tsx` (page entry)
- `src/features/ux-reset/compare/reset-compare-experience.tsx` (main layout, picker slots, status strip, results, overview)
- `src/features/ux-reset/compare/compare-county-profile-section.tsx` (groups, paired values, reasons list)
- `src/features/ux-reset/compare/compare-compact-evidence.tsx` (value + provenance block)
- `src/features/ux-reset/compare/compare-surveillance-intelligence.tsx` (four-perspective table)
- `src/features/ux-reset/compare/compare-unified-rows.ts` and `compare-county-profile.ts` (which measures appear and their labels)
- `src/features/ux-reset/compare/use-compare-workspace.ts` (how the county list is built and sorted)
- `src/features/ux-reset/page-introduction*.ts(x)` (headline and intro copy)
- `src/features/ux-reset/surveillance-intelligence/*` (perspective names, wording, existing ring gauge)
- `src/features/ux-reset/review/explorer-county-toolbar.tsx`, `explorer-county-reference.ts` (existing county search to reuse)
- `src/features/geographic-explorer/charts.tsx`, `src/features/ux-reset/review/contiguous-us-silhouette.tsx` (existing visuals)
- `src/components/ui/*` (available shadcn components), `package.json` (Base UI, Lucide, no chart library)
- `docs/UX_RESET_CONSTITUTION.md` (product rules this redesign must follow)
